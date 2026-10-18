// Rules 28, 55, 79, 82; Purpose "the agent never administers its own safeguards" and its Value "the operator's approval
// remains the operator's act". The real GitHub client behind the review explicit-yes source: five REST operations and
// nothing else. It opens a request's pull request (create a ref, put the request file, create the pull request), reads
// the pull request and its reviews, and closes a lapsed one. It has NO operation that submits, approves or dismisses a
// review: with shared access to the operator's account, not approving as the operator is the agent's duty, and this
// client cannot express the act. It authenticates with the agent's own token (the launcher reads it from
// INSTAR_SECRET_PREVIEW_GITHUB_TOKEN), never the operator's. The network is the injected `http` port. It reaches no
// model, so it sits outside the launcher's model-call recording boundary (Rules 41, 75) by design.
import type { GitHubReview, GitHubReviewClient } from './review-yes-source.js';

type Http = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
const API = 'https://api.github.com';
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;

export function createGitHubReviewClient(options: { token: string; http: Http; timeoutMs?: number;
  signal?(ms: number): AbortSignal | undefined }): GitHubReviewClient {
  if (!options.token || /\s/u.test(options.token)) throw Error('preview: GitHub token unavailable');
  const call = async (method: string, path: string, body?: unknown): Promise<Record<string, unknown>> => {
    const signal = options.signal?.(options.timeoutMs ?? 20_000);
    const response = await options.http(`${API}${path}`, { method, headers: { Authorization: `Bearer ${options.token}`,
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'instar-preview',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...(signal ? { signal } : {}) });
    // The status alone is carried: a response body could echo request content back into a log.
    if (!response.ok) throw Error(`GitHub ${method} ${path.split('?')[0]} answered ${String(response.status)}`);
    const value = await response.json();
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  };
  const repo = (repository: string) => {
    if (!REPOSITORY.test(repository)) throw Error('preview: invalid repository');
    return `/repos/${repository}`;
  };
  const number = (n: number) => { if (!Number.isSafeInteger(n) || n <= 0) throw Error('preview: invalid pull request'); return String(n); };
  const client: GitHubReviewClient = {
    async openRequest(input) {
      const base = repo(input.repository);
      const branch = String((await call('GET', base)).default_branch ?? '');
      if (!branch) throw Error('GitHub: no default branch');
      const ref = await call('GET', `${base}/git/ref/heads/${encodeURIComponent(branch)}`);
      const sha = String((ref.object as Record<string, unknown> | undefined)?.sha ?? '');
      await call('POST', `${base}/git/refs`, { ref: `refs/heads/${input.branch}`, sha });
      await call('PUT', `${base}/contents/${input.path.split('/').map(encodeURIComponent).join('/')}`,
        { message: input.title, content: Buffer.from(input.content, 'utf8').toString('base64'), branch: input.branch });
      const pull = await call('POST', `${base}/pulls`, { title: input.title, head: input.branch, base: branch, body: input.body });
      return { number: Number(pull.number), head: String((pull.head as Record<string, unknown> | undefined)?.sha ?? '') };
    },
    async pullRequest(repository, n) {
      const pull = await call('GET', `${repo(repository)}/pulls/${number(n)}`);
      return { body: typeof pull.body === 'string' ? pull.body : '', head: String((pull.head as Record<string, unknown> | undefined)?.sha ?? '') };
    },
    async reviews(repository, n) {
      const items: unknown = await call('GET', `${repo(repository)}/pulls/${number(n)}/reviews?per_page=100`);
      if (!Array.isArray(items)) throw Error('GitHub: reviews is not a list');
      return items.map((item: Record<string, unknown>): GitHubReview => ({ id: String(item.id ?? ''), state: String(item.state ?? ''),
        commitId: String(item.commit_id ?? ''), login: String((item.user as Record<string, unknown> | undefined)?.login ?? ''),
        submittedAt: String(item.submitted_at ?? '') }));
    },
    async closeRequest(repository, n) { await call('PATCH', `${repo(repository)}/pulls/${number(n)}`, { state: 'closed' }); },
  };
  return Object.freeze(client);
}

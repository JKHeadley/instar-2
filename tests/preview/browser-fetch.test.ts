// The existing native executor through real tool-turn admission and journal capture.
// The continuing harness live proof remains the Studio desk's responsibility.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openPreviewJournal } from './journal.js';
// @ts-expect-error Physical host module.
import { runToolTurn } from './tool-turn.mjs';
// @ts-expect-error Physical host module.
import { runNativeLoop } from './native-loop.mjs';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const captured = JSON.parse(readFileSync(new URL('./fixtures/browser-gap-1017.json', import.meta.url), 'utf8'));
async function readPage(fetcher: typeof fetch) {
  const root = realpathSync(mkdtempSync('/tmp/browser-fetch-')); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(9), { kind: 'genesis',
    bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9_999_999_999_999, maxCalls: 40, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  const prepared = JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5', messages: [{ role: 'user', content: captured.walk.textSent }] });
  let state = '', returned = '';
  const result = await runToolTurn({ journal, root, id: 'telegram:12345678:update:7', prepared, promptLimit: 32768,
    deniedRoots: [root], operations: [], now: () => 1, redactText: (text: string) => text,
    scratch: (turn: string) => { mkdirSync(join(turn, 'vol')); return realpathSync(join(turn, 'vol')); }, detach: () => true,
    fallback: async () => { throw Error('unexpected text-only fallback'); },
    invoke: async (turn: { stateDirectory: string }) => {
      state = turn.stateDirectory;
      return runNativeLoop({ turn, prepared, promptLimit: 32768, maxSteps: 2, stopped: () => false, fetch: fetcher,
        resources: { execute: () => { throw Error('a web read must not launch a shell worker'); } },
        step: async (envelope: string, index: number) => {
          if (index === 0) return { state: 'complete', value: JSON.stringify({ calls: [{ tool: 'WebFetch', input: { url: captured.publicPage.url } }] }) };
          returned = envelope;
          return { state: 'complete', value: 'Recorded fetch result received; no sign-in claimed.' };
        } });
    } });
  const records = readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  expect(records.find(row => row.phase === 'pre')).toMatchObject({ tool: 'WebFetch', decision: 'allow' });
  const output = JSON.parse(records.find(row => row.phase === 'post').result);
  expect(returned).toContain(String(output.status));
  return { output, result };
}
it.each([200, 401, 302])('returns public page status %s without claiming account access or following redirects', async status => {
  let calls = 0;
  const fake = (async (_url: unknown, init: RequestInit) => {
    calls++; expect(init).toMatchObject({ method: 'GET', redirect: 'manual' });
    return new Response(captured.publicPage.body, { status, headers: { 'content-type': 'text/html', ...(status === 302 ? { location: '/login' } : {}) } });
  }) as typeof fetch;
  const { output } = await readPage(fake);
  expect(calls).toBe(1); expect(output.status).toBe(status);
  expect(output.body).toBe(captured.publicPage.body);
  if (status === 302) expect(output.location).toBe('/login');
});
it.runIf(process.env.INSTAR_BROWSER_LIVE_READ === '1')('fetches the public example page through the real executor and admission hook', async () => {
  const { output } = await readPage(fetch);
  expect(output.status).toBe(200); expect(output.body).toContain('<title>Example Domain</title>');
}, 40000);

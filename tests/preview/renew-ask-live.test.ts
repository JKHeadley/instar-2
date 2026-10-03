import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conclusionText, parseModelJson } from './model-json.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { createJournalWorker, openPreviewJournal, previewTestContext } from './journal-test-worker.js';
import { OPERATOR_ACTION_GUIDANCE, OPERATOR_ACTION_UNREAD, raiseJournalCaps } from './journal.js';
import { createReviewYesSource, type GitHubReview, type GitHubReviewClient } from './review-yes-source.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY } from '../../src/assembly/production-provider.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';

// Plan row #362 (Rules 3, 79, 82, 106; observer #106). Live on the operator's preview (cint-L36 4228d0c5) an explicit
// renewal ask opened no request twice (updates 969390030, 969390031) while a raise in the same chat opened fine. The
// fixture holds the REAL model outputs on those turns' recorded envelopes: on 969390031 the model wrote
// operatorAction {action:"renew-expiry", requestedEnd:"2026-10-12T20:40:00Z"}, a field the guidance never offered and
// the strict reader refuses, so nothing was proposed while the reply said it was "passing along" a request below. The
// replay runs each recorded output through the live port's own extraction into the wired P-05 review route on a root
// shaped like the live one: trial end 2026-10-05 20:40, the reviewed 2026-10-12 activation installed.
const FIXTURE = 'tests/preview/fixtures/renew-ask-live-2026-10-03.json';
type Output = { update: number; guidance: 'recorded' | 'revised'; run: string; now: number; message: string; raw: string };
const outputs = (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { outputs: Output[] }).outputs;
const key = new Uint8Array(32).fill(43);
const OPERATOR = 7812716706, REPO = 'JKHeadley/instar-2', HEAD = 'b'.repeat(40), TRIAL = 'grant:preview';
const installation: ExplicitYesInstallation = { adapter: 'github-api', machine: 'studio', installation: TRIAL, agentSpeaksAsOperatorInChat: true,
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: false },
  github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false,
    acceptance: { account: 'JKHeadley', installation: TRIAL, operatorMessages: ['telegram:chat:7812716706:message:121804'], acceptedAt: 500, withdrawn: null } } };
const RENEWAL = `sha256:${'6'.repeat(64)}`;
type Usage = { inputTokens: null; outputTokens: null; charge: null };
type Answer = { state: 'complete'; text: string; usage: Usage } | { state: 'complete'; failureClass: 'malformed'; usage: Usage };
/** What journal-agent's invokeSubscription hands the worker for a complete subscription result. */
function livePort(raw: string): Answer {
  const extracted = parseModelJson(raw, { wrapped: 'accept' });
  const decision = extracted.ok ? extracted.value as { type?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision as Parameters<typeof decisionWithinFloor>[0]) ? conclusionText(decision.conclusion.value) : null;
  const usage = { inputTokens: null, outputTokens: null, charge: null } as const;
  return value === null ? { state: 'complete', failureClass: 'malformed', usage } : { state: 'complete', text: value, usage };
}

/** One operator turn on a fresh root shaped like the live one; `answer` is the operator turn's model output. */
async function turn(now: number, message: string, answer: () => Answer | string, limits = { maxCalls: 40, maxReplies: 40, maxTurns: 40 }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-renew-ask-')));
  try {
    const g = { kind: 'genesis' as const, bot: '8820318295', chat: String(OPERATOR), operator: String(OPERATOR), grant: TRIAL,
      configurationDigest: 'sha256:offline', expires: SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY, maxCalls: 16, maxReplies: 16, maxTurns: 20,
      maxBytes: 409600, cursor: 0 };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, g);
    if (limits.maxCalls !== g.maxCalls) raiseJournalCaps(journal, { ...limits, authority: 'operator-host:test', at: now - 3_600_000 });
    const opened: { body: string }[] = [], reviews: GitHubReview[] = [], sent: string[] = [], contexts: string[] = [];
    let clock = now;
    const client: GitHubReviewClient = {
      async openRequest(input) { opened.push({ body: input.body }); return { number: 145, head: HEAD }; },
      async pullRequest() { return { body: opened.at(-1)?.body ?? '', head: HEAD }; },
      async reviews() { return [...reviews]; }, async closeRequest() {} };
    const review = createReviewYesSource({ client, installation: () => installation, repository: REPO, context: previewTestContext,
      now: () => clock, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } });
    const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false, checkOutbound: () => {},
      explicitYes: { context: previewTestContext, installation: () => installation, review,
        renewalActivation: (expires: number) => expires === SUBSCRIPTION_PREVIEW_EXPIRY ? RENEWAL : null },
      model: async input => { if (!input.id.startsWith('telegram:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
        contexts.push(input.context); return answer(); },
      send: async input => { sent.push(input.expectedText); return 1000 + sent.length; } });
    worker.intake([{ update_id: 969390031, message: { message_id: 1012, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR },
      text: message, date: Math.floor(now / 1000) } }]);
    await worker.drain();
    const asked = journal.view.order.at(-1)!;
    const result = { sent: [...sent], contexts, opened: opened.length, operatorAction: asked.operatorAction,
      requests: journal.view.operatorRequests.map(item => ({ action: item.request.action, expires: item.request.expires, limits: item.request.limits,
        review: item.review })) };
    // The operator approves the pull request at the link: the renewal applies to the reviewed end, once.
    let applied: { expires: number; line: string | undefined } | undefined;
    if (journal.view.operatorRequests.length) {
      reviews.push({ id: '901', state: 'APPROVED', commitId: HEAD, login: 'JKHeadley', submittedAt: new Date(now + 60_000).toISOString() });
      clock = now + 120_000; await worker.minimal();
      applied = { expires: journal.view.expires, line: sent.at(-1) };
    }
    journal.close();
    return { ...result, applied };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('fails closed and truthfully on the recorded 969390031 output: no request, and no reply claiming one follows (Rule 3)', async () => {
  const recorded = outputs.find(item => item.update === 969390031 && item.guidance === 'recorded')!;
  expect(JSON.parse(recorded.raw).conclusion.value.operatorAction).toEqual({ action: 'renew-expiry', requestedEnd: '2026-10-12T20:40:00Z' });
  const result = await turn(recorded.now, recorded.message, () => livePort(recorded.raw));
  expect(result.requests).toEqual([]);
  expect(result.opened).toBe(0);
  expect(result.sent).toHaveLength(1);
  // The model's reply was written for a request that does not exist; it is replaced by the fixed line, never sent beside it.
  expect(result.sent[0]).toContain(OPERATOR_ACTION_UNREAD);
  expect(result.sent[0]).not.toMatch(/passing along|proposed request|below/iu);
});

it('opens the renewal request with its working approval link on every recorded clean output, and applies it on approval', async () => {
  const clean = outputs.filter(item => JSON.stringify(JSON.parse(item.raw).conclusion.value.operatorAction) === '{"action":"renew-expiry"}');
  // Both sides of the guidance: the recorded envelope (969390030, twice) and the revised wording (969390031, twice).
  expect(clean.map(item => `${item.update}/${item.guidance}`).sort())
    .toEqual(['969390030/recorded', '969390030/recorded', '969390031/revised', '969390031/revised']);
  for (const item of clean) {
    const label = `${item.update} ${item.guidance} ${item.run}`;
    const result = await turn(item.now, item.message, () => livePort(item.raw));
    expect(result.requests, label).toEqual([{ action: 'renew-expiry', expires: SUBSCRIPTION_PREVIEW_EXPIRY, limits: undefined,
      review: { repository: REPO, pullRequest: 145, head: HEAD } }]);
    expect(result.sent[0], label).toContain('extend this trial\'s end from 2026-10-05 20:40 UTC to 2026-10-12 20:40 UTC');
    expect(result.sent[0], label).toContain(`open https://github.com/${REPO}/pull/145/files and approve the pull request`);
    expect(result.applied, label).toMatchObject({ expires: SUBSCRIPTION_PREVIEW_EXPIRY });
    expect(result.applied!.line, label).toContain('is done: extended this trial\'s end from 2026-10-05 20:40 UTC to 2026-10-12 20:40 UTC');
  }
});

it('sends the revised renewal guidance: the field shape names no end, and operatorRequest is never the model\'s field', async () => {
  expect(OPERATOR_ACTION_GUIDANCE).toContain('or exactly {action:"renew-expiry"} with no other field (the runner fills in the one reviewed end, whatever end they named).');
  expect(OPERATOR_ACTION_GUIDANCE).toContain('operatorRequest is the runner\'s record, never a field you return.');
  const result = await turn(1791017079850, 'please renew my trial', () => JSON.stringify({ reply: 'ok' }));
  expect(result.contexts[0]).toContain('with no other field');
});

it('treats a request the model writes under the runner\'s operatorRequest name as unreadable, never silently dropped (Rule 2)', async () => {
  const result = await turn(1791016980055, 'please renew my trial so it ends on 2026-10-12.', () => JSON.stringify({
    reply: 'I\'m passing this along below as a proposed request rather than treating it as done.', operatorRequest: { action: 'renew-expiry' } }));
  expect(result.requests).toEqual([]);
  expect(result.sent[0]).toContain(OPERATOR_ACTION_UNREAD);
  expect(result.sent[0]).not.toMatch(/passing this along/u);
  // The other side: an answer with no operator field at all proposes nothing and says nothing about a request.
  const plain = await turn(1791016980055, 'what is the weather like?', () => JSON.stringify({ reply: 'I cannot see the weather from here.' }));
  expect(plain.requests).toEqual([]);
  expect(plain.sent[0]).not.toContain(OPERATOR_ACTION_UNREAD);
});

it('proposes a useful raise for the recorded "step" ask on a root already raised far above its original allowance', async () => {
  // Update 969390029's journaled proposal, on limits like the live root's (2,500 after host raises; original allowance 16).
  const result = await turn(1791016388306, 'please raise my model-call limit.', () => JSON.stringify({ reply: 'I can ask for that.',
    operatorAction: { action: 'raise-caps', limits: { maxCalls: 'step' } } }), { maxCalls: 2500, maxReplies: 2500, maxTurns: 2500 });
  expect(result.requests).toEqual([expect.objectContaining({ action: 'raise-caps', limits: { maxCalls: 5000, maxReplies: 2500, maxTurns: 2500 } })]);
  expect(result.sent[0]).toContain('raise the model-call allowance from 2500 to 5000 (2500 more model calls)');
  // Bounded: a named number past one doubling is refused with the most it may be, and nothing changes.
  const over = await turn(1791016388306, 'raise my model-call limit to 9000.', () => JSON.stringify({ reply: 'I can ask for that.',
    operatorAction: { action: 'raise-caps', limits: { maxCalls: 9000 } } }), { maxCalls: 2500, maxReplies: 2500, maxTurns: 2500 });
  expect(over.requests).toEqual([]);
  expect(over.sent[0]).toContain('one raise may add at most 2500 to the model-call allowance, so 9000 is out of bounds (the most is 5000)');
  // At the original allowance a step is the same +16 it always was.
  const fresh = await turn(1791016388306, 'please raise my model-call limit.', () => JSON.stringify({ reply: 'I can ask for that.',
    operatorAction: { action: 'raise-caps', limits: { maxCalls: 'step' } } }), { maxCalls: 16, maxReplies: 16, maxTurns: 20 });
  expect(fresh.requests).toEqual([expect.objectContaining({ limits: { maxCalls: 32, maxReplies: 16, maxTurns: 20 } })]);
});

import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createJournalWorker, openPreviewJournal, previewTestContext, OPERATOR_REVIEW_REQUEST_GUIDANCE } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SOURCE_PINS, sourcePacket } from './briefing.js';
import { selfStateBrief, selfStateSource } from './self-state.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { createReviewYesSource, type GitHubReview, type GitHubReviewClient } from './review-yes-source.js';
import { subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { SHARED_ACCESS_NOTE } from '../../src/operator/explicit-yes.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';

// cint-L32 (plan rows #306, #307; observer #106): w3-yeswire changed model-facing text on the P-05 review route -- the
// review request guidance (OPERATOR_REVIEW_REQUEST_GUIDANCE), the open-request state naming its link and that a chat
// "yes" does not approve it, and the approved-state shared-access suffix -- and could not sample a real model on the
// Laptop. The gated capture below ran the production conversation framing (subscriptionConversationPolicy,
// claude-sonnet-5, thinking off) on prepared packets from fresh offline roots configured for the review route with the
// operator's recorded acceptance, and stored every output verbatim in the fixture (six calls in all). The replay, which
// always runs, feeds those outputs through the live port's own extraction into the worker and shows the path fires on
// them and stays silent on the other side. Re-capture: INSTAR_REVIEW_YES_LIVE=1 with one scenario per process (-t).
const FIXTURE = resolve(process.cwd(), 'tests/preview/fixtures/review-yes-live-2026-10-02.json');
const MODEL = 'claude-sonnet-5';
const OPERATOR = 7654321, REPO = 'JKHeadley/instar-2', HEAD = 'e'.repeat(40), TRIAL = 'grant:preview';
const key = new Uint8Array(32).fill(31);
const installation: ExplicitYesInstallation = { adapter: 'github-api', machine: 'studio', installation: TRIAL, agentSpeaksAsOperatorInChat: true,
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: false },
  github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false,
    acceptance: { account: 'JKHeadley', installation: TRIAL, operatorMessages: ['telegram:chat:7812716706:message:121804'], acceptedAt: 500, withdrawn: null } } };
type Scenario = 'raise-ask' | 'unrelated' | 'chat-yes' | 'status-open' | 'status-applied';
type Recorded = { scenario: Scenario; run: number; now: number; message: string; promptSha256: string; raw: string };
const MESSAGES: Record<Scenario, string> = {
  'raise-ask': 'I keep running out of model calls in this trial. Can you raise that limit for me?',
  unrelated: 'Should I bring an umbrella to a picnic if the sky looks grey this afternoon?',
  'chat-yes': 'yes',
  'status-open': 'Did that limit raise go through yet?',
  'status-applied': 'Did that limit raise go through yet?' };

/** What journal-agent's invokeSubscription hands the worker for a complete subscription result. */
function livePort(raw: string) {
  const extracted = parseModelJson(raw, { wrapped: 'accept' });
  const decision = extracted.ok ? extracted.value as { type?: unknown; floor?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete' as const, failureClass: 'malformed' as const, usage: { inputTokens: null, outputTokens: null, charge: null } }
    : { state: 'complete' as const, text: value, usage: { inputTokens: null, outputTokens: null, charge: null } };
}
/** The production framing on one prepared envelope, outside this session's own harness variables. */
function callModel(prepared: string): string {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('CLAUDE_CODE_') && name !== 'CLAUDECODE'));
  const run = spawnSync('/usr/local/bin/claude', [...subscriptionConversationPolicy(MODEL).args], { input: prepared, encoding: 'utf8',
    timeout: 170_000, env: { ...env, MAX_THINKING_TOKENS: '0' }, maxBuffer: 4 * 1024 * 1024 });
  const frame = JSON.parse(run.stdout) as { result?: unknown };
  if (typeof frame.result !== 'string') throw Error(`model frame without result: ${run.stdout.slice(0, 300)}`);
  return frame.result;
}

/** One scenario on a fresh review-route root; `answer` supplies the operator turn's answer. */
async function scenario(name: Scenario, now: number, answer: (prepared: string) => string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-yes-live-')));
  try {
    const g = { kind: 'genesis' as const, bot: '12345678', chat: String(OPERATOR), operator: String(OPERATOR), grant: TRIAL,
      configurationDigest: 'sha256:offline', expires: now + 86_400_000, maxCalls: 40, maxReplies: 40, maxTurns: 40, maxBytes: 65536, cursor: 0 };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, g);
    const sources = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
      { providerAttempts: g.maxCalls, expiresAt: g.expires }).sources;
    const opened: string[] = [], reviews: GitHubReview[] = [];
    const client: GitHubReviewClient = {
      async openRequest(input) { opened.push(input.body); return { number: 40 + opened.length, head: HEAD }; },
      async pullRequest() { return { body: opened.at(-1) ?? '', head: HEAD }; },
      async reviews() { return [...reviews]; },
      async closeRequest() { /* nothing lapses here */ } };
    const review = createReviewYesSource({ client, installation: () => installation, repository: REPO, context: previewTestContext,
      now: () => now, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } });
    const sent: { text: string; id: number }[] = [], prompts: string[] = [];
    let operatorTurn = false, next = 500;
    const runs = { launches: [{ at: now - 60_000, pid: 1 }], exits: [] };
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      sources: () => [...sources, selfStateSource(selfStateBrief(journal.view, runs as never, now, 'UTC', now - 60_000))],
      prepareModel: input => prepareJournalEnvelope(input, MODEL, g.grant, now, g.maxBytes),
      explicitYes: { context: previewTestContext, installation: () => installation, review },
      model: async input => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator is trying the preview.', people: [] });
        if (!operatorTurn) return JSON.stringify({ reply: 'I can ask you for that.', memory: [],
          operatorAction: { action: 'raise-caps', limits: { maxCalls: 80 } } });
        prompts.push(String(input.prepared ?? ''));
        return livePort(answer(String(input.prepared ?? '')));
      },
      send: async input => { next += 1; sent.push({ text: input.expectedText, id: next }); return next; }, checkOutbound: () => {} });
    const say = async (update: number, messageId: number, text: string) => {
      worker.intake([{ update_id: update, message: { message_id: messageId, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR },
        text, date: Math.floor(now / 1000) } }]);
      await worker.drain();
    };
    // The follow-up scenarios start from a review request already proposed (stub answer) and sent with its link.
    if (name !== 'raise-ask' && name !== 'unrelated') await say(1, 100, 'Please raise my model-call limit to 80.');
    if (name === 'status-applied') {
      reviews.push({ id: '901', state: 'APPROVED', commitId: HEAD, login: 'JKHeadley', submittedAt: new Date(now).toISOString() });
      await worker.minimal();
    }
    operatorTurn = true;
    await say(2, (sent.at(-1)?.id ?? 100) + 1, MESSAGES[name]);
    const turn = journal.view.order.at(-1)!;
    const result = { prompt: prompts.at(-1) ?? '', reply: sent.at(-1)?.text ?? '', operatorAction: turn.operatorAction, opened: opened.length,
      requests: journal.view.operatorRequests.map(item => ({ action: item.request.action, limits: item.request.limits, review: item.review !== undefined,
        approved: item.approved !== undefined, applied: item.applied === true, refusals: item.refusals.length })),
      maxCalls: journal.view.limits.maxCalls, held: turn.held };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

const live = process.env.INSTAR_REVIEW_YES_LIVE === '1';
for (const name of Object.keys(MESSAGES) as Scenario[]) {
  it.skipIf(!live)(`captures the real answer model on ${name}`, async () => {
    const recorded: Recorded[] = existsSync(FIXTURE) ? (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { outputs: Recorded[] }).outputs : [];
    const now = Date.now();
    let raw = '';
    const result = await scenario(name, now, prepared => { raw = callModel(prepared); return raw; });
    expect(raw, 'the model call produced no output; nothing is recorded').not.toBe('');
    recorded.push({ scenario: name, run: recorded.filter(item => item.scenario === name).length + 1, now, message: MESSAGES[name],
      promptSha256: createHash('sha256').update(result.prompt).digest('hex'), raw });
    writeFileSync(FIXTURE, `${JSON.stringify({ source: FIXTURE_SOURCE, model: MODEL, outputs: recorded }, null, 2)}\n`);
  }, 190_000);
}
const FIXTURE_SOURCE = 'Captured by tests/preview/review-yes-live.test.ts (cint-L32, Mac Studio, 2026-10-02) with INSTAR_REVIEW_YES_LIVE=1: '
  + 'the production conversation framing (subscriptionConversationPolicy, --system-prompt SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, '
  + 'MAX_THINKING_TOKENS=0) on prepared packets from fresh offline roots configured for the P-05 review route with a current '
  + 'recorded acceptance, the real briefing sources and a fake GitHub client. `raw` is the model\'s output (the CLI JSON frame\'s '
  + 'result field) verbatim; promptSha256 is the prepared envelope it answered. No live preview root was read or written.';

const recorded = existsSync(FIXTURE) ? (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { outputs: Recorded[] }).outputs : [];
it('replays every recorded real answer on the review route: the path fires where it should and nowhere else', async () => {
  expect(recorded.length).toBeGreaterThanOrEqual(5);
  for (const name of Object.keys(MESSAGES) as Scenario[]) expect(recorded.some(item => item.scenario === name), name).toBe(true);
  for (const item of recorded) {
    const result = await scenario(item.scenario, item.now, () => item.raw);
    const label = `${item.scenario} run ${item.run}`;
    expect(result.held, label).toBeUndefined();
    expect(result.reply.length, label).toBeGreaterThan(0);
    if (item.scenario === 'chat-yes' || item.scenario === 'status-open') {
      // The model saw the review route's own guidance and request state.
      expect(result.prompt, label).toContain(OPERATOR_REVIEW_REQUEST_GUIDANCE.trim().slice(0, 60));
    }
    if (item.scenario === 'raise-ask') {
      // A plain ask for more calls: the model proposed a raise and the runner opened ONE review request with its link.
      expect(result.operatorAction?.action, label).toBe('raise-caps');
      expect(result.requests, label).toEqual([expect.objectContaining({ action: 'raise-caps', review: true, approved: false })]);
      expect(result.opened, label).toBe(1);
      expect(result.reply, label).toContain(`https://github.com/${REPO}/pull/41/files`);
      expect(result.maxCalls, label).toBe(40);
    }
    if (item.scenario === 'unrelated') {
      expect(result.operatorAction, label).toBeUndefined();
      expect(result.requests, label).toEqual([]);
      expect(result.opened, label).toBe(0);
    }
    if (item.scenario === 'chat-yes' || item.scenario === 'status-open') {
      // A chat "yes" is not the operator's yes here: nothing applied, no second request, the limit unchanged.
      expect(result.requests, label).toEqual([expect.objectContaining({ approved: false, applied: false })]);
      expect(result.opened, label).toBe(1);
      expect(result.maxCalls, label).toBe(40);
      expect(result.operatorAction, label).toBeUndefined();
    }
    if (item.scenario === 'status-applied') {
      // The applied approval stays in the packet with its disclosure for an hour, and the delivered status report displays
      // it with the disclosure even though this recorded answer did not write it (Purpose, the approval-account exception).
      // The answer was captured against the earlier packet; the runner, not the model, adds the disclosure line.
      expect(result.prompt, label).toContain(SHARED_ACCESS_NOTE);
      expect(result.reply, label).toContain('it went through');
      expect(result.reply, label).toMatch(new RegExp(`approved through your GitHub account; note: ${SHARED_ACCESS_NOTE}\\.$`, 'u'));
      expect(result.requests, label).toEqual([expect.objectContaining({ approved: true, applied: true })]);
      expect(result.maxCalls, label).toBe(80);
      expect(result.operatorAction, label).toBeUndefined();
    }
  }
}, 60_000);

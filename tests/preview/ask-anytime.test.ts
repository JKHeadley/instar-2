import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createJournalWorker, limitsNear, openPreviewJournal, previewTestContext, NO_YES_SOURCE,
  OPERATOR_ACTION_GUIDANCE } from './journal-test-worker.js';
import { explicitYesStatus } from './operator-yes.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SOURCE_PINS, sourcePacket } from './briefing.js';
import { selfStateBrief, selfStateSource } from './self-state.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { parseExplicitYesInstallation } from './explicit-yes-installation.js';
import { createReviewYesSource, type GitHubReviewClient } from './review-yes-source.js';
import { subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';

// Plan row #349. Live 2026-10-02 22:36 PDT on the operator's preview (build cint-L34 98ba391b, both phone actions
// connected and admissible): "Please raise my model-call limit." (journal turn update 969390016) was answered "I can't
// raise my own model-call limit -- that's not something I have authority or tools to change myself". The proposal
// guidance rode only near a limit; calls were 1,1xx of 2,000 and the end 63 hours away, so the packet carried no route
// and the answer denied a capability the runner has (Rules 3, 79). The guidance now rides whenever an explicit-yes
// source is admissible on the root. These tests hold both sides of that decision on fresh roots, then replay the
// recorded live turn (from a COPY of the live root) and the real answer model's outputs on it.

const OPERATOR = 7654321, REPO = 'JKHeadley/instar-2', HEAD = 'e'.repeat(40), TRIAL = 'grant:preview';
const key = new Uint8Array(32).fill(23);
const HOUR = 3_600_000;
const reviewRoute: ExplicitYesInstallation = { adapter: 'github-api', machine: 'studio', installation: TRIAL, agentSpeaksAsOperatorInChat: true,
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: false },
  github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false,
    acceptance: { account: 'JKHeadley', installation: TRIAL, operatorMessages: ['telegram:chat:7654321:message:1'], acceptedAt: 500, withdrawn: null } } };
const chatRoute: ExplicitYesInstallation = { ...reviewRoute, agentSpeaksAsOperatorInChat: false,
  chat: { ...reviewRoute.chat, agentHoldsNoAccess: true }, github: null };
const withdrawn: ExplicitYesInstallation = { ...reviewRoute,
  github: { ...reviewRoute.github!, acceptance: { ...reviewRoute.github!.acceptance!, withdrawn: 600 } } };

/** What journal-agent's invokeSubscription hands the worker for a complete subscription result. */
function livePort(raw: string) {
  const extracted = parseModelJson(raw, { wrapped: 'accept' });
  const decision = extracted.ok ? extracted.value as { type?: unknown; floor?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete' as const, failureClass: 'malformed' as const, usage: { inputTokens: null, outputTokens: null, charge: null } }
    : { state: 'complete' as const, text: value, usage: { inputTokens: null, outputTokens: null, charge: null } };
}

type Setup = { installation?: ExplicitYesInstallation; expiresIn: number; message: string };
/** One operator message on a fresh root with 2,000-call limits; returns the answer packet and what the runner did. */
async function turnOn(setup: Setup, now = 1_791_005_770_285) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-ask-anytime-')));
  try {
    const g = { kind: 'genesis' as const, bot: '12345678', chat: String(OPERATOR), operator: String(OPERATOR), grant: TRIAL,
      configurationDigest: 'sha256:offline', expires: now + setup.expiresIn, maxCalls: 2000, maxReplies: 2000, maxTurns: 2000,
      maxBytes: 65536, cursor: 0 };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, g);
    const sources = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
      { providerAttempts: g.maxCalls, expiresAt: g.expires }).sources;
    const opened: string[] = [];
    const client: GitHubReviewClient = {
      async openRequest(input) { opened.push(input.body); return { number: 40 + opened.length, head: HEAD }; },
      async pullRequest() { return { body: opened.at(-1) ?? '', head: HEAD }; },
      async reviews() { return []; }, async closeRequest() { /* nothing lapses here */ } };
    const installation = setup.installation;
    const review = installation && createReviewYesSource({ client, installation: () => installation, repository: REPO,
      context: previewTestContext, now: () => now, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } });
    const prompts: string[] = [], sent: string[] = [];
    const runs = { launches: [{ at: now - 60_000, pid: 1 }], exits: [] };
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      sources: () => [...sources, selfStateSource(selfStateBrief(journal.view, runs as never, now, 'UTC', now - 60_000))],
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', g.grant, now, g.maxBytes),
      ...(installation && review ? { explicitYes: { context: previewTestContext, installation: () => installation, review } } : {}),
      model: async input => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator is trying the preview.', people: [] });
        prompts.push(String(input.prepared ?? ''));
        return JSON.stringify({ reply: 'A short preview answer.', memory: [] });
      },
      send: async input => { sent.push(input.expectedText); return sent.length + 100; }, checkOutbound: () => {} });
    worker.intake([{ update_id: 9, message: { message_id: 200, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR },
      text: setup.message, date: Math.floor(now / 1000) } }]);
    await worker.drain();
    const turn = journal.view.order.at(-1)!;
    const prompt = prompts.at(-1) ?? '';
    const capability = String((JSON.parse(String((JSON.parse(prompt) as { messages: { role: string; content: string }[] }).messages
      .find(item => item.role === 'context')!.content)) as { packet: { capability: string } }).packet.capability);
    const result = { prompt, capability, reply: sent.at(-1) ?? '', operatorAction: turn.operatorAction, opened: opened.length,
      requests: journal.view.operatorRequests.map(item => ({ action: item.request.action, review: item.review !== undefined })),
      near: limitsNear(journal.view, now), maxCalls: journal.view.limits.maxCalls };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const count = (text: string, part: string) => text.split(part).length - 1;
const FAR = 63 * HOUR, NEAR_END = 24 * HOUR;
const ASK = 'Please raise my model-call limit.';

it('sends the proposal guidance on an admissible root far from every limit, and never where no source is admissible', async () => {
  // (a) No explicit-yes port at all: nothing is added; the default root's always-sent bytes are untouched.
  const none = await turnOn({ expiresIn: FAR, message: ASK });
  expect(none.near).toBe(false);
  expect(none.capability).not.toContain(OPERATOR_ACTION_GUIDANCE.trim());
  // (b) The live shape: P-05 review route under a current acceptance, far from every limit (the false cannot-do case).
  const review = await turnOn({ installation: reviewRoute, expiresIn: FAR, message: ASK });
  expect(review.near).toBe(false);
  expect(count(review.capability, OPERATOR_ACTION_GUIDANCE)).toBe(1);
  // The chat route counts as admissible too.
  const chat = await turnOn({ installation: chatRoute, expiresIn: FAR, message: ASK });
  expect(count(chat.capability, OPERATOR_ACTION_GUIDANCE)).toBe(1);
  // The other side: a port configured but no source admissible (withdrawn acceptance), far from every limit: absent.
  const shut = await turnOn({ installation: withdrawn, expiresIn: FAR, message: ASK });
  expect(explicitYesStatus(withdrawn, { chat: String(OPERATOR), operator: String(OPERATOR), trial: TRIAL }, { connected: true }).review.admissible).toBe(false);
  expect(shut.capability).not.toContain(OPERATOR_ACTION_GUIDANCE.trim());
  // Unchanged: inadmissible but near the end, the guidance still rides so the answer carries the runner's honest why-not.
  const shutNear = await turnOn({ installation: withdrawn, expiresIn: NEAR_END, message: ASK });
  expect(shutNear.near).toBe(true);
  expect(count(shutNear.capability, OPERATOR_ACTION_GUIDANCE)).toBe(1);
  // Bytes: the admissible root differs from the no-port root by exactly the guidance (one root, same message, same clock):
  // 397 bytes of text, 415 on the prepared envelope, where the packet is JSON inside JSON and each of its 6 quotes costs 3.
  const added = Buffer.byteLength(review.prompt) - Buffer.byteLength(none.prompt);
  expect(Buffer.byteLength(OPERATOR_ACTION_GUIDANCE)).toBe(397);
  expect(added).toBe(Buffer.byteLength(JSON.stringify(JSON.stringify(OPERATOR_ACTION_GUIDANCE))) - 6);
  expect(added).toBe(415);
}, 60_000);

it('a proposed raise on an admissible root far from every limit opens one request; without a source the reply says why not', async () => {
  const raise = { reply: 'I can ask you to approve a higher model-call limit; the request is below.', memory: [],
    operatorAction: { action: 'raise-caps', limits: { maxCalls: 'step' } } };
  const raised = await turnOnRaw(raise);
  expect(raised.requests).toEqual([{ action: 'raise-caps', review: true }]);
  expect(raised.opened).toBe(1);
  expect(raised.reply).toContain(`https://github.com/${REPO}/pull/41/files`);
  expect(raised.maxCalls).toBe(2000);
  // No source on the root: nothing is opened and the reply carries the honest route (the host), as before.
  const host = await turnOnRaw(raise, null);
  expect(host.requests).toEqual([]);
  expect(host.opened).toBe(0);
  expect(host.reply).toContain(NO_YES_SOURCE);
}, 60_000);

/** The same root, with a structured answer handed back as the worker's model text (no envelope parsing). */
async function turnOnRaw(answer: object, installation: ExplicitYesInstallation | null = reviewRoute) {
  return turnOnText(JSON.stringify(answer), installation ?? undefined);
}
async function turnOnText(text: string, installation: ExplicitYesInstallation | undefined, message = ASK) {
  const now = 1_791_005_770_285;
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-ask-anytime-')));
  try {
    const g = { kind: 'genesis' as const, bot: '12345678', chat: String(OPERATOR), operator: String(OPERATOR), grant: TRIAL,
      configurationDigest: 'sha256:offline', expires: now + FAR, maxCalls: 2000, maxReplies: 2000, maxTurns: 2000, maxBytes: 65536, cursor: 0 };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, g);
    const opened: string[] = [];
    const client: GitHubReviewClient = {
      async openRequest(input) { opened.push(input.body); return { number: 40 + opened.length, head: HEAD }; },
      async pullRequest() { return { body: opened.at(-1) ?? '', head: HEAD }; },
      async reviews() { return []; }, async closeRequest() { /* nothing lapses here */ } };
    const review = installation && createReviewYesSource({ client, installation: () => installation, repository: REPO,
      context: previewTestContext, now: () => now, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } });
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, sources: () => [],
      ...(installation && review ? { explicitYes: { context: previewTestContext, installation: () => installation, review } } : {}),
      model: async input => input.id.startsWith('summary:') ? JSON.stringify({ summary: 'The operator is trying the preview.', people: [] }) : text,
      send: async input => { sent.push(input.expectedText); return sent.length + 100; }, checkOutbound: () => {} });
    worker.intake([{ update_id: 9, message: { message_id: 200, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR },
      text: message, date: Math.floor(now / 1000) } }]);
    await worker.drain();
    const turn = journal.view.order.at(-1)!;
    const result = { reply: sent.at(-1) ?? '', operatorAction: turn.operatorAction, opened: opened.length,
      requests: journal.view.operatorRequests.map(item => ({ action: item.request.action, review: item.review !== undefined })),
      maxCalls: journal.view.limits.maxCalls, held: turn.held };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- The recorded live turn (rule 106), read from a COPY of the live root; never the live root itself. ----
// INSTAR_ASKANYTIME_ROOT: a directory holding a copy of lanes/preview-trial-root/runner-2026-09-26/journal.encrypted.
// INSTAR_ASKANYTIME_INSTALLATION: the installation record the runner was launched with (read only).
// INSTAR_SECRET_PREVIEW_STORAGE_KEY: from the vault (preview_storage_key), bound in the environment, never printed.
const COPY = process.env.INSTAR_ASKANYTIME_ROOT, RECORD = process.env.INSTAR_ASKANYTIME_INSTALLATION;
const STORAGE = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
const haveLive = COPY !== undefined && RECORD !== undefined && STORAGE !== undefined;
const ASK_UPDATE = 969390016, UNRELATED_UPDATE = 969390012;
const UNRELATED = 'From now on, end every picnic list with "— F52".';
type Envelope = { model: string; messages: { role: string; content: string }[] };
type Context = { bindings: { at: number; writer?: { id: string; kind: string; adapter: string } }; packet: Record<string, unknown> & { capability: string } };
/** The branch's packet for a recorded turn: the recorded packet with the one conditional term this change adds, placed
 * where the worker places it (after the hold and number guidance, before the source-trust sentence; no request was open). */
function branchPrompt(recorded: string, id: string, grant: string, maxBytes: number) {
  const envelope = JSON.parse(recorded) as Envelope;
  const context = JSON.parse(envelope.messages.find(item => item.role === 'context')!.content) as Context;
  const question = envelope.messages.find(item => item.role === 'user')!.content;
  const rebuild = (packet: Context['packet']) => prepareJournalEnvelope({ question, context: JSON.stringify(packet), id,
    ...(context.bindings.writer ? { writer: context.bindings.writer } : {}) }, envelope.model, grant, context.bindings.at, maxBytes);
  const trust = ' Trust sourceKind:';
  const at = context.packet.capability.indexOf(trust);
  const capability = `${context.packet.capability.slice(0, at)}${OPERATOR_ACTION_GUIDANCE}${context.packet.capability.slice(at)}`;
  return { base: rebuild(context.packet), branch: rebuild({ ...context.packet, capability }), model: envelope.model,
    trustCount: count(context.packet.capability, trust), hasRequest: 'operatorRequest' in context.packet,
    baseCapability: context.packet.capability };
}
function liveTurns() {
  const bytes = Buffer.from(STORAGE!, /^[a-f0-9]{64}$/iu.test(STORAGE!) ? 'hex' : 'base64');
  const journal = openPreviewJournal(resolve(COPY!, 'journal.encrypted'), new Uint8Array(bytes), undefined, undefined, true);
  try {
    const view = journal.view, find = (update: number) => view.order.find(turn => turn.update === update)!;
    const ask = find(ASK_UPDATE), unrelated = find(UNRELATED_UPDATE);
    return { view: { limits: view.limits, calls: view.calls, replies: view.replies, turns: view.order.length, expires: view.expires,
      genesis: view.genesis }, ask: { id: ask.id, at: ask.at, text: ask.text, prompt: ask.prompt!, answer: ask.answer ?? '' },
      unrelated: { id: unrelated.id, at: unrelated.at, text: unrelated.text, prompt: unrelated.prompt! },
      near: limitsNear(view, ask.at), maxBytes: view.limits.maxBytes };
  } finally { journal.close(); }
}

it.skipIf(!haveLive)('the recorded live ask: the guidance was absent on the base, is due on this branch, and lands in the packet', () => {
  const live = liveTurns();
  expect(live.ask.text).toBe(ASK);
  expect(live.ask.answer).toMatch(/^I can't raise my own model-call limit/u);
  expect(live.unrelated.text).toBe(UNRELATED);
  // The base packet the runner built carried no route; the gate's own inputs show why (not near any limit).
  expect(live.ask.prompt).not.toContain(OPERATOR_ACTION_GUIDANCE.slice(1, 80));
  expect(live.near).toBe(false);
  const installation = parseExplicitYesInstallation(readFileSync(RECORD!, 'utf8'));
  const status = explicitYesStatus(installation, { chat: live.view.genesis.chat, operator: live.view.genesis.operator,
    trial: live.view.genesis.grant }, { connected: true });
  expect(status.review.admissible).toBe(true);
  for (const turn of [live.ask, live.unrelated]) {
    const built = branchPrompt(turn.prompt, turn.id, live.view.genesis.grant, live.maxBytes);
    // The reconstruction is exact: the recorded packet re-encodes to the very bytes the runner recorded.
    expect(built.base).toBe(turn.prompt);
    expect(built.trustCount).toBe(1);
    expect(built.hasRequest).toBe(false);
    expect(count(built.branch, OPERATOR_ACTION_GUIDANCE.slice(1, 80))).toBe(1);
    expect(Buffer.byteLength(built.branch) - Buffer.byteLength(built.base)).toBeGreaterThanOrEqual(Buffer.byteLength(OPERATOR_ACTION_GUIDANCE));
  }
});

const FIXTURE = resolve(process.cwd(), 'tests/preview/fixtures/ask-anytime-live-2026-10-02.json');
type Recorded = { scenario: 'raise-ask' | 'unrelated'; update: number; run: number; model: string; promptSha256: string; raw: string };
/** The production framing on one prepared envelope, outside this session's own harness variables. */
function callModel(prepared: string, model: string): string {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('CLAUDE_CODE_') && name !== 'CLAUDECODE'
    && !name.startsWith('INSTAR_SECRET_')));
  const run = spawnSync('/usr/local/bin/claude', [...subscriptionConversationPolicy(model).args], { input: prepared, encoding: 'utf8',
    timeout: 170_000, env: { ...env, MAX_THINKING_TOKENS: '0' }, maxBuffer: 4 * 1024 * 1024 });
  const frame = JSON.parse(run.stdout) as { result?: unknown };
  if (typeof frame.result !== 'string') throw Error(`model frame without result: ${run.stdout.slice(0, 300)}`);
  return frame.result;
}
const capture = haveLive && process.env.INSTAR_ASKANYTIME_LIVE === '1';
for (const scenario of ['raise-ask', 'unrelated'] as const) {
  it.skipIf(!capture)(`captures the real answer model on the recorded ${scenario} packet with the guidance`, () => {
    const live = liveTurns();
    const turn = scenario === 'raise-ask' ? live.ask : live.unrelated;
    const built = branchPrompt(turn.prompt, turn.id, live.view.genesis.grant, live.maxBytes);
    const raw = callModel(built.branch, built.model);
    expect(raw, 'the model call produced no output; nothing is recorded').not.toBe('');
    const recorded: Recorded[] = existsSync(FIXTURE) ? (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { outputs: Recorded[] }).outputs : [];
    recorded.push({ scenario, update: scenario === 'raise-ask' ? ASK_UPDATE : UNRELATED_UPDATE,
      run: recorded.filter(item => item.scenario === scenario).length + 1, model: built.model,
      promptSha256: createHash('sha256').update(built.branch).digest('hex'), raw });
    writeFileSync(FIXTURE, `${JSON.stringify({ source: FIXTURE_SOURCE, outputs: recorded }, null, 2)}\n`);
  }, 190_000);
}
const FIXTURE_SOURCE = 'Captured by tests/preview/ask-anytime.test.ts (w3-askanytime, Mac Studio, 2026-10-02) with INSTAR_ASKANYTIME_LIVE=1: '
  + 'the production conversation framing (subscriptionConversationPolicy, MAX_THINKING_TOKENS=0) and the envelope\'s own recorded '
  + 'model, on the recorded answer packets of the live root\'s turns 969390016 ("Please raise my model-call limit.") and 969390012 '
  + '(an unrelated list directive), read from a copy of the root, with OPERATOR_ACTION_GUIDANCE placed as this branch places it. '
  + '`raw` is the model output verbatim; promptSha256 is the envelope it answered. The live root was never read or written.';

const recorded = existsSync(FIXTURE) ? (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { outputs: Recorded[] }).outputs : [];
it('replays every recorded real answer: the plain ask proposes a raise and opens one request; the unrelated message proposes nothing', async () => {
  expect(recorded.some(item => item.scenario === 'raise-ask')).toBe(true);
  expect(recorded.some(item => item.scenario === 'unrelated')).toBe(true);
  for (const item of recorded) {
    const label = `${item.scenario} run ${item.run}`;
    const port = livePort(item.raw);
    expect('text' in port, label).toBe(true);
    const result = await turnOnText((port as { text: string }).text, reviewRoute, item.scenario === 'raise-ask' ? ASK : UNRELATED);
    expect(result.held, label).toBeUndefined();
    expect(result.reply.length, label).toBeGreaterThan(0);
    expect(result.reply, label).not.toMatch(/\bcan(?:'|’|no)t raise\b/iu);
    if (item.scenario === 'raise-ask') {
      expect(result.operatorAction?.action, label).toBe('raise-caps');
      expect(result.requests, label).toEqual([{ action: 'raise-caps', review: true }]);
      expect(result.opened, label).toBe(1);
      expect(result.maxCalls, label).toBe(2000);
    } else {
      expect(result.operatorAction, label).toBeUndefined();
      expect(result.requests, label).toEqual([]);
      expect(result.opened, label).toBe(0);
    }
  }
}, 60_000);

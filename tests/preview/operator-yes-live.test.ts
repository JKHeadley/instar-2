import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createJournalWorker, openPreviewJournal, previewTestContext } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SOURCE_PINS, sourcePacket } from './briefing.js';
import { selfStateBrief, selfStateSource } from './self-state.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { subscriptionConversationPolicy, SUBSCRIPTION_PREVIEW_EXPIRY } from '../../src/assembly/production-provider.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';

// Slice 5 of w3-yesactions (Rules 10, 82, 98; observer #106): the model-facing half -- the proposal guidance, the
// operatorAction field and the reported request state -- is proven on the REAL answer model, not on a stub. The
// gated capture below ran the production conversation framing (subscriptionConversationPolicy, claude-sonnet-5, the
// proof rooms' recorded answer model, thinking off) on prepared packets and stored every output verbatim in the
// fixture. The replay, which always runs, feeds those recorded outputs through the live port's own extraction
// (journal-agent invokeSubscription) into the worker and shows the new path fires on them -- and stays silent on the
// other side of each decision. Re-capture: INSTAR_OPERATOR_YES_LIVE=1 with one scenario per process (-t).
const FIXTURE = resolve(process.cwd(), 'tests/preview/fixtures/operator-yes-live-2026-10-02.json');
const MODEL = 'claude-sonnet-5';
const OPERATOR = 7654321;
const key = new Uint8Array(32).fill(29);
const installation: ExplicitYesInstallation = { adapter: 'telegram-bot-api', machine: 'laptop',
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: true },
  github: null, agentSpeaksAsOperatorInChat: false };
type Scenario = 'raise-ask' | 'unrelated' | 'renew-ask' | 'yes-applied' | 'ambiguous';
type Recorded = { scenario: Scenario; run: number; now: number; message: string; promptSha256: string; raw: string };
const MESSAGES: Record<Scenario, string> = {
  'raise-ask': 'I keep running out of model calls in this trial. Can you raise that limit for me?',
  unrelated: 'Should I bring an umbrella to a picnic if the sky looks grey this afternoon?',
  'renew-ask': 'The trial ends tomorrow. Could you extend it so we can keep going?',
  'yes-applied': 'yes',
  ambiguous: 'hmm, maybe. what would that change exactly?' };

/** What journal-agent's invokeSubscription hands the worker for a complete subscription result. */
function livePort(raw: string) {
  const extracted = parseModelJson(raw, { wrapped: 'accept' });
  const decision = extracted.ok ? extracted.value as { type?: unknown; floor?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete' as const, failureClass: 'malformed' as const, usage: { inputTokens: null, outputTokens: null, charge: null } }
    : { state: 'complete' as const, text: value, usage: { inputTokens: null, outputTokens: null, charge: null } };
}
/** The production framing on one prepared envelope; the CLI's JSON frame's `result` is the model's verbatim output. */
function callModel(prepared: string): string {
  const run = spawnSync('/opt/homebrew/bin/claude', [...subscriptionConversationPolicy(MODEL).args], { input: prepared, encoding: 'utf8',
    timeout: 170_000, env: { ...process.env, MAX_THINKING_TOKENS: '0' }, maxBuffer: 4 * 1024 * 1024 });
  const frame = JSON.parse(run.stdout) as { result?: unknown };
  if (typeof frame.result !== 'string') throw Error(`model frame without result: ${run.stdout.slice(0, 300)}`);
  return frame.result;
}

/** One scenario on a fresh root, the real briefing sources and envelope; `answer` supplies the operator turn's answer. */
async function scenario(name: Scenario, now: number, answer: (prepared: string) => string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-operator-yes-live-')));
  try {
    // The trial ends in a day, so the proposal guidance rides the packet (limitsNear); a later reviewed end exists.
    const g = { kind: 'genesis' as const, bot: '12345678', chat: String(OPERATOR), operator: String(OPERATOR), grant: 'grant:preview',
      configurationDigest: 'sha256:offline', expires: now + 86_400_000, maxCalls: 40, maxReplies: 40, maxTurns: 40, maxBytes: 65536, cursor: 0 };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, g);
    const sources = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
      { providerAttempts: g.maxCalls, expiresAt: g.expires }).sources;
    const sent: { text: string; id: number }[] = [], prompts: string[] = [];
    let operatorTurn = false, next = 500;
    // The live runner's self-state source states the current limits and the trial end beside the briefing.
    const runs = { launches: [{ at: now - 60_000, pid: 1 }], exits: [] };
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      sources: () => [...sources, selfStateSource(selfStateBrief(journal.view, runs as never, now, 'UTC', now - 60_000))],
      prepareModel: input => prepareJournalEnvelope(input, MODEL, g.grant, now, g.maxBytes),
      explicitYes: { context: previewTestContext, installation, renewalActivation: () => `sha256:${'a'.repeat(64)}` },
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
    // The answer scenarios start from a request already proposed (stub answer) and sent.
    if (name === 'yes-applied' || name === 'ambiguous') await say(1, 100, 'Please raise my model-call limit to 80.');
    operatorTurn = true;
    await say(2, (sent.at(-1)?.id ?? 100) + 1, MESSAGES[name]);
    const turn = journal.view.order.at(-1)!;
    const result = { prompt: prompts.at(-1) ?? '', reply: sent.at(-1)?.text ?? '', operatorAction: turn.operatorAction,
      requests: journal.view.operatorRequests.map(item => ({ action: item.request.action, limits: item.request.limits, expires: item.request.expires,
        approved: item.approved !== undefined, applied: item.applied === true, refusals: item.refusals.length })),
      maxCalls: journal.view.limits.maxCalls, held: turn.held };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

const live = process.env.INSTAR_OPERATOR_YES_LIVE === '1';
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
const FIXTURE_SOURCE = 'Captured by tests/preview/operator-yes-live.test.ts (w3-yesactions, MacBook Laptop, 2026-10-02) with '
  + 'INSTAR_OPERATOR_YES_LIVE=1: the production conversation framing (subscriptionConversationPolicy, --system-prompt '
  + 'SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, MAX_THINKING_TOKENS=0) on prepared packets from fresh offline roots with the real '
  + 'briefing sources. `raw` is the model\'s output (the CLI JSON frame\'s result field) verbatim; promptSha256 is the prepared '
  + 'envelope it answered. No live preview root was read or written.';

const recorded = existsSync(FIXTURE) ? (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { outputs: Recorded[] }).outputs : [];
it('replays every recorded real answer through the live extraction: the path fires where it should and nowhere else', async () => {
  expect(recorded.length).toBeGreaterThanOrEqual(5);
  for (const name of Object.keys(MESSAGES) as Scenario[]) expect(recorded.some(item => item.scenario === name), name).toBe(true);
  for (const item of recorded) {
    const result = await scenario(item.scenario, item.now, () => item.raw);
    const label = `${item.scenario} run ${item.run}`;
    // Every recorded output is a well-formed Decision the live port admits: the reply went out.
    expect(result.held, label).toBeUndefined();
    expect(result.reply.length, label).toBeGreaterThan(0);
    if (item.scenario === 'raise-ask') {
      // A plain ask for more calls: the model proposed a raise and the runner put ONE exact, in-bounds request on the reply.
      expect(result.operatorAction?.action, label).toBe('raise-caps');
      expect(result.requests, label).toHaveLength(1);
      expect(result.requests[0]!.limits!.maxCalls, label).toBeGreaterThan(40);
      expect(result.reply, label).toMatch(/Request [0-9a-f]{16}: raise /u);
      expect(result.maxCalls, label).toBe(40);
    }
    if (item.scenario === 'unrelated') {
      // The other side: a question about something else proposes nothing, though the guidance was in the packet.
      expect(result.operatorAction, label).toBeUndefined();
      expect(result.requests, label).toEqual([]);
    }
    if (item.scenario === 'renew-ask') {
      expect(result.operatorAction?.action, label).toBe('renew-expiry');
      expect(result.requests, label).toEqual([expect.objectContaining({ action: 'renew-expiry', expires: SUBSCRIPTION_PREVIEW_EXPIRY })]);
      expect(result.reply, label).toMatch(/Request [0-9a-f]{16}: extend /u);
    }
    if (item.scenario === 'yes-applied') {
      // The plain yes is decided by the admission, not the model; the model then reports it and proposes nothing new.
      expect(result.requests, label).toEqual([expect.objectContaining({ approved: true, applied: true })]);
      expect(result.maxCalls, label).toBe(80);
      expect(result.operatorAction, label).toBeUndefined();
    }
    if (item.scenario === 'ambiguous') {
      // An ambiguous answer is not a yes: nothing applied, the refusal recorded, the limit unchanged.
      expect(result.requests, label).toEqual([expect.objectContaining({ approved: false, applied: false, refusals: 1 })]);
      expect(result.maxCalls, label).toBe(40);
    }
  }
}, 60_000);

it('leaves real recorded proof-room answers untouched with the source switched on (updates 715672779, 715672853)', async () => {
  // Real Decision outputs (claude-sonnet-5, proof room 2026-09-30) that carry no operatorAction: with the explicit-yes
  // source configured and the trial near its end (so the guidance rides the packet), they propose nothing and every
  // recorded reply is sent without a request line.
  const proof = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/preview/fixtures/proofroom-memory-misfire-715672853-2026-09-30.json'), 'utf8')) as {
    genesis: { bot: string; chat: string; operator: string; grant: string; configurationDigest: string };
    turns: { update: number; text: string; answerOutput: string }[] };
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-operator-yes-proofroom-')));
  try {
    const now = 1790831527064;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', ...proof.genesis, expires: now + 86_400_000,
      maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
    const sent: string[] = [], contexts: string[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {},
      explicitYes: { context: previewTestContext, installation: { ...installation, chat: { ...installation.chat,
        boundChatId: proof.genesis.chat, operatorAccountId: proof.genesis.operator } }, renewalActivation: () => `sha256:${'a'.repeat(64)}` },
      model: async input => {
        if (input.id.startsWith('summary:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
        contexts.push(input.context);
        return livePort(proof.turns.find(turn => turn.text === input.question)!.answerOutput);
      }, send: async input => { sent.push(input.expectedText); return 900 + sent.length; } });
    for (const turn of proof.turns) {
      worker.intake([{ update_id: turn.update, message: { message_id: turn.update % 100_000, chat: { id: Number(proof.genesis.chat), type: 'private' },
        from: { id: Number(proof.genesis.operator) }, text: turn.text, date: Math.floor(now / 1000) } }]);
      for (let pass = 0; pass < 3; pass++) await worker.drain();
    }
    expect(contexts.length).toBeGreaterThanOrEqual(2);
    for (const context of contexts) expect(context).toContain('operatorAction');
    expect(journal.view.order.every(turn => turn.operatorAction === undefined)).toBe(true);
    expect(journal.view.operatorRequests).toEqual([]);
    expect(sent.length).toBeGreaterThanOrEqual(1);
    for (const text of sent) expect(text).not.toMatch(/Request [0-9a-f]{16}:|I can't propose that/u);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

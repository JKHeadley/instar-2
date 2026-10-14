import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readAnswer } from './answer-reading.js';
import { parseReplyReviewVerdict, type ReplyCheckResult } from './reply-check.js';
import { createConversationSessionPort } from '../../src/assembly/production-conversation-session.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { createJournalWorker, openPreviewJournal, ModelNotStarted, ModelDisclosureRefused,
  createModelLaunchBoundary, type PreviewPorts } from './journal-test-worker.js';

// Execute the shipped host closure, substituting only its physical/model dependencies.
const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const signature = 'async ({ id, prepared, question, context: packet }) => {';
const body = host.split(`      model: ${signature}`)[1]!.split('\n      summaryCheck:')[0]!.trimEnd().replace(/,$/u, '');
const optionsBody = host.split('const conversationSessionOf = options => {')[1]!.split('\nconst sessionWorkOf')[0]!;
const mode = Function(`return options => {${optionsBody.replace(/;\s*$/u, '')}`)() as (options: Record<string, string>) => boolean;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const usage = { inputTokens: null, outputTokens: null, charge: null };
const update = (id: number, text: string) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });

function fixture(enabled = true, checkIntake = true, maxCalls = 200, extra: Partial<PreviewPorts> = {}, boundary: { prepareTurn?: () => Promise<'ready' | 'replaced' | 'waiting'>; wait?: () => Promise<void> } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'conversation-wiring-'))); roots.push(root);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(61), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls, maxReplies: 20,
    maxTurns: 30, maxBytes: 262144, cursor: 0 });
  const f = assemblyRuntimeFixture();
  let now = 1000, launches = 0, calls = 0, fallback = 0, stopped = false, edges = 0;
  let destination = '', answer = JSON.stringify({ reply: 'A useful answer.', memory: [] });
  const files = new Map<string, string>(), delivered: string[] = [], sent: string[] = [];
  const port = value(createConversationSessionPort({ conversation: 'operator', ...boundary.prepareTurn ? { prepareTurn: boundary.prepareTurn } : {},
    createDriver: resolve => ({ owner: 'part-eight', launch: () => { launches++; return f.success('session:123:1'); },
      deliver: input => { if (checkIntake) expect(journal.view.order.some(turn => turn.id === input.intake && turn.reserved)).toBe(true);
        delivered.push(resolve(input.intake, input.digest)); calls++; files.set(destination, answer); return f.success('accepted'); },
      observe: () => f.success({ phase: 'output-observed', evidence: 'closed', detail: 'closed' }), stop: () => f.success(['123']) }),
    io: { clearResult: path => { destination = path; files.delete(path); }, readResult: path => files.get(path) ?? null,
      wait: async ms => { now += ms; await boundary.wait?.(); }, modelCalls: () => calls, prepareAdmission: () => {}, closeAdmission: () => {},
      admissionState: () => ({ refused: false, openDelegations: [] }) },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => true }) },
    context: f.c, now: () => now, stopped: () => stopped,
    append: record => { journal.append({ kind: 'session-work', record, at: now }); if (record.type === 'SessionWorkEdge') edges++; }, parent: 'runner', owner: 'machine',
    placement: 'local', transport: 'fake', workingScope: '/scope', resultDirectory: '/scope', artifact: 'worker',
    incarnation: 'one', deadlineMs: 10000, pollMs: 25, maxResultBytes: 65536, maxSteps: 8, maxCalls: 10 }));
  const model = Function('journal', 'requireGroupDisclosure', 'toolsActive', 'toolTurnEligible', 'invokeTools',
    'invokeSubscription', 'recordedUsage', 'ModelDisclosureRefused', 'modelLaunch', 'conversationSession',
    'sessionWork', 'ModelNotStarted', 'readAnswer', 'recordShape', 'shapesPath', `return (${signature}${body});`)(journal, async () => {}, () => false, () => false,
    () => { throw Error('unexpected tools fallback'); }, async () => { fallback++; return { state: 'complete', value: answer, usage }; },
    (input: unknown) => input, ModelDisclosureRefused, createModelLaunchBoundary(), enabled,
    { port, authority: 'existing-role' }, ModelNotStarted, readAnswer, () => {}, '/unused') as PreviewPorts['model'];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => stopped,
    prepareModel: input => JSON.stringify({ ...input, responseContract: "decision-envelope-marker" }), model,
    send: async input => { sent.push(input.expectedText); return sent.length; },
    checkOutbound: text => { if (text.includes('SECRET')) throw Error('credential'); }, ...extra });
  return { root, journal, worker, model, port, sent, delivered, edges: () => edges, counts: () => ({ launches, calls, fallback }),
    answer: (text: string) => { answer = text; }, stop: () => { stopped = true; },
    close: async () => { await port.close(); journal.close(); } };
}

it('defaults off, validates the single option, and never silently enables an absent activation', () => {
  expect(mode({})).toBe(false); expect(mode({ 'conversation-session': 'off' })).toBe(false);
  expect(mode({ 'conversation-session': 'on', 'session-work-activation': '/reviewed' })).toBe(true);
  expect(() => mode({ 'conversation-session': 'on' })).toThrow(/activation/);
  expect(() => mode({ 'conversation-session': 'maybe' })).toThrow(/on or off/);
});

it.each([false, true])('uses the shipped model route, mode=%s, and sends each durably admitted turn once', async enabled => {
  const f = fixture(enabled);
  try {
    f.worker.intake([update(1, 'First question')]); await f.worker.drain();
    f.answer(JSON.stringify({ reply: 'Second answer.', memory: [] }));
    f.worker.intake([update(2, 'Second question')]); await f.worker.drain(); await f.worker.drain();
    expect(f.sent).toEqual(['A useful answer.', 'Second answer.']);
    expect(f.counts()).toEqual(enabled ? { launches: 1, calls: 2, fallback: 0 } : { launches: 0, calls: 0, fallback: 2 });
    if (enabled) {
      expect(f.delivered[0]).toContain('First question');
      expect(f.delivered[0]).toContain('decision-envelope-marker');
      expect(f.delivered[1]).toContain('Second question'); expect(f.delivered[1]).toContain('A useful answer.');
      expect(f.delivered[0]).not.toContain('You have no tools');
      expect(f.edges()).toBe(1);
    }
  } finally { await f.close(); }
});

it('keeps summary/review/repair calls on their existing route and refuses a closed session without fallback', async () => {
  const f = fixture();
  try {
    await f.model({ id: 'summary:1', question: 'summarize', context: '{}', prepared: 'exact bytes' });
    expect(f.counts().fallback).toBe(1); expect(f.counts().launches).toBe(0);
    await f.port.close();
    await expect(f.model({ id: 'telegram:7654321:update:2', question: 'hello', context: '{}', prepared: '{}' }))
      .rejects.toBeInstanceOf(ModelNotStarted);
    expect(f.counts().fallback).toBe(1);
  } finally { await f.close(); }
});

it('keeps the outbound credential wall and durable stop in front of delivery', async () => {
  const f = fixture();
  try {
    f.answer(JSON.stringify({ reply: 'SECRET', memory: [] }));
    f.worker.intake([update(1, 'Question')]); await f.worker.drain();
    expect(f.sent).toEqual([]); expect(f.journal.view.order[0]?.held).toBe('outbound secret refused');
    f.worker.stop('operator');
    expect(() => f.worker.intake([update(2, 'Next')])).toThrow(/stopped/);
    expect(f.counts().calls).toBe(1);
  } finally { await f.close(); }
});

const recorded = JSON.parse(readFileSync(new URL('./fixtures/conversation-session-userwalk-2026-10-13.json', import.meta.url), 'utf8')) as {
  records: { frame: number; id: string; output: string }[] };
it.each(recorded.records)('reads the real user-walk output at frame $frame through the session result path', async row => {
  const f = fixture(true, false);
  try {
    f.answer(row.output);
    const result = await f.model({ id: row.id, question: 'Return the recorded answer shape', context: '{}', prepared: '{}' });
    expect(result).toMatchObject({ state: 'complete', usage });
    expect(typeof result).toBe('object');
    if (typeof result === 'string' || !('text' in result)) throw Error('recorded answer was not read');
    const raw = JSON.parse(row.output) as { reasoning: string; reply: unknown; dated: unknown[] };
    const answer = JSON.parse(result.text) as { reasoning?: unknown; reply: unknown; dated: unknown[] };
    expect(answer.reply).toEqual(raw.reply); expect(answer.dated).toEqual(raw.dated);
    expect(answer.reasoning).toBeUndefined(); expect(result).toMatchObject({ reason: raw.reasoning });
    expect(f.counts()).toEqual({ launches: 1, calls: 1, fallback: 0 });
  } finally { await f.close(); }
});

it('the journal refuses the whole session reservation before launch when the parent cap cannot hold it', async () => {
  const f = fixture(true, false, 9);
  try {
    const result = await f.model({ id: 'telegram:7654321:update:1', question: 'hello', context: '{}', prepared: '{}' });
    expect(result).toEqual({ state: 'uncertain' });
    expect(f.counts()).toEqual({ launches: 0, calls: 0, fallback: 0 });
    expect(f.journal.view.calls).toBe(0);
    expect(f.sent).toEqual([]);
  } finally { await f.close(); }
});

it.each(['before-send', 'after-send'] as const)('drains durable busy intake once across a completed-turn worker move with %s review', async timing => {
  let release!: () => void, started!: () => void, preparations = 0, firstWait = true;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  const f = fixture(true, true, 200, { replyReviewTiming: timing, replyCheck: { elapsedMs: () => 0,
    jev: async () => ({ value: {}, latencyMs: 0 }),
    escalate: async () => ({ verdict: 'pass', confidence: 1, latencyMs: 1, ruleIds: [] }) } }, {
    prepareTurn: async () => ++preparations === 2 ? 'replaced' : 'ready',
    wait: async () => { if (firstWait) { firstWait = false; started(); await held; } },
  });
  try {
    f.worker.intake([update(101, 'First queued question')]);
    const draining = f.worker.drain(); await waiting;
    f.worker.intake([update(102, 'Second queued question')]);
    expect(f.journal.view.order).toHaveLength(2);
    expect(f.delivered).toHaveLength(1); expect(preparations).toBe(1);
    release(); await draining; await f.worker.drain();
    expect(f.delivered).toHaveLength(2); expect(f.sent).toHaveLength(2);
    expect(f.counts()).toEqual({ launches: 2, calls: 2, fallback: 0 });
    expect(f.edges()).toBe(1);
    await f.worker.drain(); expect(f.delivered).toHaveLength(2);
  } finally { release(); await f.close(); }
});

it('sends at turn end before slow review, persists objections for the next turn, and never sends twice', async () => {
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const events: string[] = [];
  const f = fixture(true, true, 200, { replyReviewTiming: 'after-send',
    replyCheck: { elapsedMs: () => 0,
      jev: async () => { events.push('jev'); await delayed; return { value: {}, latencyMs: 1 }; },
      escalate: async () => { events.push('review'); return { verdict: 'violation', confidence: 1, latencyMs: 1, ruleIds: ['self_state_claim'],
        reason: 'The answer claims work without evidence.' }; } } });
  try {
    f.worker.intake([update(1, 'First question')]);
    const draining = f.worker.drain();
    for (let i = 0; i < 100 && !events.length; i++) await new Promise(resolve => setTimeout(resolve, 1));
    expect(f.sent).toEqual(['A useful answer.']); // The reviewer is still awaiting the injected slow path.
    expect(events).toEqual(['jev']);
    release(); await draining;
    expect(events).toEqual(['jev', 'review']);
    expect(f.journal.view.order[0]?.replyChecks?.at(-1)?.verdict).toBe('violation');
    expect(f.journal.view.order[0]?.afterSendReview).toBe(true);
    expect(f.journal.view.order[0]?.checked).toBeDefined();
    await f.worker.drain(); expect(f.sent).toHaveLength(1); expect(events).toHaveLength(2);
    f.worker.intake([update(2, 'Second question')]); await f.worker.drain();
    expect(f.delivered[1]).toContain('self_state_claim');
  } finally { release(); await f.close(); }
});

it.each(['SECRET', 'stop'] as const)('after-send review preserves the %s wall', async kind => {
  let reviews = 0;
  const f = fixture(true, true, 200, { replyReviewTiming: 'after-send', replyCheck: {
    elapsedMs: () => 0, jev: async () => { reviews++; return { value: {}, latencyMs: 0 }; },
    escalate: async () => ({ verdict: 'pass', confidence: 1, latencyMs: 1, ruleIds: [] }) } });
  try {
    if (kind === 'SECRET') f.answer(JSON.stringify({ reply: 'SECRET', memory: [] }));
    f.worker.intake([update(1, 'Question')]);
    if (kind === 'stop') f.stop();
    try { await f.worker.drain(); } catch { /* stop is an explicit refusal */ }
    expect(f.sent).toHaveLength(0); expect(reviews).toBe(0);
  } finally { await f.close(); }
});

it('reopens the post-send journal without repeating review or delivery', async () => {
  let reviews = 0;
  const f = fixture(true, true, 200, { replyReviewTiming: 'after-send', replyCheck: {
    elapsedMs: () => 0, jev: async () => { reviews++; return { value: {}, latencyMs: 0 }; },
    escalate: async () => ({ verdict: 'pass', confidence: 1, latencyMs: 1, ruleIds: [] }) } });
  f.worker.intake([update(1, 'Question')]); await f.worker.drain(); await f.close();
  const journal = openPreviewJournal(join(f.root, 'journal.encrypted'), new Uint8Array(32).fill(61));
  try {
    const worker = createJournalWorker(journal, { now: () => 2000, stopped: () => false,
      model: async () => { throw Error('unexpected model replay'); },
      send: async () => { throw Error('unexpected duplicate send'); }, checkOutbound: () => {},
      replyReviewTiming: 'after-send', replyCheck: { elapsedMs: () => 0,
        jev: async () => { throw Error('unexpected review replay'); },
        escalate: async () => { throw Error('unexpected review replay'); } } });
    await worker.drain();
    expect(reviews).toBe(1); expect(journal.view.order[0]?.afterSendReview).toBe(true);
    expect(journal.view.order[0]?.sent).toBe(1);
  } finally { journal.close(); }
});

it('sends under the exact answer/session cap and records unavailable review without exceeding it', async () => {
  let escalations = 0;
  const f = fixture(true, true, 11, { replyReviewTiming: 'after-send', replyCheck: { elapsedMs: () => 0,
    jev: async () => ({ value: {}, latencyMs: 0 }),
    escalate: async () => { escalations++; return { verdict: 'pass', confidence: 1, latencyMs: 1, ruleIds: [] }; } } });
  try {
    f.worker.intake([update(1, 'Question')]); await f.worker.drain();
    expect(f.sent).toEqual(['A useful answer.']);
    expect(f.journal.view.calls).toBeLessThanOrEqual(11); expect(escalations).toBe(0);
    expect(f.journal.view.order[0]?.replyChecks?.at(-1)?.verdict).toBe('unavailable');
  } finally { await f.close(); }
});

it('recovers an interrupted paid review as an unavailable signal without dispatching it again', async () => {
  const f = fixture();
  f.worker.intake([update(1, 'Question')]); await f.worker.drain();
  const id = f.journal.view.order[0]!.id;
  f.journal.append({ kind: 'reply-review-after-send', id, at: 1500 });
  f.journal.append({ kind: 'reply-jev-reserve', id, at: 1500 });
  await f.close(); // Crash boundary: the paid reservation exists, its result does not.
  const journal = openPreviewJournal(join(f.root, 'journal.encrypted'), new Uint8Array(32).fill(61));
  try {
    const worker = createJournalWorker(journal, { now: () => 2000, stopped: () => false,
      model: async () => { throw Error('unexpected answer'); },
      send: async () => { throw Error('duplicate send'); }, checkOutbound: () => {},
      replyReviewTiming: 'after-send', replyCheck: { elapsedMs: () => 0,
        jev: async () => { throw Error('paid call repeated'); },
        escalate: async () => { throw Error('paid call repeated'); } } });
    await worker.drain(); await worker.drain();
    expect(journal.view.order[0]?.replyChecks).toHaveLength(1);
    expect(journal.view.order[0]?.replyChecks?.[0]).toMatchObject({ verdict: 'unavailable', path: 'holding' });
    expect(journal.view.order[0]?.checked).toBeDefined();
    expect(journal.view.order[0]?.sent).toBe(1);
  } finally { journal.close(); }
});

async function recoverReview(results: ReplyCheckResult[], subscriptionReserved = false, shared = false) {
  const f = fixture(true, true, 200, shared ? { prepareModel: () => JSON.stringify({ messages: [{ role: 'context',
    content: JSON.stringify({ packet: { audience: { surface: 'telegram-group-topic', operatorOnlyVerified: false } } }) }] }) } : {});
  f.worker.intake([update(1, 'Question')]); await f.worker.drain();
  const id = f.journal.view.order[0]!.id;
  f.journal.append({ kind: 'reply-review-after-send', id, at: 1500 });
  f.journal.append({ kind: 'reply-jev-reserve', id, at: 1500 });
  if (subscriptionReserved || results.some(result => result.path === 'subscription')) {
    f.journal.append({ kind: 'reply-review-reserve', id, candidate: f.journal.view.order[0]!.intent!, at: 1500 });
    if (results.some(result => result.path === 'subscription'))
      f.journal.append({ kind: 'reply-review-state', id, state: 'complete', at: 1500 });
  }
  for (const result of results) f.journal.append({ kind: 'reply-check', id, result, at: 1501 });
  expect(f.journal.view.order[0]!.checked).toBeUndefined();
  const calls = f.journal.view.calls;
  await f.close(); // Crash after durable result, before its coherence projection.
  const journal = openPreviewJournal(join(f.root, 'journal.encrypted'), new Uint8Array(32).fill(61));
  try {
    const worker = createJournalWorker(journal, { now: () => 2000, stopped: () => false,
      model: async () => { throw Error('unexpected model replay'); },
      send: async () => { throw Error('unexpected duplicate send'); }, checkOutbound: () => {},
      replyReviewTiming: 'after-send', replyCheck: { elapsedMs: () => 0,
        jev: async () => { throw Error('unexpected review replay'); },
        escalate: async () => { throw Error('unexpected review replay'); } } });
    await worker.drain(); await worker.drain();
    expect(journal.view.calls).toBe(calls);
    expect(journal.view.order[0]!.sent).toBe(1);
    expect(journal.view.order[0]!.checked).toBeDefined();
    const probe = worker.probe('What should inform the next answer?');
    if ('reason' in probe) throw Error(probe.reason);
    return { checks: journal.view.order[0]!.replyChecks!, findings: journal.view.order[0]!.checked!, packet: probe.context };
  } finally { journal.close(); }
}

it.each(['pass', 'violation', 'unavailable'] as const)('recovers a durable terminal %s without replacing it or spending again', async verdict => {
  const result: ReplyCheckResult = { verdict, ruleIds: verdict === 'violation' ? ['self_state_claim'] : [],
    path: 'subscription', confidence: 1, latencyMs: 1, reason: 'The answer claims completed work without evidence.' };
  const recovered = await recoverReview([result]);
  expect(recovered.checks).toEqual([result]);
  expect(recovered.packet).not.toContain('retrospective review interrupted');
  if (verdict !== 'pass') {
    expect(JSON.stringify(recovered.findings)).toContain(result.reason);
    expect(recovered.packet).toContain(result.reason);
  }
  if (verdict === 'violation') expect(recovered.packet).toContain('self_state_claim');
});

it('a Jev pass is terminal unless a contextual review was reserved and lost', async () => {
  const result: ReplyCheckResult = { verdict: 'pass', ruleIds: [], path: 'jev', confidence: 1, latencyMs: 1 };
  expect((await recoverReview([result])).checks).toEqual([result]);
  const interrupted = await recoverReview([result], true);
  expect(interrupted.checks).toHaveLength(2);
  expect(interrupted.packet).toContain('retrospective review interrupted');
  const audienceReviewMissing = await recoverReview([result], false, true);
  expect(audienceReviewMissing.checks).toHaveLength(2);
  expect(audienceReviewMissing.packet).toContain('retrospective review interrupted');
});

it('retains a terminal holding result instead of adding another interruption', async () => {
  const result: ReplyCheckResult = { verdict: 'unavailable', ruleIds: ['defers_work'], path: 'holding',
    confidence: null, latencyMs: 0, reason: 'review cap refused' };
  expect((await recoverReview([result])).checks).toEqual([result]);
});

const reviewArchive = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
  import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
it.each(reviewArchive.otherShapes)('recovery preserves recorded $kind ($id) at the review boundary', async row => {
  if (row.kind === 'jev-unsure') {
    const result = JSON.parse(row.raw) as ReplyCheckResult;
    const recovered = await recoverReview([result], true);
    expect(recovered.checks[0]).toEqual(result);
    expect(recovered.checks.at(-1)).toMatchObject({ verdict: 'unavailable', ruleIds: result.ruleIds });
    expect(recovered.packet).toContain('quits_on_self');
    expect(recovered.packet).toContain('parks_on_user');
    return;
  }
  // Recorded writer, uncertain/undecided and delivered/empty shapes are not completed review verdicts.
  // Use the shipped readers to retain that distinction, then recover the durable outcome without relabeling it.
  const read = readAnswer(row.raw, { wrapped: 'refuse', object: true });
  let result: ReplyCheckResult;
  try {
    result = { ...parseReplyReviewVerdict(read.ok ? read.value : row.raw,
      ['defers_work', 'self_state_claim', 'breaks_preference']), path: 'subscription', confidence: 1, latencyMs: 1 };
  } catch {
    result = { verdict: 'unavailable', ruleIds: [], path: 'subscription', confidence: null,
      latencyMs: 1, reason: 'recorded output is not a reply-review verdict' };
  }
  expect(result.verdict).toBe(row.kind === 'reply-review' ? 'violation' : 'unavailable');
  const recovered = await recoverReview([result]);
  expect(recovered.checks).toEqual([result]);
  expect(recovered.packet).toContain(result.reason);
  expect(recovered.packet).not.toContain('retrospective review interrupted');
  if (row.kind === 'reply-review') expect(recovered.packet).toContain('breaks_preference');
});

it('keeps a known Jev objection when a later paid review was interrupted', async () => {
  const result: ReplyCheckResult = { verdict: 'violation', ruleIds: ['defers_work'], path: 'jev', confidence: 0.99,
    latencyMs: 1, reason: 'The answer promises later work.' };
  const recovered = await recoverReview([result], true);
  expect(recovered.checks).toHaveLength(2);
  expect(recovered.packet).toContain('defers_work');
  expect(recovered.packet).toContain(result.reason);
  expect(recovered.packet).toContain('retrospective review interrupted');
});

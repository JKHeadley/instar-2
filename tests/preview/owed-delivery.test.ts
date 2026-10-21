import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, owedResultAuthority, owedResultOccurrence, owedResultId, obligationDecision,
  LOOP_REVISIT_MS, type JournalRecord, type PreviewPorts } from './journal-test-worker.js';
import { writerRecord } from './intake-principal.js';
import { loopHealth } from './obligations.js';
import { readAnswer } from './answer-reading.js';

const key = new Uint8Array(32).fill(91), start = 1790000000000;
const request = 'Finish this check and send me the result when it is done.';
const promise = 'I will finish the check and send you the result.';
const result = 'The check is complete: all three supplied totals agree.';
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function world(options: { authorize?: boolean; report?: string; rawWork?: string | { state: 'uncertain' }; thread?: number; count?: number; ports?: Partial<PreviewPorts> } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'owed-delivery-'))); dirs.push(dir);
  const path = join(dir, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: options.thread ? '-1001234' : '7654321', operator: '7654321',
    grant: 'grant:owed-result', configurationDigest: 'sha256:offline', expires: start + 10 * LOOP_REVISIT_MS,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0, ...(options.thread ? { forum: true as const } : {}) };
  const state = { now: start, stopped: false, unknown: false, secret: false, audience: true, cancel: false, sends: [] as { text: string; thread: number | undefined }[], calls: [] as string[] };
  let journal = openPreviewJournal(path, key, genesis);
  const ports: PreviewPorts = { now: () => state.now, stopped: () => state.stopped, timeZone: 'UTC', checkOutbound: () => { if (state.secret) throw Error('secret refused'); },
    groupDisclosure: async () => state.audience,
    model: async input => {
      state.calls.push(input.id);
      if (input.id.startsWith('obligation:')) return options.rawWork ?? JSON.stringify({ outcome: 'report', report: options.report ?? result });
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator requested a check.', people: [], commitments: [], closed: [] });
      if (state.cancel) return JSON.stringify({ reply: 'I cancelled that result delivery.', memory: [], dated: [],
        cancelDeliveries: [{ id: 0, quote: input.question }] });
      return JSON.stringify({ reply: Array.from({ length: options.count ?? 1 }, (_, i) => i ? `${promise} Check ${i}.` : promise).join(' '), memory: [], dated: [], openLoops: Array.from({ length: options.count ?? 1 }, (_, i) => ({ kind: 'promise', quote: i ? `${promise} Check ${i}.` : promise, waitsOn: 'nothing',
        ...(options.authorize === false ? {} : { deliveryRequest: request }) })) });
    }, send: async input => { state.sends.push({ text: input.expectedText, thread: input.thread });
      return state.unknown ? null : state.sends.length; }, ...options.ports };
  let worker = createJournalWorker(journal, ports);
  const reopen = () => { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); };
  const prepare = async (text = request, sender = 7654321) => {
    worker.intake([{ update_id: 1, message: { chat: options.thread ? { id: -1001234, type: 'supergroup', is_forum: true } : { id: 7654321, type: 'private' }, from: { id: sender }, text,
      date: Math.floor(start / 1000), ...(options.thread ? { message_thread_id: options.thread } : {}) } }]);
    await worker.drain(); state.now += LOOP_REVISIT_MS; await worker.workObligations();
  };
  return { state, prepare, reopen, ports, get journal() { return journal; }, get worker() { return worker; } };
}

it('delivers a requested finished result without another message, through one signed due turn and complete receipt', async () => {
  const w = world({ thread: 42 });
  try {
    await w.prepare();
    expect(w.journal.view.commitments[0]?.deliveryRequest).toBe(request);
    expect(w.journal.view.closed.size).toBe(0);
    expect(loopHealth(w.journal.view, w.state.now).deliveryInhibition).toContain('requested result');
    const calls = w.state.calls.length;
    w.reopen(); await w.worker.sendRequested(); await w.worker.sendRequested();
    expect(w.state.calls.length).toBe(calls); // Deliver the durable result, never regenerate it.
    expect(w.state.sends).toHaveLength(2);
    expect(w.state.sends[1]).toEqual({ text: `Here is the finished result you asked me to send:\n${result}`, thread: 42 });
    expect(w.journal.view.closed.has(0)).toBe(true);
    const due = w.journal.view.order.find(turn => turn.requestedAction?.owed)!;
    expect(due.writer).toBeDefined();
    expect(w.journal.view.obligationWork['commitment:0']!.report).toMatchObject({ boundTo: due.id, delivered: due.id });
    w.reopen(); await w.worker.sendRequested(); expect(w.state.sends).toHaveLength(2);
  } finally { w.journal.close(); }
});

const heldReviewCapture = JSON.parse(readFileSync(new URL('./fixtures/credlabel-proofroom-T-2026-10-03.json', import.meta.url), 'utf8')) as {
  turn: { recordedAnswer: string; review: Awaited<ReturnType<NonNullable<PreviewPorts['replyCheck']>['escalate']>> };
  neighbour: { credentialFinding: { rule: 'credential'; verdict: 'pass'; reason: string } };
};
it.each(['same worker', 'restart', 'unknown holding send', 'passing review'] as const)(
  'replays recorded review outcomes without stranding owed work: %s', async mode => {
    let hold = mode !== 'passing review';
    const w = world({ report: heldReviewCapture.turn.recordedAnswer });
    try {
      await w.prepare();
      const slot = w.journal.view.obligationWork['commitment:0']!.lastSlot;
      w.ports.replyCheck = { elapsedMs: () => 0,
        jev: async () => ({ value: { verdict: 'unsure', scores: { credential: 0.58 } }, latencyMs: 0 }),
        escalate: async () => hold ? { ...heldReviewCapture.turn.review, confidence: null } : { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0,
          findings: [heldReviewCapture.neighbour.credentialFinding] } };
      w.reopen();
      w.state.unknown = mode === 'unknown holding send';
      await w.worker.sendRequested();
      if (hold) {
        expect(w.state.sends[1]?.text).not.toContain(heldReviewCapture.turn.recordedAnswer);
        expect(w.journal.view.closed.size).toBe(0);
        if (mode !== 'same worker') w.reopen();
        await w.worker.sendRequested(); await w.worker.sendRequested();
        expect(w.state.sends.filter(send => send.text.includes('I need to check that answer'))).toHaveLength(1);
        expect(w.journal.view.obligationWork['commitment:0']!.withheld).toMatchObject({
          text: heldReviewCapture.turn.recordedAnswer, objection: heldReviewCapture.turn.review.reason });
        hold = false; w.state.unknown = false; w.state.now++;
        const model = w.ports.model;
        w.ports.model = async input => {
          if (input.id.startsWith('obligation:')) {
            expect(JSON.parse(input.context).withheld).toMatchObject({ report: heldReviewCapture.turn.recordedAnswer,
              objection: heldReviewCapture.turn.review.reason });
            return JSON.stringify({ outcome: 'report', report: result });
          }
          return model(input);
        };
        w.reopen(); await w.worker.workObligations();
        expect(w.journal.view.obligationWork['commitment:0']!.lastSlot).toBeGreaterThan(slot);
        await w.worker.sendRequested();
      }
      expect(w.journal.view.closed.has(0)).toBe(true);
      const sent = w.state.sends.length;
      w.reopen(); await w.worker.sendRequested(); expect(w.state.sends).toHaveLength(sent);
      expect(w.state.sends.filter(send => send.text.includes(mode === 'passing review' ? heldReviewCapture.turn.recordedAnswer : result))).toHaveLength(1);
    } finally { w.journal.close(); }
  });

it('resumes after the durable due frame but before intent without another model call', async () => {
  const w = world();
  try {
    await w.prepare();
    const ref = { key: 'commitment:0', slot: w.journal.view.obligationWork['commitment:0']!.lastSlot };
    const id = owedResultId([ref]), writer = w.journal.systemWriter('requested-action',
      owedResultOccurrence(id, [ref], w.journal.view.genesis.grant, w.journal.view.genesis.chat), w.state.now)!;
    w.journal.append({ kind: 'action-due', id, items: [], owed: [ref], update: 1 + 1 / 1024, writer: writerRecord(writer), at: w.state.now });
    w.reopen(); await w.worker.sendRequested(); expect(w.state.sends).toHaveLength(2); expect(w.journal.view.closed.has(0)).toBe(true);
  } finally { w.journal.close(); }
});

it('keeps an uncertain send pending across restart and never resends it', async () => {
  const w = world();
  try {
    await w.prepare(); w.state.unknown = true; await w.worker.sendRequested();
    expect(w.state.sends.filter(send => send.text.includes(result))).toHaveLength(1); expect(w.journal.view.closed.size).toBe(0);
    expect(loopHealth(w.journal.view, w.state.now).deliveryUnknown).toBe(1);
    w.reopen(); w.state.unknown = false; await w.worker.sendRequested(); await w.worker.workObligations();
    expect(w.state.sends.filter(send => send.text.includes(result))).toHaveLength(1); expect(w.journal.view.closed.size).toBe(0);
  } finally { w.journal.close(); }
});

it.each(['no request', 'remember only', 'wrong quote', 'non-operator'] as const)('%s creates no initiated result send', async kind => {
  const w = world({ authorize: kind !== 'no request' && kind !== 'remember only' });
  try {
    await w.prepare(kind === 'remember only' ? 'Remember this date: October 20.' : kind === 'wrong quote' ? 'Please check the totals.' : request,
      kind === 'non-operator' ? 9999999 : 7654321);
    const sent = w.state.sends.length; await w.worker.sendRequested(); w.reopen(); await w.worker.sendRequested();
    expect(w.state.sends.length).toBe(sent);
    expect(w.journal.view.order.some(turn => turn.requestedAction?.owed)).toBe(false);
  } finally { w.journal.close(); }
});

it.each(['stop', 'reply cap', 'call cap', 'cancel', 'secret'] as const)('retains the report under %s', async reason => {
  const w = world();
  try {
    await w.prepare();
    if (reason === 'stop') w.state.stopped = true;
    if (reason === 'reply cap') w.journal.view.limits.maxReplies = w.journal.view.replies;
    if (reason === 'call cap') w.journal.view.limits.maxCalls = w.journal.view.calls;
    if (reason === 'cancel') w.journal.view.closed.set(0, { id: 0, source: w.journal.view.order[0]!.id, quote: 'Cancel the result.' });
    if (reason === 'secret') w.state.secret = true;
    await w.worker.sendRequested().catch(error => { if (reason !== 'stop') throw error; });
    expect(w.state.sends).toHaveLength(1);
    expect(w.journal.view.obligationWork['commitment:0']!.report).toMatchObject({ text: result });
    expect(w.journal.view.obligationWork['commitment:0']!.report?.delivered).toBeUndefined();
  } finally { w.journal.close(); }
});

it('refuses a forged scheduler signature or a different result slot', async () => {
  const w = world();
  try {
    await w.prepare(); const slot = w.journal.view.obligationWork['commitment:0']!.lastSlot;
    const ref = { key: 'commitment:0', slot }, id = owedResultId([ref]);
    expect(owedResultAuthority(w.journal.view, { ...ref, slot: slot + 1 })).toBeUndefined();
    const frame: JournalRecord = { kind: 'action-due', id, items: [], owed: [ref], update: 1 + 1 / 1024, at: w.state.now };
    expect(() => w.journal.append(frame)).toThrow('owed result refused');
    const wrong = w.journal.systemWriter('requested-action', owedResultOccurrence(id, [ref], 'other-grant', 'other-chat'), w.state.now)!;
    expect(() => w.journal.append({ ...frame, writer: writerRecord(wrong) })).toThrow('owed result refused');
    await w.worker.sendRequested(); expect(w.journal.view.closed.has(0)).toBe(true);
  } finally { w.journal.close(); }
});

it('delivers the real recorded completed work bytes through the new path', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/obligation-step-outputs-live-2026-10-04.json', import.meta.url), 'utf8')) as {
    calls: { call: string; root: string; output: string }[] };
  // Recorded second step of update 6232091's deferred-answer case, already used by obligation-task-answer-live.test.ts.
  const call = fixture.calls.find(item => item.call === 'obligation:commitment:3:1791099958095')!;
  const reading = readAnswer(call.output, { wrapped: 'accept', evidence: [call.call] }); expect(reading.ok).toBe(true);
  if (!reading.ok) throw Error('recorded answer unreadable');
  const decision = obligationDecision(reading.value, 'commitment', start, 'UTC'); expect(decision.outcome).toBe('report');
  if (!decision.report) throw Error('recorded report missing');
  const w = world({ rawWork: reading.value });
  try {
    await w.prepare(); await w.worker.sendRequested();
    expect(w.state.sends[1]?.text).toContain(decision.report.replaceAll('**', ''));
    expect(w.journal.view.closed.has(0)).toBe(true);
  } finally { w.journal.close(); }
});

it('withdraws a queued result from an actual operator cancellation before either reply path can carry it', async () => {
  const w = world();
  try {
    await w.prepare(); w.state.cancel = true;
    w.worker.intake([{ update_id: 2, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Cancel that check and do not send its result.', date: Math.floor(w.state.now / 1000) } }]);
    await w.worker.sendRequested(); expect(w.state.sends).toHaveLength(1); // Intake withdrawal wins over due delivery.
    await w.worker.drain();
    expect(w.journal.view.closed.get(0)).toMatchObject({ source: 'telegram:12345678:update:2', quote: 'Cancel that check and do not send its result.' });
    expect(w.state.sends.some(send => send.text.includes(result))).toBe(false);
    w.reopen(); await w.worker.sendRequested();
    expect(w.journal.view.obligationWork['commitment:0']!.report?.text).toBe(result);
    expect(loopHealth(w.journal.view, w.state.now).withdrawnResults).toBe(1);
    expect(w.state.sends.some(send => send.text.includes(result))).toBe(false);
  } finally { w.journal.close(); }
});

it('holds finished results when the current audience is not admitted and releases once admission returns', async () => {
  const w = world({ thread: 42 });
  try {
    await w.prepare(); const source = w.journal.view.order[0]!.id;
    // Isolated carried-memory observation, with the real worker's current audience port.
    w.journal.view.memory.push({ mode: 'remember', source, trigger: source, quote: request });
    w.state.audience = false; await w.worker.sendRequested();
    expect(w.state.sends).toHaveLength(1); expect(w.journal.view.closed.size).toBe(0);
    expect(loopHealth(w.journal.view, w.state.now).deliveryInhibition).toContain('disclosure');
    w.state.audience = true; await w.worker.sendRequested();
    expect(w.state.sends).toHaveLength(2); expect(w.journal.view.closed.has(0)).toBe(true);
  } finally { w.journal.close(); }
});

it('closes none of a batched split result until the last transport part has a receipt', async () => {
  const w = world({ count: 3, report: 'A'.repeat(1450) });
  try {
    await w.prepare(); await w.worker.workObligations(); await w.worker.workObligations();
    let deliveries = 0;
    const worker = createJournalWorker(w.journal, { ...w.ports, send: async input => {
      deliveries++;
      expect(w.journal.view.closed.size).toBe(0);
      expect(input.thread).toBeUndefined();
      return deliveries === 1 ? 2 : null;
    } });
    await worker.sendRequested();
    expect(deliveries).toBeGreaterThanOrEqual(2);
    expect(w.journal.view.closed.size).toBe(0);
    expect(loopHealth(w.journal.view, w.state.now).deliveryUnknown).toBe(3);
    w.reopen(); const before = w.state.sends.length; await w.worker.sendRequested();
    expect(w.state.sends.length).toBe(before); expect(w.journal.view.closed.size).toBe(0);
  } finally { w.journal.close(); }
});

const recordedShapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(recordedShapes.otherShapes)('replays recorded $kind ($id) as work output: no invented completed result or delivery', async shape => {
  const w = world({ rawWork: shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw) as { state: 'uncertain' } : shape.raw });
  try {
    await w.prepare(); expect(w.state.calls.some(id => id.startsWith('obligation:'))).toBe(true);
    await w.worker.sendRequested();
    expect(w.journal.view.obligationWork['commitment:0']?.report).toBeUndefined();
    expect(w.journal.view.closed.size).toBe(0); expect(w.state.sends).toHaveLength(1);
    w.reopen(); await w.worker.sendRequested(); expect(w.state.sends).toHaveLength(1);
  } finally { w.journal.close(); }
});

it('a withdrawn batch releases its still-requested neighbors into a new signed occurrence', async () => {
  const w = world({ count: 3 });
  try {
    await w.prepare(); await w.worker.workObligations(); await w.worker.workObligations();
    const refs = [0, 1, 2].map(i => ({ key: `commitment:${i}`, slot: w.journal.view.obligationWork[`commitment:${i}`]!.lastSlot }));
    const id = owedResultId(refs), writer = w.journal.systemWriter('requested-action',
      owedResultOccurrence(id, refs, w.journal.view.genesis.grant, w.journal.view.genesis.chat), w.state.now)!;
    w.journal.append({ kind: 'action-due', id, items: [], owed: refs, update: 1 + 1 / 1024, writer: writerRecord(writer), at: w.state.now });
    w.state.cancel = true;
    w.worker.intake([{ update_id: 2, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Cancel only the first check.', date: Math.floor(w.state.now / 1000) } }]);
    await w.worker.drain(); await w.worker.sendRequested();
    expect(w.journal.view.obligationWork['commitment:0']!.report?.delivered).toBeUndefined();
    // The normal cancellation answer can carry the remaining results; a withdrawn batch cannot strand them.
    for (const key of ['commitment:1', 'commitment:2']) expect(w.journal.view.obligationWork[key]!.report?.delivered).toBeDefined();
    expect(w.journal.view.order.find(turn => turn.id === id)?.intent).toBeUndefined();
  } finally { w.journal.close(); }
});

it('an unknown acknowledgement does not revoke the operator’s distinct request for a finished result', async () => {
  const w = world();
  try {
    w.state.unknown = true; await w.prepare(); w.state.unknown = false;
    expect(w.journal.view.order[0]!.sent).toBeUndefined();
    await w.worker.sendRequested();
    expect(w.state.sends.filter(send => send.text.includes(result))).toHaveLength(1);
    expect(w.journal.view.closed.has(0)).toBe(true);
    w.reopen(); await w.worker.sendRequested();
    expect(w.state.sends.filter(send => send.text.includes(result))).toHaveLength(1);
  } finally { w.journal.close(); }
});

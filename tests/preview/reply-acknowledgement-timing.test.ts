import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, REPLY_ACKNOWLEDGEMENT, type PreviewPorts } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { at as roomAt, room, question, update as roomUpdate } from './recall-rank-room.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/reply-acknowledgement-live-2026-10-12.json', import.meta.url), 'utf8')) as {
  cases: { update: number; at: number; raw: Parameters<ReturnType<typeof createJournalWorker>['intake']>[0][number];
    answer: string; reply: string; checks: { scores: Record<string, number>; latencyMs: number }[];
    timing: { reserve: number; answerReady: number; answerDuration: number; review: number; send: number; ackReview: number | null; ackSend: number | null } }[] };
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
afterEach(() => vi.useRealTimers());

for (const sample of captured.cases.slice(0, 3)) it(`real recorded timing ${sample.update}: fixed ack starts at ten seconds, never after final send dispatch`, async () => {
  vi.useFakeTimers(); vi.setSystemTime(sample.at);
  const root = mkdtempSync(join(tmpdir(), 'ack-timing-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(71), {
    kind: 'genesis', bot: '8820318295', chat: '-1004290919884', operator: '7812716706', forum: true,
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: sample.at + 86400000,
    maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  const sent: { text: string; at: number; replyTo: number | undefined }[] = [];
  let readyAt: number | undefined, ackReviews = 0;
  const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false, groupDisclosure: async () => true,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', journal.view.genesis.grant, Date.now(), 262144),
    // Include recorded intake-to-answer time; the timer runs concurrently with the recorded slow path.
    model: async () => { await wait(sample.timing.answerReady); readyAt = Date.now();
      const parsed = readAnswer(sample.answer, { wrapped: 'refuse' }); if (!parsed.ok) throw Error('recorded output invalid'); return parsed.value; },
    checkOutbound: () => {},
    send: async input => { await wait(input.expectedText === REPLY_ACKNOWLEDGEMENT ? sample.timing.ackSend! : sample.timing.send); sent.push({ text: input.expectedText, at: Date.now(), replyTo: input.replyTo }); return 100 + sent.length; },
    replyCheck: { elapsedMs: () => Date.now(),
      jev: async () => { await wait(sample.timing.review); return { value: { model: 'jev-1.13.0',
        answers: Object.fromEntries(Object.entries(sample.checks[0]!.scores).map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: sample.checks[0]!.latencyMs }; },
      escalate: async (_text, _id, _prompt, _rules, _deadline, operation) => {
        if (operation === 'acknowledgement') ackReviews++;
        await wait(sample.timing.ackReview ?? 10000); return { verdict: 'pass', confidence: 1, ruleIds: [], latencyMs: 10000 };
      } } };
  try {
    const worker = createJournalWorker(journal, ports); worker.intake([sample.raw]); const drain = worker.drain();
    await vi.advanceTimersByTimeAsync(9999);
    expect(sent.filter(row => row.text === REPLY_ACKNOWLEDGEMENT)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(50000); await drain;
    const acknowledgements = sent.filter(row => row.text === REPLY_ACKNOWLEDGEMENT);
    if (sample.timing.answerReady < 10000) expect(acknowledgements).toHaveLength(0);
    else { expect(acknowledgements).toHaveLength(1);
      expect(acknowledgements[0]!.at - sample.at).toBe(10000 + sample.timing.ackSend!);
      expect(acknowledgements[0]!.at).toBeLessThan(readyAt!);
      expect(acknowledgements[0]!.replyTo).toBe(sample.raw.message!.message_id); }
    expect(ackReviews).toBe(0);
    expect(sent.at(-1)?.text).toBe(sample.reply);
    expect(journal.view.order[0]?.heldNoticeReviewReserved).toBeUndefined();
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('picks up recorded second input and acknowledges it while the first turn still owns the serial worker', async () => {
  const first = captured.cases[2]!, second = captured.cases[3]!;
  vi.useFakeTimers(); vi.setSystemTime(first.at);
  const root = mkdtempSync(join(tmpdir(), 'ack-queue-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(71), {
    kind: 'genesis', bot: '8820318295', chat: '-1004290919884', operator: '7812716706', forum: true,
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: first.at + 86400000,
    maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  const events: { update: number; text: string; at: number }[] = [], answering: number[] = [];
  let active = 0, peak = 0;
  const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false, groupDisclosure: async () => true,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', journal.view.genesis.grant, Date.now(), 262144),
    model: async input => { const sample = input.id.endsWith(String(first.update)) ? first : second;
      answering.push(sample.update); active++; peak = Math.max(peak, active);
      await wait(sample.timing.answerDuration); active--;
      const parsed = readAnswer(sample.answer, { wrapped: 'refuse' }); if (!parsed.ok) throw Error('recorded output invalid'); return parsed.value; },
    checkOutbound: () => {}, send: async input => {
      const sample = input.update === first.update ? first : second;
      await wait(input.expectedText === REPLY_ACKNOWLEDGEMENT ? sample.timing.ackSend! : sample.timing.send);
      events.push({ update: input.update, text: input.expectedText, at: Date.now() }); return 100 + events.length; },
    replyCheck: { elapsedMs: () => Date.now(),
      jev: async (_text, _questions, _timeout, id) => { const sample = id?.endsWith(String(first.update)) ? first : second;
        // Slow first-turn review is independent of second-message intake and its acknowledgement.
        await wait(sample === first ? 12000 : sample.timing.review);
        return { value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.entries(sample.checks[0]!.scores)
          .map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: sample.checks[0]!.latencyMs }; },
      escalate: async () => { throw Error('fixed template must not request model review'); } } };
  try {
    const worker = createJournalWorker(journal, ports); worker.intake([first.raw]); const drain = worker.drain();
    await vi.advanceTimersByTimeAsync(second.at - first.at); worker.intake([second.raw]);
    expect(journal.view.order[1]).toMatchObject({ update: second.update, at: second.at, accepted: true, reserved: false });
    expect(journal.view.cursor).toBe(second.update + 1);
    await vi.advanceTimersByTimeAsync(10000 + second.timing.ackSend!);
    const ack = events.filter(row => row.update === second.update && row.text === REPLY_ACKNOWLEDGEMENT);
    expect(ack).toHaveLength(1); expect(ack[0]!.at - second.at).toBe(10000 + second.timing.ackSend!);
    expect(answering).toEqual([first.update]); // answer calls remain serial, with no speculative paid reservation
    expect(events.some(row => row.text === first.reply)).toBe(false);
    await vi.advanceTimersByTimeAsync(50000); await drain;
    expect(answering).toEqual([first.update, second.update]); expect(peak).toBe(1);
    expect(events.filter(row => row.text === REPLY_ACKNOWLEDGEMENT)).toHaveLength(2);
    expect(events.filter(row => row.text !== REPLY_ACKNOWLEDGEMENT).map(row => row.text)).toEqual([first.reply, second.reply]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each([1000, 20000])('keeps acknowledgement through a format continuation lasting %s ms, including review', async continuationMs => {
  const sample = captured.cases[1]!;
  vi.useFakeTimers(); vi.setSystemTime(sample.at);
  const root = mkdtempSync(join(tmpdir(), 'ack-continuation-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(71), {
    kind: 'genesis', bot: '8820318295', chat: '-1004290919884', operator: '7812716706', forum: true,
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: sample.at + 86400000,
    maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  const sent: string[] = [];
  let calls = 0, reviewing = false;
  const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false, groupDisclosure: async () => true,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', journal.view.genesis.grant, Date.now(), 262144),
    model: async () => {
      calls++;
      if (calls === 1) { await wait(1000); return { state: 'complete', failureClass: 'malformed' }; }
      await wait(continuationMs);
      const parsed = readAnswer(sample.answer, { wrapped: 'refuse' }); if (!parsed.ok) throw Error('recorded output invalid'); return parsed.value;
    },
    checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return 100 + sent.length; },
    replyCheck: { elapsedMs: () => Date.now(),
      jev: async () => { reviewing = true; await wait(12000); return { value: { model: 'jev-1.13.0',
        answers: Object.fromEntries(Object.entries(sample.checks[0]!.scores).map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 12000 }; },
      escalate: async () => { throw Error('unexpected escalation'); } } };
  try {
    const worker = createJournalWorker(journal, ports); worker.intake([sample.raw]); const drain = worker.drain();
    await vi.advanceTimersByTimeAsync(10000);
    expect(calls).toBe(2);
    expect(sent).toEqual([REPLY_ACKNOWLEDGEMENT]);
    expect(reviewing).toBe(continuationMs < 10000);
    if (continuationMs > 10000) expect(journal.view.order[0]?.answer).toBeUndefined();
    await vi.advanceTimersByTimeAsync(40000); await drain;
    expect(sent).toEqual([REPLY_ACKNOWLEDGEMENT, sample.reply]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('reopens two durable queued inputs and reconstructs both timers before the first serial answer', async () => {
  const samples = captured.cases.slice(2);
  const at = samples[0]!.at;
  vi.useFakeTimers(); vi.setSystemTime(at);
  const root = mkdtempSync(join(tmpdir(), 'ack-restart-')), path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(71);
  let journal = openPreviewJournal(path, key, {
    kind: 'genesis', bot: '8820318295', chat: '-1004290919884', operator: '7812716706', forum: true,
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at + 86400000,
    maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  const sent: { update: number; text: string }[] = [], answering: number[] = [];
  const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false, groupDisclosure: async () => true,
    model: async input => {
      const sample = samples.find(item => input.id.endsWith(String(item.update)))!; answering.push(sample.update);
      await wait(20000);
      const parsed = readAnswer(sample.answer, { wrapped: 'refuse' }); if (!parsed.ok) throw Error('recorded output invalid'); return parsed.value;
    }, checkOutbound: () => {}, send: async input => { sent.push({ update: input.update, text: input.expectedText }); return 100 + sent.length; } };
  try {
    createJournalWorker(journal, ports).intake(samples.map(sample => sample.raw));
    expect(journal.view.order.every(turn => turn.accepted && !turn.reserved)).toBe(true);
    journal.close(); vi.clearAllTimers(); // process loss discards local timers, not durable intake
    journal = openPreviewJournal(path, key);
    const worker = createJournalWorker(journal, ports), drain = worker.drain();
    await vi.advanceTimersByTimeAsync(10000);
    expect(sent).toEqual(samples.map(sample => ({ update: sample.update, text: REPLY_ACKNOWLEDGEMENT })));
    expect(answering).toEqual([samples[0]!.update]);
    expect(journal.view.order[1]?.reserved).toBe(false);
    await vi.advanceTimersByTimeAsync(40000); await drain;
    expect(answering).toEqual(samples.map(sample => sample.update));
    expect(sent.filter(row => row.text !== REPLY_ACKNOWLEDGEMENT).map(row => row.text)).toEqual(samples.map(sample => sample.reply));
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain();
    expect(sent).toHaveLength(4); // accepted acknowledgement intents and answers never repeat
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});


it.each([false, true])('saved answer remains acknowledgement-eligible during slow review, restart=%s', async restart => {
  const sample = captured.cases[1]!;
  vi.useFakeTimers(); vi.setSystemTime(sample.at);
  const root = mkdtempSync(join(tmpdir(), 'ack-saved-answer-')), path = join(root, 'journal.encrypted');
  const key = new Uint8Array(32).fill(71);
  let journal = openPreviewJournal(path, key, {
    kind: 'genesis', bot: '8820318295', chat: '-1004290919884', operator: '7812716706', forum: true,
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: sample.at + 86400000,
    maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  const sent: string[] = [];
  const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false, groupDisclosure: async () => true,
    model: async () => { throw Error('saved answer must not call the model again'); }, checkOutbound: () => {},
    send: async input => { sent.push(input.expectedText); return 100 + sent.length; },
    replyCheck: { elapsedMs: () => Date.now(), jev: async () => { throw Error('review service unavailable'); },
      escalate: async () => { await wait(12000); return { verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 12000 }; } } };
  try {
    let worker = createJournalWorker(journal, ports); worker.intake([sample.raw]);
    const turn = journal.view.order[0]!;
    journal.append({ kind: 'reserve', id: turn.id, at: sample.at });
    await vi.advanceTimersByTimeAsync(1000);
    journal.append({ kind: 'answer', id: turn.id, text: sample.reply, state: 'complete', at: Date.now() });
    if (restart) {
      journal.close(); vi.clearAllTimers(); vi.setSystemTime(sample.at + 1000);
      journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    }
    const drain = worker.drain();
    await vi.advanceTimersByTimeAsync(8999); expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(1); expect(sent).toEqual([REPLY_ACKNOWLEDGEMENT]);
    expect(journal.view.order[0]?.intent).toBeUndefined();
    await vi.advanceTimersByTimeAsync(10000); await drain;
    expect(sent).toEqual([REPLY_ACKNOWLEDGEMENT, sample.reply]);
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain();
    expect(sent).toEqual([REPLY_ACKNOWLEDGEMENT, sample.reply]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});


it('keeps the timer through the recorded P4 memory lookup until its second answer is usable', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/proofroom2-recallrank-2026-10-02.json', import.meta.url), 'utf8')) as {
    lookupSamples: { samples: { label: string; calls: { raw: string }[] }[] } };
  const sample = fixture.lookupSamples.samples.find(item => item.label === 'P4')!;
  vi.useFakeTimers(); vi.setSystemTime(roomAt + 7_000_000);
  const root = mkdtempSync(join(tmpdir(), 'ack-lookup-')), sent: string[] = [];
  let calls = 0;
  const { journal } = room(join(root, 'journal.encrypted'), 'B');
  const worker = createJournalWorker(journal, { now: () => Date.now(), stopped: () => false,
    checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
    model: async () => {
      const index = calls++;
      await wait(index === 0 ? 1000 : 20000);
      const parsed = readAnswer(index === 0 ? sample.calls[0]!.raw : fixture.lookupSamples.samples.find(item => item.label === 'P1')!.calls[1]!.raw, { wrapped: 'refuse' });
      if (!parsed.ok) throw Error('recorded lookup output invalid'); return parsed.value;
    } });
  try {
    worker.intake([roomUpdate(question.update, question.message)]); const drain = worker.drain();
    await vi.advanceTimersByTimeAsync(10000);
    expect(calls).toBe(2); expect(journal.view.order.at(-1)?.lookup).toBeDefined();
    expect(journal.view.order.at(-1)?.answer).toBeUndefined(); expect(sent).toEqual([REPLY_ACKNOWLEDGEMENT]);
    await vi.advanceTimersByTimeAsync(30000); await drain;
    expect(sent).toHaveLength(2); expect(sent[1]).toContain('2958'); expect(calls).toBe(2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

// Replay the captured answer/reviewer bytes with the observer #311 timing boundary injected.
// Reported timings are from holdack5-1012-brief.txt, updates 969390429 and 969390426.
// Answer/reviewer bytes below are the committed 969390408 capture, not invented captures of those turns.
it.each([
  { label: '969390429: ready 9.6s, review/revision, delivered 36.2s', answerMs: 9600, reviewMs: 26600, sendMs: 0 },
  { label: '969390426: ready 7s, fallback review, delivered 18.3s', answerMs: 7000, reviewMs: 11300, sendMs: 0 },
  { label: 'delivered at 8.2s', answerMs: 7000, reviewMs: 1200, sendMs: 0 },
  { label: 'dispatched at 9.9s, delivered after timer', answerMs: 7000, reviewMs: 2900, sendMs: 8300 },
  ...[9300, 10500, 20000].map(answerMs => ({ label: `ready at ${answerMs}ms`, answerMs, reviewMs: 2700, sendMs: 0 })),
])('$label: acknowledgement depends on final dispatch', async ({ answerMs, reviewMs, sendMs }) => {
  const sample = captured.cases[1]!;
  vi.useFakeTimers(); vi.setSystemTime(sample.at);
  const root = mkdtempSync(join(tmpdir(), 'ack-ten-second-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(71), {
    kind: 'genesis', bot: '8820318295', chat: '-1004290919884', operator: '7812716706', forum: true,
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: sample.at + 86400000,
    maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  const sent: { text: string; at: number; replyTo: number | undefined }[] = [];
  const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false, groupDisclosure: async () => true,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', journal.view.genesis.grant, Date.now(), 262144),
    model: async () => { await wait(answerMs);
      const parsed = readAnswer(sample.answer, { wrapped: 'refuse' });
      if (!parsed.ok) throw Error('recorded output invalid'); return parsed.value; },
    checkOutbound: () => {},
    send: async input => { if (input.expectedText !== REPLY_ACKNOWLEDGEMENT && sendMs > 0) await wait(sendMs);
      sent.push({ text: input.expectedText, at: Date.now() - sample.at, replyTo: input.replyTo }); return sent.length + 100; },
    replyCheck: { elapsedMs: () => Date.now(),
      jev: async () => { await wait(reviewMs); return { value: { model: 'jev-1.13.0',
        answers: Object.fromEntries(Object.entries(sample.checks[0]!.scores).map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: reviewMs }; },
      escalate: async () => { throw Error('unexpected escalation'); } } };
  try {
    const worker = createJournalWorker(journal, ports); worker.intake([sample.raw]); const drain = worker.drain();
    await vi.advanceTimersByTimeAsync(9999);
    expect(sent.filter(row => row.text === REPLY_ACKNOWLEDGEMENT)).toEqual([]);
    if (answerMs + reviewMs < 10000) expect(journal.view.order[0]?.intent).toBeDefined();
    if (answerMs === 9300) {
      expect(journal.view.order[0]?.answer).toBeDefined();
      expect(journal.view.order[0]?.sent).toBeUndefined();
    }
    await vi.advanceTimersByTimeAsync(1);
    const ack = { text: REPLY_ACKNOWLEDGEMENT, at: 10000, replyTo: sample.raw.message!.message_id };
    expect(sent.filter(row => row.text === REPLY_ACKNOWLEDGEMENT)).toEqual(answerMs + reviewMs >= 10000 ? [ack] : []);
    await vi.advanceTimersByTimeAsync(30000); await drain; await worker.minimal();
    const reply = { text: sample.reply, at: answerMs + reviewMs + sendMs, replyTo: sample.raw.message!.message_id };
    expect(sent).toEqual(answerMs + reviewMs >= 10000 ? [ack, reply] : [reply]);
    // New intents admitted after answer readiness remain readable and never resend on restart.
    const count = sent.length;
    journal.compact(); journal.close();
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(71));
    try { await createJournalWorker(reopened, ports).drain(); expect(sent).toHaveLength(count); }
    finally { reopened.close(); }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

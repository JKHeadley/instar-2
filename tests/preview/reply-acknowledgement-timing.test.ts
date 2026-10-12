import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, REPLY_ACKNOWLEDGEMENT, type PreviewPorts } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/reply-acknowledgement-live-2026-10-12.json', import.meta.url), 'utf8')) as {
  cases: { update: number; at: number; raw: Parameters<ReturnType<typeof createJournalWorker>['intake']>[0][number];
    answer: string; reply: string; checks: { scores: Record<string, number>; latencyMs: number }[];
    timing: { reserve: number; answerReady: number; answerDuration: number; review: number; send: number; ackReview: number | null; ackSend: number | null } }[] };
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
afterEach(() => vi.useRealTimers());

for (const sample of captured.cases.slice(0, 3)) it(`real recorded timing ${sample.update}: fixed ack by ten seconds, never after answer readiness`, async () => {
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
    await vi.advanceTimersByTimeAsync(7999);
    expect(sent.filter(row => row.text === REPLY_ACKNOWLEDGEMENT)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(50000); await drain;
    const acknowledgements = sent.filter(row => row.text === REPLY_ACKNOWLEDGEMENT);
    if (sample.timing.answerReady < 8000) expect(acknowledgements).toHaveLength(0);
    else { expect(acknowledgements).toHaveLength(1);
      expect(acknowledgements[0]!.at - sample.at).toBeLessThanOrEqual(10000);
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
    await vi.advanceTimersByTimeAsync(10000);
    const ack = events.filter(row => row.update === second.update && row.text === REPLY_ACKNOWLEDGEMENT);
    expect(ack).toHaveLength(1); expect(ack[0]!.at - second.at).toBeLessThanOrEqual(10000);
    expect(answering).toEqual([first.update]); // answer calls remain serial, with no speculative paid reservation
    expect(events.some(row => row.text === first.reply)).toBe(false);
    await vi.advanceTimersByTimeAsync(50000); await drain;
    expect(answering).toEqual([first.update, second.update]); expect(peak).toBe(1);
    expect(events.filter(row => row.text === REPLY_ACKNOWLEDGEMENT)).toHaveLength(2);
    expect(events.filter(row => row.text !== REPLY_ACKNOWLEDGEMENT).map(row => row.text)).toEqual([first.reply, second.reply]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

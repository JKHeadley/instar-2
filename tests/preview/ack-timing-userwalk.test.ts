import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, REPLY_ACKNOWLEDGEMENT, QUEUED_REPLY_ACKNOWLEDGEMENT,
  type PreviewPorts } from './journal-test-worker.js';

type Frame = { frame: number; kind: string; id: string; at: number; update?: number; raw?: string; text?: string;
  phase?: string; measurements?: Record<string, number | boolean> };
const captured = JSON.parse(readFileSync(new URL('./fixtures/ack-timing-userwalk-2026-10-13.json', import.meta.url), 'utf8')) as {
  browserSentAt: Record<string, number>; frames: Frame[] };
const samples = [6233120, 6233121, 6233124, 6233129, 6233125, 6233126, 6233132, 6233133].map(update => {
  const intake = captured.frames.find(f => f.kind === 'intake' && f.update === update)!;
  const row = (kind: string) => captured.frames.find(f => f.kind === kind && f.id === intake.id)!;
  const schedule = captured.frames.find(f => f.id === `held-notice:${intake.id}` && f.phase === 'acknowledgement')!;
  return { update, intake, intent: row('intent'), sent: row('sent'), notice: row('held-notice-intent'), receipt: row('held-notice-sent'),
    callbackDelay: Number(schedule.measurements!.callbackEnteredAt) - Number(schedule.measurements!.scheduledDueAt) };
});
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
afterEach(() => vi.useRealTimers());

// Replay the actual durable intake, terminal text and readiness/transport timeline. The
// answer/revision/review interval is an injected slow dependency, not a new model judgment.
async function replay(updates: number[], extraTransport = 0) {
  const turns = updates.map(update => samples.find(s => s.update === update)!);
  vi.useFakeTimers(); vi.setSystemTime(turns[0]!.intake.at);
  const root = mkdtempSync(join(tmpdir(), 'userwalk-ack-')), path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(79);
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8989505249', chat: '7812716706', operator: '7812716706',
    grant: 'grant:preview', configurationDigest: 'sha256:recorded', expires: Date.now() + 86400000,
    maxCalls: 20, maxReplies: 20, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  const sends: { update: number; text: string; at: number; replyTo?: number }[] = [];
  const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false, checkOutbound: () => {},
    acknowledgementTimer: (ms, callback) => {
      const turn = turns.find(s => s.intake.at === Date.now()) ?? turns[0]!;
      const timer = setTimeout(callback, ms + turn.callbackDelay); return () => clearTimeout(timer);
    },
    model: async input => {
      const sample = turns.find(s => s.intake.id === input.id)!;
      await wait(Math.max(0, sample.intent.at - Date.now())); return sample.intent.text!;
    },
    send: async input => {
      const sample = turns.find(s => s.update === input.update)!;
      const notice = input.target?.startsWith('held-notice:') === true;
      // Include the captured callback-to-admission interval as well as transport.
      await wait(notice ? sample.receipt.at - (sample.intake.at + 10000 + sample.callbackDelay) + extraTransport
        : sample.sent.at - sample.intent.at);
      sends.push({ update: input.update, text: input.expectedText, at: Date.now(), ...(input.replyTo ? { replyTo: input.replyTo } : {}) });
      return 100 + sends.length;
    } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([JSON.parse(turns[0]!.intake.raw!)]); const drain = worker.drain();
    for (const sample of turns.slice(1)) {
      await vi.advanceTimersByTimeAsync(sample.intake.at - Date.now()); worker.intake([JSON.parse(sample.intake.raw!)]);
    }
    await vi.advanceTimersByTimeAsync(120000); await drain; await worker.minimal();
    for (const [index, sample] of turns.entries()) {
      // Fail-before: recorded old receipt is late. The same transport and jitter now fit the budget.
      expect(sample.receipt.at - captured.browserSentAt[sample.update]!).toBeGreaterThan(10000);
      const own = sends.filter(s => s.update === sample.update);
      expect(own.map(s => s.text)).toEqual([index === 0 ? REPLY_ACKNOWLEDGEMENT : QUEUED_REPLY_ACKNOWLEDGEMENT, sample.intent.text]);
      expect(own[0]!.at - captured.browserSentAt[sample.update]!).toBeLessThanOrEqual(10000);
      expect(own[0]!.replyTo).toBe(JSON.parse(sample.intake.raw!).message.message_id);
      expect(own[1]!.at).toBe(sample.sent.at);
    }
    // Durable notice + terminal intents survive compaction/restart without either being sent twice.
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain(); expect(sends).toHaveLength(turns.length * 2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}
for (const update of [6233120, 6233121, 6233124, 6233129]) it(`F8 ${update}: receipt by ten seconds with recorded jitter and transport`, async () => replay([update]));
for (const pair of [[6233125, 6233126], [6233132, 6233133]]) it(`F4 ${pair.join('/')}: accurate queue notice, ordered final results`, async () => replay(pair));
it('F8 worst observed intake/jitter with an additional 750ms transport delay stays inside the target', async () => replay([6233129], 750));

it('rechecks a queued line when its request starts during delayed admission', async () => {
  const turns = [samples.find(s => s.update === 6233125)!, samples.find(s => s.update === 6233126)!];
  const at = turns[0]!.intake.at;
  vi.useFakeTimers(); vi.setSystemTime(at);
  const root = mkdtempSync(join(tmpdir(), 'ack-queue-admission-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(80), {
    kind: 'genesis', bot: '8989505249', chat: '7812716706', operator: '7812716706', grant: 'grant:preview',
    configurationDigest: 'sha256:recorded', expires: at + 86400000, maxCalls: 20, maxReplies: 20, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  const sent: string[] = [];
  const worker = createJournalWorker(journal, { now: () => Date.now(), stopped: () => false, checkOutbound: () => {},
    sendAdmits: true,
    model: async input => {
      const first = input.id === turns[0]!.intake.id;
      await wait(first ? 8000 : 20000); return turns[first ? 0 : 1]!.intent.text!;
    },
    send: async input => {
      if (input.expectedText === QUEUED_REPLY_ACKNOWLEDGEMENT) await wait(3000);
      if (input.current && !input.current()) return { kind: 'refused', reason: 'notice changed before admission' };
      input.admit?.(); sent.push(input.expectedText); return sent.length + 100;
    } });
  try {
    worker.intake(turns.map(s => JSON.parse(s.intake.raw!))); const drain = worker.drain();
    await vi.advanceTimersByTimeAsync(10000);
    expect(journal.view.order[1]?.reserved).toBe(true);
    expect(journal.view.order[1]?.heldNoticeIntent).toBeUndefined();
    await worker.minimal();
    await vi.advanceTimersByTimeAsync(30000); await drain;
    expect(sent).toEqual([REPLY_ACKNOWLEDGEMENT, turns[0]!.intent.text, REPLY_ACKNOWLEDGEMENT, turns[1]!.intent.text]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

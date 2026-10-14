import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, REPLY_ACKNOWLEDGEMENT, type PreviewPorts } from './journal-test-worker.js';

type Frame = { frame: number; kind: string; id: string; at: number; update?: number; raw?: string; text?: string;
  phase?: string; measurements?: Record<string, number | boolean> };
const captured = JSON.parse(readFileSync(new URL('./fixtures/ack-deadline-rewalk-2026-10-14.json', import.meta.url), 'utf8')) as { frames: Frame[] };
const samples = captured.frames.filter(f => f.kind === 'intake').map(intake => {
  const row = (kind: string) => captured.frames.find(f => f.kind === kind && f.id === intake.id)!;
  const timer = captured.frames.find(f => f.id === `held-notice:${intake.id}` && f.phase === 'acknowledgement')!;
  return { intake, intent: row('intent'), sent: row('sent'), receipt: row('held-notice-sent'),
    jitter: Number(timer.measurements!.callbackEnteredAt) - Number(timer.measurements!.scheduledDueAt) };
});
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
afterEach(() => vi.useRealTimers());

// Replay the recorded intake, final text and readiness/transport timeline through the shipped
// journal worker. Model/review time is a slow dependency here; no new model judgment is claimed.
for (const sample of samples) it(`copy-walk ${sample.intake.update}: receipt before 10s including admission, jitter and transport`, async () => {
  await replay(sample);
});
it.each([0, 6000, 6999])('a final answer ready at %sms suppresses the acknowledgement, even during slow final transport', async readyMs => {
  await replay(samples[0]!, readyMs);
});

async function replay(sample: typeof samples[number], readyMs?: number) {
  vi.useFakeTimers(); vi.setSystemTime(sample.intake.at);
  const root = mkdtempSync(join(tmpdir(), 'ack-deadline-')), path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(81);
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8968100844', chat: '7812716706', operator: '7812716706',
    grant: 'grant:preview', configurationDigest: 'sha256:recorded', expires: Date.now() + 86400000,
    maxCalls: 20, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 });
  const sends: { text: string; at: number }[] = [];
  const ports: PreviewPorts = { now: () => Date.now(), stopped: () => false, checkOutbound: () => {},
    acknowledgementTimer: (ms, callback) => {
      const timer = setTimeout(callback, ms + sample.jitter); return () => clearTimeout(timer);
    },
    model: async () => { await wait(readyMs ?? sample.intent.at - sample.intake.at); return sample.intent.text!; },
    send: async input => {
      const acknowledgement = input.expectedText === REPLY_ACKNOWLEDGEMENT;
      await wait(acknowledgement ? sample.receipt.at - sample.intake.at - 10000 - sample.jitter
        : readyMs === undefined ? sample.sent.at - sample.intent.at : 5000);
      sends.push({ text: input.expectedText, at: Date.now() }); return 100 + sends.length;
    } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([JSON.parse(sample.intake.raw!)]); const drain = worker.drain();
    await vi.advanceTimersByTimeAsync(60000); await drain; await worker.minimal();
    if (readyMs === undefined) {
      expect(sample.receipt.at - sample.intake.at).toBeGreaterThan(10000);
      expect(sends.map(s => s.text)).toEqual([REPLY_ACKNOWLEDGEMENT, sample.intent.text]);
      expect(sends[0]!.at - sample.intake.at).toBeLessThan(10000);
      expect(sends[0]!.at).toBe(sample.receipt.at - 3000);
      expect(sends[1]!.at).toBe(sample.sent.at);
    } else expect(sends.map(s => s.text)).toEqual([sample.intent.text]);
    const count = sends.length;
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain(); expect(sends).toHaveLength(count);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

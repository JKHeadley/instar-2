import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewClock } from './clock.js';
import { createJournalWorker, openPreviewJournal, SUMMARY_UNKNOWN_RECOVERY_MS } from './journal-test-worker.js';
import { dueState } from './dated-memory.js';

const key = new Uint8Array(32).fill(31);
const start = Date.UTC(2026, 8, 27, 17);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:clock-jump', configurationDigest: 'sha256:clock-jump', expires: start + 120_000,
  maxCalls: 12, maxReplies: 12, maxTurns: 12, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
  date: Math.floor((start + id * 1000) / 1000) } });

it('advances through a backward correction, accepts a forward correction, and seeds a reopened process', () => {
  let wall = start, elapsed = 0;
  const clock = createPreviewClock(() => wall, () => elapsed);
  expect(clock.now()).toBe(start);
  wall -= 3_600_000; elapsed += 5000;
  expect(clock.now()).toBe(start + 5000);
  wall = start + 90_000; elapsed += 1000;
  expect(clock.now()).toBe(start + 90_000);
  wall = start - 3_600_000; elapsed += 1000;
  expect(clock.now()).toBe(start + 91_000);
  const reopened = createPreviewClock(() => wall, () => elapsed);
  reopened.seed(clock.now());
  expect(reopened.now()).toBe(start + 91_000);
});

it('keeps dated answers and journal time ordered, and never reopens expiry after a forward jump', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-clock-jump-')));
  try {
    const path = join(root, 'journal.encrypted');
    let wall = start, elapsed = 0, sends = 0;
    const packetTimes: number[] = [];
    const clock = createPreviewClock(() => wall, () => elapsed);
    let journal = openPreviewJournal(path, key, genesis);
    const ports = { now: clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async (input: { question: string; context: string }) => {
        const packet = JSON.parse(input.context) as { now: number };
        packetTimes.push(packet.now);
        return JSON.stringify({ reply: input.question.includes('How long ago')
          ? `About ${Math.floor((packet.now - (start + 1000)) / 1000)} seconds ago.` : 'Recorded.', memory: [],
        dated: input.question.includes('deadline') ? [{ quote: input.question, when: 'tomorrow' }] : [] });
      },
      send: async () => ++sends, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'My deadline is tomorrow.')]); await worker.drain();
    expect(journal.view.dated[0]?.day).toBe('2026-09-28');
    const firstFloor = journal.view.clockFloor;
    wall -= 3_600_000; elapsed += 5000;
    worker.intake([update(2, 'How long ago was that?')]); await worker.drain();
    expect(journal.view.clockFloor).toBeGreaterThan(firstFloor);
    expect(journal.view.order[1]?.at).toBeGreaterThanOrEqual(journal.view.order[0]!.at);
    expect(packetTimes[1]).toBeGreaterThanOrEqual(start + 5000);
    expect(journal.view.order[1]?.intent).toContain('About 4 seconds ago.');
    expect(sends).toBe(2);
    journal.compact();
    journal.close();
    journal = openPreviewJournal(path, key);
    const resumed = createPreviewClock(() => wall, () => elapsed);
    resumed.seed(journal.view.clockFloor);
    worker = createJournalWorker(journal, { ...ports, now: resumed.now });
    expect(resumed.now()).toBeGreaterThanOrEqual(journal.view.clockFloor);
    wall = start + 119_999;
    expect(() => worker.gate()).not.toThrow();
    expect(dueState(journal.view.dated[0]!, resumed.now())).toBe('upcoming');
    wall = start + 120_000;
    expect(() => worker.gate()).toThrow('preview stopped');
    expect(journal.view.stop).toBe('trial expired');
    wall = start + 2 * 86_400_000;
    expect(dueState(journal.view.dated[0]!, resumed.now())).toBe('overdue');
    wall = start - 3_600_000; elapsed += 1000;
    expect(() => worker.gate()).toThrow('preview stopped');
    expect(sends).toBe(2);
    journal.close();
    journal = openPreviewJournal(path, key);
    const rolledBack = createPreviewClock(() => wall, () => elapsed);
    rolledBack.seed(journal.view.clockFloor);
    worker = createJournalWorker(journal, { ...ports, now: rolledBack.now });
    expect(rolledBack.now()).toBeGreaterThanOrEqual(journal.view.expires);
    expect(() => worker.gate()).toThrow('preview stopped');
    expect(() => worker.intake([update(3, 'Try again')])).toThrow('preview stopped');
    expect(sends).toBe(2);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('waits the full elapsed pause before a new summary frontier after a backward jump', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-clock-summary-')));
  try {
    const path = join(root, 'journal.encrypted');
    let wall = start, elapsed = 0;
    const clock = createPreviewClock(() => wall, () => elapsed);
    const journal = openPreviewJournal(path, key, { ...genesis, expires: start + 600_000 });
    const summaries: string[] = [];
    const ports = { now: clock.now, elapsed: clock.elapsed, stopped: () => false,
      model: async (input: { id: string }) => { if (input.id.startsWith('summary:')) summaries.push(input.id); return 'answer'; },
      send: async () => 1, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Remember ORCHID')]); await worker.drain();
    journal.append({ kind: 'summary-reserve', through: 1, at: clock.now() });
    worker = createJournalWorker(journal, ports);
    worker.intake([update(2, 'What did I ask?')]); await worker.drain();
    wall -= 3_600_000; elapsed += SUMMARY_UNKNOWN_RECOVERY_MS - 1;
    await worker.summarizeIfNeeded(true);
    expect(summaries).toEqual([]);
    elapsed += 1;
    await worker.summarizeIfNeeded(true);
    expect(summaries).toEqual(['summary:2']);
    expect(journal.view.summaryReservations.has(1)).toBe(true);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('requires elapsed recovery after a forward correction and after reopening an UNKNOWN summary', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-clock-forward-summary-')));
  try {
    const path = join(root, 'journal.encrypted');
    let wall = start, elapsed = 0;
    const clock = createPreviewClock(() => wall, () => elapsed);
    let journal = openPreviewJournal(path, key, { ...genesis, expires: start + 600_000 });
    const summaries: string[] = [];
    const ports = { now: clock.now, elapsed: clock.elapsed, stopped: () => false,
      model: async (input: { id: string }) => { if (input.id.startsWith('summary:')) summaries.push(input.id); return 'answer'; },
      send: async () => 1, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Remember ORCHID')]); await worker.drain();
    journal.append({ kind: 'summary-reserve', through: 1, at: clock.now() });
    worker = createJournalWorker(journal, ports);
    worker.intake([update(2, 'What did I ask?')]); await worker.drain();
    wall += 60_000; elapsed += 1;
    await worker.summarizeIfNeeded(true);
    expect(summaries).toEqual([]);
    journal.close();
    journal = openPreviewJournal(path, key);
    const resumed = createPreviewClock(() => wall, () => elapsed);
    resumed.seed(journal.view.clockFloor);
    worker = createJournalWorker(journal, { ...ports, now: resumed.now, elapsed: resumed.elapsed });
    elapsed += SUMMARY_UNKNOWN_RECOVERY_MS - 1;
    await worker.summarizeIfNeeded(true);
    expect(summaries).toEqual([]);
    elapsed += 1;
    await worker.summarizeIfNeeded(true);
    expect(summaries).toEqual(['summary:2']);
    expect(journal.view.summaryReservations.has(1)).toBe(true);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

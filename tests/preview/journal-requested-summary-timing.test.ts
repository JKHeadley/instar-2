import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, settleSummarySchedule } from './journal-test-worker.js';

const zone = 'America/Los_Angeles';
const start = Date.UTC(2026, 8, 26, 17);
const when = 'every day at 6 pm starting tomorrow until Friday';

it('regression: a supported start does not swallow the unsupported end qualification', () => {
  expect(settleSummarySchedule('every day at 6 pm starting tomorrow', 'daily', start, zone))
    .toEqual({ time: '18:00', first: '2026-09-27' });
  expect(settleSummarySchedule('every day at 6 pm until Friday', 'daily', start, zone)).toHaveProperty('refusal');
  expect(settleSummarySchedule(when, 'daily', start, zone)).toHaveProperty('refusal');
});

it('regression: no summary sends after the operator requested end day, including after replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'astra-summary-end-')));
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(31);
  let now = start;
  const sent: string[] = [];
  const request = `send me a summary of today ${when}`;
  const ports = { now: () => now, stopped: () => false, timeZone: zone, checkOutbound: () => {},
    model: async (input: { question: string }) => input.question.startsWith('[Scheduled summary')
      ? JSON.stringify({ reply: 'Summary: nothing new.', memory: [], dated: [] })
      : JSON.stringify({ reply: 'Okay.', memory: [], dated: [], summaries: [{ quote: request, when, period: 'today', repeat: 'daily' }] }),
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:summary', configurationDigest: 'sha256:summary', expires: Date.UTC(2026, 9, 10),
    maxCalls: 30, maxReplies: 30, maxTurns: 30, maxBytes: 12000, cursor: 0 });
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: request, date: Math.floor(start / 1000) } }]);
    await worker.drain();
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    now = Date.UTC(2026, 9, 4, 1); // Saturday October 3, 18:00 local, after Friday October 2.
    await worker.drain();
    expect(sent.filter(text => text.startsWith('PREVIEW summary you asked for'))).toEqual([]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

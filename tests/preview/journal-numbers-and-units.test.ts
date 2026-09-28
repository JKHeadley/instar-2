import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Fixtures substitute the model and Jev (int11's faithfulness check runs before a summary commits).
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(41);
const now = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 12, maxReplies: 8, maxTurns: 8, maxBytes: 6200, cursor: 0 }; // inside the measured window where complete history cannot fit but the recall packet can (cbuild-2 re-measure with the always-offered decisions: 5800-6200; was 4000-5500)
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it('answers from an exact journal quote after a lossy summary and restart, keeping decimal and unit', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-quantities-')));
  const path = join(root, 'journal.encrypted');
  const seen: string[] = [];
  const sent: string[] = [];
  const ports = { now: () => now, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) {
        expect(input.question).toContain('original number and unit exactly');
        return JSON.stringify({ summary: 'The operator discussed a route of about 3 miles.', people: [] });
      }
      seen.push(input.context);
      if (input.question.includes('How far')) {
        const packet = JSON.parse(input.context);
        const source = packet.recalled?.find((item: { user: string }) => item.user.includes('3.25 miles'));
        return source ? 'The route was 3.25 miles.' : 'I do not know the exact distance.';
      }
      return 'Noted.';
    }, send: async ({ text }: { text: string }) => { sent.push(text); return sent.length; }, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'My usual route is 3.25 miles.')]);
    await worker.drain();
    expect(journal.view.order[0]?.text).toBe('My usual route is 3.25 miles.');
    const beforeSummary = worker.probe('How far was my usual route?');
    if ('reason' in beforeSummary) throw Error(beforeSummary.reason);
    expect(JSON.parse(beforeSummary.context).history[0].user).toBe('My usual route is 3.25 miles.');
    worker.intake([2, 3, 4, 5].map(id => update(id, `Unrelated notes ${id}: ${'weather and errands '.repeat(16)}`)));
    await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(journal.view.summaries.at(-1)?.text).toContain('about 3 miles');
    expect(journal.view.summaries.at(-1)?.through).toBeGreaterThanOrEqual(1);
    journal.close();

    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    worker.intake([update(6, 'How far was my usual route?')]);
    await worker.drain();
    const packet = JSON.parse(seen.at(-1)!);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.recalled).toEqual(expect.arrayContaining([expect.objectContaining({ user: 'My usual route is 3.25 miles.' })]));
    expect(packet.capability).toContain('Do not round, convert, omit, or invent the unit');
    expect(sent.at(-1)).toBe('PREVIEW — The route was 3.25 miles.');
    expect(journal.view.order[5]?.sent).toBe(6);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not invent a unit when the original contains only a bare number', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-bare-number-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The operator reported a route length of 3.', people: [] }) : 'Noted.',
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'The route length was 3.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    const probe = worker.probe('How far was the route?');
    if ('reason' in probe) throw Error(probe.reason);
    const packet = JSON.parse(probe.context);
    const original = [...packet.recalled ?? [], ...packet.history].find((item: { user: string }) => item.user === 'The route length was 3.');
    expect(original?.user).toBe('The route length was 3.');
    expect(original?.user).not.toMatch(/\b3\s*(?:miles|mg)\b/u);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

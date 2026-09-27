import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, importChannelFixture, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(31);
const now = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: now + 1000000,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 8000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it('labels direct, imported and summary memory after replay; direct facts outrank conflicting inference', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-source-trust-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const account = 'agent@example.test';
    importChannelFixture(journal, [{ source: 'email', account, id: 'mail-1', from: 'justin@example.test',
      at: now - 60000, subject: 'Studio launch', text: 'The studio launch color is blue.' }], account, now);
    let compact = false;
    const contexts: string[] = [];
    const ports = { now: () => now, stopped: () => false,
      prepareModel: ({ context }: { context: string }) => {
        if (compact && JSON.parse(context).historyMode === 'complete') throw Error('use covering summary');
        return context;
      },
      model: async ({ context }: { context: string }) => { contexts.push(context); return 'Noted.'; },
      send: async () => 1, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'My studio launch day is Tuesday.')]); await worker.drain();
    const direct = JSON.parse(contexts[0]!);
    expect(direct.history).toEqual([]); // The first question has no earlier memory.
    expect(direct.capability).not.toContain('inferred-by-summary');
    const directRecall = worker.probe('What day is the studio launch?');
    if ('reason' in directRecall) throw Error(directRecall.reason);
    expect(JSON.parse(directRecall.context).history).toMatchObject([
      { sourceKind: 'operator-stated', user: 'My studio launch day is Tuesday.' }]);
    journal.append({ kind: 'summary-reserve', through: 1, at: now });
    journal.append({ kind: 'summary', through: 1, text: 'The studio launch day is Thursday.', at: now });
    journal.close();

    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    compact = true; // Simulate an envelope that cannot fit complete history.
    worker.intake([update(2, 'What day is my studio launch?')]);
    await worker.drain();
    const covered = JSON.parse(contexts.at(-1)!);
    expect(covered.historyMode).toBe('summary-plus-recent');
    expect(covered.summary).toMatchObject({ sourceKind: 'inferred-by-summary', text: 'The studio launch day is Thursday.' });
    expect(covered.memorySummary).toBeUndefined(); // The compact summary is the correction reference.
    expect(covered.history).toEqual([]);
    expect(covered.recalled).toMatchObject([
      { sourceKind: 'operator-stated', user: 'My studio launch day is Tuesday.' }]);
    expect(covered.capability).toContain('operator-stated wins over inferred-by-summary');
    expect(covered.capability).toContain('hedge summary inference with "I think"');
    const inferenceOnly = worker.probe('What did the summary infer about the launch day?');
    if ('reason' in inferenceOnly) throw Error(inferenceOnly.reason);
    expect(JSON.parse(inferenceOnly.context).summary.sourceKind).toBe('inferred-by-summary');
    worker.intake([update(3, 'What day is my studio launch, and what color was in my email?')]);
    await worker.drain();
    const packet = JSON.parse(contexts.at(-1)!);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.summary).toMatchObject({ sourceKind: 'inferred-by-summary', text: 'The studio launch day is Thursday.' });
    expect(packet.memorySummary).toBeUndefined();
    expect(packet.recalled).toMatchObject([{ sourceKind: 'operator-stated', user: 'My studio launch day is Tuesday.' }]);
    expect(packet.channelMemory).toMatchObject([{ sourceKind: 'channel-import', source: 'email',
      from: 'justin@example.test', quote: 'The studio launch color is blue.' }]);
    expect(packet.capability).toContain('hedge summary inference with "I think"');
    expect(packet.capability).toContain('operator-stated wins over inferred-by-summary');
    expect(packet.memoryCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: 'operator-stated', message: 'My studio launch day is Tuesday.' }),
      expect.objectContaining({ sourceKind: 'channel-import', source: 'channel-import' })]));
    expect(journal.view.calls).toBe(4); // Three answers and one existing summary; no trust-check call.
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

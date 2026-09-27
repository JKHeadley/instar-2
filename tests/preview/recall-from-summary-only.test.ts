import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(41);
const originalDate = 'The family reunion is on 2026-10-17 at 14:30.';
const correctedDate = 'The family reunion is on 2026-10-24 at 14:30.';
const facts = [
  'The studio mural color is copper blue.',
  originalDate,
  'Rina prefers jasmine tea at meetings.',
  'The blue binder is in the upstairs cabinet.',
];
const active = [facts[0]!, correctedDate, facts[2]!, facts[3]!];
const conversation = [
  'Thanks, that helps me think it through.',
  'I might rearrange the chairs this weekend.',
  'The meeting felt shorter than I expected.',
  'I need to buy more paper for the printer.',
  'We took a walk after lunch.',
  'That recipe sounds easy enough to try.',
  'I will check the weather before going out.',
  'The hallway could use another lamp.',
  'I enjoyed the ending of that book.',
  'Tomorrow I will tidy the work table.',
  'The train was quiet on the way home.',
  'I am thinking about a small garden.',
];
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: 1790000000 + id * 60, text } });
const jev = { model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } };

async function score(withItems: boolean) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-only-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 6000, cursor: 0 });
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        if (!input.id.startsWith('summary:')) return 'Understood.';
        const packet = JSON.parse(input.context) as { history: { id: string; user: string }[] };
        // The same lossy prose and permissive semantic judge run on both sides.
        // Only exact quotes selected from newly covered operator turns differ.
        const memoryItems = withItems ? packet.history.filter(item => facts.includes(item.user))
          .map(item => ({ source: item.id, quote: item.user })) : [];
        return JSON.stringify({ summary: 'The operator shared household and meeting details.',
          people: [], memory: [], memoryItems });
      }, summaryCheck: async () => jev, send: async () => 1, checkOutbound: () => {} });
    for (let id = 1; id <= 32; id++) {
      const text = id === 1 ? facts[0]! : id === 3 ? facts[1]! : id === 5 ? facts[2]!
        : id === 7 ? facts[3]! : id === 11 ? `Actually, ${correctedDate}`
          : conversation[(id - 1) % conversation.length]!;
      worker.intake([update(id, text)]);
      if (id === 11) {
        // A validated correction already recorded before the next generation.
        const source = journal.view.order[2]!, trigger = journal.view.order.at(-1)!;
        journal.append({ kind: 'summary-reserve', through: id, at: 1790000000000 });
        journal.append({ kind: 'summary', through: id, text: 'The family reunion date was corrected.',
          ...(withItems ? { memoryItems: journal.view.summaries.at(-1)?.memoryItems ?? [] } : {}),
          memoryFor: [trigger.id], memory: [{ mode: 'correct', source: source.id,
            quote: originalDate, trigger: trigger.id, replacement: correctedDate }], at: 1790000000000 });
      }
      await worker.drain();
      if (id !== 11) await worker.summarizeIfNeeded(true);
      expect(journal.view.summaries.at(-1)?.through).toBe(id);
    }
    const prepared = worker.probe('What exact details did I tell you in the first part of our conversation?');
    expect('context' in prepared).toBe(true);
    if (!('context' in prepared)) throw Error('probe packet did not fit');
    const packet = JSON.parse(prepared.context) as { history: { id: string }[]; recalled?: { id: string }[];
      summary: { text: string; memoryItems?: { quote: string; source: string; sourceLabel: string }[] } };
    const firstIds = journal.view.order.slice(0, 7).filter(turn => facts.includes(turn.text)).map(turn => turn.id);
    expect(packet.history.map(item => item.id).filter(id => firstIds.includes(id))).toEqual([]);
    for (const fact of facts) expect(JSON.stringify(packet.recalled ?? [])).not.toContain(fact);
    expect(prepared.context).not.toContain(originalDate);
    const summaryOnly = [packet.summary.text, ...(packet.summary.memoryItems ?? []).map(item => item.quote)].join('\n');
    const recall = active.map(fact => summaryOnly.includes(fact));
    const staleExcluded = !summaryOnly.includes(originalDate);
    const dateProvenance = packet.summary.memoryItems?.find(item => item.quote === correctedDate)?.sourceLabel.includes('/2026-') ?? false;
    const generations = journal.view.summaries.length;
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.summaries.at(-1)?.memoryItems).toEqual(withItems ? journal.view.summaries.at(-1)?.memoryItems : undefined);
    replay.close();
    return { recall, staleExcluded, dateProvenance, generations };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('scores exact recall from the summarized region after 32 generations and a prior correction', async () => {
  const before = await score(false);
  const after = await score(true);
  expect(before.generations).toBe(32);
  expect(after.generations).toBe(32);
  expect(before.recall).toEqual([false, false, false, false]);
  expect(after.recall).toEqual([true, true, true, true]);
  expect(after.staleExcluded).toBe(true);
  expect(after.dateProvenance).toBe(true);
  console.info(`summary-only recall: ${before.recall.filter(Boolean).length}/4 before, ${after.recall.filter(Boolean).length}/4 after; stale claim absent=${after.staleExcluded}`);
});

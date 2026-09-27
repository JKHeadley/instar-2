import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(29);
const facts = [
  'Remember: the cedar box is labeled violet-7319.',
  'Remember: Mara chose the north window for the fern.',
  'Remember: the atlas stays on shelf four.',
];
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const jev = { model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } };

async function run(withReferences: boolean) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-drift-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
      operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 200, maxReplies: 100, maxTurns: 100, maxBytes: 16000, cursor: 0 });
    let checks = 0;
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        if (!input.id.startsWith('summary:')) return 'Understood.';
        const step = Number(input.id.slice('summary:'.length));
        const history = (JSON.parse(input.context) as { history: { id: string; user: string }[] }).history;
        const memoryItems = withReferences ? history.filter(item => facts.includes(item.user))
          .map(item => ({ source: item.id, quote: item.user })) : [];
        // The model's prose progressively corrupts the original details. Jev's
        // deterministic pass represents a semantic check that misses this drift.
        const summary = step <= 3 ? facts.slice(0, step).join(' ') : `At step ${step}, the box is blue, the fern is east, and the atlas is on shelf five.`;
        return JSON.stringify({ summary, people: [], memory: [], memoryItems: [...memoryItems,
          { source: 'invented-turn', quote: 'A fabricated fact.' },
          { source: history[0]?.id, quote: 'A fabricated clause.' }] });
      },
      summaryCheck: async () => { checks++; return jev; },
      send: async () => 1, checkOutbound: () => {} });
    for (let step = 1; step <= 65; step++) {
      worker.intake([update(step, facts[step - 1] ?? `Ordinary filler turn ${step}.`)]);
      await worker.drain();
      await worker.summarizeIfNeeded(true);
      expect(journal.view.summaries.at(-1)?.through).toBe(step);
    }
    const last = journal.view.summaries.at(-1)!;
    const survival = facts.map(fact => last.text.includes(fact)
      || last.memoryItems?.some(item => item.quote === fact) || false);
    expect(last.memoryItems?.some(item => item.source === 'invented-turn')).not.toBe(true);
    expect(last.memoryItems?.some(item => item.quote === 'A fabricated clause.')).not.toBe(true);
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replay.view.summaries.at(-1)).toEqual(last);
    replay.close();
    return { survival, checks, summaries: 65 };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('measures exact fact drift over 65 successive summaries, before and after source references', async () => {
  const before = await run(false);
  const after = await run(true);
  expect(before).toMatchObject({ survival: [false, false, false], summaries: 65 });
  expect(after).toMatchObject({ survival: [true, true, true], summaries: 65 });
  console.info(`65-summary exact survival: before ${before.survival.filter(Boolean).length}/3, after ${after.survival.filter(Boolean).length}/3`);
  expect(before.checks).toBeGreaterThan(0);
  expect(after.checks).toBeGreaterThan(0);
});

it('carries a verified correction by its source and removes a later forgotten item', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-item-change-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678',
      chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 });
    const contexts: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        if (input.id.startsWith('summary:')) {
          contexts.push(input.context);
          return JSON.stringify({ summary: 'A routine continuation.', people: [], memory: [], memoryItems: [] });
        }
        return 'Understood.';
      }, summaryCheck: async () => jev, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, facts[0]!) ]); await worker.drain();
    const original = journal.view.order[0]!;
    journal.append({ kind: 'summary-reserve', through: 1, at: 1790000000000 });
    journal.append({ kind: 'summary', through: 1, text: facts[0]!, memoryItems: [{ source: original.id, quote: facts[0]! }], at: 1790000000000 });

    const replacement = 'Remember: the cedar box is labeled amber-4412.';
    worker.intake([update(2, replacement)]); await worker.drain();
    const correction = journal.view.order[1]!;
    journal.append({ kind: 'summary-reserve', through: 2, at: 1790000000000 });
    journal.append({ kind: 'summary', through: 2, text: replacement,
      memoryItems: [{ source: original.id, quote: facts[0]! }],
      memory: [{ mode: 'correct', source: original.id, quote: facts[0]!, trigger: correction.id, replacement }], at: 1790000000000 });

    worker.intake([update(3, 'A filler turn.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    const afterCorrection = JSON.parse(contexts.at(-1)!) as { summary: { memoryItems: { quote: string }[] } };
    expect(afterCorrection.summary.memoryItems.map(item => item.quote)).not.toContain(facts[0]);
    expect(journal.view.summaries.at(-1)?.memoryItems).toEqual([{ source: correction.id, quote: replacement }]);

    worker.intake([update(4, 'The cedar box label is retired.')]); await worker.drain();
    const forget = journal.view.order[3]!;
    journal.append({ kind: 'summary-reserve', through: 4, at: 1790000000000 });
    journal.append({ kind: 'summary', through: 4, text: 'The label was forgotten.',
      memoryItems: [{ source: correction.id, quote: replacement }],
      memory: [{ mode: 'forget', source: correction.id, quote: replacement, trigger: forget.id }], at: 1790000000000 });
    worker.intake([update(5, 'Another filler turn.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    const afterForget = JSON.parse(contexts.at(-1)!) as { summary: { memoryItems?: { quote: string }[] } };
    expect(afterForget.summary.memoryItems ?? []).toEqual([]);
    expect(journal.view.summaries.at(-1)?.memoryItems ?? []).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

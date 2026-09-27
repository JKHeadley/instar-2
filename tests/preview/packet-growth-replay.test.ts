import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, PREVIEW_FULL_HISTORY_BYTES } from './journal.js';
import { runPacketGrowthReplay } from './packet-growth-replay.js';

it('grounds a short accepted summary in every original turn, then switches at the fixed history budget', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-grounding-budget-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(47), {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
      configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 200, maxReplies: 100, maxTurns: 100, maxBytes: 1024 * 1024, cursor: 0 });
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    for (let turn = 1; turn <= 100; turn++) {
      const text = turn === 1 ? 'My bicycle is vermilion.'
        : `Ordinary update ${turn}: errands and weather. ${turn > 12 ? 'x'.repeat(700) : ''}`;
      journal.append({ kind: 'intake', id: `telegram:12345678:update:${turn}`, update: turn,
        text, raw: JSON.stringify({ update_id: turn, message: { from: { id: 7654321 }, text } }),
        accepted: true, cursor: turn + 1, at: 1790000000000 + turn });
      if (turn === 12 || turn === 96) {
        journal.append({ kind: 'summary-reserve', through: turn, at: 1790000000000 + turn });
        journal.append({ kind: 'summary', through: turn,
          text: turn === 12 ? 'We discussed transport, errands and weather.' : 'My bicycle is vermilion.',
          at: 1790000000000 + turn });
      }
      if (turn !== 12 && turn !== 100) continue;
      const probe = worker.probe('What colour is my bike?');
      expect('context' in probe).toBe(true);
      if (!('context' in probe)) continue;
      const packet = JSON.parse(probe.context) as { historyMode: string; history: { user: string }[];
        summary?: { through: number; text: string } };
      if (turn === 12) {
        expect(packet.historyMode).toBe('complete');
        expect(packet.history).toHaveLength(12);
        expect(packet.history[0]?.user).toContain('vermilion');
        expect(packet.summary).toBeUndefined();
        expect(Buffer.byteLength(JSON.stringify(packet.history))).toBeLessThan(PREVIEW_FULL_HISTORY_BYTES);
      } else {
        expect(packet.historyMode).toBe('summary-plus-recent');
        expect(packet.summary?.through).toBe(96);
        expect(packet.history).toHaveLength(4);
        expect(packet.summary?.text).toContain('vermilion');
      }
    }
    expect(journal.view.order).toHaveLength(100);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps 500 durable turns while packets use summaries and question-selected recall', () => {
  const result = runPacketGrowthReplay();
  expect(result.durableTurns).toBe(500);
  expect(result.checkpoints.map(item => item.turn)).toEqual([36, 100, 500]);
  expect(result.checkpoints.every(item => item.recall)).toBe(true);
  expect(result.checkpoints.every(item => item.otherAccuracy)).toBe(true);
  expect(result.checkpoints.map(item => item.mode)).toEqual(['complete', 'summary-plus-recent', 'summary-plus-recent']);
  expect(result.checkpoints.map(item => item.otherRecall)).toEqual([true, false, false]);
  expect(result.checkpoints.slice(1).every(item => item.history <= 11)).toBe(true);
  expect(result.checkpoints[2]!.bytes).toBeLessThan(20_000);
  process.stdout.write(`packet growth replay: ${JSON.stringify(result)}\n`);
}, 120_000);

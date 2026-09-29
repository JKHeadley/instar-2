// cint-L3: a rolling summary keeps the turn briefing sources whenever its envelope fits, and drops
// them only as the last resort when nothing else fits, so a long operator message stays summarizable
// instead of holding the trial at its byte cap (Rules 2, 14). Both sides of that decision are proved here.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const key = new Uint8Array(32).fill(12);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 60, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
// About 3 KB: an ordinary pasted paragraph, the size the combined candidate could no longer summarize.
const MESSAGE = `Please keep this plan. ${'The garden plan has tomatoes, beans, squash and herbs along the south fence. '.repeat(40).trim()}`;

async function summarizeWith(briefingBytes: number) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-sources-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const summaryContexts: string[] = [];
    const sources = [{ id: 'capability-note', title: 'Preview capabilities and status (generated)', text: 'b'.repeat(briefingBytes), provenance: {} }];
    const worker = createJournalWorker(journal, { now: Date.now, stopped: () => false, sources,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-opus-5-5', genesis.grant, Date.now()),
      model: async ({ id, context }) => {
        if (!id.startsWith('summary:')) return 'ok';
        summaryContexts.push(context);
        return JSON.stringify({ summary: 'The operator shared a garden plan.', memory: [], people: [], commitments: [], closed: [] });
      },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, MESSAGE)]);
    await worker.drain();
    await worker.summarizeIfNeeded(true);
    const result = { summaries: journal.view.summaries.map(item => item.through), held: journal.view.order.map(turn => turn.held ?? null),
      carriedSources: summaryContexts.map(context => 'sources' in (JSON.parse(context) as object)) };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('keeps the turn briefing sources in a summary whose envelope fits', async () => {
  const result = await summarizeWith(1000);
  expect(result.summaries).toEqual([1]);
  expect(result.held).toEqual([null]);
  expect(result.carriedSources).toEqual([true]);
});

it('drops the briefing sources only when nothing else fits, and still summarizes the long message', async () => {
  const result = await summarizeWith(12000);
  expect(result.summaries).toEqual([1]);
  expect(result.held).toEqual([null]);
  expect(result.carriedSources).toEqual([false]);
});

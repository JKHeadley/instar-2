/** Unit U4, Rule 11 (Part 21 §6): operator messages summarized before build 2 wrote meaning terms
 * are indexed on the write side even when no new summary is due, so a paraphrase with none of the
 * original words reaches the fact. Indexing never moves the summary frontier, so it is not a
 * compaction and no reply carries a Rule 110 disclosure for it. The model and Telegram are stubs. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, INDEX_BACKLOG_LIMIT, openPreviewJournal, raiseJournalCaps, unknownCallCounts } from './journal.js';

const key = new Uint8Array(32).fill(53), at = 1790000000000;
const genesis = () => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 1024 * 1024, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
const target = 'My bicycle lock code is 4471.';
const targetId = 'telegram:12345678:update:1';
const cues = ['bike', 'combination', 'padlock', 'lock combination'];
type Coverage = { summarizedMessages: number; meaningIndexed: number; disposition: string };
type Packet = { meaningIndexCoverage?: Coverage; recalled?: { user?: string }[] };

/** A journal as build 1 left it: answered operator turns and a rolling summary without meaning terms. */
function preBuild2(path: string, older: number) {
  const journal = openPreviewJournal(path, key, genesis());
  // Long enough that complete history no longer fits, so answers ground in the summary plus recall.
  const texts = [target, ...Array.from({ length: older - 1 }, (_, i) => `Bike ride notes ${i}: hills and flats. ${'Long climb, steady pace. '.repeat(260)}`)];
  texts.forEach((text, index) => {
    const turn = index + 1, id = `telegram:12345678:update:${turn}`;
    journal.append({ kind: 'intake', id, update: turn, text, raw: JSON.stringify(update(turn, text)), accepted: true, cursor: turn + 1, at: at + turn });
    journal.append({ kind: 'reserve', id, at: at + turn });
    journal.append({ kind: 'answer', id, text: 'Noted.', state: 'complete', at: at + turn });
    journal.append({ kind: 'intent', id, text: 'PREVIEW — Noted.', chat: '7654321', update: turn, grant: 'grant:preview', at: at + turn });
    journal.append({ kind: 'sent', id, message: turn, at: at + turn });
  });
  journal.append({ kind: 'summary-reserve', through: older, at: at + older });
  journal.append({ kind: 'summary', through: older, text: 'The operator rides often and keeps ride notes.', at: at + older });
  return journal;
}

describe('Rule 11: the meaning index backfills summaries written before build 2', () => {
  it('indexes the backlog in full batches without moving the summary frontier, and converges', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-backfill-')));
    const older = 2 * INDEX_BACKLOG_LIMIT, path = join(dir, 'journal.encrypted');
    try {
      const journal = preBuild2(path, older);
      const summaryContexts: string[] = [], indexContexts: string[] = [], sent: string[] = [];
      const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
        send: async input => { sent.push(input.expectedText); return input.update; }, checkOutbound: () => {},
        summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0 } } }),
        model: async input => {
          if (!input.id.startsWith('summary:')) return 'Noted.';
          (input.id.startsWith('summary:index:') ? indexContexts : summaryContexts).push(input.context);
          const packet = JSON.parse(input.context) as { indexBacklog?: { id: string }[]; history?: { id: string; from?: string }[] };
          const sources = [...packet.indexBacklog ?? [], ...(packet.history ?? []).filter(item => item.from === undefined)].map(item => item.id);
          return JSON.stringify({ ...(input.id.startsWith('summary:index:') ? {} : { summary: 'The operator rides often and keeps ride notes.', people: [], questions: [], memory: [] }),
            concepts: sources.map(source => ({ source, terms: source === targetId ? cues : ['cycling'] })) });
        } });
      const probe = () => {
        const result = worker.probe('What is the combination for my bike?');
        if (!('context' in result)) throw Error('probe held');
        return JSON.parse(result.context) as Packet;
      };
      const reached = (packet: Packet) => (packet.recalled ?? []).some(item => item.user?.includes('4471'));

      // Before: every summarized message lacks terms, and the paraphrase shares no word with the fact.
      const before = probe();
      expect(before.meaningIndexCoverage).toEqual({ summarizedMessages: older, meaningIndexed: 0, disposition: 'degraded' });
      expect(reached(before)).toBe(false);

      const turn = async (id: number) => {
        worker.intake([update(id, `Short check-in ${id}.`)]); await worker.drain(); await worker.summarizeIfNeeded();
      };
      // The first later turn indexes the whole backlog in bounded batches, with no new summary.
      const frontier = journal.view.summaries.at(-1)!.through;
      await turn(older + 1);
      const passes = Math.ceil(older / INDEX_BACKLOG_LIMIT);
      expect(summaryContexts).toHaveLength(0);
      expect(indexContexts).toHaveLength(passes);
      for (const context of indexContexts) {
        const offered = (JSON.parse(context) as { indexBacklog: { id: string }[] }).indexBacklog;
        expect(offered.length).toBeLessThanOrEqual(INDEX_BACKLOG_LIMIT);
        expect(context).not.toContain('"history"');
      }
      expect(journal.view.summaries.at(-1)!.through).toBe(frontier);
      expect(journal.view.order.some(item => item.held)).toBe(false);

      const after = probe();
      const coverage = after.meaningIndexCoverage!;
      expect(coverage).toEqual({ summarizedMessages: older, meaningIndexed: older, disposition: 'complete' });
      expect(reached(after)).toBe(true);

      // Rule 110: only the pre-existing frontier (#12, never yet accounted) is disclosed, once, on the
      // first reply. Indexing compacted nothing, so no later reply opens with a disclosure.
      await turn(older + 2);
      await turn(older + 3);
      expect(sent).toHaveLength(3);
      expect(sent[0]).toContain(`Earlier conversation up to #${older} is now summarized for me`);
      expect(sent.slice(1).some(text => text.includes('is now summarized for me'))).toBe(false);
      // An empty backlog adds no pass when no summary is otherwise due.
      expect(indexContexts).toHaveLength(passes);
      expect(summaryContexts).toHaveLength(0);
      journal.close();

      const reopened = openPreviewJournal(path, key);
      expect(reopened.view.indexConcepts.some(concept => concept.source === targetId)).toBe(true);
      expect(reopened.view.indexOffered).toHaveLength(older);
      expect(reopened.view.indexOpen).toBeNull();
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('offers each source once, only in full batches, when the model returns no terms, and refuses out-of-order index records', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-backfill-')));
    const older = 12, path = join(dir, 'journal.encrypted');
    try {
      const journal = preBuild2(path, older);
      let indexCalls = 0;
      const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false, send: async input => input.update, checkOutbound: () => {},
        model: async input => {
          if (input.id.startsWith('summary:index:')) { indexCalls++; return 'no terms here'; }
          return input.id.startsWith('summary:') ? JSON.stringify({ summary: 'The operator rides often.', people: [], questions: [], memory: [] }) : 'Noted.';
        } });
      const calls = journal.view.calls;
      for (let id = older + 1; id <= older + 4; id++) {
        worker.intake([update(id, `Short check-in ${id}.`)]); await worker.drain(); await worker.summarizeIfNeeded();
      }
      // One full batch of eight; the remaining four wait for a due summary, which offers the backlog.
      expect(indexCalls).toBe(1);
      expect(journal.view.calls - calls).toBe(1 + 4);
      expect(journal.view.indexConcepts).toEqual([]);
      expect(journal.view.indexOffered).toHaveLength(INDEX_BACKLOG_LIMIT);

      expect(() => journal.append({ kind: 'meaning-index', concepts: [], at: at + 200_000 })).toThrow('unsupported meaning terms');
      expect(() => journal.append({ kind: 'index-reserve', sources: [targetId], maxInputTokens: 10, maxOutputTokens: 10, at: at + 200_000 }))
        .toThrow('index reservation refused');
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('keeps a lost index result UNKNOWN across restart, a later completed batch and compaction, and refuses a cap raise', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-backfill-')));
    const older = 2 * INDEX_BACKLOG_LIMIT, path = join(dir, 'journal.encrypted');
    let journal = preBuild2(path, older);
    try {
      let indexCalls = 0;
      const worker = (lose: boolean) => createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
        send: async input => input.update, checkOutbound: () => {},
        model: async input => {
          if (!input.id.startsWith('summary:index:')) return 'Noted.';
          indexCalls++;
          if (lose && indexCalls === 1) throw Error('lost provider result');
          return { text: '{"concepts":[]}', usage: { inputTokens: 1, outputTokens: 1, charge: null, inputComplete: true as const } };
        } });
      const raise = () => raiseJournalCaps(journal, { maxCalls: 401, maxReplies: 200, maxTurns: 200, authority: 'offline operator test', at: at + 100_001 });

      // The first batch's result is lost: its reservation stays charged and its outcome UNKNOWN across a restart.
      const first = worker(true);
      first.intake([update(older + 1, 'Short check-in.')]); await first.drain(); await first.summarizeIfNeeded();
      expect(indexCalls).toBe(1);
      journal.close(); journal = openPreviewJournal(path, key);
      expect(unknownCallCounts(journal.view)).toMatchObject({ index: 1, total: 1 });

      // A later batch completes. That conclusive result is not counted, and it does not retire the earlier unknown.
      await worker(false).summarizeIfNeeded();
      expect(indexCalls).toBe(2);
      expect(journal.view.indexOpen).toBeNull();
      expect(journal.view.indexOffered).toHaveLength(older);
      expect(unknownCallCounts(journal.view)).toMatchObject({ index: 1, total: 1 });

      // Compaction and reopening preserve it, so the shared cap-raise refusal still applies.
      journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
      expect(journal.view.indexUnknown).toEqual(['index:0']);
      expect(unknownCallCounts(journal.view)).toMatchObject({ index: 1, total: 1 });
      expect(raise).toThrow('UNKNOWN');
      expect(journal.view.limits.maxCalls).toBe(400);
      journal.close();

      // Positive neighbor: every index result arrives, so nothing is UNKNOWN and the same raise is accepted.
      rmSync(path, { force: true });
      journal = preBuild2(path, older); indexCalls = 0;
      const clean = worker(false);
      clean.intake([update(older + 1, 'Short check-in.')]); await clean.drain(); await clean.summarizeIfNeeded();
      expect(indexCalls).toBe(2);
      expect(unknownCallCounts(journal.view)).toMatchObject({ index: 0, total: 0 });
      raise();
      expect(journal.view.limits.maxCalls).toBe(401);
    } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});

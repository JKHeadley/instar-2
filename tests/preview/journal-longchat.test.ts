/** Unit w3-longchat, Rules 11, 77 and 110 (Part 21 §§2/6, Part 17 §6): the two long-chat defects proof
 * room 2 found on 2026-10-01 (lanes/pipeline/live-proof/results/A-proofroom2-20261001-142106).
 *
 * A. A fact the operator stated early was summarized, and the recall question asked in other words
 *    reached nothing: its message was one of seven pending out of a hundred summarized, because the
 *    write-side indexer only ran on a full batch of eight. The answer then told the operator there was
 *    no record of it -- which Part 21 §2 forbids for a degraded recall ("never claim unavailable history
 *    was empty") and Rule 11 forbids outright ("a keyword miss is not evidence something isn't there").
 *
 * The recorded shapes replayed here come from tests/preview/fixtures/proofroom2-longchat-2026-10-01.json,
 * taken verbatim from that room's inspect surfaces. The model and Telegram are stubs. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, INDEX_ATTEMPT_LIMIT, INDEX_BACKLOG_LIMIT, meaningIndexStatus, openPreviewJournal } from './journal.js';
import { ANSWER_INSTRUCTIONS } from './briefing.js';

const key = new Uint8Array(32).fill(54), at = 1790000000000;
const genesis = (maxBytes = 1024 * 1024) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-longchat-')));

interface Recorded { fact: { update: number; message: string };
  recallQuestion: { message: string; summaryThrough: number; pendingUpdates: number[]; deliveredReply: string;
    coverage: { summarizedMessages: number; meaningIndexed: number; disposition: string } } }
const recorded = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/proofroom2-longchat-2026-10-01.json'), 'utf8')) as Recorded;

type Coverage = { summarizedMessages: number; meaningIndexed: number; disposition: string };
type Packet = { meaningIndexCoverage?: Coverage; recalled?: { id?: string; user?: string }[];
  continuity?: { through: number; lastInbound: string; state: string } };

/** The live shape: the operator's fact, then a long chat on top of it, all summarized with meaning terms
 * recorded for every message EXCEPT a remainder smaller than one batch -- the room's own seven of a hundred. */
function strandedRemainder(path: string, pending: number) {
  const journal = openPreviewJournal(path, key, genesis());
  const older = 2 * INDEX_BACKLOG_LIMIT;
  // Long enough that complete history no longer fits the packet allowance, so answers ground in the
  // summary plus recall -- the condition under which the meaning index is the only route to the fact.
  // The distractors deliberately carry the question's own words (hut, rakes, opens, number), as the room's
  // garden logs did for its question: lexical ranking then fills every recall slot with them, and only the
  // meaning terms can bring the fact itself back. That is the whole point of Rule 11.
  const texts = [recorded.fact.message,
    ...Array.from({ length: older - 1 }, (_, i) => `Garden log ${i}: my little hut where I keep the rakes opens fine, `
      + `number ${i} on the row marker. ${'Watered at dawn, mulch still damp. '.repeat(190)}`)];
  texts.forEach((text, index) => {
    const turn = index + 1, id = `telegram:12345678:update:${turn}`;
    journal.append({ kind: 'intake', id, update: turn, text, raw: JSON.stringify(update(turn, text)), accepted: true, cursor: turn + 1, at: at + turn });
    journal.append({ kind: 'reserve', id, at: at + turn });
    journal.append({ kind: 'answer', id, text: 'Noted.', state: 'complete', at: at + turn });
    journal.append({ kind: 'intent', id, text: 'PREVIEW — Noted.', chat: '7654321', update: turn, grant: 'grant:preview', at: at + turn });
    journal.append({ kind: 'sent', id, message: turn, at: at + turn });
  });
  // The summary covers everything and carries terms for all but the last `pending` messages: the fact is
  // deliberately inside that remainder, exactly as update 6230298 was in the room.
  journal.append({ kind: 'summary-reserve', through: older, at: at + older });
  journal.append({ kind: 'summary', through: older, text: 'The operator keeps a garden log and stated a lock code.',
    concepts: texts.slice(pending).map((_, index) => ({ source: `telegram:12345678:update:${index + 1 + pending}`, terms: ['gardening'] })),
    at: at + older });
  return { journal, older };
}

describe('Rule 11: a message the indexer skipped is retried and named, never silently absent', () => {
  it('indexes a remainder smaller than one batch, so the paraphrase reaches the fact', async () => {
    const dir = root(), path = join(dir, 'journal.encrypted');
    const pending = recorded.recallQuestion.pendingUpdates.length;
    try {
      const { journal, older } = strandedRemainder(path, pending);
      const offers: number[] = [];
      const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
        send: async input => input.update, checkOutbound: () => {},
        model: async input => {
          if (!input.id.startsWith('summary:index:')) return 'Noted.';
          const backlog = (JSON.parse(input.context) as { indexBacklog: { id: string; message: string }[] }).indexBacklog;
          offers.push(backlog.length);
          return JSON.stringify({ concepts: backlog.map(item => ({ source: item.id,
            terms: item.message.includes('padlock') ? ['rake hut', 'shed combination', 'storage number'] : ['gardening'] })) });
        } });
      const probe = () => {
        const result = worker.probe(recorded.recallQuestion.message);
        if (!('context' in result)) throw Error('probe held');
        return JSON.parse(result.context) as Packet;
      };
      const reachedFact = (packet: Packet) => (packet.recalled ?? []).some(item => item.user?.includes('2958'));

      // The defect, reproduced: the remainder is pending and the paraphrase shares no word with the fact.
      const before = probe();
      expect(before.meaningIndexCoverage).toEqual({ summarizedMessages: older, meaningIndexed: older - pending,
        disposition: 'degraded' });
      // The owed work is named on the inspection surface, the fact's own update among it.
      expect(meaningIndexStatus(journal.view, older)).toMatchObject({ owed: pending,
        pendingUpdates: Array.from({ length: pending }, (_, index) => index + 1) });
      expect(reachedFact(before)).toBe(false);
      // The room's own reading had the same shape: short of complete by a remainder under one batch.
      expect(recorded.recallQuestion.coverage.summarizedMessages - recorded.recallQuestion.coverage.meaningIndexed).toBe(pending);
      expect(pending).toBeLessThan(INDEX_BACKLOG_LIMIT);

      // One ordinary later turn now offers the partial remainder instead of waiting for a full batch.
      worker.intake([update(older + 1, 'Short check-in.')]); await worker.drain(); await worker.summarizeIfNeeded();
      expect(offers).toEqual([pending]);
      expect(journal.view.summaries.at(-1)!.through).toBe(older);

      const after = probe();
      expect(after.meaningIndexCoverage).toEqual({ summarizedMessages: older, meaningIndexed: older, disposition: 'complete' });
      expect(meaningIndexStatus(journal.view, older)).toMatchObject({ owed: 0, pendingUpdates: [] });
      expect(reachedFact(after)).toBe(true);
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('names the pending work while it is owed and while its attempts are spent', async () => {
    const dir = root(), path = join(dir, 'journal.encrypted');
    const pending = recorded.recallQuestion.pendingUpdates.length;
    try {
      const { journal, older } = strandedRemainder(path, pending);
      let indexCalls = 0;
      const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
        send: async input => input.update, checkOutbound: () => {},
        model: async input => { if (!input.id.startsWith('summary:index:')) return 'Noted.';
          indexCalls++; return 'no terms here'; } });
      const coverage = () => {
        const result = worker.probe(recorded.recallQuestion.message);
        if (!('context' in result)) throw Error('probe held');
        return (JSON.parse(result.context) as Packet).meaningIndexCoverage!;
      };
      const status = () => meaningIndexStatus(journal.view, older);
      const pendingList = Array.from({ length: pending }, (_, index) => index + 1);
      // A writer that omits them: the retry happens on the next pass, not inside the same one.
      worker.intake([update(older + 1, 'Short check-in.')]); await worker.drain(); await worker.summarizeIfNeeded();
      expect(indexCalls).toBe(1);
      expect(coverage()).toEqual({ summarizedMessages: older, meaningIndexed: older - pending, disposition: 'degraded' });
      expect(status()).toMatchObject({ owed: pending, pendingUpdates: pendingList });

      worker.intake([update(older + 2, 'Another check-in.')]); await worker.drain(); await worker.summarizeIfNeeded();
      expect(indexCalls).toBe(INDEX_ATTEMPT_LIMIT);
      // Both attempts spent: still degraded, and now honest that nothing more is owed here rather than
      // reporting the same count forever as though a retry were still coming.
      expect(coverage()).toEqual({ summarizedMessages: older, meaningIndexed: older - pending, disposition: 'degraded' });
      expect(status()).toMatchObject({ owed: 0, pendingUpdates: pendingList });

      worker.intake([update(older + 3, 'A third check-in.')]); await worker.drain(); await worker.summarizeIfNeeded();
      expect(indexCalls).toBe(INDEX_ATTEMPT_LIMIT);
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('tells the answer what a degraded reading permits it to say, and the recorded reply is what it forbids', () => {
    // The room's delivered answer, verbatim. It both said "I don't know from this journal" (allowed) and
    // claimed there was no record anywhere (forbidden by Part 21 §2 and Rule 11).
    expect(recorded.recallQuestion.deliveredReply).toContain("I don't know from this journal");
    expect(recorded.recallQuestion.deliveredReply).toContain("there's no record");
    // The instruction now states the gap and the prohibition, delivered as instructions rather than packet bytes.
    expect(ANSWER_INSTRUCTIONS).toContain('not finding something is never evidence it was not said');
    expect(ANSWER_INSTRUCTIONS).toContain('Say your search of the earlier conversation is incomplete rather than that there is no record of it');
  });
});

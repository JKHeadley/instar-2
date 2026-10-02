/** Unit w3-longchat, Rules 11, 77 and 110 (Part 21 §§2/6, Part 17 §6): the two long-chat defects proof
 * room 2 found on 2026-10-01 (lanes/pipeline/live-proof/results/A-proofroom2-20261001-142106).
 *
 * A. A fact the operator stated early was summarized, and the recall question asked in other words
 *    reached nothing: its message was one of seven pending out of a hundred summarized, because the
 *    write-side indexer only ran on a full batch of eight. The answer then told the operator there was
 *    no record of it -- which Part 21 §2 forbids for a degraded recall ("never claim unavailable history
 *    was empty") and Rule 11 forbids outright ("a keyword miss is not evidence something isn't there").
 * B. Fifty-one of a hundred and fourteen replies opened with the same compaction sentence, because the
 *    rolling summary advanced its frontier on every one of them (all fifty-one carried a distinct
 *    summarizedThrough). Rule 110 asks the FIRST reply after a compaction to disclose and account.
 *
 * The recorded shapes replayed here come from tests/preview/fixtures/proofroom2-longchat-2026-10-01.json,
 * taken verbatim from that room's inspect surfaces. The model and Telegram are stubs. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { continuityDisclosure, continuitySpoken, createJournalWorker, INDEX_ATTEMPT_LIMIT, INDEX_BACKLOG_LIMIT,
  meaningIndexStatus, openPreviewJournal, type ContinuityAccount } from './journal.js';
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
    coverage: { summarizedMessages: number; meaningIndexed: number; disposition: string } };
  disclosures: { fillRepliesObserved: number; fillRepliesOpeningWithDisclosure: number;
    distinctSummarizedThroughAmongThem: number; dispositions: { addressed: number; pending: number };
    samples: { label: string; deliveredReply: string; continuity: ContinuityAccount;
      replyDigestMatchesSentText: boolean }[] } }
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
    // And the disclosure sentence is the application's to add, only when one is owed.
    expect(ANSWER_INSTRUCTIONS).toContain('adds a fixed sentence disclosing that when one is owed; never write it yourself');
  });
});

describe('Rule 110: the compaction sentence is said when it tells the operator something', () => {
  it('says it once over a rolling frontier that advances every turn, and records every turn either way', async () => {
    const dir = root(), path = join(dir, 'journal.encrypted');
    try {
      // 16384 bytes keeps this bounded on a loaded machine; the proof room launched 32768, and the shape
      // under test -- a frontier that advances as the chat grows -- is the same at either size. Driven live the
      // governing seam here is the reachability floor's set-aside rather than the room's summary frontier;
      // the defect is the same either way, because the old gate asked only whether THIS frontier had been
      // accounted and both frontiers advance as the chat grows. The room's own summary-basis accounts are
      // replayed against the predicate in the next test.
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis(16384));
      const sent: string[] = [];
      const worker = createJournalWorker(journal, { now: () => at + 100_000, stopped: () => false,
        send: async input => { sent.push(input.expectedText); return sent.length + 100; }, checkOutbound: () => {},
        model: async input => input.id.startsWith('summary:')
          ? JSON.stringify({ summary: 'The operator keeps a garden log.', people: [], questions: [], memory: [] }) : 'Noted.' });
      for (let id = 1; id <= 36; id++) {
        worker.intake([update(id, `Garden log ${id}: ${'rows looked steady today, watered at dawn. '.repeat(19)}`)]);
        await worker.drain(); await worker.summarizeIfNeeded();
      }
      const compacted = journal.view.order.filter(turn => turn.continuity !== undefined);
      const spoken = compacted.filter(turn => turn.continuity!.spoken !== false);
      // The frontier advanced past every earlier one on most of these turns. That set is exactly what the
      // old rule spoke on -- it disclosed while "this frontier is not yet accounted" -- and it is why the
      // room sent fifty-one copies of the same sentence.
      expect(compacted.length).toBeGreaterThan(10);
      let highest = -1, advanced = 0;
      for (const turn of compacted) if (turn.continuity!.summarizedThrough > highest)
        { highest = turn.continuity!.summarizedThrough; advanced++; }
      expect(advanced).toBeGreaterThan(10);
      // Said exactly once, by the first reply from a compacted context.
      expect(spoken).toHaveLength(1);
      expect(spoken[0]!.update).toBe(compacted[0]!.update);
      expect(spoken[0]!.intent!.startsWith(`PREVIEW — ${spoken[0]!.continuity!.disclosure} `)).toBe(true);
      // One seam throughout, so no basis change was owed a second sentence; exactly one went out.
      expect(new Set(compacted.map(turn => turn.continuity!.basis ?? 'summary')).size).toBe(1);
      expect(sent.filter(text => text.startsWith('PREVIEW — Earlier conversation up to #'))).toHaveLength(1);
      // Each turn's own flag is what the predicate decides from the last sentence actually delivered.
      let delivered: ContinuityAccount | undefined;
      for (const turn of compacted) {
        const account = turn.continuity!;
        expect(account.spoken !== false).toBe(continuitySpoken(delivered,
          { disposition: account.disposition, basis: account.basis ?? 'summary', disclosure: account.disclosure }, false));
        if (account.spoken !== false && turn.sent !== undefined) delivered = account;
      }
      // Rule 2: nothing is lost by going quiet. Every compacted reply still records what it accounted for,
      // bound to the text actually sent, and a silent one carries no sentence in that text.
      for (const turn of compacted) {
        expect(turn.continuity!.replyDigest).toBe(createHash('sha256').update(turn.intent!).digest('hex'));
        expect(turn.continuity!.prePauseInbound).toBeTruthy();
        expect(turn.intent!.includes(turn.continuity!.disclosure)).toBe(turn.continuity!.spoken !== false);
      }
      expect(compacted.slice(1).every(turn => turn.continuity!.spoken === false)).toBe(true);
      // The model is still told its context was compacted on every one of those turns.
      const probed = worker.probe('And one more thing');
      if (!('context' in probed)) throw Error('probe held');
      expect((JSON.parse(probed.context) as Packet).continuity).toMatchObject({ state: 'addressed' });

      const records = compacted.map(turn => [turn.id, turn.continuity] as const);
      journal.close();
      const reopened = openPreviewJournal(path, key);
      for (const [id, account] of records) expect(reopened.view.turns.get(id)!.continuity).toEqual(account);
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 30000);

  it('both sides of each spoken condition, including the dispositions the room recorded', () => {
    const summary = { disposition: 'addressed' as const, basis: 'summary' as const,
      disclosure: continuityDisclosure('#31, x', 29, 'addressed', 'Telegram message 31') };
    const first = { disclosure: continuityDisclosure('#30, x', 29, 'addressed', 'Telegram message 30') };
    // Nothing said yet: say it. Already said and the message is answered: do not say it again.
    expect(continuitySpoken(undefined, summary, false)).toBe(true);
    expect(continuitySpoken(first, summary, false)).toBe(false);
    // A pre-pause message that is still open or was replaced is material, so it is said.
    for (const disposition of ['pending', 'superseded'] as const)
      expect(continuitySpoken(first, { ...summary, disposition,
        disclosure: continuityDisclosure('#31, x', 29, disposition, 'held: call cap') }, false)).toBe(true);
    // The kind of seam changed: a kept-but-unsummarized prefix is a different claim, so it is said.
    expect(continuitySpoken(first, { ...summary, basis: 'set-aside',
      disclosure: continuityDisclosure('#31, x', 29, 'addressed', 'Telegram message 31', 'set-aside') }, false)).toBe(true);
    expect(continuitySpoken({ ...first, basis: 'set-aside' }, { ...summary, basis: 'set-aside',
      disclosure: continuityDisclosure('#31, x', 29, 'addressed', 'Telegram message 31', 'set-aside') }, false)).toBe(false);
    // A spoken disclosure whose send stayed UNKNOWN is said again: the operator may never have seen it.
    expect(continuitySpoken(first, summary, true)).toBe(true);
    // Never the same words twice running, whatever else holds.
    expect(continuitySpoken({ disclosure: summary.disclosure }, summary, true)).toBe(false);

    // The room's recorded accounts, replayed through the predicate against the one before them.
    const samples = recorded.disclosures.samples;
    expect(samples.every(item => item.replyDigestMatchesSentText)).toBe(true);
    const [fill27, fill28, fill80] = samples;
    // Each of the fifty-one carried a distinct frontier, which is why the old rule kept speaking.
    expect(recorded.disclosures.distinctSummarizedThroughAmongThem).toBe(recorded.disclosures.fillRepliesOpeningWithDisclosure);
    expect(fill27!.continuity.disposition).toBe('addressed');
    expect(continuitySpoken(undefined, { ...fill27!.continuity, basis: 'summary' }, false)).toBe(true);
    // fill-28 repeated the sentence for an already-answered message: now silent.
    expect(fill28!.deliveredReply.startsWith(`PREVIEW — ${fill28!.continuity.disclosure}`)).toBe(true);
    expect(continuitySpoken(fill27!.continuity, { ...fill28!.continuity, basis: 'summary' }, false)).toBe(false);
    // fill-80's held message was genuinely open: it still speaks.
    expect(fill80!.continuity.disposition).toBe('pending');
    expect(continuitySpoken(fill27!.continuity, { ...fill80!.continuity, basis: 'summary' }, false)).toBe(true);
    // Fifty-one spoken of a hundred and fourteen replies becomes the first plus the one open message.
    expect(recorded.disclosures.dispositions.addressed + recorded.disclosures.dispositions.pending)
      .toBe(recorded.disclosures.fillRepliesOpeningWithDisclosure);
  });

  it('replay refuses a silent account whose reply opens with the sentence, and a spoken one whose reply does not', () => {
    const id = 'telegram:12345678:update:31';
    const disclosure = continuityDisclosure('#30, x', 29, 'addressed', 'Telegram message 30');
    /** One fresh journal per case: a refused row leaves its in-memory view unusable. */
    const attempt = (spoken: boolean, text: string, check: (run: () => void, read: () => ContinuityAccount | undefined) => void) => {
      const dir = root();
      try {
        const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis(7000));
        const texts = Array.from({ length: 30 }, (_, i) => `Update ${i}: ${'garden '.repeat(240)}`);
        for (const text of [...texts, 'Hello again']) {
          const turn = journal.view.order.length + 1, item = `telegram:12345678:update:${turn}`;
          journal.append({ kind: 'intake', id: item, update: turn, text, raw: JSON.stringify(update(turn, text)),
            accepted: true, cursor: turn + 1, at: at + turn });
          if (turn > 30) continue;
          journal.append({ kind: 'reserve', id: item, at: at + turn });
          journal.append({ kind: 'answer', id: item, text: 'Noted.', state: 'complete', at: at + turn });
          journal.append({ kind: 'intent', id: item, text: 'PREVIEW — Noted.', chat: '7654321', update: turn, grant: 'grant:preview', at: at + turn });
          journal.append({ kind: 'sent', id: item, message: turn, at: at + turn });
        }
        journal.append({ kind: 'summary-reserve', through: 29, at });
        journal.append({ kind: 'summary', through: 29, text: 'Garden.', at });
        journal.append({ kind: 'reserve', id, grounding: { packetSha256: 'p', summaryThrough: 29, compactedThrough: 29,
          history: [], recalled: [], people: [], commitments: [], channelItems: [], corrections: [], memoryChanges: [], memoryCandidates: [] }, at });
        journal.append({ kind: 'answer', id, text: 'Hi!', state: 'complete', at });
        const before = journal.view.turns.get('telegram:12345678:update:30')!;
        const run = () => journal.append({ kind: 'intent', id, text, chat: '7654321', update: 31, grant: 'grant:preview',
          continuity: { prePauseInbound: before.id, capture: createHash('sha256').update(before.raw).digest('hex'),
            summarizedThrough: 29, grounding: 'p', disposition: 'addressed', reference: 'Telegram message 30', disclosure,
            ...(spoken ? {} : { spoken: false as const }),
            replyDigest: createHash('sha256').update(text).digest('hex') }, at });
        check(run, () => journal.view.turns.get(id)!.continuity);
        journal.close();
      } finally { rmSync(dir, { recursive: true, force: true }); }
    };
    // A silent account whose reply does open with the sentence, and a spoken one whose reply does not:
    // both would make the record disagree with what the operator read, so replay refuses each.
    attempt(false, `PREVIEW — ${disclosure} Hi!`, run => expect(run).toThrow('continuity account refused'));
    attempt(true, 'PREVIEW — Hi!', run => expect(run).toThrow('continuity account refused'));
    // The matching pair of each is accepted.
    attempt(false, 'PREVIEW — Hi!', (run, read) => { run(); expect(read()?.spoken).toBe(false); });
    attempt(true, `PREVIEW — ${disclosure} Hi!`, (run, read) => { run(); expect(read()?.spoken).toBeUndefined(); });
  });
});

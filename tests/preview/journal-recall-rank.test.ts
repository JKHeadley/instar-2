/** Unit w3-recallrank, Rule 11 (Part 21 §§4/6): the recall miss proof room two recorded on 2026-10-02
 * (lanes/pipeline/live-proof/results/recallrank-evidence-20261002, live build cint-L23 e26a8c1b).
 *
 * The operator stated a fact, 37 long garden logs pushed it into the summarized prefix, and the question was
 * asked in words the fact does not use. The fact's message was in the meaning index, yet the five recalled
 * turns were others. This file replays the recorded texts through the real packet path and pins the mechanism:
 *
 *   recall reaches a summarized message only through a stem the question shares with that message, its reply,
 *   or its generated index terms. There is no reading of the question by meaning on this path.
 *
 * The recorded shapes come from tests/preview/fixtures/proofroom2-recallrank-2026-10-02.json. The room's own
 * index terms were not recorded (its journal is encrypted), so the terms replayed here are two verbatim real
 * outputs of the build's index question for the same messages (sample A and sample B in the fixture). In
 * sample B the fact's terms share no stem with the question, and the recorded miss reproduces; in sample A one
 * term happens to contain "number", and the fact is recalled. Which of the two a room gets is the writer's luck.
 * The model and Telegram are stubs. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONCEPT_SOURCES_LIMIT, conceptTerms, createJournalWorker, meaningIndexStatus, meaningTermsIndex, openPreviewJournal,
  proposedConceptTerms } from './journal.js';
import { bm25, terms } from '../../src/recall/lexical.js';

const key = new Uint8Array(32).fill(57), at = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 409600, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + (id - 6230000) * 60 } });
const sourceId = (turn: number) => `telegram:12345678:update:${turn}`;

interface Sample { label: string; raw: string }
interface Recorded {
  recorded: { fact: { update: number; message: string; deliveredReply: string };
    question: { update: number; message: string; summaryThrough: number; meaningIndexed: number[]; pendingUpdates: number[]; recalledIds: string[];
      coverage: { disposition: string; meaningIndexed: number; summarizedMessages: number } };
    operatorMessages: Record<string, string>;
    gardenLog: { firstUpdate: number; lastUpdate: number; crops: string[]; opening: string; row: string } };
  sampledTerms: { samples: Sample[] } }
const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/proofroom2-recallrank-2026-10-02.json'), 'utf8')) as Recorded;
const { fact, question, operatorMessages, gardenLog } = fixture.recorded;
/** One sample as the writer returned it, parsed; nothing is filtered here. */
const sample = (label: string) => JSON.parse(fixture.sampledTerms.samples.find(item => item.label === label)!.raw) as
  { concepts: { source: string; terms: string[] }[] };
const updateOf = (source: string) => Number(source.slice(source.lastIndexOf(':') + 1));

/** The garden log for one update: opening and row sentence verbatim; 45 rows gives the recorded packet weight. */
const logNumber = (turn: number) => turn - gardenLog.firstUpdate + 1;
const cropOf = (turn: number) => gardenLog.crops[(logNumber(turn) - 1) % gardenLog.crops.length]!;
const logText = (turn: number) => [gardenLog.opening.replace('{n}', String(logNumber(turn))),
  ...Array.from({ length: 45 }, (_, k) => gardenLog.row.replace('{k}', String(k + 1)).replace('{crop}', cropOf(turn)))].join(' ');

/** Sampled terms by update. The samples cover the short messages and logs 1-3; every later log reuses the
 * sampled terms of the log three places before it in the crop cycle's first pass, with the crop word swapped. */
function termsFor(label: string, turn: number): string[] | undefined {
  const direct = sample(label).concepts.find(item => updateOf(item.source) === turn);
  if (direct) return direct.terms;
  if (turn < gardenLog.firstUpdate) return undefined;
  const first = sample(label).concepts.find(item => updateOf(item.source) === gardenLog.firstUpdate)!;
  const firstCrop = cropOf(gardenLog.firstUpdate).replace(/s$/u, '');
  return first.terms.map(term => term.replaceAll(firstCrop, cropOf(turn).replace(/s$/u, '')));
}

/** The room as recorded: every turn up to the question's summary frontier is summarized, the summary text does
 * not carry the fact, and the two updates the room listed as pending carry no terms. */
function room(path: string, label: string, extra: { turn: number; text: string; terms: string[] }[] = [], factReply = fact.deliveredReply) {
  const journal = openPreviewJournal(path, key, genesis);
  const turns: { turn: number; text: string; reply: string }[] = [
    ...Object.entries(operatorMessages).map(([id, text]) => ({ turn: Number(id), text, reply: 'Noted.' })),
    ...extra.map(item => ({ turn: item.turn, text: item.text, reply: 'Noted.' })),
    ...Array.from({ length: gardenLog.lastUpdate - gardenLog.firstUpdate + 1 }, (_, index) => gardenLog.firstUpdate + index)
      .map(turn => ({ turn, text: logText(turn), reply: 'Noted.' }))].sort((a, b) => a.turn - b.turn);
  for (const { turn, text, reply } of turns) {
    const id = sourceId(turn), said = turn === fact.update ? factReply.replace(/^PREVIEW — /u, '') : reply;
    journal.append({ kind: 'intake', id, update: turn, text, raw: JSON.stringify(update(turn, text)), accepted: true, cursor: turn + 1, at: at + turn });
    journal.append({ kind: 'reserve', id, at: at + turn });
    journal.append({ kind: 'answer', id, text: said, state: 'complete', at: at + turn });
    journal.append({ kind: 'intent', id, text: `PREVIEW — ${said}`, chat: '7654321', update: turn, grant: 'grant:preview', at: at + turn });
    journal.append({ kind: 'sent', id, message: turn, at: at + turn });
  }
  const summarized = turns.filter(item => item.turn <= question.summaryThrough);
  const indexed = summarized.flatMap(item => {
    const words = question.pendingUpdates.includes(item.turn) ? undefined
      : extra.find(added => added.turn === item.turn)?.terms ?? termsFor(label, item.turn);
    // Stored as the write path stores them: through the product's own reader of a writer's proposal.
    const stored = words ? proposedConceptTerms(words) : undefined;
    return stored ? [{ source: sourceId(item.turn), terms: stored }] : [];
  });
  for (let start = 0; start < indexed.length; start += CONCEPT_SOURCES_LIMIT) {
    const batch = indexed.slice(start, start + CONCEPT_SOURCES_LIMIT);
    const through = start + CONCEPT_SOURCES_LIMIT >= indexed.length ? question.summaryThrough : updateOf(batch.at(-1)!.source);
    journal.append({ kind: 'summary-reserve', through, at: at + through });
    journal.append({ kind: 'summary', through, text: 'The operator keeps a daily garden log and asked for reminders.', concepts: batch, at: at + through });
  }
  const worker = createJournalWorker(journal, { now: () => at + 7_000_000, stopped: () => false,
    send: async input => input.update, checkOutbound: () => {}, model: async () => 'Noted.' });
  const recalled = (message: string) => {
    const result = worker.probe(message);
    if (!('context' in result)) throw Error('probe held');
    const packet = JSON.parse(result.context) as { historyMode?: string; summary?: { text?: string };
      recalled?: { id: string }[]; meaningIndexCoverage?: unknown };
    return { packet, ids: (packet.recalled ?? []).map(item => updateOf(item.id)) };
  };
  return { journal, recalled };
}
const withRoom = (label: string, extra: Parameters<typeof room>[2], body: (opened: ReturnType<typeof room>) => void, factReply?: string) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-recallrank-')));
  try { const opened = room(join(dir, 'journal.encrypted'), label, extra, factReply); body(opened); opened.journal.close(); }
  finally { rmSync(dir, { recursive: true, force: true }); }
};

/** A reply to the fact that uses none of the question's words, so only the index terms can carry it. */
const neutral = 'PREVIEW — Noted.';

/** The meaning stage's own score: question stems against each message's generated terms (composeRecall). */
function meaningScores(label: string) {
  const sources = sample(label).concepts;
  const scored = bm25(terms(question.message, 32), sources.map(item => terms(item.terms.join(' '))));
  return new Map(scored.map(item => [updateOf(sources[item.index]!.source), item.matched]));
}

describe('Rule 11: the recorded miss, replayed from the recorded texts', () => {
  it('has a question that shares no content word with the fact', () => {
    expect(terms(question.message)).toEqual(['number', 'open', 'littl', 'hut', 'keep', 'rak']);
    const factWords = new Set(terms(fact.message));
    expect(terms(question.message).filter(word => factWords.has(word))).toEqual([]);
    // The room's own reading: the fact was indexed, and it was not among the five recalled turns.
    expect(question.meaningIndexed).toContain(fact.update);
    expect(question.recalledIds.map(updateOf)).not.toContain(fact.update);
    expect(question.coverage).toEqual({ disposition: 'degraded', meaningIndexed: 35, summarizedMessages: 37 });
  });

  it('scores the fact at zero in the meaning stage when its real terms restate it (sample B)', () => {
    const factTerms = sample('B').concepts.find(item => updateOf(item.source) === fact.update)!.terms;
    // Verbatim writer output: every term is a restatement of the message; none is a word of the question.
    expect(factTerms).toEqual(['padlock code', 'shed combination', 'lock code 2958', 'garden shed security',
      'access code', 'secret code storage', 'sensitive info']);
    const scores = meaningScores('B');
    expect(scores.get(fact.update)).toBeUndefined();
    // The unrelated question about commitments does score: its terms say "open commitments".
    expect(scores.get(6230469)).toBe(1);
    expect([...scores.keys()]).toEqual([6230469]);
  });

  it('reproduces the miss through the real packet path where no stem is shared (sample B)', () => {
    // The room's other replies are not in the evidence, so this replay gives every turn but the fact a neutral
    // reply, and here the fact's reply too: then nothing about the fact shares a stem with the question.
    withRoom('B', [], ({ recalled, journal }) => {
      const { packet, ids } = recalled(question.message);
      expect(packet.historyMode).toBe('summary-plus-recent');
      expect(packet.summary?.text).not.toContain('2958');
      // One fewer than the room's 37 of which 35: the text of its update 6230473 is not in the evidence, so
      // that turn is not replayed. The gap is the same two pending garden logs.
      expect(packet.meaningIndexCoverage).toEqual({ summarizedMessages: question.coverage.summarizedMessages - 1,
        meaningIndexed: question.coverage.meaningIndexed - 1, disposition: question.coverage.disposition });
      expect(journal.view.summaries.some(item => item.concepts?.some(entry => entry.source === sourceId(fact.update)))).toBe(true);
      expect(ids).not.toContain(fact.update);
      // As in the room, the commitments question is recalled (through "open") and garden logs fill the rest.
      expect(ids).toContain(6230469);
      expect(question.recalledIds.map(updateOf)).toContain(6230469);
      expect(ids.filter(turn => turn >= gardenLog.firstUpdate).length).toBeGreaterThan(0);
    }, neutral);
  });

  it('reaches the fact in the same room only through a word of the agent\'s own recorded reply (sample B)', () => {
    // The recorded reply to the fact says "I'd keep a copy somewhere more secure"; the question says "where I
    // keep my rakes". That one shared stem, in the agent's wording and unrelated to the meaning, is the whole
    // route. In the room, turns whose replies are not in the evidence held the word-match slots instead.
    const reply = new Set(terms(fact.deliveredReply));
    expect(terms(question.message).filter(word => reply.has(word))).toEqual(['keep']);
    withRoom('B', [], ({ recalled }) => { expect(recalled(question.message).ids).toContain(fact.update); });
  });

  it('recalls the fact when one real term shares a stem with the question (sample A)', () => {
    const factTerms = sample('A').concepts.find(item => updateOf(item.source) === fact.update)!.terms;
    expect(factTerms).toContain('secret number 2958');
    expect(meaningScores('A').get(fact.update)).toBe(1);
    withRoom('A', [], ({ recalled }) => {
      const { packet, ids } = recalled(question.message);
      expect(packet.summary?.text).not.toContain('2958');
      expect(ids).toContain(fact.update);
    }, neutral);
  });

  it('does not recall the fact for an unrelated question (sample A)', () => {
    withRoom('A', [], ({ recalled }) => {
      expect(recalled(operatorMessages['6230469']!).ids).not.toContain(fact.update);
      expect(recalled('Which crops did I stake this week?').ids).not.toContain(fact.update);
    }, neutral);
  });

  it('keeps the fact when messages that repeat the question\'s words mean something else (sample A)', () => {
    // Six messages carrying every content word of the question, about something else. They take the word-match
    // slots; the meaning stage's slots are not theirs to take.
    const distractors = Array.from({ length: 6 }, (_, index) => ({ turn: 6230440 + index,
      text: `Note ${index}: the little hut where I keep my rakes opens onto bed number ${index + 3}.`, terms: ['garden layout', 'bed map'] }));
    withRoom('A', distractors, ({ recalled }) => {
      const { ids } = recalled(question.message);
      expect(ids).toContain(fact.update);
      expect(ids.filter(turn => turn < 6230468).length).toBeGreaterThan(0);
      expect(ids.length).toBeLessThanOrEqual(5);
    }, neutral);
  });
});

describe('Rule 11: one unusable term no longer costs a message its whole index entry', () => {
  // Both real samples gave the reminder message a term carrying its clock time ("12:09"). The stored-term
  // check refuses a colon, and the write path used to refuse the whole list with it, so a message that states
  // a time was left with no meaning terms at all -- and after its two attempts, for good.
  const reminder = 6230472;
  const rawTerms = (label: string) => sample(label).concepts.find(item => updateOf(item.source) === reminder)!.terms;

  it('finds the shape in both real writer outputs', () => {
    expect(rawTerms('A')).toContain('scheduled reminder 12:09am');
    expect(rawTerms('B')).toContain('12:09 am alert');
    for (const label of ['A', 'B']) {
      // The strict stored-term check refuses the list as a whole: that stays, for replay.
      expect(conceptTerms(rawTerms(label))).toBeUndefined();
      const kept = proposedConceptTerms(rawTerms(label))!;
      expect(kept).toEqual(rawTerms(label).filter(term => !term.includes(':')));
      expect(conceptTerms(kept)).toEqual(kept);
    }
  });

  it('keeps the proposal reader bounded and refuses what is not a list', () => {
    expect(proposedConceptTerms('padlock code')).toBeUndefined();
    expect(proposedConceptTerms([':', 7, null, ''])).toBeUndefined();
    expect(proposedConceptTerms(['Lock  Code', 'lock code', 'x'.repeat(41), 'shed'])).toEqual(['lock code', 'shed']);
    expect(proposedConceptTerms(Array.from({ length: 40 }, (_, index) => `term ${index}`))).toHaveLength(12);
  });

  it('indexes the reminder through the real index pass from the recorded output (sample A and B)', async () => {
    for (const label of ['A', 'B']) {
      const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-recallrank-index-')));
      try {
        const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
        const turns = [...Object.entries(operatorMessages).map(([id, text]) => ({ turn: Number(id), text })),
          ...[6230475, 6230476, 6230477].map(turn => ({ turn, text: logText(turn) }))].sort((a, b) => a.turn - b.turn);
        for (const { turn, text } of turns) {
          const id = sourceId(turn);
          journal.append({ kind: 'intake', id, update: turn, text, raw: JSON.stringify(update(turn, text)), accepted: true, cursor: turn + 1, at: at + turn });
          journal.append({ kind: 'reserve', id, at: at + turn });
          journal.append({ kind: 'answer', id, text: 'Noted.', state: 'complete', at: at + turn });
          journal.append({ kind: 'intent', id, text: 'PREVIEW — Noted.', chat: '7654321', update: turn, grant: 'grant:preview', at: at + turn });
          journal.append({ kind: 'sent', id, message: turn, at: at + turn });
        }
        // Summarized before any terms existed: the whole prefix is index backlog.
        journal.append({ kind: 'summary-reserve', through: 6230477, at: at + 6230477 });
        journal.append({ kind: 'summary', through: 6230477, text: 'The operator keeps a daily garden log and asked for reminders.', at: at + 6230477 });
        let indexCalls = 0;
        // The writer's answer, verbatim, with only the room's bot id replaced by this root's.
        const answer = fixture.sampledTerms.samples.find(item => item.label === label)!.raw.replaceAll('telegram:8989505249:', 'telegram:12345678:');
        const worker = createJournalWorker(journal, { now: () => at + 7_000_000, stopped: () => false,
          send: async input => input.update, checkOutbound: () => {},
          model: async input => { if (!input.id.startsWith('summary:index:')) return 'Noted.'; indexCalls++; return answer; } });
        worker.intake([update(6230478, 'Short check-in.')]); await worker.drain(); await worker.summarizeIfNeeded();
        // Nine backlog messages: one full batch of eight and the remainder, each offered once.
        expect(indexCalls).toBe(2);
        expect(journal.view.indexOffered.filter(id => id === sourceId(reminder))).toHaveLength(1);
        const index = meaningTermsIndex(journal.view);
        expect(index.get(sourceId(reminder))).toEqual(rawTerms(label).filter(term => !term.includes(':')));
        expect(index.get(sourceId(fact.update))).toEqual(sample(label).concepts.find(item => updateOf(item.source) === fact.update)!.terms);
        expect(meaningIndexStatus(journal.view, 6230477).pendingUpdates).not.toContain(reminder);
        journal.close();
        // The stored row replays under the strict check.
        const reopened = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
        expect(meaningTermsIndex(reopened.view).get(sourceId(reminder))).toEqual(index.get(sourceId(reminder)));
        reopened.close();
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
  });
});

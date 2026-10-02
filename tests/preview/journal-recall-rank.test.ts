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
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conceptTerms, createJournalWorker, meaningIndexStatus, meaningTermsIndex, openPreviewJournal,
  proposedConceptTerms } from './journal.js';
import { bm25, terms } from '../../src/recall/lexical.js';
import { at, fact, fixture, gardenLog, genesis, key, logText, neutral, operatorMessages, question, sample, sourceId, update, updateOf,
  withRoom } from './recall-rank-room.js';

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

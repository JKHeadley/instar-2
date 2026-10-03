/** Unit w4-memlearn (plan row #404; the operator's 2026-09-13 direction): when the agent fails to
 * remember something it should have, the failure is recorded from durable evidence, and what is
 * recorded changes the next recall rather than only being counted.
 *
 * The recorded shapes are proof room two's own recall miss of 2026-10-02
 * (tests/preview/fixtures/proofroom2-recallrank-2026-10-02.json, live build cint-L23 e26a8c1b),
 * replayed through tests/preview/recall-rank-room.ts exactly as units w3-recallrank and
 * w3-recalllookup replay it: the operator stated a fact, 34 long garden logs pushed it into the
 * summarized prefix, the question was asked in words the fact does not use, and the fact was not
 * recalled. Sample B is the room's real index-writer output in which no stem is shared, so the
 * recorded miss reproduces. Here the conversation continues past the recorded run: the operator
 * corrects the wrong answer, and the same question is asked again.
 *
 * The one branch that room cannot reach -- a correction after an answer that carried the complete
 * history, where the evidence says nothing about memory -- is proved on a short room of the same
 * shape as tests/preview/journal-answer-correction.test.ts. The model and Telegram are stubs;
 * nothing reaches a live root. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, meaningTermsIndex, openPreviewJournal, type MemoryChange, type ReplyGrounding } from './journal.js';
import { applicableCues, MEMORY_FAILURE_LIMIT, MEMORY_LEARNING_THRESHOLD, memoryFailureCues, memoryFailureOlderNotRead,
  memoryFailureStatusLines, memoryFailures, memoryLearnings, questionCueTerms } from './memory-learning.js';
import { statusReply } from './status-command.js';
import { bm25, terms } from '../../src/recall/lexical.js';
import { fact, key, neutral, question, room, sourceId, update } from './recall-rank-room.js';

const WRONG = 'I have no record of a code for that hut.';
const SHED_CORRECTION = 'No, that’s wrong — I told you already: garden shed padlock code is 2958.';
const SHED_TRUTH = 'garden shed padlock code is 2958';

interface Round {
  /** The operator's question, answered wrongly. */
  readonly asked: string;
  /** Raw model outputs for that question's turn, in order; a `{"lookup":[...]}` output searches once. */
  readonly answers: readonly string[];
  /** The operator's correction of that answer, and the clauses it binds. */
  readonly correction: string;
  readonly quote: string;
  readonly replacement: string;
}
const lookupFor = (words: readonly string[]) => JSON.stringify({ lookup: words });
const shedRound = (asked = question.message, answers: readonly string[] = [WRONG]): Round =>
  ({ asked, answers, correction: SHED_CORRECTION, quote: WRONG, replacement: SHED_TRUTH });

/** The recorded room, continued: each round asks for real (not probed), is answered wrongly, and is
 * corrected. Returns the opened room so the same question can be asked again afterwards. */
function continued(path: string, rounds: readonly Round[]) {
  const corrections = new Map(rounds.map(round => [round.correction, round]));
  const attempts = new Map<string, number>();
  const opened = room(path, 'B', [], neutral, {
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul' as const, noul: 0.01 } } }),
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) {
        const packet = JSON.parse(input.context) as { memoryRequest?: { message: string };
          memoryCandidates?: { id: string; reply: string }[] };
        const round = packet.memoryRequest === undefined ? undefined : corrections.get(packet.memoryRequest.message);
        const source = round && packet.memoryCandidates?.find(item => item.reply.includes(round.quote));
        return JSON.stringify({ summary: 'The operator keeps a daily garden log, asked for reminders, and stated a garden shed padlock code.',
          people: [], memory: source
            ? [{ mode: 'correct', in: 'reply', source: source.id, quote: round!.quote, replacement: round!.replacement }] : [] });
      }
      if (corrections.has(input.question)) return JSON.stringify({ reply: 'Thank you — I have it now.', memory: [] });
      const round = rounds.find(item => item.asked === input.question);
      if (!round) return 'Noted.';
      const seen = (attempts.get(input.question) ?? 0);
      attempts.set(input.question, seen + 1);
      return round.answers[Math.min(seen, round.answers.length - 1)]!;
    },
  });
  return opened;
}

const send = async (opened: ReturnType<typeof continued>, id: number, text: string) => {
  opened.worker.intake([update(id, text)]);
  await opened.worker.drain();
};
/** Each round takes two updates: the question and its correction. */
async function play(opened: ReturnType<typeof continued>, rounds: readonly Round[]) {
  let id = question.update;
  for (const round of rounds) { await send(opened, id++, round.asked); await send(opened, id++, round.correction); }
  return id;
}

const withRoom = async (name: string, rounds: readonly Round[],
  body: (opened: ReturnType<typeof continued>) => Promise<void> | void) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), `preview-${name}-`)));
  const opened = continued(join(root, 'journal.encrypted'), rounds);
  try { await play(opened, rounds); await body(opened); } finally { opened.journal.close(); rmSync(root, { recursive: true, force: true }); }
};

describe('a memory failure is recorded from the evidence the answer already carried', () => {
  it('records the recorded miss as summarized-away, naming the record, the question and the truth', async () => {
    await withRoom('memlearn-record', [shedRound()], opened => {
      const view = opened.journal.view;
      expect(view.memory).toMatchObject([{ mode: 'correct', in: 'reply', quote: WRONG, replacement: SHED_TRUTH }]);

      const failures = memoryFailures(view);
      expect(failures).toHaveLength(1);
      const failure = failures[0]!;
      // Part 21 section 9 keeps three records distinct: the exchange, the explanation, the repair.
      expect(failure.answer).toBe(sourceId(question.update));
      expect(failure.trigger).toBe(sourceId(question.update + 1));
      expect(failure.asked).toBe(question.message);
      expect(failure.truth).toBe(SHED_TRUTH);
      expect(failure.missed).toBe(sourceId(fact.update));
      expect(failure.cause).toBe('summarized-away');
      expect(failure.stage).toBe('index');
      // What the memory path actually returned, counted from that answer's own grounding.
      expect(failure.returned.frontier).toEqual({ through: question.summaryThrough, basis: 'summary' });
      expect(failure.returned.recalled).toBeGreaterThan(0);
      expect(failure.returned.lookupWords).toBeUndefined();
      expect(view.turns.get(failure.answer)!.grounding!.recalled).not.toContain(sourceId(fact.update));
    });
  }, 60000);

  it('blames the search, not the summary, when a search ran over the hidden history and missed it', async () => {
    await withRoom('memlearn-search', [shedRound(question.message, [lookupFor(['porcupine', 'telescope']), WRONG])], opened => {
      const failures = memoryFailures(opened.journal.view);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ cause: 'not-retrieved', stage: 'selection', missed: sourceId(fact.update) });
      expect(failures[0]!.returned.lookupWords).toEqual(['porcupine', 'telescope']);
      expect(failures[0]!.returned.lookupFound).toBe(0);
    });
  }, 60000);

  it('reads a search that found nothing, for something no record holds, as never stored', async () => {
    const round: Round = { asked: question.message, answers: [lookupFor(['porcupine', 'telescope']), WRONG],
      correction: 'No, that’s wrong — the shed sits behind the compost heap.',
      quote: WRONG, replacement: 'the shed sits behind the compost heap' };
    await withRoom('memlearn-absent', [round], opened => {
      const failures = memoryFailures(opened.journal.view);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ cause: 'never-stored', stage: 'capture', truth: round.replacement });
      expect(failures[0]!.missed).toBeUndefined();
      // Nothing to find means nothing to hint at: the repair arm stays empty.
      expect([...memoryFailureCues(opened.journal.view)]).toEqual([]);
    });
  }, 60000);

  it('survives the journal closing and reopening, because its evidence is the journal', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-replay-')));
    const path = join(root, 'journal.encrypted');
    try {
      const opened = continued(path, [shedRound()]);
      await play(opened, [shedRound()]);
      const before = memoryFailures(opened.journal.view);
      const cuesBefore = [...memoryFailureCues(opened.journal.view)];
      expect(before).toHaveLength(1);
      opened.journal.close();

      const reopened = openPreviewJournal(path, key);
      expect(memoryFailures(reopened.view)).toEqual(before);
      expect([...memoryFailureCues(reopened.view)]).toEqual(cuesBefore);
      reopened.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60000);
});

describe('the repair changes the next recall, not only the count', () => {
  it('recalls the record the next time the same words are used, where it was missed before', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-repair-')));
    const opened = continued(join(root, 'journal.encrypted'), [shedRound()]);
    try {
      // Before: the recorded miss. The fact is in the summarized prefix and is not recalled.
      expect(opened.recalled(question.message).ids).not.toContain(fact.update);
      // The room's own recorded terms for the fact score it at zero against this question (sample B).
      const written = meaningTermsIndex(opened.journal.view).get(sourceId(fact.update))!;
      expect(bm25(terms(question.message, 32), [terms(written.join(' '))])).toEqual([]);

      await play(opened, [shedRound()]);

      const cues = memoryFailureCues(opened.journal.view);
      expect([...cues.keys()]).toEqual([sourceId(fact.update)]);
      expect(cues.get(sourceId(fact.update))).toEqual(['number', 'opens', 'little', 'hut', 'keep', 'rakes']);
      // After: the same question, through the same recall owner, now reaches the record.
      expect(opened.recalled(question.message).ids).toContain(fact.update);
      // The stage that changed: the derived ranking the recall owner fuses, scoring where it scored nothing.
      const merged = [...written, ...cues.get(sourceId(fact.update))!];
      expect(bm25(terms(question.message, 32), [terms(merged.join(' '))])[0]!.matched).toBe(6);
      // And only for those words: an unrelated question shares no stem with the hint, so the same
      // derived stage cannot reach the record for it.
      expect(bm25(terms('Which crops did I write up in the logs?', 32),
        [terms(cues.get(sourceId(fact.update))!.join(' '))])).toEqual([]);
    } finally { opened.journal.close(); rmSync(root, { recursive: true, force: true }); }
  }, 60000);

  it('leaves the write-side index exactly as written, so its own coverage reading stays honest', async () => {
    await withRoom('memlearn-coverage', [shedRound()], opened => {
      const written = meaningTermsIndex(opened.journal.view).get(sourceId(fact.update));
      // The room's own recorded terms for the fact (sample B), unchanged by the repair.
      expect(written).toEqual(['padlock code', 'shed combination', 'lock code 2958', 'garden shed security',
        'access code', 'secret code storage', 'sensitive info']);
      expect(memoryFailureCues(opened.journal.view).get(sourceId(fact.update)))
        .toEqual(['number', 'opens', 'little', 'hut', 'keep', 'rakes']);
    });
  }, 60000);

  it('stops calling it a retrieval failure once the record is in the packet and the answer is still wrong', async () => {
    await withRoom('memlearn-carried', [shedRound(), shedRound('What number opens the little hut where I keep my rakes?')], opened => {
      const failures = memoryFailures(opened.journal.view);
      expect(failures).toHaveLength(2);
      expect(failures.map(item => item.cause)).toEqual(['summarized-away', 'wrongly-stored']);
      // The second answer did carry the record the first one missed: the repair worked, the answer did not.
      expect(opened.journal.view.turns.get(failures[1]!.answer)!.grounding!.recalled)
        .toContain(sourceId(fact.update));
    });
  }, 120000);
});

describe('the words a question contributes', () => {
  it('keeps the content words the lexical stage keeps, in order, and drops the rest', () => {
    // 'what' and 'where' are not kept: the lexical stage drops them, so they could never rank anything.
    expect(questionCueTerms(question.message)).toEqual(['number', 'opens', 'little', 'hut', 'keep', 'rakes']);
    // Stemming happens at ranking time: the stored words stem to exactly the question's own terms.
    expect(terms(questionCueTerms(question.message)!.join(' '))).toEqual(terms(question.message));
  });

  it('bounds the list and refuses a question with nothing usable in it', () => {
    expect(questionCueTerms('??? !!!')).toBeUndefined();
    expect(questionCueTerms(Array.from({ length: 40 }, (_, k) => `word${k}`).join(' '))).toHaveLength(12);
  });

  it('applies a hint only to a question that substantially repeats it', () => {
    const hint = questionCueTerms(question.message)!;
    // The question that failed, and a close paraphrase of it: the hint applies.
    expect(applicableCues(hint, question.message)).toEqual(hint);
    expect(applicableCues(hint, 'Remind me of the number that opens the little hut.')).toEqual(hint);
    // One shared word is not a repeat of the question; the ranking is left exactly as it was.
    expect(applicableCues(hint, 'How many rakes do I own?')).toEqual([]);
    expect(applicableCues(hint, 'Which crops did I write up in the logs?')).toEqual([]);
    // Two words is the floor, so a one-word hint can never apply on a single coincidence.
    expect(applicableCues(['hut'], 'Where is the hut?')).toEqual([]);
    expect(applicableCues(['hut', 'rakes'], 'Where is the hut with the rakes?')).toEqual(['hut', 'rakes']);
  });
});

describe('status and the standing note', () => {
  it('reads memory health on the pull surface, and says none when there is none', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-status-')));
    const opened = continued(join(root, 'journal.encrypted'), [shedRound()]);
    try {
      expect(memoryFailureStatusLines(opened.journal.view)).toEqual(['Memory failures recorded: 0.']);
      await play(opened, [shedRound()]);
      expect(memoryFailureStatusLines(opened.journal.view)).toEqual([
        'Memory failures recorded: 1 (1 summarized away).',
        'Retrieval hints in force: 1 record.',
      ]);
      expect(statusReply(opened.journal.view, 1790000000000, 'UTC'))
        .toContain('Memory failures recorded: 1 (1 summarized away).');
    } finally { opened.journal.close(); rmSync(root, { recursive: true, force: true }); }
  }, 60000);

  it('carries no standing note for a single failure, and one once the cause repeats', async () => {
    const second: Round = { asked: 'Which way does the little hut face from the house?', answers: [WRONG],
      correction: 'No, that’s wrong — the shed sits behind the compost heap.',
      quote: WRONG, replacement: 'the shed sits behind the compost heap' };
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-note-')));
    const opened = continued(join(root, 'journal.encrypted'), [shedRound(), second]);
    try {
      await play(opened, [shedRound()]);
      expect(memoryLearnings(opened.journal.view)).toEqual([]);
      expect(opened.recalled('Anything else about the shed?').packet).not.toHaveProperty('memoryLearning');

      await send(opened, question.update + 2, second.asked);
      await send(opened, question.update + 3, second.correction);
      const failures = memoryFailures(opened.journal.view);
      expect(failures.map(item => item.cause)).toEqual(['summarized-away', 'summarized-away']);
      expect(failures).toHaveLength(MEMORY_LEARNING_THRESHOLD);
      const learnings = memoryLearnings(opened.journal.view);
      expect(learnings).toHaveLength(1);
      expect(learnings[0]).toMatchObject({ cause: 'summarized-away', occurrences: 2 });
      expect(learnings[0]!.guidance).toContain('rolling summary');
      const packet = opened.recalled('Anything else about the shed?').packet as { memoryLearning?: unknown[] };
      expect(packet.memoryLearning).toMatchObject([{ cause: 'summarized-away', occurrences: 2 }]);
      expect(memoryFailureStatusLines(opened.journal.view).at(-1))
        .toBe('Standing memory notes: summarized away (2).');
    } finally { opened.journal.close(); rmSync(root, { recursive: true, force: true }); }
  }, 120000);
});

describe('a correction after an answer that had the whole conversation', () => {
  const shortGenesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 8000, cursor: 0 };
  const shortUpdate = (id: number, text: string) => ({ update_id: id,
    message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

  it('names no stage, because the evidence names none', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-whole-')));
    const path = join(root, 'journal.encrypted');
    try {
      const journal = openPreviewJournal(path, new Uint8Array(32).fill(29), shortGenesis);
      const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
        summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul' as const, noul: 0.01 } } }),
        model: async (input: { id: string; question: string; context: string }) => {
          const packet = JSON.parse(input.context) as { memoryCandidates?: { id: string; reply: string }[] };
          if (input.id.startsWith('summary:')) {
            const source = packet.memoryCandidates?.find(item => item.reply.includes('The review was Monday.'));
            return JSON.stringify({ summary: 'The operator corrected the review day to Tuesday.', people: [],
              memory: source ? [{ mode: 'correct', in: 'reply', source: source.id,
                quote: 'The review was Monday.', replacement: 'it was Tuesday.' }] : [] });
          }
          if (input.question.startsWith('No,')) return JSON.stringify({ reply: 'Thanks, I will use Tuesday.', memory: [] });
          return 'The review was Monday.';
        }, send: async () => 1, checkOutbound: () => {} });
      worker.intake([shortUpdate(1, 'When was the review?')]); await worker.drain();
      worker.intake([shortUpdate(2, 'No, that’s wrong, it was Tuesday.')]); await worker.drain();

      const failures = memoryFailures(journal.view);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ cause: 'undetermined', stage: 'unassessable', truth: 'it was Tuesday.' });
      expect(failures[0]!.returned.frontier).toBeUndefined();
      // An unassessable observation earns no hint and no standing note; it is still counted and read.
      expect([...memoryFailureCues(journal.view)]).toEqual([]);
      expect(memoryLearnings(journal.view)).toEqual([]);
      expect(memoryFailureStatusLines(journal.view)).toEqual(['Memory failures recorded: 1 (1 undetermined).']);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60000);
});

/** Rows written straight into a real journal and read back through the real replay, for the two
 * things a recorded room cannot show: forty rounds (more than a room can be driven through in a
 * test), and a packet's grounding set exactly. The point being proved is arithmetic over the
 * projection, not anything a model decides. */
const boundGenesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 4000, maxReplies: 4000, maxTurns: 4000, maxBytes: 409600, cursor: 0 };
const rawUpdate = (id: number, text: string) => JSON.stringify({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });
const grounded = (through: number, carried: Partial<ReplyGrounding> = {}): ReplyGrounding =>
  ({ packetSha256: 'sha256:synthetic', summaryThrough: through, compactedThrough: through,
    history: [], recalled: [], people: [], commitments: [], channelItems: [], corrections: [],
    memoryChanges: [], memoryCandidates: [], ...carried });
const synthetic = (root: string, fill: number) => {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(fill), boundGenesis);
  const say = (update: number, text: string, reply: string,
    extra: { grounding?: ReplyGrounding; memory?: MemoryChange[] } = {}) => {
    const id = `telegram:12345678:update:${update}`;
    journal.append({ kind: 'intake', id, update, text, raw: rawUpdate(update, text), accepted: true, cursor: update + 1, at: 1790000000000 + update });
    journal.append({ kind: 'reserve', id, at: 1790000000000 + update, ...(extra.grounding ? { grounding: extra.grounding } : {}) });
    journal.append({ kind: 'answer', id, text: reply, state: 'complete', at: 1790000000000 + update, ...(extra.memory ? { memory: extra.memory } : {}) });
    journal.append({ kind: 'intent', id, text: `PREVIEW — ${reply}`, chat: '7654321', update, grant: 'grant:preview', at: 1790000000000 + update });
    journal.append({ kind: 'sent', id, message: update, at: 1790000000000 + update });
    return id;
  };
  return { journal, say };
};
const sid = (update: number) => `telegram:12345678:update:${update}`;

describe('a correction of a stored record, not of an answer', () => {
  it('is read as a failure only where the answer actually carried that record, and never hints at it', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-record-')));
    try {
      const { journal, say } = synthetic(root, 13);
      say(1, 'The Delta review owner is Nadia.', 'Noted.');
      // The answer that used the record: its grounding names it among what the packet recalled.
      say(2, 'Who owns the Delta review?', 'Nadia owns the Delta review.', { grounding: grounded(1, { recalled: [sid(1)] }) });
      say(3, 'Actually, the Delta review owner is Priya.', 'Thank you.', { memory: [{ mode: 'correct',
        source: sid(1), quote: 'The Delta review owner is Nadia', replacement: 'the Delta review owner is Priya', trigger: sid(3) }] });

      const carried = memoryFailures(journal.view);
      expect(carried).toHaveLength(1);
      expect(carried[0]).toMatchObject({ answer: sid(2), missed: sid(1), cause: 'wrongly-stored',
        stage: 'reader-use', hintable: false });
      // The record it names is the superseded one; promoting that would make memory worse.
      expect([...memoryFailureCues(journal.view)]).toEqual([]);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 30000);

  it('is not read as a memory failure at all when the answer never carried that record', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-record-absent-')));
    try {
      const { journal, say } = synthetic(root, 14);
      say(1, 'The Delta review owner is Nadia.', 'Noted.');
      say(2, 'What is the weather like?', 'I have no weather records.', { grounding: grounded(1) });
      say(3, 'Actually, the Delta review owner is Priya.', 'Thank you.', { memory: [{ mode: 'correct',
        source: sid(1), quote: 'The Delta review owner is Nadia', replacement: 'the Delta review owner is Priya', trigger: sid(3) }] });

      // An operator restating a fact is usually changing it; with no evidence an answer used the old
      // value, that is an update to the record, not a failure to remember (Part 21 section 9).
      expect(memoryFailures(journal.view)).toEqual([]);
      expect(memoryFailureStatusLines(journal.view)).toEqual(['Memory failures recorded: 0.']);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 30000);
});

describe('bounds', () => {
  const empty = (through: number) => grounded(through);

  it('keeps every failure and hints at the newest records only', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-bounds-')));
    try {
      const { journal, say } = synthetic(root, 11);
      const rounds = 40;
      for (let k = 0; k < rounds; k++) {
        const base = 1 + k * 3;
        const truth = `the gate code for shed ${k} is ${1000 + k}`;
        const factId = say(base, `I should write this down: ${truth}.`, 'Noted.');
        const wrong = `I have no record of shed ${k}.`;
        say(base + 1, `Remind me what opens shed ${k}?`, wrong, { grounding: empty(base) });
        say(base + 2, `No, that’s wrong — ${truth}.`, 'Thank you.', { memory: [{ mode: 'correct', in: 'reply',
          source: `telegram:12345678:update:${base + 1}`, quote: wrong, replacement: truth, trigger: `telegram:12345678:update:${base + 2}` }] });
        expect(factId).toBe(`telegram:12345678:update:${base}`);
      }
      const failures = memoryFailures(journal.view);
      expect(failures).toHaveLength(rounds);
      expect(new Set(failures.map(item => item.cause))).toEqual(new Set(['summarized-away']));
      // Every failure is kept and counted; only the hints are capped, newest first.
      const cues = memoryFailureCues(journal.view);
      expect(cues.size).toBe(32);
      expect(cues.has(`telegram:12345678:update:${1 + (rounds - 1) * 3}`)).toBe(true);
      expect(cues.has('telegram:12345678:update:1')).toBe(false);
      for (const [, held] of cues) expect(held.length).toBeLessThanOrEqual(12);
      expect(memoryFailureStatusLines(journal.view)).toEqual([
        'Memory failures recorded: 40 (40 summarized away).',
        'Retrieval hints in force: 32 records.',
        'Standing memory notes: summarized away (40).',
      ]);
      // Under the read bound nothing is left out, and the reading says so by saying nothing.
      expect(memoryFailureOlderNotRead(journal.view)).toBe(0);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60000);

  it('reads the newest corrections past the bound, and says how many it left behind', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-overbound-')));
    try {
      const { journal, say } = synthetic(root, 12);
      const rounds = MEMORY_FAILURE_LIMIT + 5;
      for (let k = 0; k < rounds; k++) {
        const base = 1 + k * 3;
        const truth = `the gate code for shed ${k} is ${1000 + k}`;
        say(base, `I should write this down: ${truth}.`, 'Noted.');
        const wrong = `I have no record of shed ${k}.`;
        say(base + 1, `Remind me what opens shed ${k}?`, wrong, { grounding: grounded(base) });
        say(base + 2, `No, that’s wrong — ${truth}.`, 'Thank you.', { memory: [{ mode: 'correct', in: 'reply',
          source: sid(base + 1), quote: wrong, replacement: truth, trigger: sid(base + 2) }] });
      }
      const failures = memoryFailures(journal.view);
      // The bound keeps the live end of the conversation, never the stale start: a long chat must
      // not quietly stop learning once it has made enough mistakes (Rules 2, 55).
      expect(failures).toHaveLength(MEMORY_FAILURE_LIMIT);
      expect(memoryFailureOlderNotRead(journal.view)).toBe(5);
      expect(failures[0]!.answer).toBe(sid(1 + 5 * 3 + 1));
      expect(failures.at(-1)!.answer).toBe(sid(1 + (rounds - 1) * 3 + 1));
      // The hints follow the newest failures, so the repair stays attached to live records.
      const cues = memoryFailureCues(journal.view);
      expect(cues.has(sid(1 + (rounds - 1) * 3))).toBe(true);
      expect(cues.has(sid(1))).toBe(false);
      // What the bound left out is said, not dropped quietly.
      expect(memoryFailureStatusLines(journal.view)[0])
        .toBe('Memory failures recorded: 200 (200 summarized away); 5 older corrections not read.');
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 120000);
});

/** Unit w4-memlearn-s (plan row #404; Part 21 §16): memory failures are recorded with what was asked, what the memory
 * path returned, the truth and the likely cause, and recurring failures change recall structurally.
 *
 * Recorded shapes (observer #106): the room is proof room two's recorded recall room (fixtures/proofroom2-recallrank-
 * 2026-10-02.json, rebuilt by recall-rank-room.ts) under its recorded index sample B, where the recorded paraphrase
 * question (update 6230509) misses the recorded fact (update 6230474). The forgotten-fact answers replayed here are the
 * verbatim real claude-sonnet-5 answers recorded for that room: P2 and P3 (the agent says it does not know, with the
 * fact in the journal), 'never-said' (a lookup that found nothing), and 'answered' (an ordinary reply that carries no
 * report). The reminder message and the model's memoryFailure report are this unit's own: no recorded output carries
 * the new field yet, so its acceptance rules are proved on both sides with stubs. Telegram is a stub. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, operatorWriter, type JournalView, type Turn } from './journal.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { fact, fixture, neutral, question, room, sourceId, update, updateOf } from './recall-rank-room.js';
import { MEMORY_FAILURE_DECISION, PIN_AFTER_FAILURES, learnedCues, memoryFailures, memoryLearningLine, memoryLearningReport,
  memoryLessons } from './memory-learning.js';

interface LookupSample { label: string; question: string; calls: { raw: string }[] }
const samples = (fixture as unknown as { lookupSamples: { samples: LookupSample[] } }).lookupSamples.samples;
const recorded = (label: string) => samples.find(item => item.label === label)!;
const decoded = (raw: string) => {
  const parsed = parseModelJson(raw);
  if (!parsed.ok || parsed.value.type !== 'Decision') throw Error('recorded output is not a Decision');
  const text = conclusionText((parsed.value.conclusion as { value?: unknown }).value);
  if (text === null) throw Error('recorded output has no conclusion text');
  return text;
};
const usage = { inputTokens: 10, outputTokens: 5, charge: null };
const factId = sourceId(fact.update), askedId = sourceId(question.update);
const REMINDER = 'You should have known that one. I told you before: my garden shed padlock code is 2958.';
const reminderReport = (source: string | null = factId) => JSON.stringify({ reply: 'Sorry about that: the code is 2958, your garden shed padlock.',
  memory: [], memoryFailure: { quote: 'my garden shed padlock code is 2958', source } });
type Packet = { memoryFailureDecision?: string; searchedTurn?: string; recalled?: { id: string }[]; history?: { id: string }[] };
const operator = (view: JournalView) => (turn: Turn) => operatorWriter(view, turn, true);

/** The recorded room under sample B with a scripted model: each operator message maps to the answer text it gets. */
function world(script: (text: string, packet: Packet) => string) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-')));
  const path = join(dir, 'journal.encrypted');
  const packets = new Map<number, Packet>(), sent: string[] = [];
  const ports = {
    send: async (input: { text: string; update: number }) => { sent.push(input.text); return input.update; },
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) return { state: 'complete' as const, failureClass: 'malformed' as const, usage };
      const packet = JSON.parse(input.context) as Packet;
      packets.set(updateOf(input.id.replace(/-resp$/u, '')), packet);
      return { state: 'complete' as const, text: script(input.question, packet), usage };
    } };
  // The fact's reply is neutral, as in the recorded lookup samples, so only its index terms can carry it.
  let opened = room(path, 'B', [], neutral, ports);
  let next = question.update;
  const say = async (text: string) => {
    const at = next++;
    opened.worker.intake([update(at, text)]);
    await opened.worker.drain();
    return { turn: opened.journal.view.turns.get(sourceId(at))!, packet: packets.get(at) };
  };
  return { get journal() { return opened.journal; }, get worker() { return opened.worker; }, say, sent, packets, path,
    recalledIds: (text: string) => opened.recalled(text).packet.recalled?.map(item => item.id) ?? [],
    reopen: () => {
      opened.journal.close();
      const journal = openPreviewJournal(path, new Uint8Array(32).fill(57), { kind: 'genesis' as const, bot: '12345678', chat: '7654321',
        operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
        maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 409600, cursor: 0 });
      const worker = createJournalWorker(journal, { now: () => 1790000000000 + 7_000_000, stopped: () => false, checkOutbound: () => {}, ...ports });
      opened = { journal, worker, recalled: (message: string) => {
        const result = worker.probe(message);
        if (!('context' in result)) throw Error('probe held');
        return { packet: JSON.parse(result.context) as { recalled?: { id: string }[] }, ids: [] };
      } } as typeof opened;
    },
    close: () => { try { opened.journal.close(); } catch { /* closed */ } rmSync(dir, { recursive: true, force: true }); } };
}

/** Three ordinary garden messages, so the three most recent turns, which widen recall, do not name the fact. */
const movesOn = async (w: ReturnType<typeof world>) => {
  for (const text of ['The basil row needs water.', 'The beans are climbing the trellis.', 'The carrots look thin this week.'])
    await w.say(text);
};

describe('Part 21 §16 (P21-NF-25/26/27): a forgotten fact, then the operator reminding, on the recorded recall room', () => {
  it('records the failure from the recorded P2 answer and the next recall of the same question reaches the fact', async () => {
    const forgot = decoded(recorded('P2').calls[0]!.raw);
    const w = world(text => text === REMINDER ? reminderReport() : text === question.message ? forgot : 'Noted.');
    try {
      // The recorded miss: the paraphrase does not reach the fact, and the real answer says it does not know.
      expect(w.recalledIds(question.message)).not.toContain(factId);
      const first = await w.say(question.message);
      expect(first.packet!.recalled!.map(item => item.id)).not.toContain(factId);
      expect(w.sent.at(-1)).not.toContain('2958');
      // That answer was given from a summary, so the next operator turn carries the offer, naming it.
      const reminded = await w.say(REMINDER);
      expect(reminded.packet!.memoryFailureDecision).toBe(MEMORY_FAILURE_DECISION);
      expect(reminded.packet!.searchedTurn).toBe(askedId);
      expect(reminded.turn.memoryFailure).toEqual({ quote: 'my garden shed padlock code is 2958', source: factId });
      const [failure, ...rest] = memoryFailures(w.journal.view, operator(w.journal.view));
      expect(rest).toEqual([]);
      expect(failure).toMatchObject({ signal: 'operator-reminded', trigger: reminded.turn.id,
        asked: { turn: askedId, update: question.update, question: question.message },
        truth: { quote: 'my garden shed padlock code is 2958', source: factId }, cause: 'not-retrieved' });
      expect(failure!.returned.reply).toContain('know');
      expect(failure!.returned.recalled).toBe(first.packet!.recalled!.length);
      // The lesson: the words of the question that missed now cue the fact, so the same question reaches it.
      expect(memoryLessons(w.journal.view, [failure!]).hints.get(factId)).toEqual(learnedCues(question.message));
      expect(w.recalledIds(question.message)).toContain(factId);
      const again = await w.say(question.message);
      expect(again.packet!.recalled!.map(item => item.id)).toContain(factId);
      // One failure is a hint, not a pin: once the conversation has moved on, an unrelated question does not carry it.
      expect(memoryLessons(w.journal.view, memoryFailures(w.journal.view, operator(w.journal.view))).pinned).toEqual([]);
      await movesOn(w);
      expect(w.recalledIds('What is 17 times 3?')).not.toContain(factId);
      // Shown in the operator's pull status, answered from the journal without a model call.
      await w.say('status');
      expect(w.sent.at(-1)).toContain('Memory failures: 1 recorded (1 not retrieved); learned: 1 retrieval hint, 0 pinned facts.');
      // Durable: the failure and its lesson replay from the journal after a restart.
      w.reopen();
      expect(memoryFailures(w.journal.view, operator(w.journal.view))).toHaveLength(1);
      expect(w.recalledIds(question.message)).toContain(factId);
    } finally { w.close(); }
  }, 120_000);

  it('records the failure after the recorded P3 answer too, and a pin after it recurs', async () => {
    const forgot = decoded(recorded('P3').calls[0]!.raw);
    const other = 'Remind me, which little hut holds my rakes and what opens it?';
    const w = world(text => text === REMINDER ? reminderReport() : text === question.message || text === other ? forgot : 'Noted.');
    try {
      await w.say(question.message);
      await w.say(REMINDER);
      await movesOn(w);
      expect(w.recalledIds('What is 17 times 3?')).not.toContain(factId);
      // A second miss on the same fact, asked another way, and a second reminder: the fact is pinned.
      await w.say(other);
      const second = await w.say(REMINDER);
      expect(second.packet!.searchedTurn).toBe(sourceId(question.update + 5));
      await movesOn(w);
      const failures = memoryFailures(w.journal.view, operator(w.journal.view));
      expect(failures).toHaveLength(PIN_AFTER_FAILURES);
      expect(memoryLessons(w.journal.view, failures).pinned).toEqual([factId]);
      // Pinned: recall carries the fact even for a question that shares nothing with it.
      expect(w.recalledIds('What is 17 times 3?')).toContain(factId);
      // The hint already reached the fact the second time, so that miss is recorded as shown but not used.
      expect(failures.map(failure => failure.cause)).toEqual(['not-retrieved', 'shown-not-used']);
      expect(memoryLearningLine(w.journal.view, operator(w.journal.view)))
        .toBe('Memory failures: 2 recorded (1 not retrieved, 1 shown not used); learned: 1 retrieval hint, 1 pinned fact.');
      expect(memoryLearningReport(w.journal.view, operator(w.journal.view))).toMatchObject({ failures: 2,
        bySignal: { 'operator-reminded': 2 }, byCause: { 'not-retrieved': 1, 'shown-not-used': 1 }, retrievalHints: 1, pinnedFacts: 1 });
    } finally { w.close(); }
  }, 120_000);

  it('records a recorded lookup that found nothing as never-stored, learned against the reminder itself', async () => {
    const sample = recorded('never-said');
    const first = decoded(sample.calls[0]!.raw), settled = decoded(sample.calls[1]!.raw);
    const told = 'I did tell you, I am sure of it: my sister\'s middle name is Rosalind.';
    let calls = 0;
    const w = world(text => {
      if (text === sample.question) return calls++ === 0 ? first : settled;
      if (text === told) return JSON.stringify({ reply: 'Thanks, Rosalind it is.', memory: [],
        memoryFailure: { quote: 'my sister\'s middle name is Rosalind', source: null } });
      return 'Noted.';
    });
    try {
      const asked = await w.say(sample.question);
      expect(asked.turn.lookup?.found).toEqual([]);
      const reminded = await w.say(told);
      expect(reminded.packet!.searchedTurn).toBe(asked.turn.id);
      const [failure] = memoryFailures(w.journal.view, operator(w.journal.view));
      expect(failure).toMatchObject({ cause: 'never-stored', truth: { quote: 'my sister\'s middle name is Rosalind' },
        returned: { lookup: { found: 0 } } });
      expect(failure!.truth.source).toBeUndefined();
      expect(memoryLessons(w.journal.view, [failure!]).hints.get(reminded.turn.id)).toEqual(learnedCues(sample.question));
    } finally { w.close(); }
  }, 120_000);

  it('records nothing for the recorded answered reply: the offer rides, the real answer carries no report', async () => {
    const forgot = decoded(recorded('P2').calls[0]!.raw), answered = decoded(recorded('answered').calls[0]!.raw);
    const w = world(text => text === question.message ? forgot : answered);
    try {
      await w.say(question.message);
      const next = await w.say('Thanks. What number opens the little hut where I keep my rakes, again?');
      expect(next.packet!.memoryFailureDecision).toBe(MEMORY_FAILURE_DECISION);
      expect(next.turn.memoryFailure).toBeUndefined();
      expect(memoryFailures(w.journal.view, operator(w.journal.view))).toEqual([]);
      expect(memoryLearningLine(w.journal.view, operator(w.journal.view))).toBe('Memory failures: none recorded.');
    } finally { w.close(); }
  }, 120_000);
});

describe('Part 21 §16 (P21-NF-25/27, P21-NEG-32/33): what a report may carry, both sides', () => {
  it('keeps the quote only when it is the operator\'s own words, and a source only when it preceded the failed answer', async () => {
    const forgot = decoded(recorded('P2').calls[0]!.raw);
    let report: unknown;
    const w = world(text => text === question.message ? forgot : JSON.stringify({ reply: 'Sorry.', memory: [], memoryFailure: report }));
    try {
      await w.say(question.message);
      // A paraphrased quote falls back to the operator's whole message; a source after the failed turn is dropped.
      report = { quote: 'the shed code is 2958', source: askedId };
      const first = await w.say(REMINDER);
      expect(first.turn.memoryFailure).toEqual({ quote: REMINDER });
      // Not an object: nothing recorded. The previous answer is now the reminder's, which had the whole message too.
      report = 'forgot the code';
      const second = await w.say('And again, you forgot.');
      expect(second.turn.memoryFailure).toBeUndefined();
    } finally { w.close(); }
  }, 120_000);

  it('offers nothing and records nothing after an answer that had the whole conversation in front of it', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-small-')));
    const packets: Packet[] = [];
    try {
      const journal = openPreviewJournal(join(dir, 'journal.encrypted'), new Uint8Array(32).fill(5), { kind: 'genesis',
        bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
        expires: 9999999999999, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 409600, cursor: 0 });
      const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false, checkOutbound: () => {},
        send: async (input: { update: number }) => input.update,
        model: async (input: { context: string }) => { packets.push(JSON.parse(input.context) as Packet);
          return JSON.stringify({ reply: 'I do not know.', memory: [], memoryFailure: { quote: 'my locker is 4521', source: null } }); } });
      worker.intake([update(1, 'My locker is 4521.')]); await worker.drain();
      worker.intake([update(2, 'What is my locker?')]); await worker.drain();
      worker.intake([update(3, 'I told you: my locker is 4521.')]); await worker.drain();
      expect(packets.every(packet => packet.memoryFailureDecision === undefined)).toBe(true);
      expect(journal.view.order.every(turn => turn.memoryFailure === undefined)).toBe(true);
      expect(memoryFailures(journal.view, operator(journal.view))).toEqual([]);
      // A forged row naming a report the offer could not have carried fails replay.
      const id = sourceId(4);
      journal.append({ kind: 'intake', id, update: 4, text: 'I told you twice: my locker is 4521.',
        raw: JSON.stringify(update(4, 'I told you twice: my locker is 4521.')), accepted: true, cursor: 5, at: 1790000000000 });
      journal.append({ kind: 'reserve', id, at: 1790000000000 });
      expect(() => journal.append({ kind: 'answer', id, text: 'Sorry.', state: 'complete', memoryFailure: { quote: 'my locker is 4521' },
        at: 1790000000000 })).toThrow('memory failure report refused');
      journal.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('teaches nothing from a fact the operator has since forgotten', async () => {
    const forgot = decoded(recorded('P2').calls[0]!.raw);
    const w = world(text => text === REMINDER ? reminderReport() : text === question.message ? forgot : 'Noted.');
    try {
      await w.say(question.message);
      await w.say(REMINDER);
      const failures = memoryFailures(w.journal.view, operator(w.journal.view));
      expect(memoryLessons(w.journal.view, failures).hints.has(factId)).toBe(true);
      const view = { ...w.journal.view, memory: [...w.journal.view.memory, { mode: 'forget' as const, source: factId,
        quote: fact.message, trigger: sourceId(question.update + 1) }] };
      expect(memoryLessons(view, failures).hints.has(factId)).toBe(false);
      expect(memoryLessons(view, failures).pinned).toEqual([]);
    } finally { w.close(); }
  }, 120_000);
});

describe('Part 21 §16 (P21-NF-25, P21-NEG-31): an operator correction of a fact the agent stated', () => {
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 8000, cursor: 0 };
  const small = async (model: (input: { id: string; question: string; context: string }) => string, messages: string[]) => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memlearn-correct-')));
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), new Uint8Array(32).fill(29), genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false, checkOutbound: () => {},
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      send: async (input: { update: number }) => input.update, model: async input => model(input) });
    for (const [index, text] of messages.entries()) { worker.intake([update(index + 1, text)]); await worker.drain(); }
    return { journal, close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }); } };
  };

  it('records the agent\'s own wrong statement, corrected by the operator, as a failure (the in:"reply" shape)', async () => {
    const r = await small(input => {
      const packet = JSON.parse(input.context) as { memoryCandidates?: { id: string; reply: string }[] };
      if (input.id.startsWith('summary:')) {
        const source = packet.memoryCandidates!.find(item => item.reply.includes('The review was Monday.'))!;
        return JSON.stringify({ summary: 'The operator corrected the review day to Tuesday.', people: [],
          memory: [{ mode: 'correct', in: 'reply', source: source.id, quote: 'The review was Monday.', replacement: 'it was Tuesday.' }] });
      }
      if (input.question === 'When was the review?') return 'The review was Monday.';
      return JSON.stringify({ reply: 'Thanks, I will use Tuesday.', memory: [] });
    }, ['When was the review?', 'No, that’s wrong, it was Tuesday.']);
    try {
      const failures = memoryFailures(r.journal.view, operator(r.journal.view));
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ signal: 'operator-correction', asked: { update: 1, question: 'When was the review?' },
        returned: { reply: 'The review was Monday.' }, truth: { quote: 'it was Tuesday.' }, cause: 'never-stored' });
    } finally { r.close(); }
  });

  it('records no failure for the recorded K13b correction of the operator\'s own earlier statement', async () => {
    // Recorded (journal-memory-correction-shape.test.ts, live 969389720/969389737): the operator corrects a code they
    // had stated; the agent never restated it, so the correction names no reply.
    const shedSet = 'My garden shed padlock code is 2958.', shedFix = 'Correction: my garden shed padlock code is 2093.';
    const r = await small(input => {
      const packet = JSON.parse(input.context) as { memoryCandidates?: { id: string; message: string }[] };
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Shed code noted.', people: [], memory: [] });
      if (input.question === shedFix) return JSON.stringify({ reply: 'Got it — your garden shed padlock code is now 2093.',
        memory: [{ mode: 'correct', source: packet.memoryCandidates!.find(item => item.message === shedSet)!.id,
          quote: 'My garden shed padlock code is 2958.', replacement: 'my garden shed padlock code is 2093.' }] });
      return JSON.stringify({ reply: `Noted: ${input.question}`, memory: [] });
    }, [shedSet, shedFix]);
    try {
      expect(r.journal.view.memory.filter(change => change.mode === 'correct')).toHaveLength(1);
      expect(memoryFailures(r.journal.view, operator(r.journal.view))).toEqual([]);
    } finally { r.close(); }
  });
});

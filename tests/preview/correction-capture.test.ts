/**
 * Unit — correction capture (carryover row 32; 1.x tests/unit/CorrectionCaptureLoop.test.ts at 4f88880a, spec
 * §3.1/§3.3).
 *
 * Pins, as in 1.x: the look-back window is bounded and cut at the flagged user turn; every captured text is
 * secret-scrubbed before any model reads it and the stored lesson is scrubbed again; an agent turn is marked
 * fromUser=false and never yields a lesson on its own; the model cannot widen the recorded kind; a model
 * unavailable at capture time loses nothing. Where 1.x pinned its in-memory ring (LRU/TTL eviction), its
 * capacity-throw drop paths and its per-topic rate ceiling, 2.0 pins the journal: the window is a read that
 * survives a restart, a message the model could not answer stays recorded and is distilled once it can, and no
 * burst of corrections is dropped. Each outcome is observable on its own (`captureDecision`).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, operatorWriter, MEMORY_UNDECIDED_REPLY, type Turn } from './journal.js';
import { captureDecision, captureReport, captureWindow, CAPTURE_TURN_CHARS, DEFAULT_CAPTURE_CONTEXT_TURNS } from './correction-capture.js';
import { correctionOccurrences, correctionRecords } from './correction-ledger.js';
import { correctionWorld, BOT, OPERATOR, T } from './correction-fixture.js';

const GHP = `ghp_${'A'.repeat(36)}`;

describe('captureWindow (bounded, cut at the trigger, scrubbed; a read, never a ring)', () => {
  it('caps the window at contextTurns (drop-oldest)', () => {
    const w = correctionWorld();
    try {
      const ids = Array.from({ length: 6 }, (_, i) => w.say(`t${String(i)}`, T('2026-05-01T10:00:00Z') + i * 1000));
      const window = captureWindow(w.view, w.operator, ids[5]!, 3);
      expect(window.length).toBe(3);
      expect(window[0]!.text).toBe('t3'); // oldest 3 dropped
      expect(window[2]!.text).toBe('t5');
      expect(captureWindow(w.view, w.operator, ids[5]!).length).toBe(DEFAULT_CAPTURE_CONTEXT_TURNS);
    } finally { w.close(); }
  });

  it('keeps conversations apart: another topic never enters the window, and a restart returns the same window', () => {
    const w = correctionWorld();
    try {
      w.say('a', T('2026-05-01T10:00:00Z'), { thread: 1 });
      w.say('b', T('2026-05-01T10:00:10Z'), { thread: 2 });
      const a2 = w.say('a2', T('2026-05-01T10:00:20Z'), { thread: 1 });
      const c = w.say('c', T('2026-05-01T10:00:30Z'), { thread: 3 });
      expect(captureWindow(w.view, w.operator, a2).map(turn => turn.text)).toEqual(['a', 'a2']);
      expect(captureWindow(w.view, w.operator, c).map(turn => turn.text)).toEqual(['c']);
      const before = captureWindow(w.view, w.operator, a2);
      w.reopen();
      expect(captureWindow(w.view, w.operator, a2)).toEqual(before);
    } finally { w.close(); }
  });

  it('cuts after the flagged user turn, dropping the reply that arrived meanwhile (1.x windowEndingAt)', () => {
    const w = correctionWorld();
    try {
      const first = w.say('Why did you remove the PIN step?', T('2026-05-01T10:00:00Z'));
      w.answer(first, 'I removed the PIN step.', T('2026-05-01T10:00:01Z'));
      const flagged = w.say('Quality before speed, always.', T('2026-05-01T10:00:02Z'));
      w.answer(flagged, 'Understood, slowing down.', T('2026-05-01T10:00:03Z'));
      const window = captureWindow(w.view, w.operator, flagged);
      expect(window.map(turn => [turn.fromUser, turn.text])).toEqual([
        [true, 'Why did you remove the PIN step?'], [false, 'I removed the PIN step.'], [true, 'Quality before speed, always.']]);
      // A later message never leaks into an earlier trigger's window.
      w.say('later', T('2026-05-01T10:00:04Z'));
      expect(captureWindow(w.view, w.operator, flagged).map(turn => turn.text)).not.toContain('later');
    } finally { w.close(); }
  });

  it('yields nothing for an unknown trigger and only the trigger when nothing precedes it', () => {
    const w = correctionWorld();
    try {
      expect(captureWindow(w.view, w.operator, 'telegram:12345678:update:999')).toEqual([]);
      const only = w.say('gone', T('2026-05-01T10:00:00Z'));
      expect(captureWindow(w.view, w.operator, only)).toEqual([{ id: only, text: 'gone', fromUser: true, at: T('2026-05-01T10:00:00Z') }]);
    } finally { w.close(); }
  });

  it('PRE-SCRUBS secrets out of captured turns and bounds each text', () => {
    const w = correctionWorld();
    try {
      const id = w.say(`my key is sk-abcdef0123456789abcdef and ${GHP} ${'x'.repeat(1200)}`, T('2026-05-01T10:00:00Z'));
      const [turn] = captureWindow(w.view, w.operator, id);
      expect(turn!.text).not.toContain('sk-abcdef0123456789abcdef');
      expect(turn!.text).not.toContain(GHP);
      expect(turn!.text).toContain('[redacted credential]');
      expect(turn!.text.length).toBeLessThanOrEqual(CAPTURE_TURN_CHARS);
      expect(JSON.stringify(captureWindow(w.view, w.operator, id))).not.toContain(GHP);
    } finally { w.close(); }
  });
});

describe('the lesson is the journal\'s validated memory change (no separate distill call)', () => {
  it('POST-SCRUBS the stored lesson: a credential in the operator\'s clause never reaches the record', () => {
    const w = correctionWorld();
    try {
      w.preference(`remember the token ${GHP} for pushes`, T('2026-05-01T10:00:00Z'));
      const record = correctionRecords(w.view, w.operator)[0]!;
      expect(record.learning).not.toContain(GHP);
      expect(record.learning).toContain('[redacted credential]');
      // The identity is taken from the operator's clause, so the same clause stated again is the same record.
      w.preference(`remember the token ${GHP} for pushes`, T('2026-05-02T10:00:00Z'));
      expect(correctionRecords(w.view, w.operator)).toHaveLength(1);
    } finally { w.close(); }
  });

  it('an agent turn (an over-apology) carries no user signal: it is marked and never becomes a lesson', () => {
    const w = correctionWorld();
    try {
      const id = w.say('ok', T('2026-05-01T10:00:00Z'));
      w.answer(id, "I'm so sorry, you're absolutely right, my mistake: I prefer plain language from now on.", T('2026-05-01T10:00:01Z'));
      const next = w.say('fine', T('2026-05-01T10:00:02Z'));
      expect(captureWindow(w.view, w.operator, next).map(turn => turn.fromUser)).toEqual([true, false, true]);
      expect(correctionOccurrences(w.view, w.operator)).toEqual([]);
      expect(captureDecision(w.view, w.operator, w.view.turns.get(id)!)).toBe('noise');
    } finally { w.close(); }
  });

  it('records a preference end-to-end and reports it recorded; an answered message with no lesson is noise', () => {
    const w = correctionWorld();
    try {
      const pref = w.preference('from now on lead with the action', T('2026-05-01T10:00:00Z'));
      const plain = w.reply('what time is it', T('2026-05-01T10:01:00Z'));
      const pending = w.say('and one more thing', T('2026-05-01T10:02:00Z'));
      expect(correctionRecords(w.view, w.operator)).toHaveLength(1);
      expect(captureDecision(w.view, w.operator, w.view.turns.get(pref)!)).toBe('recorded');
      expect(captureDecision(w.view, w.operator, w.view.turns.get(plain)!)).toBe('noise');
      expect(captureDecision(w.view, w.operator, w.view.turns.get(pending)!)).toBe('unanswered');
      expect(captureReport(w.view, w.operator)).toEqual({ recorded: 1, noise: 1, undecided: 0, unanswered: 1, 'no-signal': 0 });
    } finally { w.close(); }
  });

  it('every accepted correction in a burst is recorded: no per-topic rate ceiling drops the thirteenth', () => {
    const w = correctionWorld();
    try {
      for (let i = 0; i < 13; i++) w.preference(`lesson number ${String(i)}`, T('2026-05-01T10:00:00Z') + i * 1000);
      expect(correctionRecords(w.view, w.operator)).toHaveLength(13);
      expect(captureReport(w.view, w.operator).recorded).toBe(13);
    } finally { w.close(); }
  });
});

describe('the answer path\'s own validation and recovery replace the distill envelope and the backlog', () => {
  const genesis = { kind: 'genesis' as const, bot: BOT, chat: OPERATOR, operator: OPERATOR, grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 8000, cursor: 0 };
  const update = (id: number, text: string) => ({ update_id: id, message: { message_id: id, date: 1790000000, text,
    chat: { id: Number(OPERATOR), type: 'private' }, from: { id: Number(OPERATOR), is_bot: false, first_name: 'Operator' } } });
  const world = () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'preview-capture-')));
    const path = join(dir, 'journal.encrypted');
    let journal = openPreviewJournal(path, new Uint8Array(32).fill(29), genesis);
    const sent: string[] = [];
    let stopped = false, next = 1;
    const worker = (model: (input: { id: string; question: string; context: string }) => string) => createJournalWorker(journal, {
      now: () => 1790000000000, stopped: () => stopped, checkOutbound: () => {},
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      send: async (input: { text: string; update: number }) => { sent.push(input.text); return input.update; }, model: async input => model(input) });
    const operator = (turn: Turn) => operatorWriter(journal.view, turn, true);
    return { get view() { return journal.view; }, operator, sent, worker, stop: (value: boolean) => { stopped = value; },
      next: () => next++,
      say: async (run: ReturnType<typeof worker>, text: string) => { run.intake([update(next++, text)]); await run.drain(); },
      reopen: () => { journal.close(); journal = openPreviewJournal(path, new Uint8Array(32).fill(29)); },
      close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }); } };
  };
  const prefer = (text: string) => (input: { id: string; question: string }) => input.id.startsWith('summary:')
    ? JSON.stringify({ summary: 'Chat.', people: [], memory: [] })
    : input.question === text ? JSON.stringify({ reply: 'Will do.', memory: [{ mode: 'prefer', source: input.id.replace(/-resp$/u, ''), quote: text }] })
      : JSON.stringify({ reply: 'Noted.', memory: [] });

  it('the model cannot widen the kind: an unknown memory mode is refused on write, the operator is told, nothing is dropped', async () => {
    const w = world();
    try {
      const text = 'from now on lead with the action';
      const run = w.worker(input => input.id.startsWith('summary:') ? JSON.stringify({ summary: 'Chat.', people: [], memory: [] })
        : JSON.stringify({ reply: 'Will do.', memory: [{ mode: 'admin-override', source: input.id.replace(/-resp$/u, ''), quote: text }] }));
      await w.say(run, text);
      await run.drain();
      const turn = w.view.order[0]!;
      expect(correctionOccurrences(w.view, w.operator)).toEqual([]);
      expect(captureDecision(w.view, w.operator, turn)).toBe('undecided');
      // The journal holds the refused proposal as pending for the summary's decision and tells the operator the
      // request was reviewed; the proposal itself never became a memory change (MEMORY_UNDECIDED_REPLY is the
      // wording when that decision settles as undecided).
      expect(turn.memoryPending).toBe(true);
      expect(w.view.memory).toEqual([]);
      expect(w.sent).toHaveLength(1);
      expect(w.sent[0]).not.toContain('Will do.');
      expect(typeof MEMORY_UNDECIDED_REPLY).toBe('string');
      expect(turn.accepted).toBe(true);
      expect(captureReport(w.view, w.operator)).toMatchObject({ undecided: 1, recorded: 0 });
    } finally { w.close(); }
  }, 60_000);

  it('a lesson stated while the model is unavailable is distilled after a restart from the durable intake (no backlog)', async () => {
    const w = world();
    try {
      const text = 'from now on lead with the action';
      // Capacity gone between intake and answer: the stop gate refuses the model call; the message is durable intake.
      const first = w.worker(prefer(text));
      first.intake([update(w.next(), text)]);
      w.stop(true);
      await expect(first.drain()).rejects.toThrow('preview stopped');
      expect(w.view.order).toHaveLength(1);
      expect(captureDecision(w.view, w.operator, w.view.order[0]!)).toBe('unanswered');
      expect(correctionRecords(w.view, w.operator)).toEqual([]);
      // Restart with capacity back: the same message is answered and its lesson recorded, once.
      w.reopen(); w.stop(false);
      const run = w.worker(prefer(text));
      await run.drain();
      expect(correctionRecords(w.view, w.operator).map(record => record.learning)).toEqual([text]);
      expect(captureDecision(w.view, w.operator, w.view.order[0]!)).toBe('recorded');
      await run.drain();
      expect(correctionRecords(w.view, w.operator)[0]!.occurrenceCount).toBe(1);
    } finally { w.close(); }
  }, 60_000);
});

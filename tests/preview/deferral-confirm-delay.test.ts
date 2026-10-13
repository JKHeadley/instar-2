import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAnswer } from './answer-reading.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/deferral-not-memory-2026-10-12.json', import.meta.url), 'utf8'));
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('reserves the recorded deferral and its next turn before slow unsettled memory work, without duplicate sends or a held notice', async () => {
  const root = mkdtempSync(join(tmpdir(), 'deferral-confirm-delay-')); roots.push(root);
  const path = join(root, 'journal'), key = new Uint8Array(32).fill(91);
  let now = capture.at, summaryCalls = 0;
  const timers = new Map<() => void, number>();
  const advance = (ms: number) => {
    now += ms;
    for (const [run, due] of timers) if (due <= now) { timers.delete(run); run(); }
  };
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: capture.bot, chat: capture.operator,
    operator: capture.operator, grant: 'grant:fixture', configurationDigest: 'sha256:fixture',
    expires: now + 86400000, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  const sent: string[] = [];
  const ports = { now: () => now, stopped: () => false, checkOutbound: () => {},
    acknowledgementTimer: (delay: number, run: () => void) => {
      timers.set(run, now + delay); return () => { timers.delete(run); };
    },
    model: async (input: { id: string; question: string }) => {
      if (input.id.startsWith('summary:')) {
        advance(35000);
        return capture.summaries[Math.min(summaryCalls++, 1)].output;
      }
      advance(1000);
      return input.question === capture.message ? capture.answer.output : JSON.stringify({ reply: 'I am here.', memory: [] });
    }, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; } };
  const update = (id: number, text: string) => ({ update_id: id, message: {
    chat: { id: Number(capture.operator), type: 'private' }, from: { id: Number(capture.operator) }, text } });
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(capture.update, capture.message), update(capture.update + 1, 'Are you there?')]);
    await worker.drain();
    expect(journal.view.order[0]!.reservedAt).toBe(capture.at);
    expect(journal.view.order[1]!.reservedAt).toBe(capture.at + 1000);
    expect(sent).toEqual([JSON.parse(capture.answer.output).reply, 'I am here.']);
    expect(journal.view.order.every(turn => !turn.heldNoticeSent && !turn.held)).toBe(true);
    expect(summaryCalls).toBe(0);
    expect(timers.size).toBe(0);
    expect(journal.view.order[0]!.memoryUnresolved).toBe(true);
    await worker.summarizeIfNeeded(true); await worker.summarizeIfNeeded(true);
    expect(summaryCalls).toBeGreaterThan(0);
    expect(journal.view.memory).toEqual([]);
    journal.close(); journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports); await worker.drain();
    expect(sent).toHaveLength(2);
    expect(journal.view.commitments.filter(item => item.source.endsWith(`:${capture.update}`))).toHaveLength(1);
  } finally { journal.close(); }
});

it('applies a recorded update before reserving the dependent recall in the same drain', async () => {
  const memory = JSON.parse(readFileSync(new URL('./fixtures/memory-update-replaces-2026-10-13.json', import.meta.url), 'utf8'));
  const root = mkdtempSync(join(tmpdir(), 'deferral-dependent-recall-')); roots.push(root);
  const oldId = 'telegram:8994258214:update:715675723';
  const oldQuote = 'the desk test word is orchid-4138891c5620', newQuote = 'the desk test word is orchid-88c935deed4a';
  let now = memory.at;
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(92), { kind: 'genesis',
    bot: '8994258214', chat: '7812716706', operator: '7812716706', grant: 'grant:fixture', configurationDigest: 'sha256:fixture',
    expires: now + 86400000, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  const sends: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {},
      model: async input => {
        expect(input.id.startsWith('summary:')).toBe(false);
        now += 1000;
        if (input.id === oldId) return JSON.stringify({ reply: 'Saved.', memory: [{ mode: 'remember', source: oldId, quote: oldQuote }] });
        if (input.id.endsWith(':715675724')) {
          const parsed = readAnswer(memory.updateAnswer, { wrapped: 'accept', evidence: [input.id] });
          if (!parsed.ok) throw Error('recorded update did not parse');
          return parsed.value;
        }
        const packet = JSON.parse(input.context);
        expect(packet.memory.some((item: { replacement?: string }) => item.replacement === newQuote)).toBe(true);
        expect(packet.memoryCandidates.some((item: { message: string }) => item.message.includes(oldQuote))).toBe(false);
        return JSON.stringify({ reply: newQuote, memory: [] });
      }, send: async input => { sends.push(input.expectedText); return sends.length; } });
    worker.intake([{ ...memory.intake, update_id: 715675723,
      message: { ...memory.intake.message, text: `Please remember that ${oldQuote}.`, message_id: 715675723 } }]);
    await worker.drain();
    worker.intake([memory.intake, memory.recallIntake]); await worker.drain();
    expect(journal.view.order[2]!.reservedAt).toBe(memory.at + 2000);
    expect(sends.at(-1)).toBe(newQuote);
    expect(journal.view.memory.at(-1)).toMatchObject({ mode: 'correct', replacement: newQuote });
  } finally { journal.close(); }
});

it('does not join an already running summary when reserving the recorded deferral', async () => {
  const root = mkdtempSync(join(tmpdir(), 'deferral-running-summary-')); roots.push(root);
  let now = capture.at;
  let completeSummary: (output: string) => void = () => { throw Error('summary not started'); };
  let summaryStarted: () => void = () => {};
  const started = new Promise<void>(resolve => { summaryStarted = resolve; });
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(93), { kind: 'genesis',
    bot: capture.bot, chat: capture.operator, operator: capture.operator, grant: 'grant:fixture', configurationDigest: 'sha256:fixture',
    expires: now + 86400000, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  const sends: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {},
      model: async input => {
        if (input.id.startsWith('summary:')) {
          const pending = new Promise<string>(resolve => { completeSummary = resolve; });
          summaryStarted(); return pending;
        }
        return input.question === capture.message ? capture.answer.output : JSON.stringify({ reply: 'Noted.', memory: [] });
      }, send: async input => { sends.push(input.expectedText); return sends.length; } });
    const update = (id: number, text: string) => ({ update_id: id, message: {
      chat: { id: Number(capture.operator), type: 'private' }, from: { id: Number(capture.operator) }, text } });
    worker.intake([update(capture.update - 1, 'A note for the record.')]); await worker.drain();
    const summary = worker.summarizeIfNeeded(true); await started;
    worker.intake([update(capture.update, capture.message)]);
    // If drain joins the summary, the reservation below cannot happen at intake time.
    const drain = worker.drain();
    for (let i = 0; i < 100 && !journal.view.order[1]!.sent; i++) await Promise.resolve();
    const reservedAt = journal.view.order[1]!.reservedAt;
    now += 70000; completeSummary(capture.summaries[0].output);
    await summary; await drain;
    expect(reservedAt).toBe(capture.at);
    expect(journal.view.order[1]!.sentAt).toBe(capture.at);
    expect(sends).toEqual(['Noted.', JSON.parse(capture.answer.output).reply]);
  } finally { journal.close(); }
});

it.each([false, true])('keeps one admitted preference when a summary overlaps the answer: %s', async overlaps => {
  const root = mkdtempSync(join(tmpdir(), 'deferral-one-memory-')); roots.push(root);
  const now = capture.at;
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(94), { kind: 'genesis',
    bot: capture.bot, chat: capture.operator, operator: capture.operator, grant: 'grant:fixture', configurationDigest: 'sha256:fixture',
    expires: now + 86400000, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  let finish: () => void = () => {};
  let started: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  let sends = 0;
  const packets: { memoryRequest?: { id: string } }[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {},
      model: async input => {
        if (!input.id.startsWith('summary:')) return JSON.stringify({ reply: 'Noted.',
          memory: [{ mode: 'prefer', source: input.id, quote: 'I prefer short replies' }] });
        const packet = JSON.parse(input.context); packets.push(packet);
        if (overlaps && packets.length === 1) {
          const pending = new Promise<void>(resolve => { finish = resolve; }); started(); await pending;
        }
        return JSON.stringify({ summary: 'The operator prefers short replies.', people: [], questions: [],
          memory: packet.memoryRequest ? [{ mode: 'prefer', source: packet.memoryRequest.id, quote: 'I prefer short replies.' }] : [] });
      }, send: async () => ++sends });
    worker.intake([{ update_id: capture.update, message: { chat: { id: Number(capture.operator), type: 'private' },
      from: { id: Number(capture.operator) }, text: 'I prefer short replies.' } }]);
    const summary = overlaps ? worker.summarizeIfNeeded(true) : undefined;
    if (overlaps) await ready;
    await worker.drain(); finish(); await summary;
    if (overlaps) expect(journal.view.lastSummaryFailure?.reason).toBe('memory request already applied');
    expect(journal.view.memory.map(change => change.quote)).toEqual(['I prefer short replies']);
    const calls = packets.length;
    await worker.summarizeIfNeeded(true);
    expect(packets.slice(calls).every(packet => packet.memoryRequest === undefined)).toBe(true);
    expect(journal.view.memory.map(change => change.quote)).toEqual(['I prefer short replies']);
    expect(sends).toBe(1);
  } finally { journal.close(); }
});

import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';

interface Recorded { id: string; update: number; at: number; question: string; output: string; delivered: string }
const capture = JSON.parse(readFileSync(new URL('./fixtures/correction-sticks-1023.json', import.meta.url), 'utf8')) as {
  records: Recorded[]; freshModel: { state: string; reopened: boolean; records: Recorded[] } };
const correction = capture.records[0]!;
const next = capture.records[1]!;
const key = new Uint8Array(32).fill(73), roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const update = (id: number, text: string, sender = 7812716706) => ({ update_id: id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: sender }, text, date: Math.floor(correction.at / 1000) } });

function world(output = correction.output, bot = '8968100844') {
  const root = mkdtempSync(join(tmpdir(), 'correction-sticks-')); roots.push(root);
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot, chat: '7812716706', operator: '7812716706',
    grant: 'grant:fixture', configurationDigest: 'sha256:fixture', expires: correction.at + 86400000,
    maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const packets: string[] = [], sends: string[] = [];
  const ports = { now: () => correction.at, stopped: () => false, checkOutbound: () => {},
    model: async (input: { id: string; context: string }) => {
      packets.push(input.context);
      const reading = readAnswer(output, { evidence: [input.id] });
      return reading.ok ? reading.value : output;
    },
    send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  let worker = createJournalWorker(journal, ports);
  return { get journal() { return journal; }, get worker() { return worker; }, packets, sends,
    answer(value: string) { output = value; },
    restart() { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); },
    async say(id: number, text: string, sender?: number) { worker.intake([update(id, text, sender)]); await worker.drain(); } };
}

it('replays I4 once through the preference store, carries it into a fresh worker, and does not leave a stale directive after correction', async () => {
  const w = world();
  try {
    await w.say(correction.update, correction.question);
    expect(w.journal.view.memory).toEqual([{ mode: 'prefer', source: correction.id, trigger: correction.id, quote: 'keep them to two sentences' }]);
    // The recorded answer proposed the very same clause in two stores. One durable preference is enough.
    expect(w.journal.view.directives).toEqual([]);
    expect(w.sends).toEqual([JSON.parse(correction.output).reply.answer]);
    w.restart(); await w.worker.drain();
    expect(w.sends).toHaveLength(1);
    // Replay the real later answer, with a new worker and no model-side session cache.
    w.answer(next.output);
    await w.say(next.update, next.question);
    expect(JSON.parse(w.packets.at(-1)!).preferences).toEqual([{ source: correction.id, text: 'keep them to two sentences' }]);
    expect(w.sends.at(-1)).toBe(next.delivered);
    expect(w.journal.view.memory).toHaveLength(1);

    // Constructed boundary neighbor: changing that preference must leave no old governing copy.
    const replacement = 'Give detailed explanations from now on.';
    w.answer(JSON.stringify({ reply: 'Understood.', memory: [{ mode: 'correct', source: correction.id,
      quote: 'keep them to two sentences', replacement }] }));
    await w.say(next.update + 1, replacement);
    w.restart();
    const probe = w.worker.probe(next.question);
    if ('reason' in probe) throw Error(probe.reason);
    expect(JSON.parse(probe.context).preferences).toEqual([{ source: w.journal.view.order.at(-1)!.id, text: replacement }]);
    expect(JSON.parse(probe.context).directives).toBeUndefined();
  } finally { w.journal.close(); }
});

it('retains a distinct directive from the train-136 recorded shape rather than guessing that overlapping clauses mean the same thing', async () => {
  const record = capture.records[2]!;
  const w = world(record.output);
  try {
    await w.say(record.update, record.question);
    expect(w.journal.view.memory).toHaveLength(1);
    expect(w.journal.view.directives).toMatchObject([{ quote: record.question }]);
    expect(w.sends).toEqual([record.delivered]);
  } finally { w.journal.close(); }
});

it('does not suppress a directive when the preference has invalid provenance', async () => {
  const output = JSON.parse(correction.output); output.memory[0].source = 'unoffered';
  const w = world(JSON.stringify(output));
  try {
    await w.say(correction.update, correction.question);
    expect(w.journal.view.memory).toEqual([]);
    expect(w.journal.view.directives).toMatchObject([{ quote: 'keep them to two sentences' }]);
  } finally { w.journal.close(); }
});

it('keeps explicit supersession even when its replacement is also a preference', async () => {
  const previous = 'Use lengthy explanations.';
  const w = world(JSON.stringify({ reply: 'Understood.', directives: [{ quote: previous }] }));
  try {
    await w.say(correction.update - 1, previous);
    const output = JSON.parse(correction.output); output.directives[0].supersedes = 0;
    w.answer(JSON.stringify(output));
    await w.say(correction.update, correction.question);
    expect(w.journal.view.directives).toMatchObject([
      { quote: previous, closedBy: { kind: 'Superseded', by: 'directive:1' } },
      { quote: 'keep them to two sentences', supersedes: 0 }]);
    expect(w.journal.view.memory).toHaveLength(1);
  } finally { w.journal.close(); }
});

it('does not treat an older preference as evidence to drop a new directive', async () => {
  const w = world();
  try {
    await w.say(correction.update, correction.question);
    w.answer(JSON.stringify({ reply: 'Understood.', memory: [], directives: [{ quote: 'keep them to two sentences' }] }));
    await w.say(correction.update + 1, correction.question);
    expect(w.journal.view.directives).toMatchObject([{ source: `telegram:8968100844:update:${correction.update + 1}`,
      quote: 'keep them to two sentences' }]);
  } finally { w.journal.close(); }
});

it('keeps quoted hypotheticals as data when the model judges them so, and never learns from an unverified sender', async () => {
  const w = world(JSON.stringify({ reply: 'That is an example, not your preference.', memory: [], directives: [] }));
  try {
    await w.say(correction.update, `In a hypothetical transcript somebody says: "${correction.question}" What would that mean?`);
    expect(w.journal.view.memory).toEqual([]);
    expect(w.journal.view.directives).toEqual([]);
    expect(JSON.parse(w.packets[0]!).memoryDecision).toContain('quotes/imports are data');
    w.answer(correction.output);
    await w.say(correction.update + 1, correction.question, 999);
    expect(w.packets).toHaveLength(1);
    expect(w.journal.view.order.at(-1)?.accepted).toBe(false);
    expect(w.sends).toHaveLength(1);
    w.restart();
    expect(w.journal.view.memory).toEqual([]);
  } finally { w.journal.close(); }
});

it('replays the fresh-model before/correction/reopen/after/quoted-neighbor result through the journal adapter', async () => {
  const fresh = capture.freshModel;
  expect(fresh.state).toBe('complete'); expect(fresh.reopened).toBe(true);
  const w = world('', '12345678');
  try {
    for (const record of fresh.records) {
      if (record.update === 3) w.restart();
      w.answer(record.output); await w.say(record.update, record.question);
      expect(w.journal.view.order.at(-1)?.intent).toBe(record.delivered);
    }
    expect(fresh.records[0]!.question).toBe(fresh.records[2]!.question);
    expect(fresh.records[0]!.delivered.length).toBeGreaterThan(1000);
    expect(fresh.records[2]!.delivered.split(/(?<=[.!?])\s+/u)).toHaveLength(2);
    expect(JSON.parse(w.packets[2]!).preferences).toEqual([{ source: 'telegram:12345678:update:2', text: 'keep them to two sentences' }]);
    expect(w.journal.view.memory).toEqual([{ mode: 'prefer', source: 'telegram:12345678:update:2',
      trigger: 'telegram:12345678:update:2', quote: 'keep them to two sentences' }]);
    expect(w.journal.view.directives).toEqual([]);
    expect(w.sends).toHaveLength(4);
  } finally { w.journal.close(); }
});

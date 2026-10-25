import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAnswer } from './answer-reading.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/recall-held-2026-10-12.json', import.meta.url), 'utf8'));
const frame = (number: number) => capture.frames.find((row: { frame: number }) => row.frame === number);
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const output = (number: number) => {
  const reading = readAnswer(frame(number).output, { wrapped: 'accept', evidence: [frame(number).id] });
  if (!reading.ok) throw Error(reading.defect);
  return reading.value;
};

it.each(['recorded', 'restart-before-send', 'missing-fact', 'retired-fact', 'wrong-source', 'new-fact', 'dependent-answer'])(
  'replays recall 715675726 after saved 715675724 (%s)', async mode => {
  const root = mkdtempSync(join(tmpdir(), 'recall-held-memory-')); dirs.push(root);
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(42);
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: capture.bot, chat: capture.operator,
    operator: capture.operator, grant: 'grant:fixture', configurationDigest: 'sha256:fixture',
    expires: frame(146).at + 86400000, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 }, stage => {
    if (mode === 'restart-before-send' && stage === 'after:answer' && recallCalls === 2 && !interrupted) {
      interrupted = true; throw Error('interrupted before recall send');
    }
  });
  let interrupted = false;
  const sends: string[] = []; let recallCalls = 0;
  const uncertainty = 'I cannot yet confirm which value the pending correction will save.';
  const ports = { now: () => frame(146).at, stopped: () => false, checkOutbound: () => {},
    model: async (input: { id: string; context: string }) => {
      if (input.id.startsWith('summary:')) return { state: 'uncertain' as const };
      if (input.id === frame(90).id) return output(95);
      if (input.id.endsWith(':715675725')) return JSON.stringify({ reply: 'Forgot the requested information.',
        memory: [{ mode: 'forget', source: frame(90).id, quote: JSON.parse(output(95)).memory[0].quote }] });
      recallCalls++;
      if (mode === 'dependent-answer') {
        expect(JSON.parse(input.context).memoryDecision).toContain('Report failed saves only when relevant');
        return JSON.stringify({ reply: uncertainty, memory: [], memoryDisposition: 'unresolved' });
      }
      const value = JSON.parse(output(recallCalls === 1 ? 155 : 161));
      if (mode === 'wrong-source') value.memory[0].source = 'unoffered';
      if (mode === 'new-fact') value.memory[0].quote = 'the desk test word is an invented new value';
      return JSON.stringify(value);
    },
    send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  const intake = (worker: ReturnType<typeof createJournalWorker>, number: number) => worker.intake([
    { update_id: frame(number).update, message: { chat: { id: Number(capture.operator), type: 'private' },
      from: { id: Number(capture.operator) }, text: frame(number).text } }]);
  try {
    let worker = createJournalWorker(journal, ports);
    if (mode !== 'missing-fact') { intake(worker, 90); await worker.drain(); }
    if (mode === 'retired-fact') {
      worker.intake([{ update_id: 715675725, message: { chat: { id: Number(capture.operator), type: 'private' },
        from: { id: Number(capture.operator) }, text: 'Forget the desk test word.' } }]);
      await worker.drain(); await worker.drain();
      expect(journal.view.memory.some(change => change.mode === 'forget')).toBe(true);
    }
    const before = JSON.stringify(journal.view.memory);
    const beforeSends = sends.length;
    intake(worker, 146);
    if (mode === 'dependent-answer') journal.append({ kind: 'memory-undecided', id: frame(178).id,
      reason: frame(178).reason, at: frame(178).at });
    if (mode === 'restart-before-send') {
      await expect(worker.drain()).rejects.toThrow('interrupted before recall send');
      expect(sends).toHaveLength(beforeSends);
      journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    }
    await worker.drain();
    const independent = ['recorded', 'restart-before-send', 'dependent-answer'].includes(mode);
    expect(recallCalls).toBe(mode === 'dependent-answer' ? 1 : 2);
    if (!independent) {
      expect(sends).toHaveLength(beforeSends);
      expect(journal.view.order.at(-1)!.memoryPending).toBe(true);
      expect(JSON.stringify(journal.view.memory)).toBe(before);
      return;
    }
    const reply = mode === 'dependent-answer' ? uncertainty : frame(163).text;
    expect(sends.slice(beforeSends)).toEqual([reply]);
    expect(journal.view.order.at(-1)!.held).toBeUndefined();
    expect(JSON.stringify(journal.view.memory)).toBe(before);
    // The recorded failed review cannot retract an answer already sent or invent a new save.
    if (mode !== 'dependent-answer') journal.append({ kind: 'memory-undecided', id: frame(178).id, reason: frame(178).reason, at: frame(178).at });
    await worker.drain();
    journal.close(); journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports); await worker.drain();
    expect(sends.slice(beforeSends)).toEqual([reply]);
    expect(JSON.stringify(journal.view.memory)).toBe(before);
  } finally { journal.close(); }
});

import { MEMORY_DISAMBIGUATION } from '../../src/assembly/memory-answer-guidance.js';
const HISTORICAL_MEMORY = 'If two active memory items match the question but disagree, or refer to different people or things, ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; ignore corrected or forgotten items. ';
import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { OBLIGATION_WORK_QUESTION, OBLIGATION_WORK_QUESTION_TOOLS, obligationDecision,
  obligationSchedule, createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { loopHealth } from './obligations.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/deferral-delivery-2026-10-18.json', import.meta.url), 'utf8')) as {
  bot: string; operator: string; cases: { update: number; at: number; message: string;
    answer: { id: string; output: string }; before: { id: string; output: string; input: string };
    after: { question: string; inputSha256: string; output: string; systemSha256: string } }[];
};
const legacy = JSON.parse(readFileSync(new URL('./fixtures/deferral-finish-2026-10-17.json', import.meta.url), 'utf8')) as {
  summaries: { output: string }[] };
function read(raw: string, id: string) {
  const result = readAnswer(raw, { wrapped: 'accept', evidence: [id] });
  if (!result.ok) throw Error(result.shape);
  return result.value;
}

it('makes the scheduled preparation and recorded dependency boundary explicit on both routes', () => {
  for (const question of [OBLIGATION_WORK_QUESTION, OBLIGATION_WORK_QUESTION_TOOLS]) {
    expect(question).toContain('This scheduled call prepares a result for the runner; it is not the operator-facing reply');
    expect(question).toContain('obligation.waitsOn records an earlier classification');
    expect(question).toContain('A genuine missing input or unfinished step still uses waiting or continue');
  }
});

for (const sample of capture.cases) it.each(['recorded-continue', 'finished', 'restart'])(
  `replays train-76 update ${sample.update}: %s`, async mode => {
  const root = mkdtempSync(join(tmpdir(), 'deferral-delivery-')), path = join(root, 'journal');
  const key = new Uint8Array(32).fill(57), sends: string[] = [];
  let now = sample.at, summaries = 0, workCalls = 0;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: capture.bot, operator: capture.operator,
    chat: capture.operator, grant: 'grant:recorded-deferral', configurationDigest: 'sha256:fixture',
    expires: now + 86400000, loopRevisitMs: 15 * 60000, maxCalls: 50, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  const ports = { now: () => now, stopped: () => false, checkOutbound: () => {}, toolRoute: () => true,
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) return legacy.summaries[Math.min(summaries++, 2)]!.output;
      if (input.id.startsWith('obligation:')) {
        workCalls++;
        expect(input.question).toBe(OBLIGATION_WORK_QUESTION_TOOLS);
        expect(JSON.parse(input.context).obligation).toMatchObject({ kind: 'deferral', waitsOn: 'operator' });
        expect(JSON.parse(input.context).obligation.deliveryRequest).toBeUndefined();
        return read(mode === 'recorded-continue' ? sample.before.output : sample.after.output, input.id);
      }
      return input.id === sample.answer.id ? read(sample.answer.output, input.id) : 'Hello.';
    }, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  const intake = (worker: ReturnType<typeof createJournalWorker>, update: number, text: string) => worker.intake([
    { update_id: update, message: { chat: { id: Number(capture.operator), type: 'private' },
      from: { id: Number(capture.operator) }, text } }]);
  try {
    let worker = createJournalWorker(journal, ports);
    intake(worker, sample.update, sample.message); await worker.drain(); await worker.drain();
    expect(sends).toEqual([JSON.parse(read(sample.answer.output, sample.answer.id)).reply]);
    expect(journal.view.commitments).toHaveLength(1);
    const due = obligationSchedule(journal.view)[0]!;
    now = due.slot - 1; expect(await worker.workObligations()).toBe(false);
    now = due.slot; expect(await worker.workObligations()).toBe(true);
    expect(workCalls).toBe(1);
    await worker.sendRequested(); expect(sends).toHaveLength(1);
    if (mode === 'recorded-continue') {
      expect(loopHealth(journal.view, now)).toMatchObject({ awaitingDelivery: 0, deliveryInhibition: null });
      expect(journal.view.obligationWork['commitment:0']!.outcome).toBe('continue');
      expect(journal.view.closed.size).toBe(0);
      return; // A progress note is never coerced into a finished answer.
    }
    expect(loopHealth(journal.view, now)).toMatchObject({ awaitingDelivery: 1,
      deliveryInhibition: 'no grant for unsolicited sends; 1 finished result waits for your next message' });
    if (mode === 'restart') {
      journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    }
    intake(worker, sample.update + 1, 'hi'); await worker.drain(); await worker.drain();
    expect(sends).toHaveLength(2);
    expect(sends[1]).toContain('Follow-up on "');
    expect(sends[1]).toContain(JSON.parse(read(sample.after.output, sample.before.id)).report);
    expect(loopHealth(journal.view, now).awaitingDelivery).toBe(0);
    expect(journal.view.closed.has(0)).toBe(true);
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    await worker.drain(); await worker.sendRequested();
    expect(await worker.workObligations()).toBe(false);
    expect(sends).toHaveLength(2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('keeps genuine unfinished work and external dependencies open (constructed neighbours)', () => {
  for (const value of [{ outcome: 'continue', note: 'Compared two chapters; three remain.' },
    { outcome: 'waiting', waitsOn: 'external', note: 'The requested export is still processing.' },
    { outcome: 'waiting', waitsOn: 'operator', note: 'Need the operator-only account approval.' }]) {
    expect(obligationDecision(JSON.stringify(value), 'commitment', capture.cases[0]!.at, 'UTC')).toMatchObject(value);
  }
});

it('binds the new instruction to both complete recorded provider envelopes', () => {
  for (const sample of capture.cases) {
    expect(sample.after.question).toBe(OBLIGATION_WORK_QUESTION_TOOLS);
    // Translate only the reviewed supersession wording; retain original capture and digest.
    expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain(MEMORY_DISAMBIGUATION);
    expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).not.toContain(HISTORICAL_MEMORY);
    expect(sample.after.systemSha256).toBe(createHash('sha256')
      .update(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT.replace(MEMORY_DISAMBIGUATION, HISTORICAL_MEMORY).replace('give a brief decision rationale supported by the relevant evidence.', 'do all your reasoning there.')).digest('hex'));
    const input = JSON.parse(sample.before.input);
    input.messages[0].content = OBLIGATION_WORK_QUESTION_TOOLS;
    expect(createHash('sha256').update(JSON.stringify(input)).digest('hex')).toBe(sample.after.inputSha256);
    expect(JSON.parse(read(sample.before.output, sample.before.id)).outcome).toBe('continue');
    expect(JSON.parse(read(sample.after.output, sample.before.id)).outcome).toBe('report');
  }
});

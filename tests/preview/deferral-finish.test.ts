import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, obligationSchedule, openPreviewJournal,
  OBLIGATION_WORK_QUESTION, OBLIGATION_WORK_QUESTION_TOOLS } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { loopHealth } from './obligations.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/deferral-finish-2026-10-17.json', import.meta.url), 'utf8')) as {
  bot: string; operator: string; summaries: { output: string }[];
  cases: { update: number; at: number; message: string; answer: { id: string; output: string };
    before: { id: string; output: string };
    after: { output: string; input: string; question: string; systemSha256: string } }[];
};
function read(raw: string, id: string) {
  const result = readAnswer(raw, { wrapped: 'accept', evidence: [id] });
  if (!result.ok) throw Error(result.shape);
  return result.value;
}

it('preserves recorded provider provenance and both merged work instructions', () => {
  for (const sample of capture.cases) {
    // The recording predates completion accounting. Keep its bytes honest: the merged
    // question inserts exactly the live checklist paragraph before the runner-task suffix.
    const boundary = 'This is a runner task, not a message from the operator.';
    const prefix = sample.after.question.slice(0, sample.after.question.indexOf(boundary));
    const suffix = sample.after.question.slice(sample.after.question.indexOf(boundary));
    expect(OBLIGATION_WORK_QUESTION.startsWith(prefix)).toBe(true);
    expect(OBLIGATION_WORK_QUESTION.endsWith(suffix)).toBe(true);
    const added = OBLIGATION_WORK_QUESTION.slice(prefix.length, -suffix.length);
    expect(createHash('sha256').update(added).digest('hex')).toBe('57d0ee1e1da513677f60a7266c572948222e50da275cda1082570b0859da0413');
    expect(sample.after.systemSha256).toBe(createHash('sha256').update(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).digest('hex'));
    const envelope = JSON.parse(sample.after.input);
    expect(envelope.messages[0].content).toBe(sample.after.question);
    const packet = JSON.parse(envelope.messages.find((item: { role: string }) => item.role === 'context').content).packet;
    expect(packet.obligation.operatorMessage).toBe(sample.message);
    expect(packet.obligation.deliveryRequest).toBeUndefined();
    expect(packet.memory.operatorMessages.some((item: { text: string }) => item.text === sample.message)).toBe(true);
    expect(JSON.parse(sample.before.output).outcome).toBe('continue');
    expect(JSON.parse(sample.after.output).outcome).toBe('report');
  }
  // Both installed routes share the same distinction, while genuine dependencies retain their outcomes.
  for (const question of [OBLIGATION_WORK_QUESTION, OBLIGATION_WORK_QUESTION_TOOLS]) {
    expect(question).toContain('returning report does not send it');
    expect(question).toContain('when it genuinely needs more time');
    expect(question).toContain('only when someone else must act first');
  }
});

for (const sample of capture.cases) it.each(['finished', 'restart', 'old-continue'])(
  `replays ${sample.update} through classification, scheduled work and delivery: %s`, async mode => {
  const root = mkdtempSync(join(tmpdir(), 'deferral-finish-')), path = join(root, 'journal');
  const key = new Uint8Array(32).fill(71), sends: string[] = [], workQuestions: string[] = [];
  let now = sample.at, summaries = 0;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: capture.bot, operator: capture.operator,
    chat: capture.operator, grant: 'grant:recorded-deferral', configurationDigest: 'sha256:fixture',
    expires: now + 7 * 86400000, loopRevisitMs: 15 * 60000, maxCalls: 50, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  const ports = { now: () => now, stopped: () => false, checkOutbound: () => {},
    model: async (input: { id: string; question: string }) => {
      if (input.id.startsWith('summary:')) return capture.summaries[Math.min(summaries++, 2)]!.output;
      if (input.id.startsWith('obligation:')) {
        workQuestions.push(input.question);
        return read(mode === 'old-continue' ? sample.before.output : sample.after.output, input.id);
      }
      return input.id === sample.answer.id ? read(sample.answer.output, input.id) : 'Hello.';
    }, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  const intake = (worker: ReturnType<typeof createJournalWorker>, update: number, text: string) => worker.intake([
    { update_id: update, message: { chat: { id: Number(capture.operator), type: 'private' },
      from: { id: Number(capture.operator) }, text } }]);
  try {
    let worker = createJournalWorker(journal, ports);
    intake(worker, sample.update, sample.message);
    await worker.drain(); await worker.drain();
    // The actual d1 output already classifies correctly; its early live status was still awaiting the answer.
    expect(sends).toEqual([JSON.parse(read(sample.answer.output, sample.answer.id)).reply]);
    expect(journal.view.commitments).toMatchObject([{ owner: 'agent', loop: 'deferral', waitsOn: 'nothing' }]);
    expect(journal.view.commitments).toHaveLength(1);
    const due = obligationSchedule(journal.view)[0]!;
    now = due.slot - 1; expect(await worker.workObligations()).toBe(false);
    now = due.slot; expect(await worker.workObligations()).toBe(true);
    expect(workQuestions).toEqual([OBLIGATION_WORK_QUESTION]);
    expect(sends).toHaveLength(1);
    expect(journal.view.obligationWork['commitment:0']!.attempts).toBe(1);
    if (mode === 'old-continue') {
      // Never reinterpret the model's continue as completion: the fix is its delivered instruction.
      expect(journal.view.obligationWork['commitment:0']!.outcome).toBe('continue');
      expect(loopHealth(journal.view, now).awaitingDelivery).toBe(0);
      return;
    }
    expect(loopHealth(journal.view, now)).toMatchObject({ awaitingDelivery: 1,
      deliveryInhibition: 'no grant for unsolicited sends; 1 finished result waits for your next message' });
    expect(await worker.workObligations()).toBe(false);
    if (mode === 'restart') {
      journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
      expect(loopHealth(journal.view, now).awaitingDelivery).toBe(1);
    }
    intake(worker, sample.update + 1, 'hi'); await worker.drain(); await worker.drain();
    expect(sends).toHaveLength(2);
    expect(sends[1]).toContain('Follow-up on "');
    expect(sends[1]).toContain(JSON.parse(sample.after.output).report);
    expect(journal.view.closed.has(0)).toBe(true);
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    await worker.drain(); expect(await worker.workObligations()).toBe(false);
    expect(sends).toHaveLength(2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

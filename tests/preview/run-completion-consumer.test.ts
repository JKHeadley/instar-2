import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, obligationDecision } from './journal.js';
import { readAnswer } from './answer-reading.js';

const key = new Uint8Array(32).fill(118), at = 1791106122000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at + 86400000,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const promise = 'I will finish the spec and validate the script.';
const reply = 'The spec and script are complete.';
const item = { id: 'script', work: 'Validate the created script', state: 'open' as const };

it('the actual answer reader retains completion fields for the work-result consumer', () => {
  const output = JSON.stringify({ reasoning: 'The script remains unfinished.', outcome: 'report', report: reply, completion: [item] });
  const reading = readAnswer(output, { wrapped: 'accept', evidence: ['obligation:commitment:0:1'] });
  expect(reading.ok).toBe(true);
  if (!reading.ok) throw Error(reading.defect);
  expect(obligationDecision(reading.value, 'commitment', at, 'UTC')).toMatchObject({ outcome: 'continue', completion: [item] });
});

it.each([false, true])('a delivered reply only fulfills a promise once created work is accounted for (complete: %s)', async complete => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'completion-consumer-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  let now = at, calls = 0, messages = 0;
  const checks: string[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async () => JSON.stringify(++calls === 1 ? { reply: promise, promises: [{ quote: promise }] }
      : { reply, fulfilled: [{ id: 0, quote: reply }] }),
    send: async () => ++messages, checkOutbound: () => {},
    stepCheck: { jev: async (state, questions) => { checks.push(state); return { latencyMs: 1,
      value: { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(questions!).map(id => [id, { type: 'noul', noul: 0.1 }])) } }; } } });
  try {
    worker.intake([update(1, 'Finish the spec and its validation script.')]); await worker.drain();
    expect(journal.view.commitments[0]?.agentPromise).toBeDefined();
    journal.append({ kind: 'obligation-start', obligation: 'commitment:0', slot: now, at: now });
    journal.append({ kind: 'obligation-result', obligation: 'commitment:0', slot: now, at: now,
      outcome: 'continue', note: 'Validation is recorded separately.', completion: [complete
        ? { ...item, state: 'complete', evidence: 'The recorded validation command exited zero.' } : item] });
    now++;
    worker.startStepChecks();
    worker.intake([update(2, 'What did you finish?')]); await worker.drain();
    expect(messages).toBe(2); // The user's answer is not blocked.
    expect(journal.view.closed.has(0)).toBe(complete);
    expect(journal.view.obligationWork['commitment:0']?.completion?.[0]?.state).toBe(complete ? 'complete' : 'open');
    // No deferred observer is used to manufacture the mechanical closure result above.
    await worker.checkSteps();
    const answerCheck = checks.map(text => JSON.parse(text)).find(state => state.step === 'answer:telegram:12345678:update:2');
    expect(answerCheck.request).toBe('What did you finish?');
    if (!complete) expect(answerCheck.journal.completion).toContainEqual(expect.objectContaining({
      obligation: 'commitment:0', open: true, work: expect.objectContaining({ completion: [item] }) }));
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('scrubs every checklist string before durable accounting and keeps redacted identities stable', () => {
  const secret = 'password=syntheticCompletionSecret123';
  const first = obligationDecision(JSON.stringify({ outcome: 'continue', note: 'Validation is pending.',
    completion: [{ id: secret, work: `Validate ${secret}`, state: 'open' }] }), 'commitment', at, 'UTC');
  expect(first.completion).toHaveLength(1);
  expect(JSON.stringify(first)).not.toContain('syntheticCompletionSecret123');
  const next = obligationDecision(JSON.stringify({ outcome: 'report', report: reply,
    completion: [{ id: secret, work: `Validate ${secret}`, state: 'complete', evidence: `Validated ${secret}` }] }),
    'commitment', at, 'UTC', first.completion);
  expect(next.outcome).toBe('report');
  expect(next.completion?.[0]?.id).toBe(first.completion?.[0]?.id);
  expect(JSON.stringify(next)).not.toContain('syntheticCompletionSecret123');
});

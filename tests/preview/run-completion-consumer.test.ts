import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, obligationDecision, LOOP_REVISIT_MS } from './journal.js';
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

it.each([false, true])('can resume after two admitted checklist updates (long evidence: %s)', async large => {
  const at = 1791106122000, root = realpathSync(mkdtempSync(join(tmpdir(), 'astra-completion-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(119), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: at + 99 * LOOP_REVISIT_MS,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 });
  let now = at, calls = 0;
  const pending = { id: 'remaining', work: 'Finish the remaining integration step', state: 'open' };
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => {
      if (!input.id.startsWith('obligation:')) return JSON.stringify({ reply: 'I will finish the requested job.',
        openLoops: [{ kind: 'deferral', quote: 'I will finish the requested job.', waitsOn: 'nothing' }] });
      const offset = calls++ * 12;
      const packet = JSON.parse(input.context);
      expect(Buffer.byteLength(input.context)).toBeLessThanOrEqual(32768);
      if (calls === 3) {
        expect(packet.completion).toEqual([pending]);
        expect(packet.completionOmitted).toEqual({ open: 0, complete: 24 });
        return JSON.stringify({ outcome: 'continue', note: 'Continue the remaining integration step.' });
      }
      return JSON.stringify({ outcome: 'continue', note: 'Continue the remaining integration step.', completion: [pending,
        ...Array.from({ length: 12 }, (_, i) => ({ id: `task-${offset + i}`, state: 'complete',
          work: large ? 'Validate the generated component and its expected behavior. '.repeat(8) : 'Validate component',
          evidence: large ? 'Recorded validation succeeded with matching expected output. '.repeat(16) : 'Validation passed' }))] });
    }, send: async () => 1, checkOutbound: () => {} });
  try {
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Finish the requested job.' } }]);
    await worker.drain();
    for (let i = 0; i < 2; i++) { now += LOOP_REVISIT_MS; expect(await worker.workObligations()).toBe(true); }
    expect(journal.view.obligationWork['commitment:0']?.completion).toHaveLength(25);
    now += LOOP_REVISIT_MS;
    expect(await worker.workObligations()).toBe(true);
    expect(calls).toBe(3);
    const retained = journal.view.obligationWork['commitment:0']?.completion;
    expect(retained).toHaveLength(25);
    expect(retained?.find(entry => entry.id === 'task-0')?.evidence).toBe(large ? 'Recorded validation succeeded with matching expected output. '.repeat(16) : 'Validation passed');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

// A full Unicode checklist exceeds the byte budget even when its JS length fits.
it.each([false, true])('pages whole unfinished entries without weakening closure (UTF-8 overflow: %s)', async unicode => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'completion-page-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
    { ...genesis, expires: at + 99 * LOOP_REVISIT_MS });
  let now = at;
  const entries = Array.from({ length: 32 }, (_, i) => ({ id: `task-${i}`,
    work: (unicode ? '界' : 'x').repeat(470), state: 'open' as const }));
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/obligation-step-outputs-live-2026-10-04.json', import.meta.url), 'utf8')) as {
    calls: { call: string; output: string }[] };
  const report = fixture.calls.map(call => readAnswer(call.output, { wrapped: 'accept', evidence: [call.call] }))
    .find(read => read.ok && obligationDecision(read.value, 'commitment', at, 'UTC').outcome === 'report');
  if (!report?.ok) throw Error('recorded worker report missing');
  const pages: string[][] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => {
      if (!input.id.startsWith('obligation:')) return JSON.stringify({ reply: promise,
        openLoops: [{ kind: 'deferral', quote: promise, waitsOn: 'nothing' }] });
      expect(Buffer.byteLength(input.context)).toBeLessThanOrEqual(genesis.maxBytes);
      const packet = JSON.parse(input.context);
      expect(packet.completion.length).toBeGreaterThan(0);
      expect(packet.completionOmitted.open).toBe(32 - pages.flat().length - packet.completion.length);
      expect(packet.completionOmitted.complete).toBe(pages.flat().length);
      for (const entry of packet.completion) expect(entries).toContainEqual(entry);
      pages.push(packet.completion.map((entry: { id: string }) => entry.id));
      // Replay a real accepted report through the same consumer with hidden work retained.
      expect(obligationDecision(report.value, 'commitment', now, 'UTC', journal.view.obligationWork['commitment:0']?.completion).outcome)
        .toBe('continue');
      return JSON.stringify({ outcome: 'report', report: reply,
        completion: packet.completion.map((entry: object) => ({ ...entry, state: 'complete', evidence: 'Validated this item.' })) });
    }, send: async () => 1, checkOutbound: () => {} });
  try {
    worker.intake([update(1, 'Finish the spec and its validation script.')]); await worker.drain();
    journal.append({ kind: 'obligation-start', obligation: 'commitment:0', slot: now, at: now });
    journal.append({ kind: 'obligation-result', obligation: 'commitment:0', slot: now, at: now,
      outcome: 'continue', note: 'Finish retained work.', completion: entries });
    now += LOOP_REVISIT_MS;
    expect(await worker.workObligations()).toBe(true);
    if (unicode) {
      expect(pages[0]!.length).toBeLessThan(32);
      expect(journal.view.obligationWork['commitment:0']?.outcome).toBe('continue');
      expect(journal.view.closed.has(0)).toBe(false);
      now += LOOP_REVISIT_MS;
      expect(await worker.workObligations()).toBe(true);
    }
    expect(pages.flat()).toEqual(entries.map(entry => entry.id));
    expect(journal.view.obligationWork['commitment:0']?.outcome).toBe('report');
    expect(journal.view.obligationWork['commitment:0']?.completion).toHaveLength(32);
    expect(journal.view.obligationWork['commitment:0']?.completion?.every(entry => entry.state === 'complete')).toBe(true);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

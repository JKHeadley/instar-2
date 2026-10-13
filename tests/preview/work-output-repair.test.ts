import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, obligationSchedule, OBLIGATION_FORMAT_RETRY_MS,
  type PreviewPorts } from './journal-test-worker.js';
import { loopHealth, loopStatusLines } from './obligations.js';
import { readAnswer } from './answer-reading.js';
// @ts-expect-error The shipped launcher module is JavaScript.
import { toolTurnEligible } from './tool-turn.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/work-output-live-2026-10-12.json', import.meta.url), 'utf8')) as {
  calls: { frame: number; id: string; output: string; at: number }[] };
const DAY = 86_400_000, T0 = 1791850000000, key = new Uint8Array(32).fill(29);
const usage = { inputTokens: 20, outputTokens: 10, inputComplete: true as const, charge: null };
type Answer = Awaited<ReturnType<PreviewPorts['model']>>;
// Same launcher reading and retained malformed bytes. No external provider, credentials or send.
const launched = (output: string, id: string): Answer => {
  const read = readAnswer(output, { wrapped: 'accept', evidence: [id] });
  return read.ok ? { text: read.value, usage } : { state: 'complete', failureClass: 'malformed', rawOutput: output, usage };
};
async function world(outputs: (string | Answer)[], options: { cap?: number; revisit?: number; afterCall?: (clock: { now: number; stopped: boolean }) => void } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'work-output-repair-')), path = join(root, 'journal');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: T0 + 10 * DAY, maxCalls: options.cap ?? 100,
    maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0, loopRevisitMs: options.revisit ?? DAY });
  const clock = { now: T0, stopped: false }, sent: string[] = [], calls: { id: string; context: string }[] = [];
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => clock.stopped,
    prepareModel: input => input.context,
    model: async input => {
      if (/^(obligation|work-repair):/u.test(input.id)) {
        calls.push(input); options.afterCall?.(clock);
        const output = outputs.shift();
        if (output === undefined) throw Error('test has no output');
        return typeof output === 'string' ? launched(output, input.id) : output;
      }
      return { text: JSON.stringify(sent.length ? { reply: 'Here is the answer.' }
        : { reply: 'I will review the plan.', openLoops: [{ kind: 'deferral', quote: 'I will review the plan.', waitsOn: 'nothing' }] }), usage };
    }, send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
  const say = async (update: number) => { worker.intake([{ update_id: update, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text: 'Please review the plan.', date: Math.floor(clock.now / 1000) } }]); await worker.drain(); };
  await say(1);
  expect(journal.view.commitments).toHaveLength(1);
  clock.now += options.revisit ?? DAY;
  return { journal, worker, clock, sent, calls, say, path, close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it.each(fixture.calls)('repairs recorded frame $frame once; retains its bytes and delivers the admitted result once', async call => {
  const w = await world([call.output, '{"outcome":"report","report":"The review is complete."}']);
  try {
    const before = w.journal.view.calls;
    expect(await w.worker.workObligations()).toBe(true);
    expect(w.calls).toHaveLength(2);
    expect(w.journal.view.calls - before).toBe(2);
    expect(JSON.parse(w.calls[1]!.context).previousOutput).toBe(call.output);
    expect(toolTurnEligible(w.calls[1]!.id)).toBe(false);
    expect(w.journal.view.obligationWork['commitment:0']).toMatchObject({ attempts: 1, outcome: 'report' });
    expect(w.journal.view.tokenTotals.answer.unknownCalls).toBe(0);
    expect(await w.worker.workObligations()).toBe(false);
    expect(w.sent).toHaveLength(1);
    await w.say(2); await w.say(3);
    expect(w.sent.filter(text => text.includes('The review is complete.'))).toHaveLength(1);
  } finally { w.close(); }
});

it('a second malformed output fails visibly, retries after two minutes twice, then returns to the normal cadence across replay', async () => {
  const w = await world(Array(6).fill(fixture.calls[0]!.output));
  try {
    const progress = loopHealth(w.journal.view, w.clock.now).lastProgressAt;
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect(await w.worker.workObligations()).toBe(true);
      const work = w.journal.view.obligationWork['commitment:0']!;
      const delay = attempt <= 2 ? OBLIGATION_FORMAT_RETRY_MS : DAY;
      expect(work).toMatchObject({ outcome: 'failed', failureClass: 'malformed', formatFailures: attempt, failedAttempts: attempt });
      expect(obligationSchedule(w.journal.view)[0]!.slot).toBe(w.clock.now + delay);
      expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ state: 'idle', lastProgressAt: progress,
        lastAttemptAt: w.clock.now, lastAttemptOutcome: 'failed', failedAttempts: attempt });
      expect(loopStatusLines(w.journal.view, w.clock.now).join('\n')).toContain(`failed; ${attempt} failed attempts`);
      expect(await w.worker.workObligations()).toBe(false);
      w.journal.compact();
      const replay = openPreviewJournal(w.path, key);
      expect(replay.view.obligationWork).toEqual(w.journal.view.obligationWork);
      expect(obligationSchedule(replay.view)).toEqual(obligationSchedule(w.journal.view)); replay.close();
      w.clock.now += delay;
    }
    expect(w.calls).toHaveLength(6);
  } finally { w.close(); }
});

it.each(['uncertain', 'rejected', 'empty'] as const)('does not repair or accelerate %s', async failure => {
  const result: Answer = failure === 'uncertain' ? { state: 'uncertain' } : { state: 'complete', failureClass: failure };
  const w = await world([result]);
  try { await w.worker.workObligations(); expect(w.calls).toHaveLength(1);
    expect(obligationSchedule(w.journal.view)[0]!.slot).toBe(w.clock.now + DAY);
  } finally { w.close(); }
});

it('a raw object with invalid task fields also gets one repair; a valid original gets none', async () => {
  for (const outputs of [['{"outcome":"nonsense"}', '{"outcome":"continue","note":"Reviewing the plan."}'],
    ['{"outcome":"continue","note":"Reviewing the plan."}']]) {
    const expected = outputs.length, w = await world(outputs);
    try { await w.worker.workObligations(); expect(w.calls).toHaveLength(expected);
      expect(w.journal.view.obligationWork['commitment:0']!.outcome).toBe('continue');
      expect(obligationSchedule(w.journal.view)[0]!.slot).toBe(w.clock.now + DAY);
    } finally { w.close(); }
  }
});

it('the repair yields to the reply reserve and to a stop', async () => {
  const w = await world([fixture.calls[0]!.output], { cap: 4 });
  try { await w.worker.workObligations(); expect(w.calls).toHaveLength(1);
    expect(w.journal.view.calls).toBe(2); expect(w.journal.view.obligationWork['commitment:0']!.failureClass).toBe('malformed');
  } finally { w.close(); }
  const stopped = await world([fixture.calls[0]!.output], { afterCall: clock => { clock.stopped = true; } });
  try { await stopped.worker.workObligations();
    expect(stopped.calls).toHaveLength(1);
    expect(stopped.journal.view.obligationWork['commitment:0']!.failureClass).toBe('malformed');
  } finally { stopped.close(); }
});

it('refuses a duplicate repair reservation and retains uncertain repair liability after a crash', async () => {
  const w = await world([]);
  try {
    const slot = w.clock.now;
    w.journal.append({ kind: 'obligation-start', obligation: 'commitment:0', slot, at: slot });
    const repair = { kind: 'obligation-start' as const, obligation: 'commitment:0', slot, at: slot, repair: true as const, usage };
    w.journal.append(repair);
    expect(() => w.journal.append(repair)).toThrow('repair order or cap');
    expect(await w.worker.workObligations()).toBe(false);
    expect(w.journal.view.obligationWork['commitment:0']!.outcome).toBe('uncertain');
    expect(w.calls).toHaveLength(0);
    expect(w.journal.view.tokenTotals.answer.unknownCalls).toBe(1);
  } finally { w.close(); }
});

it('the actual launcher retains all three rejected work outputs for repair, but does not expose unrelated failures', async () => {
  const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('    const invokeSubscription = async'), source.indexOf('    // Part Thirteen §9', source.indexOf('    const invokeSubscription = async')));
  const make = new Function('doorway', 'options', 'required', 'journal', 'wallNow', 'callSubscription', 'judgmentOf',
    'roleOf', 'wrappedPolicyOf', 'objectAnswerOf', 'readAnswer', 'recordShape', 'shapesPath', `${body}; return invokeSubscription;`);
  for (const call of fixture.calls) {
    const invoke = make({ policyFor: () => ({ timeout: 60_000 }) }, {}, () => 'test', { view: { expires: T0 + DAY } }, () => T0,
      async () => ({ state: 'complete', bytes: call.output, usage }), () => 'answer', () => 'answer', () => 'accept',
      () => false, readAnswer, () => {}, '') as (prepared: string, id: string) => Promise<Answer>;
    expect(await invoke('{}', call.id)).toMatchObject({ failureClass: 'malformed', rawOutput: call.output });
    expect(await invoke('{}', 'telegram:12345678:update:1')).not.toHaveProperty('rawOutput');
  }
});

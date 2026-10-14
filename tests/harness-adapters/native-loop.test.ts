import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nativeStepEnvelope, parseNativeStep, runNativeLoop } from '../../src/harness-adapters/index.js';
import type { NativeLoopOptions, NativeStepResult } from '../../src/harness-adapters/index.js';

const prepared = JSON.stringify({ messages: [{ role: 'user', content: 'do the work' }] });
const answer = (value: string): NativeStepResult => ({ state: 'complete', value });
const request = answer(JSON.stringify({ calls: [{ tool: 'Write', input: { file_path: 'note.txt' } }] }));
function fixture(results: NativeStepResult[], overrides: Partial<NativeLoopOptions> = {}) {
  const events: string[] = [], envelopes: string[] = [];
  const options: NativeLoopOptions = { prepared, promptLimit: 32768, maxSteps: 8, maxCallsPerStep: 8,
    resultChars: 4096, tools: ['Write'], stopped: () => false,
    step: async (envelope, index) => { events.push('model'); envelopes.push(envelope); return results[index]; },
    admit: async () => { events.push('admit'); return { decision: 'allow', reason: 'admitted' }; },
    execute: async () => { events.push('execute'); return { output: { written: true } }; },
    record: async () => { events.push('record'); }, ...overrides };
  return { run: () => runNativeLoop(options), events, envelopes };
}

it('carries tool observations to the next model call, and returns the reply unchanged', async () => {
  const f = fixture([request, answer('done')]);
  expect(await f.run()).toMatchObject({ value: 'done', native: { models: 2, steps: 1, calls: 1, ended: 'answered' } });
  expect(f.events).toEqual(['model', 'admit', 'execute', 'record', 'model']);
  expect(f.envelopes[1]).toContain('written');
});
it('never executes a refused tool; the model sees the refusal', async () => {
  const f = fixture([request, answer('refused')], { admit: async () => ({ decision: 'deny', reason: 'outside grant' }) });
  expect((await f.run()).native.calls).toBe(0);
  expect(f.events).toEqual(['model', 'model']);
  expect(f.envelopes[1]).toContain('outside grant');
});
it('executes the admitted rewritten input, and records the original proposal identity', async () => {
  let executed: unknown, recorded: unknown;
  const f = fixture([request, answer('done')], {
    admit: async () => ({ decision: 'allow', reason: 'scoped', updatedInput: { file_path: '/scope/note.txt' } }),
    execute: async call => { executed = call.input; return { output: 'done' }; },
    record: async (call, id) => { recorded = { input: call.input, id }; },
  });
  await f.run(); expect(executed).toEqual({ file_path: '/scope/note.txt' });
  expect(recorded).toEqual({ input: { file_path: 'note.txt' }, id: 'native-1-1' });
});
it('makes no call under stop and records an admitted call stopped before dispatch', async () => {
  const halted = fixture([request], { stopped: () => true });
  expect((await halted.run()).native.ended).toBe('stopped'); expect(halted.events).toEqual([]);
  let stop = false, recorded: unknown;
  const race = fixture([request], { stopped: () => stop,
    admit: async () => { stop = true; return { decision: 'allow', reason: 'admitted' }; },
    record: async (_call, _id, output) => { recorded = output; } });
  expect((await race.run()).native.ended).toBe('stopped');
  expect(race.events).toEqual(['model']); expect(recorded).toMatchObject({ interrupted: 'stopped' });
});
it('bounds model calls and executes no tool on the last reserved model step', async () => {
  const cap = fixture([request], { maxSteps: 1 });
  expect(await cap.run()).toMatchObject({ failureClass: 'step-cap', native: { models: 1, calls: 0 } });
  expect(cap.events).toEqual(['model']);
  expect((await fixture([answer('done')], { maxSteps: 1 }).run()).native.ended).toBe('answered');
});
it.each([0, -1, Infinity, NaN, 1.5])('rejects non-finite or non-positive integer bounds: %s', async bound => {
  for (const key of ['maxSteps', 'maxCallsPerStep', 'resultChars', 'promptLimit']) {
    const f = fixture([answer('done')], { [key]: bound });
    await expect(f.run()).rejects.toThrow('finite positive bounds'); expect(f.events).toEqual([]);
  }
});
it('retains failed and empty model outcomes without retry or tool dispatch', async () => {
  for (const result of [{ state: 'uncertain' }, { state: 'complete', failureClass: 'refused' }, answer('')]) {
    const f = fixture([result]); expect((await f.run()).native.ended).toBe('step-failed'); expect(f.events).toEqual(['model']);
  }
});
it('reports malformed calls to the model and still counts them against the cap', async () => {
  const f = fixture([answer('{"calls":[]}'), answer('done')]);
  expect((await f.run()).native).toMatchObject({ calls: 0, models: 2, steps: 1 });
  expect(f.envelopes[1]).toContain('a tool request must be');
});
it('preserves unresolved containment, while verified and never-launched calls do not become leaks', async () => {
  for (const [cleanup, membership, count] of [['unknown', null, 1], ['verified', 'sandbox-joined', 0], ['not-launched', null, 0]] as const) {
    const f = fixture([request, answer('done')], { execute: async () => ({ output: 'x', containment: { cleanup, membership, leaked: null } }) });
    expect((await f.run()).native.unresolved).toHaveLength(count);
  }
});
it('enforces prompt bytes before a model call and shortens only old tool results', async () => {
  const f = fixture([answer('done')], { promptLimit: 1 });
  expect((await f.run()).native.ended).toBe('prompt-size'); expect(f.events).toEqual([]);
  const steps = [{ step: 1, calls: [{ tool: 'Write', decision: 'allow', reason: 'x', result: 'ü'.repeat(1000) }] }];
  const small = nativeStepEnvelope(prepared, steps, { steps: 1 }, 1000, ['Write']);
  expect(small).toContain('shortened'); expect(small).toContain('do the work');
  expect(steps[0]?.calls[0]?.result).toHaveLength(1000);
});
it('keeps the native parser boundary: reply wins; malformed calls refuse; empty is not an answer', () => {
  expect(parseNativeStep('{"calls":[],"reply":"hello"}', 8)).toEqual({ kind: 'answer' });
  for (const value of ['{"calls":[]}', '{"calls":[{"tool":"Read","input":[]}]}'])
    expect(parseNativeStep(value, 8).kind).toBe('malformed');
  expect(parseNativeStep(' ', 8).kind).toBe('empty');
  expect(parseNativeStep('hello', 8).kind).toBe('answer');
});

describe('recorded native turns, 2026-10-03 (real model values; host effects replayed)', () => {
  for (const name of ['task', 'scope', 'stop']) it(name, async () => {
    const capture = JSON.parse(readFileSync(new URL(`../preview/fixtures/native-loop/live-2026-10-03/${name}.json`, import.meta.url), 'utf8'));
    const admissions: Array<{ phase: string; tool: string; decision: string; reason?: string; result?: string }> =
      capture.admission.trim().split('\n').map((line: string) => JSON.parse(line));
    const expected = admissions.filter(row => row.phase === 'pre'); let at = 0, stop = false;
    const actual: string[] = [];
    const f = fixture(capture.steps.map((row: { state: string; value: string }) => ({ state: row.state, value: row.value })), {
      prepared: capture.prepared, stopped: () => stop, tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebFetch'],
      admit: async call => { const row = expected[at++]; expect(call.tool).toBe(row?.tool); actual.push(call.tool);
        return { decision: row!.decision, reason: row!.reason ?? 'recorded' }; },
      execute: async call => { const row = admissions.find(item => item.phase === 'post' && item.tool === call.tool);
        return { output: row?.result ? JSON.parse(row.result) : null }; },
      record: async () => { if (name === 'stop') stop = true; },
    });
    const result = await f.run(); expect(actual).toEqual(expected.map(row => row.tool));
    expect(f.envelopes[0]).toBe(capture.steps[0].envelope);
    expect(result.native.ended).toBe(name === 'stop' ? 'stopped' : 'answered');
    if (name !== 'stop') expect(result.value).toBe(capture.answer);
  });
});

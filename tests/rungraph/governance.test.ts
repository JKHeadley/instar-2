import { afterEach, expect, it, vi } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { consumeResult } from '../../src/index.js';
import * as records from '../../src/rungraph/records.js';
import { runAdmission, stepAdmission, transitionAdmission, exitAdmission, groundingAdmission, stopAdmission } from '../../src/rungraph/rungraph.js';
import { governanceFixture } from './governance-fixture.js';
import { setup, value, refused } from './fixtures.js';

afterEach(() => vi.restoreAllMocks());
it('P5-NF-54 R7 every built blocking gate consumes P3 and invokes its real enforced decoder', () => {
  const f = setup();
  const gates = [
    [runAdmission, 'decodeRun'], [stepAdmission, 'decodeRunStep'], [transitionAdmission, 'decodeRunTransition'],
    [exitAdmission, 'decodeRunExit'], [groundingAdmission, 'decodeSessionGrounding'], [stopAdmission, 'decodeRunTransition'],
  ] as const;
  for (const [gate, decoder] of gates) {
    const spy = vi.spyOn(records, decoder); spy.mockClear();
    // Real owner decoder rejects the input. A named declaration/no-op cannot
    // pass this assertion: the executed function must be the bound decoder.
    refused<unknown>(gate({}, f.context(), f.deps.governance), 'type or schema version');
    expect(spy).toHaveBeenCalledTimes(1); spy.mockRestore();
  }
  expect(value(runAdmission(f.run, f.context(), f.deps.governance)).id).toBe(f.id);
});
it('P5-NF-54 R7 missing gates, wrong decoder bindings and wrong stop direction refuse construction', () => {
  const f = setup();
  for (const id of ['admit', 'step', 'transition', 'exit', 'grounding', 'stop']) {
    const g = governanceFixture(f.c, declarations => declarations.filter(d => d.id !== 'rungraph.' + id));
    refused(createRunGraph({ ...f.deps, governance: g }), 'unresolved register entry');
  }
  const wrongDecoder = governanceFixture(f.c, declarations => declarations.map(d => d.id === 'rungraph.admit'
    ? { ...d, requiredFacts: { ...d.requiredFacts, enforces: { record: 'rungraph.contract', decoder: 'decodeRunExit' } } } : d));
  refused(createRunGraph({ ...f.deps, governance: wrongDecoder }), 'decoder binding');
  const wrongStop = governanceFixture(f.c, declarations => declarations.map(d => d.id === 'rungraph.stop'
    ? { ...d, requiredFacts: { ...d.requiredFacts, failDirection: 'closed' } } : d));
  refused(createRunGraph({ ...f.deps, governance: wrongStop }), 'fail direction');
});
it('P5-NF-54 R7 refusal retains the exact captured input and capture failure cannot admit work', () => {
  const f = setup(), input = { ...f.run, depth: 2 };
  const refusal = consumeResult(f.graph.open(input), { Success: () => { throw Error('expected refusal'); }, Refused: r => r });
  expect(refusal.detail).toContain('non-root depth');
  expect(refusal.preserved).toMatch(/^gate-input:/);
  expect(JSON.parse(f.ctx.captures[refusal.preserved]!.bytes!)).toEqual(input);
  expect(value(f.store.read()).filter(f => f.kind === 'run-opening')).toHaveLength(0);
  const unpreserved = value(createRunGraph({ ...f.deps, governance: { ...f.deps.governance,
    capture: { owner: 'part-two', preserve: () => f.success('missing-capture') } } }));
  refused(unpreserved.open(f.run), 'not durably captured');
  expect(value(f.store.read()).filter(f => f.kind === 'run-opening')).toHaveLength(0);
});
it('P5-NF-54 preservation precedes a failing fact-context read and the public API still returns Result', () => {
  const f = setup(), graph = value(createRunGraph({ ...f.deps, store: { ...f.store, read: () => { throw Error('fixture reader unavailable'); } } }));
  for (const action of [() => graph.open(f.run), () => graph.transition({ id: 'pending-input' })]) {
    const refusal = consumeResult(action(), { Success: () => { throw Error('expected refusal'); }, Refused: r => r });
    expect(refusal.detail).toContain('fixture reader unavailable');
    expect(f.ctx.captures[refusal.preserved]?.status).toBe('available');
  }
});

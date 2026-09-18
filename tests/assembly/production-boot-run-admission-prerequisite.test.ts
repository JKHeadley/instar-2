// @ts-nocheck -- prerequisite diagnostic, not the full production lifecycle proof.
import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { groundedAssemblyRuntimeFixture, genuineProductionComposition } from './genuine-production-fixture.js';
import { productionBindingSet } from './production-fixture.js';
import { refused, value } from '../facts/fixtures.js';

it('U4 prerequisite: the actual landed Six authority does not supply the production RunAdmissionPort', () => {
  const f = groundedAssemblyRuntimeFixture(undefined, { minimal: true });
  // Use the actual createTransportAuthority product already composed with its
  // signed Six spine. Merely relabelling it cannot make Five's required port.
  const six = f.effects.transport;
  expect(typeof six.admitWrite).toBe('function');
  expect(typeof six.reserve).toBe('function');
  for (const method of ['create', 'commit', 'verify', 'execution', 'reservation'])
    expect(typeof six[method]).toBe('undefined');
  expect(refused(createRunGraph({ ...f.deps, admission: six })))
    .toBe('conditional admission, execution context, reservation and durable witness reader required');
});

it('U4 prerequisite: the landed native lifecycle fixture opens Five through a process-local admission set, not a Six write', () => {
  const f = groundedAssemblyRuntimeFixture(undefined, { minimal: true });
  const production = genuineProductionComposition(f, productionBindingSet());
  const before = value(f.effects.transport.inspect());
  const opened = value(production.run.port.open(f.run));
  const opening = value(f.store.read()).find(row => row.kind === 'run-opening' && row.body.run === opened.run.id);
  expect(opening).toBeTruthy();
  expect(f.admissions.has(opening.id)).toBe(true);
  expect(value(f.effects.transport.inspect())).toEqual(before);
  // This missing Six realization is independent of the admitted peer handle.
  // U4-C grants that peer only; it does not grant this second stand-in.
});

// @ts-nocheck -- adversarial append and self-report probes.
import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { createProductionRunAdmission } from '../../src/transport/index.js';
import { createLiveInputAssemblyFixture, json } from '../assembly/live-input-owner-fixture.js';
import { refused, value } from '../facts/fixtures.js';

function fixture() {
  const f = createLiveInputAssemblyFixture(undefined, { minimal: true });
  const admission = createProductionRunAdmission({ authority: f.effects.transport, store: f.store, context: f.c });
  const graph = value(createRunGraph({ ...f.deps, admission }));
  return { f, admission, graph };
}

it('refuses a callback that durably appends twice instead of returning one exact Run append', () => {
  const { f, admission } = fixture();
  let callbackCalls = 0;
  const detail = refused(admission.create(
    { owner: 'part-two', name: 'FactEnvelope', id: f.opening.id },
    f.id,
    () => {
      callbackCalls++;
      const first = f.append('run-opening', json({ run: f.id, record: f.run }));
      f.append('run-opening', json({ run: f.id, record: { ...f.run,
        cadence: { ...f.run.cadence, milliseconds: f.run.cadence.milliseconds + 1 } } }));
      return f.success(first);
    },
  ));

  expect(callbackCalls).toBe(1);
  expect(value(f.store.read()).filter(row => row.kind === 'run-opening')).toHaveLength(2);
  expect(detail).toContain('run append interleaved with another fact');
});

it('refuses a copied self-reported Run state that did not cross Six admission', () => {
  const { f, admission } = fixture();
  const copied = { ...f.run, cadence: { ...f.run.cadence } };
  const fact = f.append('run-opening', json({ run: copied.id, record: copied })).fact;
  const reference = { owner: 'part-two', name: 'FactEnvelope', id: fact.id } as const;

  expect(refused(admission.verify(reference))).toContain('run fact lacks adjacent Six write witness');
});

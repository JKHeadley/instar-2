// @ts-nocheck -- adversarial durable-history verification.
import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { createProductionRunAdmission } from '../../src/transport/index.js';
import { createLiveInputAssemblyFixture } from '../assembly/live-input-owner-fixture.js';
import { refused, value } from '../facts/fixtures.js';

function fixture() {
  const f = createLiveInputAssemblyFixture(undefined, { minimal: true });
  const admission = createProductionRunAdmission({ authority: f.effects.transport, store: f.store, context: f.c });
  const graph = value(createRunGraph({ ...f.deps, admission }));
  return { f, admission, graph };
}

it('re-observes owner history and refuses a formerly verified opening removed from durable storage', () => {
  const { f, admission, graph } = fixture();
  const opened = value(graph.open(f.run));
  const fact = value(f.store.read()).at(-1)!;
  expect(fact.kind).toBe('run-opening');
  expect(fact.body.run).toBe(opened.run.id);
  const reference = { owner: 'part-two', name: 'FactEnvelope', id: fact.id } as const;

  expect(value(admission.verify(reference))).toEqual(reference);
  f.wire.pop();
  expect(refused(f.store.verifiedPrefix())).toContain('stored verified prefix was truncated');
  expect(refused(admission.verify(reference))).toContain('stored verified prefix was truncated');
});

it('keeps a signed current neighbour positive and verifies its history after a legitimate takeover', () => {
  const { f, admission, graph } = fixture();
  value(graph.open(f.run));
  const fact = value(f.store.read()).at(-1)!;
  expect(fact.kind).toBe('run-opening');
  const reference = { owner: 'part-two', name: 'FactEnvelope', id: fact.id } as const;
  expect(value(admission.verify(reference))).toEqual(reference);

  value(f.effects.transport.release('run-admission:verify-history-release', f.effects.fence));
  const predecessor = value(f.effects.transport.inspect()).at(-1)!.fact.id;
  value(f.effects.transport.acquire('run-admission:verify-history-takeover', predecessor, 500));

  expect(value(admission.verify(reference))).toEqual(reference);
});

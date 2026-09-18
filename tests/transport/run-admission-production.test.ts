// @ts-nocheck -- adversarial production-boundary fixture.
import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { createProductionRunAdmission, isProductionRunAdmission } from '../../src/transport/index.js';
import { createLiveInputAssemblyFixture, digest, json } from '../assembly/live-input-owner-fixture.js';
import { refused, value } from '../facts/fixtures.js';

function fixture() {
  const f = createLiveInputAssemblyFixture(undefined, { minimal: true });
  const admission = createProductionRunAdmission({ authority: f.effects.transport, store: f.store, context: f.c });
  const graph = value(createRunGraph({ ...f.deps, admission }));
  return { f, admission, graph };
}

it('Six admits the exact signed-current opening once and retains its durable neighbour witness', () => {
  const { f, admission, graph } = fixture();
  const before = value(f.effects.transport.inspect()).length;
  const opened = value(graph.open(f.run));
  const fact = value(f.store.read()).find(row => row.kind === 'run-opening' && row.body.run === opened.run.id)!;
  const rows = value(f.effects.transport.inspect());
  expect(rows).toHaveLength(before + 1);
  expect(rows.at(-1)?.record).toMatchObject({ type: 'Lease', operation: 'write' });
  expect(fact.predecessors.inSegment).toBe(rows.at(-1)?.fact.id);
  expect(value(admission.verify({ owner: 'part-two', name: 'FactEnvelope', id: fact.id }))).toEqual(
    { owner: 'part-two', name: 'FactEnvelope', id: fact.id });
});

it('Six refuses a wrong head, a stale assignment, an absent reservation and copied provenance', () => {
  const first = fixture();
  value(first.graph.open(first.f.run));
  let calls = 0;
  expect(refused(first.admission.commit({ run: first.f.id, expected: 'wrong-head', ownership: first.f.lease,
    generation: first.f.run.generation, operation: 'operation:wrong', digest: digest('wrong'),
    durability: { kind: 'local-durable' } }, () => { calls++; throw Error('must not append'); })))
    .toContain('run opening head changed');
  expect(calls).toBe(0);

  const second = fixture();
  value(second.graph.open(second.f.run));
  value(second.f.effects.transport.release('run-admission:test-release', second.f.effects.fence));
  const predecessor = value(second.f.effects.transport.inspect()).at(-1)!.fact.id;
  value(second.f.effects.transport.acquire('run-admission:test-takeover', predecessor, 500));
  const currentHead = value(second.f.store.read()).find(row => row.kind === 'run-opening'
    && row.body.run === second.f.id)!.id;
  expect(refused(second.admission.commit({ run: second.f.id,
    expected: currentHead, ownership: second.f.lease,
    generation: second.f.run.generation, operation: 'operation:stale', digest: digest('stale'),
    durability: { kind: 'local-durable' } }, () => { throw Error('must not append'); })))
    .toContain('stale or foreign run ownership');

  expect(refused(second.admission.reservation(
    { owner: 'part-six', name: 'AdmissionReservation', id: 'missing' }, second.f.start(
      value(second.graph.read(second.f.id)), second.f.opening).step))).toContain('admission reservation absent');
  expect(isProductionRunAdmission({ ...second.admission })).toBe(false);
});

it('Six invokes the exact opening append callback once', () => {
  const { f, admission } = fixture();
  let calls = 0;
  const receipt = value(admission.create({ owner: 'part-two', name: 'FactEnvelope', id: f.opening.id }, f.id, () => {
    calls++;
    return f.success(f.append('run-opening', json({ run: f.id, record: f.run })));
  }));
  expect(calls).toBe(1);
  expect(receipt.fact.kind).toBe('run-opening');
});

import { expect, it } from 'vitest';
import { createTransportAuthority, createTransportSpine,
  decodeHistoricalCapacityReservation } from '../../src/transport/index.js';
import type { CapacityReservation } from '../../src/transport/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { responderCapacityFixture, vector } from '../transport/responder-capacity.test.js';
import { value, refused, privateKey } from '../facts/fixtures.js';
import { intakeFixture } from '../intake/fixtures.js';

it('P6-NF-42 reconstructs one finite parent debit from the same signed store across owner instances', () => {
  const x = responderCapacityFixture();
  const first = value(x.api.reserveCapacity(x.input));
  const freshStore = createFactStore(x.f.context, x.f.storage);
  const freshSpine = createTransportSpine(x.host, { context: x.f.context, privateKey }, freshStore);
  const restored = createTransportAuthority(x.host, freshSpine, x.boundary);
  expect(value(restored.inspectCapacity()).parentRemainder.effect.quantity).toBe(80);
  expect(value(restored.reserveCapacity(x.input))).toEqual(first);
  refused(restored.reserveCapacity({ ...x.input, command: 'capacity:overflow',
    expected: value(restored.inspectCapacity()).sourceFrontier, allocation: vector(100) }));
  expect(value(restored.inspectCapacity()).heads).toHaveLength(1);
});

it('P6-NF-41/42 refuses a foreign source store, wrong approval kind and changed policy', () => {
  const x = responderCapacityFixture();
  const other = intakeFixture();
  const alienStore = createFactStore(other.context, other.storage);
  const alienSpine = createTransportSpine(x.host, { context: x.f.context, privateKey }, alienStore);
  refused(createTransportAuthority(x.host, alienSpine, x.boundary).reserveCapacity(x.input));

  const wrongApprovalHost = { ...x.host, capacityPolicy: { ...x.policy, approval: x.policy.grant } };
  const wrongApproval = createTransportAuthority(wrongApprovalHost,
    createTransportSpine(wrongApprovalHost, { context: x.f.context, privateKey },
      createFactStore(x.f.context, x.f.storage)), x.boundary);
  refused(wrongApproval.reserveCapacity({ ...x.input, approval: x.policy.grant }));

  value(x.api.reserveCapacity(x.input));
  const changedHost = { ...x.host, capacityPolicy: { ...x.policy, reference: 'policy:changed' } };
  refused(createTransportAuthority(changedHost,
    createTransportSpine(changedHost, { context: x.f.context, privateKey },
      createFactStore(x.f.context, x.f.storage)), x.boundary).inspectCapacity());
  const capacityFact = x.f.facts().find(fact => fact.kind === 'transport-CapacityReservation')!;
  const capacityRecord = (capacityFact.body as unknown as { record: CapacityReservation }).record;
  const historical = { ...x.boundary, origin: capacityFact, mode: 'historical' as const,
    facts: { ...x.f.context, facts: x.f.facts() } };
  expect(value(decodeHistoricalCapacityReservation(capacityRecord,
    historical, changedHost, x.boundary)).budgetPolicy).toBe(x.policy.reference);
  const missing = { ...historical, facts: { ...historical.facts,
    captures: Object.fromEntries(Object.entries(historical.facts.captures)
      .filter(([reference]) => reference !== x.policy.reference)) } };
  refused(decodeHistoricalCapacityReservation(capacityRecord,
    missing, changedHost, x.boundary), 'historical capacity policy artifact is unavailable');
});

import { expect, it } from 'vitest';
import { createRunClosureGraph, recordWire } from '../../src/rungraph/index.js';
import { continuityFixture, exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, refused, value } from '../rungraph/fixtures.js';

it('P5-SEAM-RC-R7-INTEGRATION-V19 signed replication revalidates the addressed result and owner witness', () => {
  const f = continuityFixture();
  const unsupported = { ...f.accounting, id: 'repair7:replicated-unwitnessed-addressed',
    disposition: { kind: 'addressed' as const, work: ref(f.addressedWork) } };
  expect(() => f.replicate('continuity-accounting', json({ run: f.id, record: recordWire(unsupported as never) }),
    [f.groundingFact.id, f.disclosure.id, f.addressedWork.id])).toThrow('decode: addressed continuity fields differ');
  refused(value(createRunClosureGraph(f.deps)).recordContinuity(unsupported, f.lease), 'addressed continuity fields differ');
});

it('P5-SEAM-RC-R7-INTEGRATION-V18 signed replication cannot erase the current dependency inventory', () => {
  const f = exhaustionFixture();
  const resolved = f.append('run-dependency-observation',
    json({ ...f.dependency.body as object, status: 'resolved' }), [f.dependency.id]).fact;
  const omitted = { ...f.exhaustion, id: 'repair7:replicated-omitted-dependency', dependencies: [] };
  expect(() => f.replicate('run-exhaustion', json({ run: f.id, record: recordWire(omitted as never) }),
    [f.opening.id, resolved.id])).toThrow('decode: exhaustion dependencies differ from the complete current dependency inventory');
  refused(value(createRunClosureGraph(f.deps)).recordExhaustion(omitted, f.lease),
    'complete current dependency inventory');
});

it('P5-SEAM-RC-R7-INTEGRATION-V25 keeps investigator grants independent from a human outside actor', () => {
  const f = exhaustionFixture(), grant = f.grant({ id: 'repair7:integration-grant', grantee: f.bob });
  const grantFact = f.replicate('grant-record', json({ grant }), [],
    { principal: f.alice, provenance: grant.source }).fact;
  const humanFact = f.replicate('stimulus', json({ ...f.opening.body as object, owner: f.alice }), [],
    { principal: f.alice, provenance: f.alice.provenance }).fact;
  const identity = f.append('run-owned-identity-read',
    json({ run: f.id, principal: f.alice.id, status: 'current' })).fact;
  const record = { ...f.exhaustion, id: 'repair7:integration-human-action',
    grants: [{ type: 'StandingGrant' as const, id: grant.id, fact: ref(grantFact), field: 'grant' as const }],
    identityReads: [ref(identity)], outsideAction: { ...f.exhaustion.outsideAction,
      owner: { type: 'VerifiedPrincipal' as const, id: f.alice.id, fact: ref(humanFact), field: 'owner' as const } } };

  const admitted = value(f.graph.recordExhaustion(record, f.lease));
  expect(admitted.kind).toBe('run-exhaustion');
  expect(value(value(createRunClosureGraph(f.deps)).recordExhaustion(record, f.lease))).toEqual(admitted);
});

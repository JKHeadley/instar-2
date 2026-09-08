import { expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { assessCaptureAdmission, closureReleasedPins, mergeVerificationRecords, remoteCaptureUseAllowed,
  replicaCurrency, retainedGap, routineAgeRemovalAllowed, verificationProjectionDefinitions,
  decodeVerificationRecord } from '../../src/verification/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { verificationInput } from './fixture.js';

it('P9-NF-43 P9-NF-48 P9-NF-50 capacity refuses new capture work without deleting pins or consuming repair reserve', () => {
  const f = factsFixture();
  const state = { capacity: 100, retained: 50, reserved: 20, repairReserve: 20,
    pinned: [{ reference: 'capture:unsettled', bytes: 40, reasons: ['unsettled-effect'] }] };
  expect(value(assessCaptureAdmission(state, 4, 5, 1, f.c))).toEqual({ admitted: true, requested: 10, remaining: 10, reason: 'within-capacity' });
  expect(value(assessCaptureAdmission(state, 5, 5, 1, f.c))).toEqual({ admitted: false, requested: 11, remaining: 10, reason: 'capacity-refused' });
  expect(state.pinned).toEqual([{ reference: 'capture:unsettled', bytes: 40, reasons: ['unsettled-effect'] }]);
  expect(routineAgeRemovalAllowed()).toBe(false); expect(retainedGap.status).toBe('partial');
});

it('P9-NF-43 P9-NF-49 assessment closure releases only its own pin and leaves byte custody unchanged', () => {
  const closure = verificationInput('AssessmentClosure');
  expect(closureReleasedPins(closure)).toEqual(['assessment-pin:case:1']);
  expect(closureReleasedPins(closure)).not.toContain('settlement-pin');
});

it('P9-NF-24 P9-NF-36 duplicate replicas converge while differing canonical content conflicts', () => {
  const f = factsFixture(); const plan = verificationInput('VerificationPlan');
  expect(mergeVerificationRecords([plan, plan])).toMatchObject({ records: [plan], conflicts: [] });
  const changed = value(decodeVerificationRecord('VerificationPlan', { ...plan,
    subject: { ...plan.subject, governed: 'different-subject' } }, f.c));
  const merged = mergeVerificationRecords([plan, changed]);
  expect(merged.records).toHaveLength(1); expect(merged.conflicts).toHaveLength(1);
  expect(merged.conflicts[0]).toMatchObject({ kind: 'immutable-disagreement' });
});

it('P9-NF-59 every verification projection declares every generation kind and reads source facts directly', () => {
  const kinds = ['verification-VerificationPlan', 'verification-ProbeRecord', 'note'];
  const generation = { reference: { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: 'generation:1' },
    kinds, lineages: { 'machine-a': { head: null, observedAt: null, closed: false } } };
  const definitions = verificationProjectionDefinitions(generation);
  expect(definitions).toHaveLength(7);
  for (const definition of definitions) {
    expect(Object.keys(definition.decisions).sort()).toEqual([...kinds].sort());
    expect(definition.decisions.note).toMatchObject({ kind: 'ignores' });
  }
});

it('P9-NF-61 missing lineages close authority-dependent currency and raw captures remain local', () => {
  expect(replicaCurrency(['machine-a'], ['machine-a', 'machine-b'])).toEqual({ knownLineages: ['machine-a'],
    requiredLineages: ['machine-a', 'machine-b'], missingLineages: ['machine-b'], authorityCurrent: false });
  expect(remoteCaptureUseAllowed('machine-a', 'machine-b')).toBe(false);
  expect(remoteCaptureUseAllowed('machine-a', 'machine-a')).toBe(true);
});

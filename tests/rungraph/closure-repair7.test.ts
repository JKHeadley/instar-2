import { expect, it } from 'vitest';
import type { Json } from '../../src/index.js';
import { createRunGraph, decodeRunExit } from '../../src/rungraph/index.js';
import { exhaustionFixture } from './closure-fixtures.js';
import { closingRun, completedRun, json, ref, refused, value } from './fixtures.js';

it('P5-SEAM-RC-R7-HISTORY-V25 permanently combines the round-3 investigation grant with its human outside-action owner', () => {
  const f = exhaustionFixture(), grant = f.grant({ id: 'repair7:investigator-grant', grantee: f.bob });
  const grantFact = f.replicate('grant-record', json({ grant }), [],
    { principal: f.alice, provenance: grant.source }).fact;
  const grantReference = { type: 'StandingGrant' as const, id: grant.id, fact: ref(grantFact), field: 'grant' as const };
  const humanFact = f.replicate('stimulus', json({ ...f.opening.body as object, owner: f.alice }), [],
    { principal: f.alice, provenance: f.alice.provenance }).fact;
  const human = { type: 'VerifiedPrincipal' as const, id: f.alice.id, fact: ref(humanFact), field: 'owner' as const };
  const identity = f.append('run-owned-identity-read', json({ run: f.id, principal: f.alice.id, status: 'current' })).fact;

  expect(value(f.graph.recordExhaustion({ ...f.exhaustion, id: 'repair7:human-action-with-investigator-grant',
    grants: [grantReference], identityReads: [ref(identity)], outsideAction: { ...f.exhaustion.outsideAction, owner: human } },
  f.lease)).kind).toBe('run-exhaustion');
});

it('P5-SEAM-RC-R7-F2-V18 refuses omission of the causally latest resolved dependency and preserves another-run near miss', () => {
  const f = exhaustionFixture();
  f.append('run-dependency-observation', json({ ...f.dependency.body as object, status: 'resolved' }), [f.dependency.id]);
  refused(f.graph.recordExhaustion({ ...f.exhaustion, id: 'repair7:omitted-resolved-dependency', dependencies: [] }, f.lease),
    'complete current dependency inventory');

  const unrelated = exhaustionFixture();
  unrelated.append('run-dependency-observation', json({ ...unrelated.dependency.body as object,
    run: 'another-run', status: 'resolved' }));
  expect(value(unrelated.graph.recordExhaustion({ ...unrelated.exhaustion, id: 'repair7:unrelated-dependency' },
  unrelated.lease)).kind).toBe('run-exhaustion');
});

it.each([
  ['P5-SEAM-RC-R7-F4-V26-EXITTEST', 'exitTest'],
  ['P5-SEAM-RC-R7-F4-V26-CHECK', 'check'],
  ['P5-SEAM-RC-R7-F4-V26-EVIDENCE', 'evidence'],
  ['P5-SEAM-RC-R7-F4-V26-RESULT', 'result'],
  ['P5-SEAM-RC-R7-F4-V26-SETTLEDOPERATIONS', 'settledOperations'],
] as const)
('%s preserves the exact legacy unsupported-kind missing-field refusal', (_id, field) => {
  const f = closingRun();
  const malformed = structuredClone(json(f.terminalExit)) as Record<string, Json>;
  malformed.kind = 'unsupported';
  delete malformed[field];
  expect(refused(decodeRunExit(malformed, f.context()))).toBe(`missing required field ${field}`);
});

it('P5-SEAM-RC-R7-F4-TYPE-PRECEDENCE preserves type/schema refusal before the unsupported-kind legacy preflight', () => {
  const f = closingRun();
  expect(refused(decodeRunExit({}, f.context()))).toBe('type or schema version unknown');
});

it('P5-SEAM-RC-R7-HISTORY-V45 preserves the round-6 completed replay mismatch detail', () => {
  const f = completedRun();
  const graph = value(createRunGraph({ ...f.deps, exitCheck: { owner: 'part-nine', verify: () => f.success(ref(f.opening)) } }));
  expect(refused(graph.read(f.id))).toBe('exit replay witness mismatch');
});

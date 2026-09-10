import { expect,it } from 'vitest';
import { authorAndAppend } from '../../src/facts/index.js';
import { bundledScheduledCandidate,appendAdmissionWithUnrelatedEvidence,
  BASE_32E5961_ORDINARY_TRANSCRIPT,ordinaryPortTranscript,scheduledFactReference } from '../intake/scheduled-repair9-fixtures.js';
import { value } from '../intake/fixtures.js';

it.each(['discovery-first','unrelated-first'] as const)
('P4-ST-44 V102 integration keeps owner append and pending independent of discovery field order (%s)',order=>{
  const x=bundledScheduledCandidate(order);
  const written=value(authorAndAppend({ kind: x.original.kind,schemaVersion: 1,machine: 'machine-a',
    principal: x.original.principal,provenance: x.original.provenance,at: x.original.at,body: x.original.body,
    required: x.required },x.context,x.store,x.f.deps.author.privateKey));
  expect(written.taint).toEqual([]);
  expect(value(x.f.port().pendingScheduledAdmissions({ owner: x.admitted.owner,frontier: x.f.frontier(),limit: 10,after: null })).admissions)
    .toEqual([scheduledFactReference(written.fact.id)]);
});

it('P4-ST-45 V101 integration projects an admission with stale unrelated Evidence',()=>{
  const x=appendAdmissionWithUnrelatedEvidence(0);
  expect(x.written.taint).toEqual([]);
  expect(value(x.f.port().pendingScheduledAdmissions({ owner: x.admitted.owner,frontier: x.f.frontier(),limit: 10,after: null })).admissions)
    .toEqual([scheduledFactReference(x.written.fact.id)]);
});

it.each(['absent','present','none'] as const)
('P4-ST-46 V108 integration preserves base 32e5961 ordinary-port bytes (%s)',membership=>{
  const result=ordinaryPortTranscript(membership);
  expect(value(result.construction).receive).toBeTypeOf('function');
  expect(value(result.result!).kind).toBe('admitted');
  expect(result.hash).toBe(BASE_32E5961_ORDINARY_TRANSCRIPT);
});

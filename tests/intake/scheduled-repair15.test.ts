import { expect, it } from 'vitest';
import { verifyAndAdmit } from '../../src/facts/index.js';
import { json, refused, value } from './fixtures.js';
import { admissionWithSecondGrant } from './scheduled-repair14-fixtures.js';
import { scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';
import { unavailableDiscoveryAdmission } from './scheduled-repair15-fixtures.js';

it.each(['wrong-event','negative','stale'] as const)
('P4-ST-84 V164 F1 unavailable discovery cannot suppress a known %s refusal',mutation=>{
  const x=unavailableDiscoveryAdmission(mutation);
  refused(verifyAndAdmit(json(x.signed),'machine-a',{
    ...x.context,decode:{ ...x.context.decode,captures:x.f.f.captures },facts:x.f.frames as any,
  }),'unsupported-in-slice-a');
});

it('P4-ST-85 V157 F2 pending explicitly identifies an honestly partial admission',()=>{
  const x=scheduledRepair6Setup(),admitted:any=value(x.f.port().receiveScheduledTick(x.input));
  x.f.dropCapture(x.discovery.evidence.capture.reference);
  const result=value(x.f.port().pendingScheduledAdmissions({
    owner:admitted.owner,frontier:x.f.frontier(),limit:10,after:null,
  }));
  expect(result.admissions).toEqual([]);
  expect(result.partial).toEqual([admitted.fact]);
  expect(x.f.facts().some(fact=>fact.id===admitted.fact.id)).toBe(true);
});

it('P4-ST-86 V158 F3 signed replay refuses selection between covering grants',()=>{
  const x=admissionWithSecondGrant();
  refused(x.appended,'unsupported-in-slice-a');
  expect(x.f.facts().some(fact=>fact.kind==='intake-admitted')).toBe(false);
});

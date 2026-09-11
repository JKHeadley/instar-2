import { expect,it } from 'vitest';
import { authorAndAppend,createFactStore,prepareSnapshot,verifyAndAdmit } from '../../src/facts/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { admissionWithSecondGrant,mismatchedIntentPrincipal,resolutionCandidate } from '../intake/scheduled-repair14-fixtures.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';

it('P4-ST-78 V150/V152 F1 applies the same principal refusal to owner append and signed replication',()=>{
  const x=mismatchedIntentPrincipal('person');
  refused(verifyAndAdmit(json(x.signed),'machine-a',{ ...x.context,facts:x.f.frames as any }),'unsupported-in-slice-a');
  refused(createFactStore(x.context,x.f.storage).append(json(x.signed),{ peer:'machine-a' }),'unsupported-in-slice-a');
  expect(x.f.facts().some(fact=>fact.id===x.signed.id)).toBe(false);
});

it('P4-ST-79 V147/V153 F2 rechecks known dependencies when the receipt capture is unavailable',()=>{
  const x=resolutionCandidate('wrong-binding'); delete x.f.f.captures[x.pin.reference];
  Object.assign((x.f.context.captures as any)[x.pin.reference],{ status:'missing',bytes:null });
  refused(createFactStore(x.context,x.f.storage).append(json(x.signed),{ peer:'machine-a' }),'unsupported-in-slice-a');
  expect(value(prepareSnapshot(x.f.frames as any,{ ...scheduledOwnerContext(x.f),facts:x.f.frames as any })).entries
    .some(row=>row.fact.id===x.signed.id)).toBe(false);
});

it('P4-ST-80 V154/V155 F3 pending resolution ignores an unrelated second live grant',()=>{
  const x=admissionWithSecondGrant();
  const pending=x.f.port().pendingScheduledAdmissions({ owner:x.admitted.owner,frontier:x.f.frontier(),limit:10,after:null });
  expect(value(pending).admissions).toEqual([{ owner:'part-two',name:'FactEnvelope',id:x.appended.fact.id }]);
  expect(x.appended.taint).toEqual([]);
});

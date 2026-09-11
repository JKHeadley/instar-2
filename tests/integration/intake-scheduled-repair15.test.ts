import { expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { json, refused, value } from '../intake/fixtures.js';
import { scheduledOwnerContext, scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';
import { unavailableDiscoveryAdmission } from '../intake/scheduled-repair15-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';

it('P4-ST-87 V165 F1 replication refuses a known bad discovery even when its capture is unavailable',()=>{
  const x=unavailableDiscoveryAdmission('wrong-event');
  const target=scheduledFixture(); target.installSchemas();
  Object.assign(target.context,{ schemas:x.f.context.schemas });
  Object.assign(target.f.captures,x.f.f.captures); target.syncCaptures();
  (target.context.captures as any)[x.pin]={ ...(x.f.context.captures as any)[x.pin] };
  const store=createFactStore(scheduledOwnerContext(target),target.storage);
  for(const fact of x.f.frames as any[]) value(store.append(json(fact),{ peer:fact.machine }));
  const result=store.append(json(x.signed),{ peer:'machine-a' });
  refused(result,'unsupported-in-slice-a');
  expect(target.facts().some(fact=>fact.id===x.signed.id)).toBe(false);
});

it('P4-ST-88 V157 F2 projection retains partial identity without promotion',()=>{
  const x=scheduledRepair6Setup(),admitted:any=value(x.f.port().receiveScheduledTick(x.input));
  x.f.dropCapture(x.grant.grant.source.record.reference);
  const result=value(x.f.port().pendingScheduledAdmissions({
    owner:admitted.owner,frontier:x.f.frontier(),limit:10,after:null,
  }));
  expect(result).toMatchObject({ admissions:[],partial:[admitted.fact] });
});

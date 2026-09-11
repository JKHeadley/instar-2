import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect,it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { admissionWithSecondGrant,mismatchedIntentPrincipal,resolutionCandidate } from '../intake/scheduled-repair14-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';

function durableClone(x:any) {
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair14-')),target=scheduledFixture({ directory });
  target.installSchemas(); Object.assign(target.context,{ schemas:x.f.context.schemas });
  Object.assign(target.f.captures,x.f.f.captures); target.syncCaptures();
  return { directory,target,store:createFactStore(scheduledOwnerContext(target),target.storage) };
}

it('P4-ST-81 V152 F1 durable replication never fsyncs a mismatched Intent principal',()=>{
  const x=mismatchedIntentPrincipal('agent'),d=durableClone(x);
  for(const fact of x.f.frames as any[]) value(d.store.append(json(fact),{ peer:fact.machine }));
  refused(d.store.append(json(x.signed),{ peer:'machine-a' }),'unsupported-in-slice-a');
  const restarted=scheduledFixture({ directory:d.directory }); restarted.installSchemas();
  expect(restarted.facts().some(fact=>fact.id===x.signed.id)).toBe(false);
});

it('P4-ST-82 V149/V153 F2 durable replication refuses a known bad resolution despite missing receipt bytes',()=>{
  const x=resolutionCandidate('wrong-principal'); delete x.f.f.captures[x.pin.reference];
  Object.assign((x.f.context.captures as any)[x.pin.reference],{ status:'missing',bytes:null });
  const d=durableClone(x); (d.target.context.captures as any)[x.pin.reference]={ ...(x.f.context.captures as any)[x.pin.reference] };
  for(const fact of x.f.frames as any[]) value(d.store.append(json(fact),{ peer:fact.machine }));
  refused(d.store.append(json(x.signed),{ peer:'machine-a' }),'unsupported-in-slice-a');
  const restarted=scheduledFixture({ directory:d.directory }); restarted.installSchemas();
  Object.assign(restarted.context,{ schemas:x.f.context.schemas });
  expect(restarted.facts().some(fact=>fact.id===x.signed.id)).toBe(false);
});

it('P4-ST-83 V156 F3 restart keeps the explicitly referenced grant when another valid grant exists',()=>{
  const x=admissionWithSecondGrant(),d=durableClone(x);
  for(const fact of x.f.frames as any[]) value(d.store.append(json(fact),{ peer:fact.machine }));
  const restarted=scheduledFixture({ directory:d.directory }); restarted.installSchemas();
  Object.assign(restarted.context,{ schemas:x.f.context.schemas });
  expect(value(restarted.port().pendingScheduledAdmissions({ owner:x.admitted.owner,frontier:restarted.frontier(),limit:10,after:null })).admissions)
    .toEqual([{ owner:'part-two',name:'FactEnvelope',id:x.appended.fact.id }]);
});

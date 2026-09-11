import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { distinctDirectiveAdmission,laterDirectiveCopyAdmission,missingRecognitionAdmission } from '../intake/scheduled-repair12-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';

const ref=(id:string)=>({ owner:'part-two' as const,name:'FactEnvelope' as const,id });

function durableTarget(source:ReturnType<typeof distinctDirectiveAdmission>|ReturnType<typeof laterDirectiveCopyAdmission>
  |ReturnType<typeof missingRecognitionAdmission>) {
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-r12-')),target=scheduledFixture({ directory });
  target.installSchemas(); Object.assign(target.context,{ schemas:source.f.context.schemas });
  Object.assign(target.f.captures,source.f.f.captures); target.syncCaptures();
  return { directory,target,store:createFactStore(scheduledOwnerContext(target),target.storage) };
}

it('P4-ST-66 V131 refuses both Directive identities before durable admission',()=>{
  expect(()=>distinctDirectiveAdmission()).toThrow('unsupported-in-slice-a');
});

it('P4-ST-67 V133 refuses missing recognition evidence before durable storage',()=>{
  const x=missingRecognitionAdmission(),durable=durableTarget(x);
  for(const fact of x.f.frames as any[]) expect(value(durable.store.append(json(fact),{ peer:fact.machine })).taint).toEqual([]);
  refused(durable.store.append(json(x.candidate),{ peer:'machine-a' }),'unsupported-in-slice-a');
  const restarted=scheduledFixture({ directory:durable.directory }); restarted.installSchemas();
  expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
});

it('P4-ST-68 V131 refuses a later identical Directive copy before durability',()=>{
  expect(()=>laterDirectiveCopyAdmission()).toThrow('unsupported-in-slice-a');
});

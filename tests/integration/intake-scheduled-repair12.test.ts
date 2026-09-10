import { expect,it } from 'vitest';
import { createFactStore,verifyAndAdmit } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { distinctDirectiveAdmission,laterDirectiveCopyAdmission,missingRecognitionAdmission } from '../intake/scheduled-repair12-fixtures.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';

const ref=(id:string)=>({ owner:'part-two' as const,name:'FactEnvelope' as const,id });

it('P4-ST-63 V128 replays and consumes an admission with two Directive identities',()=>{
  const x=distinctDirectiveAdmission(),original=x.f.frames.pop() as FactEnvelope,context=scheduledOwnerContext(x.f);
  expect(value(verifyAndAdmit(json(original),'machine-a',{ ...context,facts:x.f.frames as any })).id).toBe(original.id);
  expect(value(createFactStore(context,x.f.storage).append(json(original),{ peer:'machine-a' })).taint).toEqual([]);
  expect(value(x.f.port().pendingScheduledAdmissions({ owner:x.admitted.owner,frontier:x.f.frontier(),limit:10,after:null })).admissions)
    .toEqual([ref(original.id)]);
});

it('P4-ST-64 V134 refuses a mismatched resolution when the principal link is absent',()=>{
  const x=missingRecognitionAdmission(true);
  refused(verifyAndAdmit(json(x.candidate),'machine-a',{ ...x.context,facts:x.f.frames as any }),
    'package-system principal dependency is missing');
});

it('P4-ST-65 V130 consumes the admission that names only the later identical Directive copy',()=>{
  const x=laterDirectiveCopyAdmission(),context=scheduledOwnerContext(x.f);
  expect(value(createFactStore(context,x.f.storage).append(json(x.candidate),{ peer:'machine-a' })).taint).toEqual([]);
  expect(value(x.f.port().pendingScheduledAdmissions({ owner:x.owner,frontier:x.f.frontier(),limit:10,after:null })).admissions)
    .toEqual([ref(x.candidate.id)]);
});

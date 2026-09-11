import { expect,it } from 'vitest';
import { createFactStore,verifyAndAdmit } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { distinctDirectiveAdmission,laterDirectiveCopyAdmission,missingRecognitionAdmission } from '../intake/scheduled-repair12-fixtures.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';

const ref=(id:string)=>({ owner:'part-two' as const,name:'FactEnvelope' as const,id });

it('P4-ST-63 V128 refuses an admission with two Directive identities',()=>{
  expect(()=>distinctDirectiveAdmission()).toThrow('unsupported-in-slice-a');
});

it('P4-ST-64 V134 refuses a mismatched resolution when the principal link is absent',()=>{
  const x=missingRecognitionAdmission(true);
  refused(verifyAndAdmit(json(x.candidate),'machine-a',{ ...x.context,facts:x.f.frames as any }),
    'unsupported-in-slice-a');
});

it('P4-ST-65 V130 refuses an admission naming a later identical Directive copy',()=>{
  expect(()=>laterDirectiveCopyAdmission()).toThrow('unsupported-in-slice-a');
});

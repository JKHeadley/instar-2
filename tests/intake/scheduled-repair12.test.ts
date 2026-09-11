import { expect,it } from 'vitest';
import { verifyAndAdmit } from '../../src/facts/index.js';
import { json,refused,value } from './fixtures.js';
import { distinctDirectiveAdmission,laterDirectiveCopyAdmission,missingRecognitionAdmission } from './scheduled-repair12-fixtures.js';
import { scheduledOwnerContext } from './scheduled-repair6-fixtures.js';

it('P4-ST-60 V127 refuses distinct Directive identities within one signed fact',()=>{
  expect(()=>distinctDirectiveAdmission()).toThrow('unsupported-in-slice-a');
});

it('P4-ST-61 V129 refuses scheduled replay with both recognition references omitted',()=>{
  const x=missingRecognitionAdmission();
  refused(verifyAndAdmit(json(x.candidate),'machine-a',{ ...x.context,facts:x.f.frames as any }),
    'unsupported-in-slice-a');
});

it('P4-ST-62 V130 refuses the later identical Directive copy',()=>{
  expect(()=>laterDirectiveCopyAdmission()).toThrow('unsupported-in-slice-a');
});

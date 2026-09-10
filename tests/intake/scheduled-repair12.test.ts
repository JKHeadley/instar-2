import { expect,it } from 'vitest';
import { verifyAndAdmit } from '../../src/facts/index.js';
import { json,refused,value } from './fixtures.js';
import { distinctDirectiveAdmission,laterDirectiveCopyAdmission,missingRecognitionAdmission } from './scheduled-repair12-fixtures.js';
import { scheduledOwnerContext } from './scheduled-repair6-fixtures.js';

it('P4-ST-60 V127 groups distinct Directive identities within one signed fact',()=>{
  const x=distinctDirectiveAdmission();
  const admitted=x.f.facts().find(fact=>fact.id===x.admitted.fact.id)!;
  expect((admitted.body as any).intent.under).toEqual(x.ids);
});

it('P4-ST-61 V129 refuses scheduled replay with both recognition references omitted',()=>{
  const x=missingRecognitionAdmission();
  refused(verifyAndAdmit(json(x.candidate),'machine-a',{ ...x.context,facts:x.f.frames as any }),
    'package-system principal dependency is missing');
});

it('P4-ST-62 V130 honors the later identical Directive copy named by the admission',()=>{
  const x=laterDirectiveCopyAdmission(),context=scheduledOwnerContext(x.f);
  expect(value(verifyAndAdmit(json(x.candidate),'machine-a',{ ...context,facts:x.f.frames as any })).id).toBe(x.candidate.id);
});

import { expect,it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { json,refused } from '../intake/fixtures.js';
import { mismatchedSourceSignedAdmission } from '../intake/scheduled-repair16-fixtures.js';

it('P4-ST-92 V173 signed replay refuses two matching discoveries even when one reports another source',()=>{
  const x=mismatchedSourceSignedAdmission();
  refused(createFactStore(x.context,x.f.storage).append(json(x.signed),{ peer:'machine-a' }),
    'exactly one discovery Evidence witness');
  expect(x.f.facts().some(fact=>fact.id===x.signed.id)).toBe(false);
});

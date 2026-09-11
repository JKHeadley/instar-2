import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { refused,value } from '../intake/fixtures.js';
import { scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';

it.each(['none','directive','directives','under'])
('P4-ST-101 supplied Directive redelivery refuses before collapse (%s)',field=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const directive=value(decode('Directive',x.f.f.directiveInput(),{
    ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant),
  }));
  const admitted=value(x.f.port().receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const input={ ...x.input,...(field==='none'?{}:{
    [field]:field==='directive'?directive:[directive],
  }) };
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(input);
  if(field==='none') expect(value(result)).toMatchObject({ kind:'duplicate',original:admitted.fact });
  else {
    refused(result,'unsupported-in-slice-a');
    expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
  }
  expect(x.f.facts().filter(fact=>fact.kind==='intake-admitted')).toHaveLength(1);
});

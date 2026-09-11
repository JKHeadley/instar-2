import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { refused,value } from './fixtures.js';
import { scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';

it.each(['none','directive','directives','under'])
('P4-ST-100 supplied Directive input refuses after its receipt (%s)',field=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const directive=value(decode('Directive',x.f.f.directiveInput(),{
    ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant),
  }));
  const input={ ...x.input,...(field==='none'?{}:{
    [field]:field==='directive'?directive:[directive],
  }) };
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(input);
  if(field==='none') expect(value(result).kind).toBe('scheduled-admitted');
  else {
    refused(result,'unsupported-in-slice-a');
    expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
  }
});

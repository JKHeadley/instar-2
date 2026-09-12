import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { refused,json,value } from './fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';

it.each(['principal-copies','directive-later'])
('P4-ST-106 F1 V219 an invalid no-admission retry writes only its receipt (%s)',fault=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  if(fault==='principal-copies') {
    const context=scheduledOwnerContext(x.f);
    for(let copy=0;copy<2;copy++) value(authorAndAppend({
      kind:'intake-scheduled-principal',schemaVersion:1,machine:'machine-a',
      principal:json(x.f.principal),provenance:json(x.f.provenance),at:json(x.f.f.now),
      body:json({ principal:x.f.principal }),required:[x.grant.fact.id],
    },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
  } else {
    const directive=value(decode('Directive',x.f.f.directiveInput(),{
      ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant),
    }));
    const schema={ ...x.f.f.schema,kind:'repair21-later-directive',fields:{
      directive:{ kind:'constitutional' as const,type:'Directive' as const },
    } };
    Object.assign(x.f.context,{ schemas:[...x.f.context.schemas,schema] });
    expect(value(authorAndAppend({
      kind:schema.kind,schemaVersion:1,machine:'machine-a',principal:json(x.f.f.alice),
      provenance:json(x.f.f.alice.provenance),at:json(x.f.f.now),body:{ directive:json(directive) },required:[],
    },x.f.context,createFactStore(x.f.context,x.f.storage),x.f.deps.author.privateKey)).taint).toEqual([]);
  }

  const append=x.f.storage.append.bind(x.f.storage); let cut=false;
  const storage={ ...x.f.storage,append(bytes:string,expected:string|null) {
    const result=append(bytes,expected);
    if(!cut&&JSON.parse(bytes).kind==='intake-receipt') { cut=true; throw new Error('cut after receipt fsync'); }
    return result;
  } };
  const seedBefore=x.f.facts().length;
  value(createIntakePort({ ...x.f.deps,storage })).receiveScheduledTick(x.input);
  expect(cut).toBe(true);
  expect(x.f.facts().slice(seedBefore).map(fact=>fact.kind)).toEqual(['intake-receipt']);

  const input={ ...x.input,raw:x.f.tick({ calendarPolicyVersion:'cron-v2' }).raw };
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(input);
  refused(result,'unsupported-in-slice-a');
  expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
  expect(x.f.facts().slice(before+1)).toEqual([]);
  expect(x.f.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
});

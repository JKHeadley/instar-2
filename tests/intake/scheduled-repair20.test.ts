import { expect,it } from 'vitest';
import { canonical,decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { refused,json,value } from './fixtures.js';
import { scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';

function receiptOnly(facts: readonly FactEnvelope[],before: number): void {
  const suffix=facts.slice(before);
  expect(suffix.map(fact=>fact.kind)).toEqual(['intake-receipt']);
  expect(suffix.slice(1)).toEqual([]);
}

it.each(['none','operation','route','discovery','raw'].flatMap(place =>
  ['new','duplicate','changed'].map(phase=>({ place,phase }))))
('P4-ST-103 V211 the one receipt gate decides Directive refusal before every write ($place $phase)',({ place,phase })=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const directive=value(decode('Directive',x.f.f.directiveInput(),{
    ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant),
  }));
  if(phase!=='new') expect(value(x.f.port().receiveScheduledTick(x.input)).kind).toBe('scheduled-admitted');
  const input:any=structuredClone(x.input);
  if(phase==='changed') input.raw=x.f.tick({ calendarPolicyVersion:'cron-v2' }).raw;
  if(place==='operation') input.directives=[directive];
  if(place==='route') input.route.directives=[directive];
  if(place==='discovery') input.discovery.directives=[directive];
  if(place==='raw') input.raw=value(canonical({ ...JSON.parse(input.raw),directives:[directive] })).bytes;
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(input);
  if(place==='none') {
    if(phase==='changed') {
      refused(result,'different arrival bytes');
      expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt','intake-mismatch']);
    } else expect(value(result).kind).toBe(phase==='new'?'scheduled-admitted':'duplicate');
  } else {
    refused(result,'unsupported-in-slice-a');
    receiptOnly(x.f.facts(),before);
  }
});

it.each(['none','bundled','predecessor'].flatMap(placement =>
  ['new','duplicate','changed'].map(phase=>({ placement,phase }))))
('P4-ST-103 V212 selected Directive-bearing discovery history refuses before every write ($placement $phase)',({ placement,phase })=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const directive=value(decode('Directive',x.f.f.directiveInput(),{
    ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant),
  }));
  if(phase!=='new') expect(value(x.f.port().receiveScheduledTick(x.input)).kind).toBe('scheduled-admitted');
  const evidence=value(decode('Evidence',{ ...json(x.discovery.evidence) as any,id:'discovery:repair20' },x.f.context.decode));
  const schema={ ...x.f.evidenceSchema,kind:'repair20-discovery',fields:{
    evidence:{ kind:'constitutional' as const,type:'Evidence' as const },
    ...(placement==='bundled'?{ directive:{ kind:'constitutional' as const,type:'Directive' as const } }:{}),
  } };
  const directiveSchema={ ...x.f.f.schema,kind:'repair20-directive',fields:{
    directive:{ kind:'constitutional' as const,type:'Directive' as const },
  } };
  Object.assign(x.f.context,{ schemas:[...x.f.context.schemas,schema,directiveSchema] });
  const append=(kind:string,body:any,required:string[]=[])=>value(authorAndAppend({
    kind,schemaVersion:1,machine:'machine-a',principal:json(x.f.f.alice),
    provenance:json(x.f.f.alice.provenance),at:json(x.f.f.now),body,required,
  },x.f.context,createFactStore(x.f.context,x.f.storage),x.f.deps.author.privateKey));
  const predecessor=placement==='predecessor'
    ?append(directiveSchema.kind,{ directive:json(directive) }):undefined;
  const bundle=append(schema.kind,{
    evidence:json(evidence),...(placement==='bundled'?{ directive:json(directive) }:{}),
  },predecessor?[predecessor.fact.id]:[]);
  expect(bundle.taint).toEqual([]);
  const input={ ...x.input,
    raw:phase==='changed'?x.f.tick({ calendarPolicyVersion:'cron-v2' }).raw:x.input.raw,
    discovery:{ owner:'part-two' as const,name:'FactEnvelope' as const,id:bundle.fact.id },
  };
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(input);
  if(placement==='none') {
    if(phase==='changed') {
      refused(result,'different arrival bytes');
      expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt','intake-mismatch']);
    } else expect(value(result).kind).toBe(phase==='new'?'scheduled-admitted':'duplicate');
  } else {
    refused(result,'unsupported-in-slice-a');
    receiptOnly(x.f.facts(),before);
  }
});

it.each(['normal','past-freshness'])
('P4-ST-103 V214 later unrelated Directive history does not invalidate the selected historical witness (%s)',variant=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const admitted:any=value(x.f.port().receiveScheduledTick(x.input));
  const directive=value(decode('Directive',x.f.f.directiveInput(),{
    ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant),
  }));
  const schema={ ...x.f.f.schema,kind:'repair20-later-directive',fields:{
    directive:{ kind:'constitutional' as const,type:'Directive' as const },
  } };
  Object.assign(x.f.context,{ schemas:[...x.f.context.schemas,schema] });
  expect(value(authorAndAppend({
    kind:schema.kind,schemaVersion:1,machine:'machine-a',principal:json(x.f.f.alice),
    provenance:json(x.f.f.alice.provenance),at:json(x.f.f.now),body:{ directive:json(directive) },required:[],
  },x.f.context,createFactStore(x.f.context,x.f.storage),x.f.deps.author.privateKey)).taint).toEqual([]);
  if(variant==='past-freshness') x.f.setTime(1101);
  expect(value(x.f.port().receiveScheduledTick(x.input))).toMatchObject({ kind:'duplicate',original:admitted.fact });
});

it.each(['jobInstance','calendarPolicyVersion','timeZoneDataVersion'])
('P4-ST-103 V215 Directive-looking text remains ordinary scheduled data (%s)',field=>{
  const x=scheduledRepair6Setup();
  const tick=x.f.tick({ [field]:'directive:under:directives' });
  const discovery=x.f.discovery(tick.eventId,'machine-b',99);
  const input={ raw:tick.raw,route:tick.route,
    discovery:{ owner:'part-two' as const,name:'FactEnvelope' as const,id:discovery.fact.id } };
  const admitted:any=value(x.f.port().receiveScheduledTick(input));
  expect(admitted.kind).toBe('scheduled-admitted');
  expect(value(x.f.port().receiveScheduledTick(input))).toMatchObject({ kind:'duplicate',original:admitted.fact });
});

it.each(['none','missing','wrong-owner','wrong-kind','wrong-event'].flatMap(fault =>
  ['new','duplicate','changed'].map(phase=>({ fault,phase }))))
('P4-ST-103 V216 discovery existence, kind and subject are decided before every write ($fault $phase)',({ fault,phase })=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  if(phase!=='new') expect(value(x.f.port().receiveScheduledTick(x.input)).kind).toBe('scheduled-admitted');
  const input:any=structuredClone(x.input);
  if(phase==='changed') input.raw=x.f.tick({ calendarPolicyVersion:'cron-v2' }).raw;
  if(fault==='missing') input.discovery.id=`sha256:${'f'.repeat(64)}`;
  if(fault==='wrong-owner') input.discovery.owner='part-five';
  if(fault==='wrong-kind') input.discovery.id=x.grant.fact.id;
  if(fault==='wrong-event') input.discovery.id=x.f.discovery(x.f.tick({ jobInstance:'job:other' }).eventId).fact.id;
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(input);
  if(fault==='none') {
    if(phase==='changed') {
      refused(result,'different arrival bytes');
      expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt','intake-mismatch']);
    } else expect(value(result).kind).toBe(phase==='new'?'scheduled-admitted':'duplicate');
  } else {
    refused(result);
    receiptOnly(x.f.facts(),before);
  }
});

it.each(['old-expired','new-distinct'])
('P4-ST-103 V218 valid changed bytes retain the existing mismatch behavior (%s)',mode=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  expect(value(x.f.port().receiveScheduledTick(x.input)).kind).toBe('scheduled-admitted');
  const input=structuredClone(x.input);
  input.raw=x.f.tick({ calendarPolicyVersion:'cron-v2' }).raw;
  if(mode==='old-expired') x.f.setTime(1101);
  else input.discovery.id=x.f.discovery(x.tick.eventId,'machine-b',100).fact.id;
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(input);
  refused(result,'different arrival bytes');
  expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt','intake-mismatch']);
});

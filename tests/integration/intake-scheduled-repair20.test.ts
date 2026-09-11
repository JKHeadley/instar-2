import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { refused,json,value } from '../intake/fixtures.js';
import { scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';

it.each(['duplicate','changed'])
('P4-ST-104 F1 V211/V212 the public receipt gate refuses selected Directive history before %s writes',phase=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const admitted:any=value(x.f.port().receiveScheduledTick(x.input));
  const directive=value(decode('Directive',x.f.f.directiveInput(),{
    ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant),
  }));
  const evidence=value(decode('Evidence',{ ...json(x.discovery.evidence) as any,id:'discovery:repair20-integration' },
    x.f.context.decode));
  const schema={ ...x.f.evidenceSchema,kind:'repair20-integration-discovery',fields:{
    evidence:{ kind:'constitutional' as const,type:'Evidence' as const },
    directive:{ kind:'constitutional' as const,type:'Directive' as const },
  } };
  Object.assign(x.f.context,{ schemas:[...x.f.context.schemas,schema] });
  const bundle=value(authorAndAppend({
    kind:schema.kind,schemaVersion:1,machine:'machine-a',principal:json(x.f.f.alice),
    provenance:json(x.f.f.alice.provenance),at:json(x.f.f.now),
    body:{ evidence:json(evidence),directive:json(directive) },required:[],
  },x.f.context,createFactStore(x.f.context,x.f.storage),x.f.deps.author.privateKey));
  expect(bundle.taint).toEqual([]);
  const input={ ...x.input,
    raw:phase==='changed'?x.f.tick({ calendarPolicyVersion:'cron-v2' }).raw:x.input.raw,
    discovery:{ owner:'part-two' as const,name:'FactEnvelope' as const,id:bundle.fact.id },
  };
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(input);
  refused(result,'unsupported-in-slice-a');
  expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
  expect(x.f.facts().slice(before+1)).toEqual([]);
  expect(x.f.facts().filter(fact=>fact.kind==='intake-admitted')).toHaveLength(1);
  expect(value(x.f.port().pendingScheduledAdmissions({
    owner:x.f.deps.workOwner,frontier:x.f.frontier(),limit:10,after:null,
  })).admissions).toEqual([admitted.fact]);
});

it.each(['missing','wrong-owner','wrong-kind','wrong-event'])
('P4-ST-104 F2 V216 the public receipt gate refuses %s discovery before mismatch writes',fault=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const admitted:any=value(x.f.port().receiveScheduledTick(x.input));
  const input:any=structuredClone(x.input);
  input.raw=x.f.tick({ calendarPolicyVersion:'cron-v2' }).raw;
  if(fault==='missing') input.discovery.id=`sha256:${'f'.repeat(64)}`;
  if(fault==='wrong-owner') input.discovery.owner='part-five';
  if(fault==='wrong-kind') input.discovery.id=x.grant.fact.id;
  if(fault==='wrong-event') input.discovery.id=x.f.discovery(x.f.tick({ jobInstance:'job:other' }).eventId).fact.id;
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(input);
  refused(result);
  expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
  expect(x.f.facts().slice(before+1)).toEqual([]);
  expect(x.f.facts().filter(fact=>fact.kind==='intake-admitted')).toHaveLength(1);
  expect(value(x.f.port().pendingScheduledAdmissions({
    owner:x.f.deps.workOwner,frontier:x.f.frontier(),limit:10,after:null,
  })).admissions).toEqual([admitted.fact]);
});

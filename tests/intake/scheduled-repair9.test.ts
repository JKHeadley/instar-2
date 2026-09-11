import {expect,it} from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { scheduledFixture } from './scheduled-fixtures.js';
import { join } from 'node:path';
import { canonical, decode, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { authorAndAppend, createFactStore, signEnvelope, verifyAndAdmit, prepareSnapshot } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { scheduledRepair6Setup, scheduledOwnerContext } from './scheduled-repair6-fixtures.js';
import { scheduledRunHarness } from './scheduled-run-fixtures.js';
import { intakeFixture, json, message, route, value, refused } from './fixtures.js';
const ref=(id:string)=>({owner:'part-two' as const,name:'FactEnvelope' as const,id});
function observe<T>(_label: string, result: Result<T>): Result<T> { return result; }
function extraEvidence(x:any,id:string,claim:any,freshFor=1000){return value(decode('Evidence',{...json(x.discovery.evidence) as any,id,claim,freshFor},x.f.context.decode));}
function evidenceFact(x:any,body:any){
 const fields=Object.fromEntries(Object.keys(body).map(k=>[k,{kind:'constitutional',type:'Evidence'}]));
 Object.assign(x.f.context,{schemas:[...x.f.context.schemas,{...x.f.evidenceSchema,kind:'reviewer-evidence-bundle',fields}]});
 const c={...x.f.context,decode:{...x.f.context.decode,provenance:x.f.provenance}};
 return value(authorAndAppend({kind:'reviewer-evidence-bundle',schemaVersion:1,machine:'machine-a',principal:json(x.f.principal),provenance:json(x.f.provenance),at:json(x.f.f.now),body:json(body),required:[]},c,createFactStore(c,x.f.storage),x.f.deps.author.privateKey)).fact;
}
it.each(['discovery-first','unrelated-first','no-matching-claim'])('P4-ST-44 V100 live discovery resolves matching claim in a signed multi-Evidence fact (%s)',variant=>{
 const x=scheduledRepair6Setup();
 const unrelated=extraEvidence(x,'evidence:unrelated',{subject:'other',predicate:'unrelated-observation',value:true});
 const matching=extraEvidence(x,'evidence:bundled-discovery',x.discovery.evidence.claim);
 const body=variant==='discovery-first'?{a:matching,b:unrelated}:variant==='unrelated-first'?{a:unrelated,b:matching}:{a:unrelated};
 const fact=evidenceFact(x,body),before=x.f.frames.length;
 const result=observe('V100-'+variant,x.f.port().receiveScheduledTick({...x.input,discovery:ref(fact.id)}));
 if(variant==='no-matching-claim'){refused(result);expect(x.f.facts().slice(before).map(f=>f.kind)).toEqual(['intake-receipt']);}
 else expect(value(result).kind).toBe('scheduled-admitted');
});
it.each(['fresh-unrelated','stale-unrelated','stale-matching'])('P4-ST-45 V101 pending lookup does not treat unrelated expired Evidence as discovery (%s)',variant=>{
 const x=scheduledRepair6Setup();
 const matching=variant==='stale-matching';
 const evidence=extraEvidence(x,'evidence:extra',{subject:matching?x.tick.eventId:'other',predicate:matching?'scheduled-discovery':'unrelated-observation',value:true},variant==='fresh-unrelated'?1000:0);
 const extra=evidenceFact(x,{evidence});x.f.setTime(101);
 const admitted:any=value(x.f.port().receiveScheduledTick(x.input));
 const original=x.f.frames.pop() as any,c=scheduledOwnerContext(x.f);
 const result=observe('V101-'+variant,authorAndAppend({kind:original.kind,schemaVersion:1,machine:'machine-a',principal:json(original.principal),provenance:json(original.provenance),at:json(original.at),body:original.body,required:[...original.predecessors.required,extra.id]},c,createFactStore(c,x.f.storage),x.f.deps.author.privateKey));
 if(matching){refused(result);return;}
 const written=value(result);expect(written.taint).toEqual([]);
 const pending=observe('V101-'+variant+'-pending',x.f.port().pendingScheduledAdmissions({owner:admitted.owner,frontier:x.f.frontier(),limit:10,after:null}));
 const h=scheduledRunHarness(x.f,{...admitted,fact:ref(written.fact.id)});expect(value(observe('V101-'+variant+'-run',h.graph.open(h.run))).run.opening).toEqual(ref(written.fact.id));
 expect(value(pending).admissions).toEqual([ref(written.fact.id)]);
});

function bundledCandidate(order:string){
 const x=scheduledRepair6Setup(),unrelated=extraEvidence(x,'evidence:unrelated',{subject:'other',predicate:'unrelated-observation',value:true});
 const matching=extraEvidence(x,'evidence:bundled-discovery',x.discovery.evidence.claim);
 const bundle=evidenceFact(x,order==='discovery-first'?{a:matching,b:unrelated}:{a:unrelated,b:matching});
 const admitted:any=value(x.f.port().receiveScheduledTick(x.input));
 const original=x.f.frames.pop() as any,resolution=x.f.frames.pop() as any,c=scheduledOwnerContext(x.f),store=createFactStore(c,x.f.storage);
 const replacement=value(authorAndAppend({kind:resolution.kind,schemaVersion:1,machine:'machine-a',principal:json(resolution.principal),provenance:json(resolution.provenance),at:json(resolution.at),body:resolution.body,required:resolution.predecessors.required.map((id:string)=>id===x.discovery.fact.id?bundle.id:id)},c,store,x.f.deps.author.privateKey)).fact;
 const required=original.predecessors.required.map((id:string)=>id===x.discovery.fact.id?bundle.id:id===resolution.id?replacement.id:id);
 return {...x,bundle,admitted,original,c,store,required};
}
it.each(['discovery-first','unrelated-first'])('P4-ST-44 V102 owner, signed replay, pending and Run agree on bundled discovery (%s)',order=>{
 const x=bundledCandidate(order);
 const previous=x.f.frames.at(-1) as any;
 const signed:any=signEnvelope({...x.original,predecessors:{...x.original.predecessors,required:x.required,
  inSegment:previous.id},prevInSegment:previous.contentHash},x.f.deps.author.privateKey);
 expect(value(observe('V102-'+order+'-replay',verifyAndAdmit(json(signed),'machine-a',{...x.c,facts:x.f.frames as any}))).id).toBe(signed.id);
 const written=value(observe('V102-'+order+'-origin',authorAndAppend({kind:x.original.kind,schemaVersion:1,machine:'machine-a',principal:json(x.original.principal),provenance:json(x.original.provenance),at:json(x.original.at),body:x.original.body,required:x.required},x.c,x.store,x.f.deps.author.privateKey)));
 expect(written.taint).toEqual([]);
 expect(value(observe('V102-'+order+'-pending',x.f.port().pendingScheduledAdmissions({owner:x.admitted.owner,frontier:x.f.frontier(),limit:10,after:null}))).admissions).toEqual([ref(written.fact.id)]);
 const h=scheduledRunHarness(x.f,{...x.admitted,fact:ref(written.fact.id)});expect(value(h.graph.open(h.run)).run.opening).toEqual(ref(written.fact.id));
});
it.each(['discovery-first','unrelated-first'])('P4-ST-44 V103 unchanged duplicate resolves matching bundled discovery (%s)',order=>{
 const x=bundledCandidate(order);
 const written=value(authorAndAppend({kind:x.original.kind,schemaVersion:1,machine:'machine-a',principal:json(x.original.principal),provenance:json(x.original.provenance),at:json(x.original.at),body:x.original.body,required:x.required},x.c,x.store,x.f.deps.author.privateKey));
 expect(value(observe('V103-'+order,x.f.port().receiveScheduledTick({...x.input,discovery:ref(x.bundle.id)})))).toMatchObject({kind:'duplicate',original:ref(written.fact.id)});
});
it.each(['fresh','stale'])('P4-ST-45 V104 signed replay accepts a complete unrelated Evidence dependency (%s)',fresh=>{
 const x=scheduledRepair6Setup();
 const evidence=extraEvidence(x,'evidence:unrelated',{subject:'other',predicate:'unrelated-observation',value:true},fresh==='fresh'?1000:0);
 const extra=evidenceFact(x,{evidence});x.f.setTime(101);value(x.f.port().receiveScheduledTick(x.input));
 const original=x.f.frames.pop() as any,c=scheduledOwnerContext(x.f);
 const signed:any=signEnvelope({...original,predecessors:{...original.predecessors,required:[...original.predecessors.required,extra.id]}},x.f.deps.author.privateKey);
 expect(value(observe('V104-'+fresh,verifyAndAdmit(json(signed),'machine-a',{...c,facts:x.f.frames as any}))).id).toBe(signed.id);
});
it.each([['discovery-first',false],['unrelated-first',false],['unrelated-first',true]] as const)
('P4-ST-44 V105 durable bundled discovery survives restart and duplicate acknowledgement (%s, cut=%s)',(order,cut)=>{
 const x=bundledCandidate(order),written=value(authorAndAppend({kind:x.original.kind,schemaVersion:1,machine:'machine-a',principal:json(x.original.principal),provenance:json(x.original.provenance),at:json(x.original.at),body:x.original.body,required:x.required},x.c,x.store,x.f.deps.author.privateKey));
 const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair9-v105-')),f=scheduledFixture({directory});f.installSchemas();
 Object.assign(f.context,{schemas:x.f.context.schemas});Object.assign(f.f.captures,x.f.f.captures);f.syncCaptures();
 const c=scheduledOwnerContext(f),store=createFactStore(c,f.storage),append=f.storage.append.bind(f.storage);let hit=false;
 f.storage.append=(bytes,expected)=>{const r=append(bytes,expected);if(cut&&JSON.parse(bytes).kind==='intake-admitted'){hit=true;throw new Error('lost acknowledgement after fsync');}return r;};
 for(const fact of x.f.frames as any[]){const r=store.append(json(fact),{peer:fact.machine});if(cut&&fact.kind==='intake-admitted')refused(r);else value(r);}
 expect(hit).toBe(cut);
 const restarted=scheduledFixture({directory});restarted.installSchemas();Object.assign(restarted.context,{schemas:x.f.context.schemas});
 expect(value(observe('V105-'+order+'-'+cut+'-pending',restarted.port().pendingScheduledAdmissions({owner:x.admitted.owner,frontier:restarted.frontier(),limit:10,after:null}))).admissions).toEqual([ref(written.fact.id)]);
 const duplicate=observe('V105-'+order+'-'+cut+'-duplicate',restarted.port().receiveScheduledTick({...x.input,discovery:ref(x.bundle.id)}));
 const h=scheduledRunHarness(restarted,{...x.admitted,fact:ref(written.fact.id)});expect(value(h.graph.open(h.run)).run.opening).toEqual(ref(written.fact.id));
 expect(value(duplicate)).toMatchObject({kind:'duplicate',original:ref(written.fact.id)});
});
it.each(['machine-a','scheduled-clock'])('P4-ST-44 V106 signed replay independently refuses discovery-specific tick subject (%s)',source=>{
 const x=scheduledRepair6Setup();value(x.f.port().receiveScheduledTick(x.input));const original=x.f.frames.pop() as any,c=scheduledOwnerContext(x.f);
 const body=structuredClone(original.body);body.intent.ask.scheduledInstant=json(x.f.clock(1000,source));
 const signed:any=signEnvelope({...original,body},x.f.deps.author.privateKey),r=verifyAndAdmit(json(signed),'machine-a',{...c,facts:x.f.frames as any});
 if(source==='scheduled-clock')expect(value(r).id).toBe(signed.id);else refused(r);
});

it.each([['fresh',false],['stale',false],['stale',true]] as const)
('P4-ST-45 V107 durable unrelated Evidence freshness cannot hide valid admitted work (%s, cut=%s)',(fresh,cut)=>{
 const x=scheduledRepair6Setup(),evidence=extraEvidence(x,'evidence:unrelated',{subject:'other',predicate:'unrelated-observation',value:true},fresh==='fresh'?1000:0);
 const extra=evidenceFact(x,{evidence});x.f.setTime(101);
 const admitted:any=value(x.f.port().receiveScheduledTick(x.input)),original=x.f.frames.pop() as any,c=scheduledOwnerContext(x.f);
 const written=value(authorAndAppend({kind:original.kind,schemaVersion:1,machine:'machine-a',principal:json(original.principal),provenance:json(original.provenance),at:json(original.at),body:original.body,required:[...original.predecessors.required,extra.id]},c,createFactStore(c,x.f.storage),x.f.deps.author.privateKey));
 const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair9-v107-')),f=scheduledFixture({directory});f.installSchemas();Object.assign(f.context,{schemas:x.f.context.schemas});Object.assign(f.f.captures,x.f.f.captures);f.syncCaptures();
 const durableContext=scheduledOwnerContext(f),store=createFactStore(durableContext,f.storage),append=f.storage.append.bind(f.storage);let hit=false;
 f.storage.append=(bytes,expected)=>{const r=append(bytes,expected);if(cut&&JSON.parse(bytes).kind==='intake-admitted'){hit=true;throw new Error('lost ack after fsync');}return r;};
 for(const fact of x.f.frames as any[]){const r=store.append(json(fact),{peer:fact.machine});if(cut&&fact.kind==='intake-admitted')refused(r);else value(r);}expect(hit).toBe(cut);
 const restarted=scheduledFixture({directory});restarted.installSchemas();Object.assign(restarted.context,{schemas:x.f.context.schemas});
 const rows=value(prepareSnapshot(restarted.frames as any,{...scheduledOwnerContext(restarted),facts:restarted.frames as any})).entries;
 expect(rows.find(row=>row.fact.id===written.fact.id)!.taint).toEqual([]);
 const pending=observe('V107-'+fresh+'-'+cut+'-pending',restarted.port().pendingScheduledAdmissions({owner:admitted.owner,frontier:restarted.frontier(),limit:10,after:null}));
 const duplicate=observe('V107-'+fresh+'-'+cut+'-duplicate',restarted.port().receiveScheduledTick(x.input));
 const h=scheduledRunHarness(restarted,{...admitted,fact:ref(written.fact.id)});expect(value(observe('V107-'+fresh+'-'+cut+'-run',h.graph.open(h.run))).run.opening).toEqual(ref(written.fact.id));
 expect(value(pending).admissions).toEqual([ref(written.fact.id)]);expect(value(duplicate)).toMatchObject({kind:'duplicate',original:ref(written.fact.id)});
});

const BASE_32E5961_ORDINARY_TRANSCRIPT =
 'sha256:6afe17cbb0dbf1ceb199a397039866d5e2f0f7cd76aae316bf7d816cf1dfc044';

it.each(['absent','present','none'] as const)
('P4-ST-46 V108 HEAD remains byte-identical to base 32e5961 for ordinary ports with unrelated parser membership (%s)',membership=>{
 const f=intakeFixture(),declared=f.registerInput.sources.map(source=>source.declaration);
 if(membership!=='none')declared.push(f.r.declaration('unrelated-parser','parsers',{
  fixture:'check',authenticationClass:[{stimulusType:'message',class:'channel-attested'}],
  eventIdAuthority:{mintedBy:'provider',uniquenessScope:'channel-and-sender',replayWindow:1000,
   fallbackFingerprint:{policy:'none',basis:'provider id required'}},ackPolicy:'never',
 },{profile:f.r.profile}));
 if(membership==='present')Object.assign(f.context,{decode:{...f.context.decode,register:{
  ...f.context.decode.register,entries:[...f.context.decode.register.entries,'unrelated-parser'],
 }}});
 const construction=createIntakePort({...f.deps,governance:f.govern(declared).governance});
 const port=consumeResult(construction,{Success:result=>result,Refused:()=>null});
 const result=port?.receive(message('unchanged ordinary input'),route);
 const wire:any=result?consumeResult<any,any>(result,{Success:result=>({kind:'Success',value:result}),
  Refused:refusal=>({kind:'Refused',refusal})}):consumeResult<any,any>(construction,{
  Success:()=>null,Refused:refusal=>({kind:'RefusedConstruction',refusal}),
 });
 expect(value(construction).receive).toBeTypeOf('function');
 expect(value(result!).kind).toBe('admitted');
 expect(value(canonical({wire,facts:f.facts()})).hash).toBe(BASE_32E5961_ORDINARY_TRANSCRIPT);
});

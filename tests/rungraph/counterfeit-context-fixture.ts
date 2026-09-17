// @ts-nocheck -- independently authored Astra executable cases are retained verbatim in runtime shape.

import { consumeResult } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createRunGraph, registerProductionGroundingReader } from '../../src/rungraph/index.js';
import { createAssemblyRuntime, createAssemblySpine, createConfinedContextDeliveryDriver, createProductionGroundingReader, createNativeHarnessAdapter, contextDeliveryIdFor, decodeAssemblyRecord } from '../../src/assembly/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { privateKey } from '../facts/fixtures.js';
import { executeInitialLiveInputLifecycle, paired, setup, value, json, ref, digest } from './astra-production-grounding-fixture.js';
const result = (r:any):any => consumeResult(r,{Success:v=>({accepted:true,value:v}),Refused:r=>({accepted:false,detail:r.detail})});
export function ten(storageFactory?: any) {
 const text={kind:'text' as const,maxLength:2048};
 const f=setup(storageFactory,undefined,{fields:{intent:{kind:'constitutional',type:'Intent'},owner:{kind:'constitutional',type:'VerifiedPrincipal'},capture:{kind:'capture'}},extra:{
  'effect-OperationDefinition':{id:text},'effect-EffectRequest':{id:text,definition:text,digest:text,run:text},'transport-AdmissionReservation':{operation:text,state:text,digest:text,run:text},
  'transport-Lease':{run:text,incarnation:text},'effect-OperationObservation':{operation:text,claim:text,digest:text,run:text,input:text,stage:text},
  'rungraph-briefing-material':{class:text},
 },ownerRecords:true,body:({intent,owner,hash})=>json({intent,owner,capture:{reference:'message:1',hash}})});
 const spine=createAssemblySpine(f.assemblyHost,{context:f.ctx,privateKey},f.store);
 const runtime=createAssemblyRuntime({host:f.assemblyHost,spine} as any);
 const history:any={owner:'part-ten',current:()=>runtime.inspectCurrent(),lookup:(id:string)=>{const snap=value(f.store.readForProjection());const a=value(runtime.inspectCurrent()).find(r=>r.fact.id===id||r.record.id===id);const s=snap.entries.find(r=>r.fact.id===(a?.fact.id??id));return f.success(s?{fact:s.fact,...(a?{record:a.record}:{}),taint:s.taint,conflicts:[...s.conflicts,...(a?.conflicts??[])],completeness:'complete'}:null)},resolve:(r:any)=>runtime.resolve(r),resolveContextDelivery:(r:any)=>runtime.resolve(r)};
 const typed=(label:string)=>{const definition=`definition:${label}`,request=`request:${label}`,attempt=`attempt:${label}`;f.append('effect-OperationDefinition',json({record:{type:'OperationDefinition',schemaVersion:1,id:definition}}));f.append('effect-EffectRequest',json({record:{type:'EffectRequest',schemaVersion:1,id:request,definition,digest:f.ctx.captures['message:1']!.hash,run:f.id}}));const operation={id:`operation:${digest([f.id,request,attempt])}`};const claim=f.append('transport-AdmissionReservation',json({record:{type:'AdmissionReservation',schemaVersion:1,operation:operation.id,request,state:'dispatch-claimed',digest:f.ctx.captures['message:1']!.hash,run:f.id,tick:1}})).fact;return{operation,claim}};
 const first=typed('first'),execution=f.append('transport-Lease',json({record:{type:'Lease',schemaVersion:1,id:'delivery-lease:1',run:f.id,incarnation:'incarnation:one'}})).fact;
 const accepted=f.append('effect-OperationObservation',json({record:{type:'OperationObservation',schemaVersion:1,id:'accepted:first',operation:first.operation.id,claim:first.claim.id,digest:f.ctx.captures['message:1']!.hash,run:f.id,input:f.opening.id,stage:'executor-accepted'}})).fact;
 const consumed=f.append('effect-OperationObservation',json({record:{type:'OperationObservation',schemaVersion:1,id:'consumed:first',operation:first.operation.id,claim:first.claim.id,digest:f.ctx.captures['message:1']!.hash,run:f.id,input:f.opening.id,stage:'response'}})).fact;
 const launch=value(runtime.record('HarnessLaunchSpec',{...assemblyInput('HarnessLaunchSpec'),id:'typed-launch',run:f.id,step:'launch-step',input:f.opening.id,inputDigest:f.ctx.captures['message:1']!.hash,incarnation:'incarnation:one',harness:'native',processOperation:first.operation.id}));
 const launchFact=value(runtime.inspect()).find(r=>r.record.id===launch.id)!.fact;
 const specs=new Map([[first.operation.id,first.claim.id]]);
 const spec=(reason='initial',operation=first.operation.id,previousDelivery='')=>{const claim=specs.get(operation)!;return({type:'ContextDeliverySpecification',schemaVersion:1,id:contextDeliveryIdFor(launchFact.id,operation),predecessors:[],dependencyFacts:[],launch:launchFact.id,run:launch.run,step:'step:next',input:f.opening.id,inputDigest:f.ctx.captures['message:1']!.hash,incarnation:launch.incarnation,harness:launch.harness,artifactDigest:launch.artifactDigest,machine:launch.machine,generation:'generation:fixture',executionContext:execution.id,contextManifest:[{class:'message',reference:'message:1',digest:f.ctx.captures['message:1']!.hash}],reason,operation,claim,previousDelivery,controlObservation:''})};
 let calls=0;
 const driver=createConfinedContextDeliveryDriver({history,runtime,context:f.c,clock:()=>100,liveProcess:{owner:'part-ten',resolve:l=>f.success({launch:l.id,run:l.run,incarnation:l.incarnation,harness:l.harness,artifactDigest:l.artifactDigest,machine:l.machine,processIdentity:'pid:42:start:1'})},execution:{owner:'part-eight',deliver:()=>{calls++;return f.success(accepted.id)},observe:()=>f.success({phase:'context-consumed',evidence:consumed.id,detail:'witness'})}});
 const next=(label:string)=>{const pair=typed(label);specs.set(pair.operation.id,pair.claim.id);return pair};
 return {...f,runtime,spine,launch,launchFact,evidence:consumed,history,spec,driver,next,calls:()=>calls};
}

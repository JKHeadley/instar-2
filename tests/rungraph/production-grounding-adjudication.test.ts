// @ts-nocheck -- authoritative review assertions; adjudicated real-owner prerequisite translation.
import '../assembly/production-grounding-evidence.mjs';
// AUTHORITATIVE SETUP REPLACEMENTS: Q7, R2, R3, R8. Q8 ordinary-reply refusal remains binding.
import {it,expect} from 'vitest';
import {consumeResult,canonical} from '../../src/index.js';
import {authorAndAppend} from '../../src/facts/index.js';
import {createEffectDoorway} from '../../src/effects/index.js';
import {createConfinedContextDeliveryDriver,createAssemblyRuntime,createAssemblySpine,contextDeliveryIdFor} from '../../src/assembly/index.js';
import {effectFixture} from './production-grounding-adjudication-owner-fixture.js';
import {value,json} from './astra-production-grounding-fixture.js';
import {privateKey} from '../facts/fixtures.js';
import {assemblyInput} from '../assembly/fixture.js';
const result=(r:any):any=>consumeResult(r,{Success:value=>({accepted:true,value}),Refused:r=>({accepted:false,detail:r.detail})});
function realDelivery(purpose: 'ordinary-reply' | 'context-delivery' = 'context-delivery'){
 const f=effectFixture(undefined, 'executor:1', {}, purpose),q=f.prepare();
 // Let Eight author its real dispatch validation, then cut after Six issues its
 // exact live capability, before Eight handoff. No synthetic owner rows.
 let liveClaim:any;
 const preparing=createEffectDoorway({...f.composition,transport:{...f.transport,
  claim:(...args:any[])=>{liveClaim=value((f.transport.claim as any)(...args));throw Error('cut after real claim issuance');}}});
 expect(result(preparing.dispatch(q,f.fence))).toMatchObject({accepted:false});
 expect(liveClaim).toBeDefined();expect(f.calls()).toBe(0);
 const claim=value(f.transport.inspect()).filter((r:any)=>r.record.type==='AdmissionReservation').at(-1)!;
 expect(claim.record.state).toBe('dispatch-claimed');
 const spine=createAssemblySpine(f.assemblyHost,{context:f.ctx,privateKey},f.store),runtime=createAssemblyRuntime({host:f.assemblyHost,spine} as any);
 const capture=value(f.host.capture(value(canonical(f.message)).bytes));expect(capture.hash).toBe(q.digest);
 const intake=value(authorAndAppend({kind:'review-intake',schemaVersion:1,machine:f.host.machine,principal:json(f.host.principal),provenance:json(f.host.principal.provenance),at:json(f.now),body:json({capture}),required:[]},f.ctx,f.store,privateKey)).fact;
 const launch=value(runtime.record('HarnessLaunchSpec',{...assemblyInput('HarnessLaunchSpec'),run:f.run.id,input:intake.id,inputDigest:capture.hash,incarnation:f.host.incarnation}));
 const launchFact=value(runtime.inspect()).find(r=>r.record.id===launch.id)!.fact;
 const lease=value(f.transport.inspect()).find((r:any)=>r.record.type==='Lease')!.fact;
 const spec={type:'ContextDeliverySpecification',schemaVersion:1,id:contextDeliveryIdFor(launchFact.id,claim.record.operation),predecessors:[],dependencyFacts:[],launch:launchFact.id,run:launch.run,step:'step:actual',input:intake.id,inputDigest:capture.hash,incarnation:launch.incarnation,harness:launch.harness,artifactDigest:launch.artifactDigest,machine:launch.machine,generation:f.host.current().decode.register.generation.id,executionContext:lease.id,contextManifest:[{class:'message',reference:capture.reference,digest:capture.hash}],reason:'initial',operation:claim.record.operation,claim:claim.fact.id,previousDelivery:'',controlObservation:''};
 return {f,runtime,spine,spec,liveClaim,q,reservation:claim.record};
}

it('Q7 F2 real Six consumed authority prevents driver invocation from its old specification',()=>{
 const {f,runtime,spine,spec,liveClaim}=realDelivery();const admitted=value(runtime.recordContextDelivery(spec));
 value(f.transport.consume(liveClaim,f.fence));
 expect(result(runtime.recordContextDelivery(spec))).toMatchObject({accepted:false});
 const history:any={owner:'part-ten',current:()=>runtime.inspectCurrent(),resolve:(r:any)=>runtime.resolve(r),resolveContextDelivery:(r:any)=>runtime.resolve(r),lookup:(id:string)=>{
  const snap=value(f.store.readForProjection()),a=value(runtime.inspectCurrent()).find(r=>r.fact.id===id||r.record.id===id),s=snap.entries.find(r=>r.fact.id===(a?.fact.id??id));
  return f.success(s?{fact:s.fact,...(a?{record:a.record}:{}),taint:s.taint,conflicts:[...s.conflicts,...(a?.conflicts??[])],completeness:'complete'}:null);
 }};
 let calls=0;
 const driver=createConfinedContextDeliveryDriver({history,runtime,context:f.host.boundary,clock:()=>100,
  liveProcess:{owner:'part-ten',resolve:(l:any)=>f.success({launch:l.id,run:l.run,incarnation:l.incarnation,harness:l.harness,artifactDigest:l.artifactDigest,machine:l.machine,processIdentity:'pid:42:start:1'})},
  execution:{owner:'part-eight',deliver:()=>{calls++;throw Error('invocation must be barred')},observe:()=>{throw Error('unused')}}});
 expect(result(driver.deliver(admitted,{operation:admitted.operation,claim:admitted.claim}))).toMatchObject({accepted:false});
 expect(calls).toBe(0);
},30000);
it('Q8 F2 ordinary reply effect does not authorize harness context delivery',()=>{
 const {f,runtime,spec}=realDelivery('ordinary-reply');expect(f.message.purpose).toBe('ordinary-reply');
 expect(result(runtime.recordContextDelivery(spec))).toMatchObject({accepted:false});
},30000);

function driverFor(x:ReturnType<typeof realDelivery>,runtime=x.runtime,entry?:()=>never) {
 const {f}=x;
 const history:any={owner:'part-ten',current:()=>x.runtime.inspectCurrent(),resolve:(r:any)=>x.runtime.resolve(r),resolveContextDelivery:(r:any)=>x.runtime.resolve(r),lookup:(id:string)=>{
  const snap=value(f.store.readForProjection()),a=value(x.runtime.inspectCurrent()).find(r=>r.fact.id===id||r.record.id===id),s=snap.entries.find(r=>r.fact.id===(a?.fact.id??id));
  return f.success(s?{fact:s.fact,...(a?{record:a.record}:{}),taint:s.taint,conflicts:[...s.conflicts,...(a?.conflicts??[])],completeness:'complete'}:null);
 }};
 // A fresh Eight doorway discards its process-local accepted/active maps.
 // Six authority and signed durable store remain the owner of one-use permission.
 const eight=createEffectDoorway(f.composition);
 return createConfinedContextDeliveryDriver({history,runtime,context:f.host.boundary,clock:()=>100,
  liveProcess:{owner:'part-ten',resolve:(l:any)=>f.success({launch:l.id,run:l.run,incarnation:l.incarnation,harness:l.harness,artifactDigest:l.artifactDigest,machine:l.machine,processIdentity:'pid:42:start:1'})},
  execution:{owner:'part-eight',deliver:()=>{
   if(entry) return entry();
   const observation=value(eight.handoff(x.q,x.reservation,x.liveClaim,f.fence));
   const signed=value(eight.inspect()).find(r=>r.record.id===observation.id)!;
   return f.success(signed.fact.id);
  },observe:()=>{throw Error('unused')}}});
}
it('R2 F2 restart after invoke before acceptance append must not invoke again',()=>{
 const x=realDelivery(),s=value(x.runtime.recordContextDelivery(x.spec)),counter={calls:0};
 x.f.onInvoke(()=>{counter.calls++;});
 let cuts=0;
 const broken={...x.runtime,record:()=>{cuts++;throw Error('cut after external invoke before acceptance append')}};
 const first=driverFor(x,broken);expect(result(first.deliver(s,{operation:s.operation,claim:s.claim}))).toMatchObject({accepted:false});
 expect(counter.calls).toBe(1);expect(cuts).toBe(1);
 expect(value(x.f.transport.inspect()).filter(r=>r.record.type==='AdmissionReservation').at(-1)!.record.state).toBe('consumed');
 const second=driverFor(x,broken);second.deliver(s,{operation:s.operation,claim:s.claim});expect(counter.calls).toBe(1);
},30000);
it('R3 F2 a consumed claim in current history must prevent delivery using its older dispatch-claimed row',()=>{
 const x=realDelivery(),s=value(x.runtime.recordContextDelivery(x.spec));
 value(x.f.transport.consume(x.liveClaim,x.f.fence));
 let calls=0;const driver=driverFor(x,x.runtime,()=>{calls++;throw Error('invocation must be barred')});
 expect(result(driver.deliver(s,{operation:s.operation,claim:s.claim}))).toMatchObject({accepted:false});expect(calls).toBe(0);
 expect(x.f.calls()).toBe(0);
},30000);
it('R8 F2 real Six admitted operation identity must be accepted as the specification operation',()=>{
 const {f,runtime,spec}=realDelivery();expect(f.message.purpose).toBe('context-delivery');
 const actual=result(runtime.recordContextDelivery(spec));expect(actual,JSON.stringify(actual)).toMatchObject({accepted:true});
},30000);

// @ts-nocheck -- authoritative review assertions; adjudicated real-owner prerequisite translation.
import { vi } from 'vitest'; vi.setConfig({ testTimeout: 120000 });
import '../assembly/production-grounding-evidence.mjs';
import {ten as originalTen} from './astra-rereview-ten-fixture.js';
import {it,expect} from 'vitest';
import {consumeResult,canonical} from '../../src/index.js';
import {authorAndAppend} from '../../src/facts/index.js';
import {createRunGraph,registerProductionGroundingReader,registerProductionGroundedGraph} from '../../src/rungraph/index.js';
import {createConfinedContextDeliveryDriver,createNativeHarnessAdapter,createAssemblyRuntime,createAssemblySpine,bootProductionAssembly,contextDeliveryIdFor} from '../../src/assembly/index.js';
import {realTenFixture as ten} from '../assembly/real-context-delivery-fixture.js';
import {paired,setup,value,ref,json,digest,executeInitialLiveInputLifecycle} from './astra-production-grounding-fixture.js';
import {effectFixture} from './production-grounding-adjudication-owner-fixture.js';
import {privateKey} from '../facts/fixtures.js';
import {assemblyInput} from '../assembly/fixture.js';
import {assemblyRuntimeFixture} from '../assembly/round8-extended-fixture.js';
import {installProduction,productionBindingSet,productionComposition} from '../assembly/production-fixture.js';
const result=(r:any):any=>consumeResult(r,{Success:value=>({accepted:true,value}),Refused:r=>({accepted:false,detail:r.detail})});
function makeDriver(f:any,runtime=f.runtime,counter={calls:0}) {
 return {counter,driver:createConfinedContextDeliveryDriver({history:f.history,runtime,context:f.c,clock:()=>100,
 liveProcess:{owner:'part-ten',resolve:(l:any)=>f.success({launch:l.id,run:l.run,incarnation:l.incarnation,harness:l.harness,artifactDigest:l.artifactDigest,machine:l.machine,processIdentity:'pid:42:start:1'})},
 execution:{owner:'part-eight',deliver:()=>{counter.calls++;return f.success(f.evidence.id)},observe:()=>f.success({phase:'context-consumed',evidence:f.evidence.id,detail:'consumed'})}})};
}
it('R1 F2 kind-labelled substitute schemas must not qualify as owner admitted evidence',()=>{
 const f=originalTen();expect((f.ctx.ownedBodies??[]).some((x:any)=>x.owner==='part-eight')).toBe(false);
 expect(result(f.runtime.recordContextDelivery(f.spec()))).toMatchObject({accepted:false});
});
it('R4 F8 marked production boot must refuse a flat graph even after public registration',()=>{
 const f=assemblyRuntimeFixture(),binding={...productionBindingSet(),productionGrounding:{implementation:'context-delivery-v1' as const}};
 const installed=installProduction(f,binding),p=productionComposition(f,installed.binding),old=setup();
 const ready=value(old.graph.open(old.run)),flat=value(old.graph.ground(old.id,'w','h','start',old.lease));expect(flat.kind).toBe('session-grounding');
 const graph=registerProductionGroundedGraph(old.graph),production={...p,productionGrounding:{owner:'part-ten' as const,implementation:'context-delivery-v1' as const},run:{...p.run,port:graph}};
 expect(result(bootProductionAssembly({...f.composition,production},installed.manifest.id,installed.binding.scope))).toMatchObject({accepted:false});
});
it('R5 F9 contract map must refuse named passing titles when the named behavior failed',async()=>{
 const {checkProductionGroundingAssemblyEvidence}=await import('../../scripts/check-assembly-contracts.mjs');
 const rows=[['assembly','PG-P10-SIGNED-DELIVERY PG-P10-TYPED-REFUSALS'],['integration','PG-INTEGRATION-PRODUCTION-BINDING'],['e2e','PG-E2E-INITIAL-LIVE-REPLAY']];
 const report={success:true,testResults:rows.map(([tier,name])=>({name:`${process.cwd()}/tests/${tier}/production-grounding.test.ts`,assertionResults:[{fullName:name+' placeholder',status:'passed'}]}))};
 expect(()=>checkProductionGroundingAssemblyEvidence(report)).toThrow();
});
it('R6 F1 signed native observation reconstructs without local delivery or launch maps',()=>{
 const f=ten(),s=value(f.runtime.recordContextDelivery(f.spec())),accepted=value(f.driver.deliver(s,{operation:s.operation,claim:s.claim}));
 const fresh=createNativeHarnessAdapter({id:'native',artifact:f.launch.artifactDigest,platform:'fixture',conformance:'fixture',context:{...f.c,history:f.history},clock:()=>100,generation:()=>s.generation,contextDeliveryDriver:f.driver,
 driver:{owner:'part-eight',launch:()=>{throw Error('must not relaunch')},deliver:()=>{throw Error('must not use legacy deliver')},observe:()=>{throw Error('must not use legacy observe')}}});
 expect(result(fresh.observe({launch:s.launch,delivery:accepted.id,operation:s.operation}))).toMatchObject({accepted:true,value:{phase:'context-consumed'}});expect(f.calls()).toBe(1);
});
it('R7 positive initial and genuinely second inbound both start while incarnation and launch stay unchanged',()=>{
 const f=executeInitialLiveInputLifecycle();expect(f.secondRunning.state).toBe('running');expect(f.last.spec.incarnation).toBe(f.first.spec.incarnation);expect(f.last.spec.launch).toBe(f.first.spec.launch);
 expect(f.last.spec.input).not.toBe(f.first.spec.input);expect(f.last.spec.step).not.toBe(f.first.spec.step);expect(f.last.spec.previousDelivery).toBe(f.first.sf.id);
});
it('R9 F7 a raw signed predecessor skip must be refused on replay resolution',async()=>{
 const {decodeAssemblyRecord}=await import('../../src/assembly/index.js');
 const f=ten(),a=value(f.runtime.recordContextDelivery(f.spec())),af=value(f.runtime.inspect()).find(r=>r.record.id===a.id)!.fact;
 const op2=f.next('second').operation;value(f.runtime.recordContextDelivery(f.spec('live-input',op2.id,af.id)));
 const op3=f.next('third').operation,skip=value(decodeAssemblyRecord('ContextDeliverySpecification',f.spec('live-input',op3.id,af.id),{...f.c,validateReferences:false}));
 value(f.spine.append(skip));expect(result(f.runtime.resolve(skip))).toMatchObject({accepted:true,value:{admitted:false}});
});
it('R10 F1 repeated consumed observation after restart at a later clock must remain readable',()=>{
 const f=ten(),s=value(f.runtime.recordContextDelivery(f.spec()));value(f.driver.deliver(s,{operation:s.operation,claim:s.claim}));value(f.driver.observe(s,s.operation));f.setClock(101);
 const driver=createConfinedContextDeliveryDriver({history:f.history,runtime:f.runtime,context:f.c,clock:()=>101,
 liveProcess:{owner:'part-ten',resolve:l=>f.success({launch:l.id,run:l.run,incarnation:l.incarnation,harness:l.harness,artifactDigest:l.artifactDigest,machine:l.machine,processIdentity:'pid:42:start:1'})},
 execution:{owner:'part-eight',deliver:()=>{throw Error('must not invoke')},observe:()=>f.success({phase:'context-consumed',evidence:f.evidence.id,detail:'witness'})}});
 const actual=result(driver.observe(s,s.operation));expect(actual,JSON.stringify(actual)).toMatchObject({accepted:true});
});

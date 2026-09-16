// @ts-nocheck -- independently authored Astra executable cases are retained verbatim in runtime shape.
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createRunGraph, registerProductionGroundingReader } from '../../src/rungraph/index.js';
import { createAssemblyRuntime, createAssemblySpine, createConfinedContextDeliveryDriver, createProductionGroundingReader, createNativeHarnessAdapter, contextDeliveryIdFor, decodeAssemblyRecord } from '../../src/assembly/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { privateKey } from '../facts/fixtures.js';
import { executeInitialLiveInputLifecycle, paired, setup, value, json, ref, digest } from './astra-production-grounding-fixture.js';
const result = (r:any):any => consumeResult(r,{Success:v=>({accepted:true,value:v}),Refused:r=>({accepted:false,detail:r.detail})});
function ten() {
 const text={kind:'text' as const,maxLength:2048};
 const f=setup(undefined,undefined,{fields:{intent:{kind:'constitutional',type:'Intent'},owner:{kind:'constitutional',type:'VerifiedPrincipal'},capture:{kind:'capture'}},extra:{
  'effect-OperationDefinition':{id:text},'transport-AdmissionReservation':{operation:text,state:text,digest:text,run:text},
  'transport-Lease':{run:text,incarnation:text},'effect-OperationObservation':{operation:text,claim:text,digest:text,run:text,input:text,stage:text},
  'rungraph-briefing-material':{class:text},
 },body:({intent,owner,hash})=>json({intent,owner,capture:{reference:'message:1',hash}})});
 const spine=createAssemblySpine(f.assemblyHost,{context:f.ctx,privateKey},f.store);
 const runtime=createAssemblyRuntime({host:f.assemblyHost,spine} as any);
 const history:any={owner:'part-ten',current:()=>runtime.inspectCurrent(),lookup:(id:string)=>{const snap=value(f.store.readForProjection());const a=value(runtime.inspectCurrent()).find(r=>r.fact.id===id||r.record.id===id);const s=snap.entries.find(r=>r.fact.id===(a?.fact.id??id));return f.success(s?{fact:s.fact,...(a?{record:a.record}:{}),taint:s.taint,conflicts:[...s.conflicts,...(a?.conflicts??[])],completeness:'complete'}:null)},resolve:(r:any)=>runtime.resolve(r),resolveContextDelivery:(r:any)=>runtime.resolve(r)};
 const typed=(label:string)=>{const operation=f.append('effect-OperationDefinition',json({id:`operation:${label}`})).fact;const claim=f.append('transport-AdmissionReservation',json({operation:operation.id,state:'dispatch-claimed',digest:f.ctx.captures['message:1']!.hash,run:f.id})).fact;return{operation,claim}};
 const first=typed('first'),execution=f.append('transport-Lease',json({run:f.id,incarnation:'incarnation:one'})).fact;
 const accepted=f.append('effect-OperationObservation',json({operation:first.operation.id,claim:first.claim.id,digest:f.ctx.captures['message:1']!.hash,run:f.id,input:f.opening.id,stage:'executor-accepted'})).fact;
 const consumed=f.append('effect-OperationObservation',json({operation:first.operation.id,claim:first.claim.id,digest:f.ctx.captures['message:1']!.hash,run:f.id,input:f.opening.id,stage:'response'})).fact;
 const launch=value(runtime.record('HarnessLaunchSpec',{...assemblyInput('HarnessLaunchSpec'),id:'typed-launch',run:f.id,step:'launch-step',input:f.opening.id,inputDigest:f.ctx.captures['message:1']!.hash,incarnation:'incarnation:one',harness:'native',processOperation:first.operation.id}));
 const launchFact=value(runtime.inspect()).find(r=>r.record.id===launch.id)!.fact;
 const specs=new Map([[first.operation.id,first.claim.id]]);
 const spec=(reason='initial',operation=first.operation.id,previousDelivery='')=>{const claim=specs.get(operation)!;return({type:'ContextDeliverySpecification',schemaVersion:1,id:contextDeliveryIdFor(launchFact.id,operation),predecessors:[],dependencyFacts:[],launch:launchFact.id,run:launch.run,step:'step:next',input:f.opening.id,inputDigest:f.ctx.captures['message:1']!.hash,incarnation:launch.incarnation,harness:launch.harness,artifactDigest:launch.artifactDigest,machine:launch.machine,generation:'generation:fixture',executionContext:execution.id,contextManifest:[{class:'message',reference:'message:1',digest:f.ctx.captures['message:1']!.hash}],reason,operation,claim,previousDelivery,controlObservation:''})};
 let calls=0;
 const driver=createConfinedContextDeliveryDriver({history,runtime,context:f.c,clock:()=>100,liveProcess:{owner:'part-ten',resolve:l=>f.success({launch:l.id,run:l.run,incarnation:l.incarnation,harness:l.harness,artifactDigest:l.artifactDigest,machine:l.machine,processIdentity:'pid:42:start:1'})},execution:{owner:'part-eight',deliver:()=>{calls++;return f.success(accepted.id)},observe:()=>f.success({phase:'context-consumed',evidence:consumed.id,detail:'witness'})}});
 const next=(label:string)=>{const pair=typed(label);specs.set(pair.operation.id,pair.claim.id);return pair};
 return {...f,runtime,spine,launch,launchFact,evidence:consumed,history,spec,driver,next,calls:()=>calls};
}
it('V1 accepts a signed current initial specification',()=>{const f=ten();expect(result(f.runtime.recordContextDelivery(f.spec())).accepted).toBe(true)});
it('V2 accepts valid spec delivery through the real recorder',()=>{const f=ten();const s=value(f.runtime.recordContextDelivery(f.spec()));const actual=result(f.driver.deliver(s,{operation:s.operation,claim:s.claim}));expect(actual,JSON.stringify(actual)).toMatchObject({accepted:true});expect(f.calls()).toBe(1)});
it('V3 refuses a second invocation after acceptance append fails',()=>{const f=ten();const s=value(f.runtime.recordContextDelivery(f.spec()));f.driver.deliver(s,{operation:s.operation,claim:s.claim});f.driver.deliver(s,{operation:s.operation,claim:s.claim});expect(f.calls()).toBe(1)});
it('V4 refuses ordinary evidence substituted for admitted operation and one-use claim',()=>{const f=ten();const ordinary=f.append('note',json({identity:'ordinary',amount:'0'})).fact;expect(result(f.runtime.recordContextDelivery({...f.spec(),operation:ordinary.id,claim:ordinary.id}))).toMatchObject({accepted:false})});
it('V5 PG-P5-INVOKED-READ signed-history graph control accepts ground then start and zero pending before start',()=>{const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));expect(value(f.graph.read(f.id)).pending).toHaveLength(0);expect(value(f.graph.transition(f.start(f.ready,g))).pending).toHaveLength(1)});
it('V6 refuses pre-completed grounding even within the same clock tick',()=>{const f=paired();const cached=value(f.read({run:f.ready,worker:'w',harness:'h',reason:'start',execution:value(f.deps.admission.execution(f.id,f.lease))}));expect(result(createRunGraph({...f.deps,grounding:{owner:'part-ten',production:true,read:()=>f.success(cached)}} as any))).toMatchObject({accepted:false})});
it('V7 refuses future-reported consumption',()=>{const f=paired();f.setMutation((s,o)=>o.observedAt=100000);expect(result(f.graph.ground(f.id,'w','h','start',f.lease))).toMatchObject({accepted:false})});
it('V8 PG-P5-SOURCE-REFUSALS refuses input digest substitution',()=>{const f=paired();f.setMutation(s=>s.inputDigest=digest('not input'));expect(result(f.graph.ground(f.id,'w','h','start',f.lease))).toMatchObject({accepted:false})});
it('V9 refuses unresolvable briefing-reference substitution',()=>{const f=paired();f.setMutation(s=>s.contextManifest[1].reference='missing:briefing');expect(result(f.graph.ground(f.id,'w','h','start',f.lease))).toMatchObject({accepted:false})});
it('V10 refuses an ordinary note as context-consumption boundary proof',()=>{const f=paired();const note=f.append('note',json({identity:'not-consumption',amount:'0'})).fact;f.setMutation((_s,o)=>{o.boundaryEvidence=note.id;o.sourceEvidence=[note.id]});expect(result(f.graph.ground(f.id,'w','h','start',f.lease))).toMatchObject({accepted:false})});
it('V11 historical start remains readable after its observation freshness expires',()=>{const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));value(f.graph.transition(f.start(f.ready,g)));f.setClock(1200);const actual=result(f.graph.read(f.id));expect(actual,JSON.stringify(actual)).toMatchObject({accepted:true})});
it('V12 refuses stale context at actual start',()=>{const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));f.setClock(1200);expect(result(f.graph.transition(f.start(f.ready,g)))).toMatchObject({accepted:false})});
it('V13 refuses observation step differing from candidate',()=>{const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));const t=f.start(f.ready,g);expect(result(f.graph.transition({...t,step:{...t.step,id:'wrong-step'}}))).toMatchObject({accepted:false})});
it('V14 refuses newer unaccounted inbound at start',()=>{const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));f.append('stimulus',f.opening.body);expect(result(f.graph.transition(f.start(f.ready,g)))).toMatchObject({accepted:false})});
it('V15 refuses omitted message manifest row',()=>{const f=paired();f.setMutation((s,o)=>{s.contextManifest.shift();o.contextDigests=s.contextManifest.map(r=>r.digest)});expect(result(f.graph.ground(f.id,'w','h','start',f.lease))).toMatchObject({accepted:false})});
it('V16 refuses duplicate manifest row',()=>{const f=paired();f.setMutation((s,o)=>{s.contextManifest.push({...s.contextManifest[0]});o.contextDigests=s.contextManifest.map(r=>r.digest)});expect(()=>value(f.graph.ground(f.id,'w','h','start',f.lease))).toThrow()});
it('V17 refuses wrong-run delivery',()=>{const f=paired();f.setMutation(s=>s.run='other-run');expect(()=>value(f.graph.ground(f.id,'w','h','start',f.lease))).toThrow()});
it('V18 refuses context delivery from another incarnation',()=>{const f=paired();f.setMutation(s=>s.incarnation='other-incarnation');expect(()=>value(f.graph.ground(f.id,'w','h','start',f.lease))).toThrow()});
it('V19 refuses production flat receipt fallback',()=>{const f=paired();expect(result(createRunGraph({...f.deps,grounding:{...setup().deps.grounding,production:true}} as any))).toMatchObject({accepted:false})});
it('V20 cut after grounding reconstructs zero pending steps with a fresh store',()=>{const f=paired();value(f.graph.ground(f.id,'w','h','start',f.lease));const store=createFactStore(f.ctx,{owner:'part-ten',read:()=>JSON.parse(JSON.stringify(f.wire)),append:()=>{throw Error('read-only')}});const graph=value(createRunGraph({...f.deps,store}));expect(value(graph.read(f.id)).pending).toHaveLength(0)});
it('V21 refuses predecessor skip after a second delivery',()=>{const f=ten();const a=value(f.runtime.recordContextDelivery(f.spec()));const af=value(f.runtime.inspect()).find(r=>r.record.id===a.id)!.fact;const op2=f.next('second').operation;value(f.runtime.recordContextDelivery(f.spec('live-input',op2.id,af.id)));const op3=f.next('third').operation;expect(result(f.runtime.recordContextDelivery(f.spec('live-input',op3.id,af.id)))).toMatchObject({accepted:false})});
it('V22 accepts unchanged incarnation for a second live-input specification',()=>{const f=ten();const a=value(f.runtime.recordContextDelivery(f.spec()));const af=value(f.runtime.inspect()).find(r=>r.record.id===a.id)!.fact;const op=f.next('second').operation;const b=value(f.runtime.recordContextDelivery(f.spec('live-input',op.id,af.id)));expect(b.incarnation).toBe(a.incarnation);expect(b.id).not.toBe(a.id)});
it('V23 native reader accepts a real signed launch and context-delivery record',()=>{
 const f=ten();const events:string[]=[];
 const harness=createNativeHarnessAdapter({id:'native',artifact:f.launch.artifactDigest,platform:'test',conformance:'test',context:{...f.c,history:f.history},clock:()=>100,generation:()=> 'generation:fixture',contextDeliveryDriver:f.driver,driver:{owner:'part-eight',launch:()=>f.success('pid:42:start:1'),deliver:()=>{throw Error('legacy deliver forbidden')},observe:()=>{throw Error('legacy observe forbidden')}}});
 value(harness.launch(f.launch,f.launch.processOperation,'launch-claim'));
 const reader=createProductionGroundingReader({runtime:f.runtime,harness,clock:()=>{events.push('clock');return f.clock(100)},context:f.c,sample:()=>{events.push('sample');return f.success({specification:f.spec(),grounding:(consumption:any)=>({at:f.clock(100),step:'step:next',incarnation:f.launch.incarnation,contextDeliveryReason:'initial',consumption})})}});
 const actual=result(reader.read({run:{} as any,worker:'w',harness:'h',reason:'start',execution:{} as any}));
 expect(actual,JSON.stringify(actual)).toMatchObject({accepted:true});expect(events).toEqual(['clock','sample']);expect(f.calls()).toBe(1);
});
it('V24 refuses copied body paired with another signed observation envelope at start',()=>{
 const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));const first=f.last();
 f.setMutation((s:any)=>{s.reason='live-input';s.previousDelivery=first.sf.id});
 value(f.read({run:f.ready,worker:'w',harness:'h',reason:'start',execution:value(f.deps.admission.execution(f.id,f.lease))}));const second=f.last();
 const h={...f.history,lookup:(id:string)=>{const row=value(f.history.lookup(id));return f.success(id===first.of.id?{...row,record:second.observation}:row)}};
 const graph=value(createRunGraph({...f.deps,assemblyHistory:h}));expect(result(graph.transition(f.start(f.ready,g)))).toMatchObject({accepted:false});
});
it.each(['missing','wrong-kind','partial','tainted','conflicted'] as const)('V25-%s refuses changed observation evidence at start',mode=>{
 const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));const first=f.last();
 const h={...f.history,lookup:(id:string)=>{let r:any=value(f.history.lookup(id));if(id===first.of.id){if(mode==='missing')r=null;if(mode==='wrong-kind')r={...r,fact:{...r.fact,kind:'note'}};if(mode==='partial')r={...r,completeness:'partial'};if(mode==='tainted')r={...r,taint:['redacted']};if(mode==='conflicted')r={...r,conflicts:[{kind:'immutable-disagreement',key:'x',facts:[id],detail:'conflict'}]};}return f.success(r)}};
 const graph=value(createRunGraph({...f.deps,assemblyHistory:h}));expect(result(graph.transition(f.start(f.ready,g)))).toMatchObject({accepted:false});
});
it('V26 accepts fresh current execution context bound to delivery rather than old launch',()=>{
 const f=paired();f.place('w','h');expect(result(f.graph.ground(f.id,'w','h','start',f.lease))).toMatchObject({accepted:true});
});
it('V27 initial and second distinct inbound can both start on one incarnation',()=>{
 const actual=executeInitialLiveInputLifecycle();expect(actual.secondRunning.state).toBe('running');
 expect(actual.last.spec.incarnation).toBe(actual.first.spec.incarnation);
},30_000);
it('V30 assembly contract map refuses a report with only token titles and no named refusal assertions',async()=>{
 const {checkProductionGroundingAssemblyEvidence}=await import('../../scripts/check-assembly-contracts.mjs');
 const report={success:true,testResults:['assembly','integration','e2e'].map(tier=>({name:`${process.cwd()}/tests/${tier}/placeholder.test.ts`,assertionResults:[{fullName:'PRODUCTION-GROUNDING placeholder',status:'passed'}]}))};
 expect(()=>checkProductionGroundingAssemblyEvidence(report)).toThrow();
});
it('V31 production boot refuses a real graph that accepts only flat compatibility receipts',async()=>{
 const {installProduction,productionComposition}=await import('../assembly/production-fixture.js');const {bootProductionAssembly}=await import('../../src/assembly/index.js');
 const f=assemblyRuntimeFixture();const binding={...((await import('../assembly/production-fixture.js')).productionBindingSet()),productionGrounding:{implementation:'context-delivery-v1' as const}};const installed=installProduction(f,binding);const p=productionComposition(f,installed.binding);const old=setup();const production={...p,productionGrounding:{owner:'part-ten' as const,implementation:'context-delivery-v1' as const},run:{...p.run,port:old.graph}};
 expect(result(bootProductionAssembly({...f.composition,production},installed.manifest.id,installed.binding.scope))).toMatchObject({accepted:false});
});
it('V32 refuses retimestamped pre-completed grounding against a previously signed future receipt',()=>{
 const f=paired();f.setMutation((s,o)=>o.observedAt=101);
 const raw:any=value(f.read({run:f.ready,worker:'w',harness:'h',reason:'start',execution:value(f.deps.admission.execution(f.id,f.lease))}));f.setClock(101);const at=f.deps.clock();const cached={...raw,at,previousActivity:at,elapsed:{...raw.elapsed,at}};
 expect(result(createRunGraph({...f.deps,grounding:{owner:'part-ten',production:true,read:()=>f.success(cached)}} as any))).toMatchObject({accepted:false});
});
it('V33 refuses stale generation in the delivery specification',()=>{const f=paired();f.setMutation((s,o)=>{s.generation='generation:stale';o.generation=s.generation});expect(result(f.graph.ground(f.id,'w','h','start',f.lease))).toMatchObject({accepted:false})});
it('V34 refuses non-consumed phase',()=>{const f=paired();f.setMutation((s,o)=>o.phase='input-accepted');expect(result(f.graph.ground(f.id,'w','h','start',f.lease))).toMatchObject({accepted:false})});
it('V35 refuses unresolvable boundary evidence',()=>{const f=paired();f.setMutation((s,o)=>o.boundaryEvidence='missing:boundary');expect(result(f.graph.ground(f.id,'w','h','start',f.lease))).toMatchObject({accepted:false})});
it('V36 refuses equal delivery identity with differing content',()=>{const f=ten();const first=value(f.runtime.recordContextDelivery(f.spec()));expect(result(f.runtime.recordContextDelivery({...first,inputDigest:digest('changed')}))).toMatchObject({accepted:false})});
it('V37 refuses changed live process immediately before delivery',()=>{const f=ten();const spec=value(f.runtime.recordContextDelivery(f.spec()));let calls=0;const driver=createConfinedContextDeliveryDriver({history:f.history,runtime:f.runtime,context:f.c,clock:()=>100,liveProcess:{owner:'part-ten',resolve:l=>f.success({launch:l.id,run:l.run,incarnation:'reused-pid-incarnation',harness:l.harness,artifactDigest:l.artifactDigest,machine:l.machine,processIdentity:'pid:42:start:2'})},execution:{owner:'part-eight',deliver:()=>{calls++;return f.success(f.evidence.id)},observe:()=>{throw Error('unused')}}});expect(result(driver.deliver(spec,{operation:spec.operation,claim:spec.claim}))).toMatchObject({accepted:false});expect(calls).toBe(0)});
it('V38 refuses adapter-authored spec mutation before invoking',()=>{const f=ten();const spec=value(f.runtime.recordContextDelivery(f.spec()));expect(result(f.driver.deliver({...spec,inputDigest:digest('adapter-altered')},{operation:spec.operation,claim:spec.claim}))).toMatchObject({accepted:false});expect(f.calls()).toBe(0)});
it('V39 accepts an initial specification after a durable record cut without another identity',async()=>{
 const f=ten(),candidate=f.spec(),s=value(f.runtime.recordContextDelivery(candidate));
 const store=createFactStore(f.ctx,{owner:'part-ten',read:()=>JSON.parse(JSON.stringify(f.wire)),append:()=>{throw Error('unexpected second append')}});
 const spine=createAssemblySpine(f.assemblyHost,{context:f.ctx,privateKey},store);const runtime=createAssemblyRuntime({host:f.assemblyHost,spine} as any);
 expect(value(runtime.recordContextDelivery(candidate))).toEqual(s);expect(value(runtime.inspect()).filter(r=>r.record.id===s.id)).toHaveLength(1);
});
it('V40 cut immediately before start append leaves zero newly pending steps',()=>{
 const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));const graph=value(createRunGraph({...f.deps,writer:{owner:'part-ten',append:()=>{throw Error('cut-before-append')}}}));expect(result(graph.transition(f.start(f.ready,g)))).toMatchObject({accepted:false});expect(value(value(createRunGraph(f.deps)).read(f.id)).pending).toHaveLength(0);
});
it('V41 cut immediately after durable start append reconstructs one step without another transition',()=>{
 const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));const graph=value(createRunGraph({...f.deps,admission:{...f.deps.admission,commit:(request:any,write:any)=>{value(f.deps.admission.commit(request,write));throw Error('cut-after-append')}}}));expect(result(graph.transition(f.start(f.ready,g)))).toMatchObject({accepted:false});const restarted=value(createRunGraph(f.deps));expect(value(restarted.read(f.id)).pending).toHaveLength(1);expect(value(restarted.transition(f.start(f.ready,g))).pending).toHaveLength(1);expect(value(f.store.read()).filter(r=>r.kind==='run-transition')).toHaveLength(1);
});
it('V42 signed fact reference accepts an observation while the specification payload alias refuses',()=>{
 const f=ten();const s=value(f.runtime.recordContextDelivery(f.spec()));const sf=value(f.runtime.inspect()).find(r=>r.record.id===s.id)!.fact;
 const o={type:'HarnessObservation',schemaVersion:1,id:'explicit-observation',predecessors:[],dependencyFacts:[sf.id],launch:s.launch,run:s.run,step:s.step,input:s.input,incarnation:s.incarnation,contextDelivery:sf.id,sourceEvidence:[f.evidence.id],contextDigests:s.contextManifest.map(r=>r.digest),generation:s.generation,causalReferences:[f.evidence.id],observedAt:100,freshFor:1000,phase:'context-consumed',boundaryEvidence:f.evidence.id,detail:'boundary'};
 expect(result(f.runtime.record('HarnessObservation',{...o,contextDelivery:s.id}))).toMatchObject({accepted:false});expect(result(f.runtime.record('HarnessObservation',o))).toMatchObject({accepted:true});
});
it('V43 start re-resolves a newly appended real signed specification conflict',()=>{
 const f=paired();const g=value(f.graph.ground(f.id,'w','h','start',f.lease));const previous=f.last();
 const changed=value(decodeAssemblyRecord('ContextDeliverySpecification',{...previous.spec,inputDigest:digest('conflicting signed bytes')},{...f.c,validateReferences:false}));
 value(f.spine.append(changed));
 expect(value(f.runtime.inspectCurrent()).filter(r=>r.record.type==='ContextDeliverySpecification').every(r=>r.conflicts.length>0)).toBe(true);
 expect(result(f.graph.transition(f.start(f.ready,g)))).toMatchObject({accepted:false});
});

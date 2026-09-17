// @ts-nocheck -- authoritative review assertions; adjudicated real-owner prerequisite translation.
import { vi } from 'vitest'; vi.setConfig({ testTimeout: 120000 });
import '../assembly/production-grounding-evidence.mjs';
import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { consumeResult } from '../../src/index.js';
import * as five from '../../src/rungraph/index.js';
import * as tenPublic from '../../src/assembly/index.js';
import { createProductionGroundingReader, bootProductionAssembly } from '../../src/assembly/index.js';
import { paired, setup, value } from './astra-production-grounding-fixture.js';
import { ten } from './counterfeit-context-fixture.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { installProduction, productionBindingSet, productionComposition } from '../assembly/production-fixture.js';
const result=(r:any):any=>consumeResult(r,{Success:value=>({accepted:true,value}),Refused:r=>({accepted:false,detail:r.detail})});
for (const later of [false,true]) it(`Q${later?2:1} F3 public Ten factory refuses ${later?'retimestamped':'same-tick'} completed receipt from a replaying adapter`,()=>{
 const f=paired();if(later) f.setMutation((_s:any,o:any)=>o.observedAt=101);
 const raw:any=value(f.read({run:f.ready,worker:'w',harness:'h',reason:'start',execution:value(f.deps.admission.execution(f.id,f.lease))}));
 if(later)f.setClock(101);
 const at=f.deps.clock(),cached=later?{...raw,at,previousActivity:at,elapsed:{...raw.elapsed,at}}:raw,last=f.last();
 let externalInvocations=0;
 const reader=createProductionGroundingReader({scope:'scope:minimal',runtime:f.runtime,context:f.c,clock:f.deps.clock,
  harness:{owner:'part-ten',deliver:()=>f.success({...last.observation,phase:'input-accepted'}),observe:()=>f.success(last.observation)} as any,
  sample:()=>f.success({specification:last.spec,grounding:()=>cached})});
 const graph=value(five.createRunGraph({...f.deps,grounding:reader}));
 const actual=result(graph.ground(f.id,'w','h','start',f.lease));
 expect(externalInvocations).toBe(0);
 expect(actual,JSON.stringify(actual)).toMatchObject({accepted:false});
});
it('Q3 F8 public reader factory cannot certify null runtime and harness as production',()=>{
 const f=setup(),a=assemblyRuntimeFixture(),binding={...productionBindingSet(),productionGrounding:{implementation:'context-delivery-v1' as const}};
 const installed=installProduction(a,binding),base=productionComposition(a,installed.binding);
 const reader=createProductionGroundingReader({scope:binding.scope,runtime:null as any,harness:null as any,clock:f.deps.clock,context:f.c,sample:()=>{throw Error('no production implementation')}});
 const assemblyHistory:any={owner:'part-ten',current:()=>f.success([]),lookup:()=>f.success(null),resolve:()=>f.success({admitted:true,completeness:'complete',facts:[],conflicts:[],missing:[]})};
 const graph=value(five.createRunGraph({...f.deps,grounding:reader,assemblyHistory}));
 const production={...base,productionGrounding:{owner:'part-ten' as const,implementation:'context-delivery-v1' as const},run:{...base.run,port:graph}};
 const boot=result(bootProductionAssembly({...a.composition,production},installed.manifest.id,binding.scope));
 expect({capable:five.isProductionGroundedRunGraph(graph,binding.scope),boot},JSON.stringify(boot)).toMatchObject({capable:false,boot:{accepted:false}});
});
it('Q4 public registration and package exports expose no direct capability issuer',()=>{
 expect('issueProductionGroundingReader' in tenPublic).toBe(false);
 expect('issueProductionGroundedGraph' in five).toBe(false);
 expect('issueProductionGroundingRead' in tenPublic).toBe(false);
 const f=setup();expect(five.isProductionGroundedRunGraph(five.registerProductionGroundedGraph(f.graph))).toBe(false);
 const reader=five.registerProductionGroundingReader({...f.deps.grounding,production:true});
 const history:any={owner:'part-ten'};
 const graph=value(five.createRunGraph({...f.deps,grounding:reader,assemblyHistory:history}));
 expect(five.isProductionGroundedRunGraph(graph)).toBe(false);
});
it('Q5 F2 arbitrary registered substitute owner decoders do not constitute real Eight admission',()=>{
 const f=ten();
 expect((f.ctx.ownedBodies??[]).some((r:any)=>r.owner==='part-eight')).toBe(true);
 expect(result(f.runtime.recordContextDelivery(f.spec()))).toMatchObject({accepted:false});
});
it('Q6 checker still detects reintroduced private sibling import',async()=>{
 const {inspectAssemblyCore}=await import('../../scripts/check-assembly-contracts.mjs');
 const sources=Object.fromEntries(readdirSync('src/assembly').filter(n=>n.endsWith('.ts')).map(n=>['src/assembly/'+n,readFileSync('src/assembly/'+n,'utf8')]));
 expect(inspectAssemblyCore(sources)).toEqual([]);
 sources['src/assembly/context-delivery.ts']+="\nimport { issueProductionGroundedGraph } from '../rungraph/types.js';\n";
 expect(inspectAssemblyCore(sources)).toContain('src/assembly/context-delivery.ts: private sibling import ../rungraph/types.js');
});

for (const later of [false,true]) it(`Q${later?10:9} F3 public Ten factory with a complete four-method adapter refuses ${later?'retimestamped':'same-tick'} completed receipt from a replaying adapter`,()=>{
 const f=paired();if(later) f.setMutation((_s:any,o:any)=>o.observedAt=101);
 const raw:any=value(f.read({run:f.ready,worker:'w',harness:'h',reason:'start',execution:value(f.deps.admission.execution(f.id,f.lease))}));
 if(later)f.setClock(101);
 const at=f.deps.clock(),cached=later?{...raw,at,previousActivity:at,elapsed:{...raw.elapsed,at}}:raw,last=f.last();
 let externalInvocations=0;
 const reader=createProductionGroundingReader({scope:'scope:minimal',runtime:f.runtime,context:f.c,clock:f.deps.clock,
  harness:{owner:'part-ten',id:'h',describe:()=>({artifact:f.launch.artifactDigest,platform:'fixture',contextModes:['initial','live-input'],outputModes:['text'],interruptionModes:[],custodyModes:['signed'],observationModes:['context-consumed'],conformance:'fixture'}),launch:()=>{throw Error('existing signed launch must be retained')},deliver:()=>f.success({...last.observation,phase:'input-accepted'}),observe:()=>f.success(last.observation)} as any,
  sample:()=>f.success({specification:last.spec,grounding:()=>cached})});
 const graph=value(five.createRunGraph({...f.deps,grounding:reader}));
 const actual=result(graph.ground(f.id,'w','h','start',f.lease));
 expect(externalInvocations).toBe(0);
 expect(actual,JSON.stringify(actual)).toMatchObject({accepted:false});
});

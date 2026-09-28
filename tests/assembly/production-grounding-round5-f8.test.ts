// Re-review 3 finding F8 (2026-09-17): certified production owners must stay bound to the exact dependencies that were
// certified. Replacing a caller-owned input after construction must either refuse activation or keep delegating to the
// original genuine dependency without ever invoking the replacement. Reviewer's reproducer, kept as a permanent case.
import {it,expect} from 'vitest';
import {consumeResult} from '../../src/index.js';
import {createProductionGroundingReader,createNativeHarnessAdapter,bootProductionAssembly} from '../../src/assembly/index.js';
import {createRunGraph,isProductionGroundedRunGraph} from '../../src/rungraph/index.js';
import {groundedAssemblyRuntimeFixture,installProduction} from './genuine-production-fixture.js';
import {productionComposition} from './production-fixture.js';
import {value} from '../facts/fixtures.js';
import { stallCoverageFixture } from './stall-coverage-fixture.js';
type Outcome = { accepted: boolean; value?: unknown; detail?: string };
const outcome=(r:any):Outcome=>consumeResult<unknown,Outcome>(r,{Success:value=>({accepted:true,value}),Refused:refusal=>({accepted:false,detail:refusal.detail})});
for(const substitution of ['reader-runtime','native-driver','context-history','unchanged-control']) it(`Astra F8 ${substitution}: boot refuses substituted owners or keeps original genuine delegation`,()=>{
 const f=groundedAssemblyRuntimeFixture(),installed=installProduction(f),p=f.groundingFor({scope:installed.binding.scope});
 const nativeInput:any={id:f.harnessId,stallCoverage:stallCoverageFixture(f.harnessId),artifact:f.launch.artifactDigest,platform:'darwin-arm64',conformance:'conformance:1',context:p.context,clock:()=>100,generation:()=>f.run.generation.id,contextDeliveryDriver:p.driver,driver:{owner:'part-eight',launch:()=>{throw Error('unused')},deliver:()=>{throw Error('unused')},observe:()=>{throw Error('unused')}}};
 const harness=createNativeHarnessAdapter(nativeInput);f.composition.harnesses.splice(0,f.composition.harnesses.length,harness);
 const input:any={scope:installed.binding.scope,runtime:p.runtime,harness,context:p.context,clock:p.clock,sample:p.sample};
 const reader=createProductionGroundingReader(input);
 const graph=value(createRunGraph({...p.graphDependencies,store:p.spine.store,assemblyHistory:p.history,grounding:reader}));
 value(graph.open(f.run));
 const base=productionComposition(f,installed.binding),production={...base,run:{...base.run,port:graph}};
 let substituteCalls=0;
 if(substitution==='reader-runtime')input.runtime={...p.runtime,inspectCurrent:()=>{substituteCalls++;throw Error('method-shaped replacement runtime called');}};
 if(substitution==='native-driver')nativeInput.contextDeliveryDriver={...p.driver,deliver:()=>{substituteCalls++;throw Error('method-shaped replacement driver called');}};
 if(substitution==='context-history')nativeInput.context.history={...p.history,lookup:()=>{substituteCalls++;throw Error('method-shaped replacement history called');}};
 const capable=isProductionGroundedRunGraph(graph,installed.binding.scope);
 const boot:any=outcome(bootProductionAssembly({...f.composition,production},installed.manifest.id,installed.binding.scope));
 const grounded:any=outcome(graph.ground(f.id,'w','native','start',f.lease));
 const actual={substitution,capable,bootAccepted:boot.accepted,groundAccepted:grounded.accepted,groundDetail:grounded.detail,substituteCalls};
 expect(!boot.accepted || (grounded.accepted && substituteCalls===0),JSON.stringify(actual)).toBe(true);
},120000);

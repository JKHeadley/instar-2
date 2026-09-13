import {root,m,one,facts,proj,measurementA2Fixture,got,ok,no,closed,open,request,peer,pp,eventWindows,privateKey} from './common.js';
const results:any[]=[];
function test(name:string,run:()=>any,expect:(r:any)=>boolean){try{const actual=run();results.push({name,pass:expect(actual),actual});}catch(e){results.push({name,pass:false,exception:String(e)});}}
{
 const {f,windows:[base,current]}=eventWindows([['currency-base',0,200,17,83],['currency-current',200,400,141,59]]);const p=f.burnPolicy();
 test('burn:current-currency-neighbor',()=>m.evaluateCurrentBurn(p,closed,current,[base],f.c),r=>ok(r)&&got(r).notify);
 test('burn:withdrawn-producer-at-use',()=>m.evaluateCurrentBurn(p,closed,current,[base],{...f.c,types:{...f.types,register:{...f.types.register,producers:[]}}}),no);
 test('burn:withdrawn-population-at-use',()=>m.evaluateCurrentBurn(p,closed,current,[base],{...f.c,types:{...f.types,evidence:f.evidence.filter((e:any)=>e.id!==current.populationEvidence.id)}}),no);
 test('burn:withdrawn-baseline-observation-at-use',()=>m.evaluateCurrentBurn(p,closed,current,[base],{...f.c,types:{...f.types,evidence:f.evidence.filter((e:any)=>e.id!==base.samples[0].quantities[0].witnesses[0].evidence.id)}}),no);
 test('burn:forged-census-fields-refuse',()=>m.createCurrentBurnWindow({sourceHistory:f.snapshot(),window:{...current,programmaticEvents:1}},f.c),no);
 test('burn:changed-window-clock-retains-proof-refuses',()=>m.createCurrentBurnWindow({sourceHistory:f.snapshot(),window:{...current,start:f.clock(350)}},f.c),no);
}
for(const early of [true,false]){
 const f=measurementA2Fixture();const a=f.planObservation({subject:'causal:same-tick',sourceEvent:'causal:first',amount:21,at:100,contract:f.eventProducer});const b=f.planObservation({subject:a.subject,sourceEvent:'causal:second',amount:27,at:100,contract:f.eventProducer});f.persistObservation(a);
 const evidence=f.admitEvidence(f.evidenceInput({id:'causal:resolution',observedAt:f.clock(100),freshFor:1000000,claim:{subject:a.identity,predicate:'quantity-resolved',value:{amount:24,witnesses:[a.sourceEvent,b.sourceEvent]}}}));
 if(!early)f.persistObservation(b);f.append('measurement-evidence',{evidence},f.clock(100));if(early)f.persistObservation(b);
 const h=f.snapshot();test(`resolution:equal-clock-${early?'before-last-witness-refuses':'causally-after-all-accepts'}`,()=>m.resolveCurrentQuantity({sourceHistory:h,witnesses:[f.witness(a,h),f.witness(b,h)],resolution:{owner:'probe',key:a.identity,witnesses:[a.sourceEvent,b.sourceEvent],amount:24,evidence},evaluationClock:f.clock(200)},f.c),r=>early?no(r):ok(r)&&got(r).amount===24);
}
{
 const f=measurementA2Fixture();const oldProducer={type:'MeasurementProducerContract',schemaVersion:1,id:'producer:migration',family:'model-call',subjectKind:'model-token',producer:'probe',unit:'tokens',evidencePredicate:'usage-observed'};const current={...f.modelProducerInput,id:oldProducer.id,categories:[{name:'value',unit:'tokens',relation:'standalone'}]};const pc=f.withRegistered(current,f.c);
 test('migration:producer-compares-true',()=>m.compareMeasurementProducerContracts(oldProducer,current,pc),r=>ok(r)&&got(r)===true);
 const currentBurn={...f.burnPolicyInput,id:'burn:migration',selections:[f.burnPolicyInput.selections[0]]};const bc=f.withRegistered(currentBurn,f.c);const {selections,minimumEligibleSamples,...rest}=currentBurn;const oldBurn={...rest,schemaVersion:1,selection:selections[0],minimumSamples:minimumEligibleSamples};
 test('migration:burn-compares-true',()=>m.compareBurnPolicies(oldBurn,currentBurn,bc),r=>ok(r)&&got(r)===true);
 test('canonical:reordered-keys-compare-true',()=>m.compareMeasurementProducerContracts(Object.fromEntries(Object.entries(current).reverse()),current,pc),r=>ok(r)&&got(r)===true);
 const a=f.planObservation({subject:'binding:shape',sourceEvent:'binding:e',amount:4,at:100,contract:f.eventProducer});f.persistObservation(a);const h=f.snapshot();const req=request(f,h,[f.eventProducer]);
 test('binding:well-formed-projection-neighbor',()=>m.bindCurrentMeasurementReadSource({sourceHistory:h,sourceDefinition:req.sourceDefinition,sourceGeneration:req.sourceGeneration},f.c),ok);
 test('binding:numeric-projection-class-must-refuse',()=>m.bindCurrentMeasurementReadSource({sourceHistory:h,sourceDefinition:{...req.sourceDefinition,class:42},sourceGeneration:req.sourceGeneration},f.c),no);
 const machine=Object.keys(req.sourceGeneration.lineages)[0]!;const lineages={...req.sourceGeneration.lineages,[machine]:{...req.sourceGeneration.lineages[machine],observedAt:42,closed:'not-a-boolean'}};
 test('binding:malformed-lineage-must-refuse',()=>m.bindCurrentMeasurementReadSource({sourceHistory:h,sourceDefinition:req.sourceDefinition,sourceGeneration:{...req.sourceGeneration,lineages}},f.c),no);
}
// Genuine Part Seven record, then a lawful Part Two retraction of its resolution.
{
 const {judgmentFixture}=await import(`${root}/tests/judgment/fixture.ts`);const j=judgmentFixture();got(await j.door.judge(j.input,j.start()));const f=measurementA2Fixture();const c={...f.c,register:j.ctx.decode.register,types:j.ctx.decode};const before=got(j.store.readForProjection());const resolution=before.entries.find((e:any)=>e.fact.kind==='judgment-JudgmentResolution')!;
 const a={attempt:`attempt:${j.input.id}:1`,claimed:{feature:'ignored',model:'ignored',machine:'ignored'},evaluationClock:j.now,sourceHistory:before,candidates:[]};
 test('attribution:current-resolution-before-retraction',()=>m.resolveCurrentAttribution(a,c),r=>ok(r)&&got(r).state==='attributed');
 const ctx={...j.ctx,schemas:[...j.ctx.schemas,{...j.schema,kind:'retraction',fields:{target:{kind:'reference'},reason:{kind:'text',maxLength:100}}}]};const store=facts.createFactStore(ctx,j.storage);
 const append=facts.authorAndAppend({kind:'retraction',schemaVersion:1,machine:j.host.transport.machine,principal:j.alice,provenance:j.alice.provenance,at:j.now,body:{target:resolution.fact.id,reason:'resolution withdrawn'},required:[resolution.fact.id]},ctx,store,privateKey);test('attribution:owner-accepts-resolution-retraction',()=>append,ok);
 if(ok(append)) {const h=got(store.readForProjection());test('attribution:retracted-resolution-no-longer-attributes',()=>m.resolveCurrentAttribution({...a,sourceHistory:h},c),r=>no(r)||(ok(r)&&got(r).state!=='attributed'));}
}
{
 const {f,plans}=eventWindows([['alias-base',0,200,17,83],['alias-high',200,400,141,59],['alias-low',400,600,0,19]]);
 const old=plans[2].evidence;const evidence=f.admitEvidence(f.evidenceInput({id:'independent-population-witness',observedAt:f.clock(600),freshFor:1000000,claim:{...old.claim,subject:'second-label-same-interval'}}));
 f.append('measurement-evidence',{evidence},f.clock(600));const h=f.snapshot();const [base,high,low]=plans.map(p=>got(m.createCurrentBurnWindow({window:p.build(h),sourceHistory:h},f.c)));
 const second=got(m.createCurrentBurnWindow({window:{...plans[2].build(h),id:'second-label-same-interval',populationEvidence:evidence},sourceHistory:h},f.c));
 const opened=got(m.evaluateCurrentBurn(f.burnPolicy(),closed,high,[base],f.c));const first=got(m.evaluateCurrentBurn(f.burnPolicy(),opened.episode,low,[high],f.c));
 test('burn:distinct-population-witness-same-interval-stays-one',()=>m.evaluateCurrentBurn(f.burnPolicy(),first.episode,second,[high],f.c),r=>ok(r)&&got(r).episode.state==='open'&&got(r).episode.recoveryCount===1);
}
export const closureCases=results;

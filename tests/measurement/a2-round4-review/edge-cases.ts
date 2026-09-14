import {root,m,one,facts,proj,measurementA2Fixture,got,ok,no,closed,open,request,peer,pp,eventWindows,privateKey} from './common.js';
const results:any[]=[];
function test(name:string,run:()=>any,expect:(r:any)=>boolean){try{const actual=run();results.push({name,pass:expect(actual),actual});}catch(e){results.push({name,pass:false,exception:String(e)});}}
// An ordinary owner's `target` field is not a Part Two retraction.
{
 const f=measurementA2Fixture();const a=f.planObservation({subject:'evt:target',sourceEvent:'evt:target:e',amount:31,at:100,contract:f.eventProducer});const original=f.persistObservation(a);
 const schemas=[...f.factContext.schemas,{...f.facts.schema,kind:'ordinary-note',fields:{target:{kind:'reference'},description:{kind:'text',maxLength:100}}}];
 const ctx={...f.factContext,schemas};const store=facts.createFactStore(ctx,f.storage);
 const added=got(facts.authorAndAppend({kind:'ordinary-note',schemaVersion:1,machine:'machine-a',principal:f.facts.alice,provenance:f.facts.alice.provenance,at:f.clock(110),body:{target:original,description:'link to still-current observation'},required:[]},ctx,store,privateKey));
 const h=got(store.readForProjection());const req=request(f,h,[f.eventProducer]);
 test('unrelated-note:owner-fold-retains-observation',()=>proj.foldProjection(req.sourceDefinition,h,req.sourceGeneration,f.c),r=>ok(r)&&Object.keys(got(r).values).length===1);
 test('unrelated-note:target-field-must-not-suppress-observation',()=>m.renderCurrentMeasurementRead(req,f.c),r=>ok(r)&&got(r).totalCount===1&&got(r).rows[0].amount===31);
}
// Retraction of a retraction restores the owner source point.
{
 const f=measurementA2Fixture();const a=f.planObservation({subject:'evt:restore',sourceEvent:'evt:restore:e',amount:31,at:100,contract:f.eventProducer});const original=f.persistObservation(a);
 const ctx={...f.factContext,schemas:[...f.factContext.schemas,{...f.facts.schema,kind:'retraction',fields:{target:{kind:'reference'},reason:{kind:'text',maxLength:100}}}]};const store=facts.createFactStore(ctx,f.storage);
 const retract=(target:string,t:number)=>got(facts.authorAndAppend({kind:'retraction',schemaVersion:1,machine:'machine-a',principal:f.facts.alice,provenance:f.facts.alice.provenance,at:f.clock(t),body:{target,reason:'correct mistaken withdrawal'},required:[target]},ctx,store,privateKey)).fact.id;
 const r=retract(original,110);retract(r,120);const h=got(store.readForProjection());const req=request(f,h,[f.eventProducer]);
 test('restored-retraction:owner-fold-retains-observation',()=>proj.foldProjection(req.sourceDefinition,h,req.sourceGeneration,f.c),r=>ok(r)&&Object.keys(got(r).values).length===1);
 test('restored-retraction:current-read-accepts-restored-point',()=>m.renderCurrentMeasurementRead(req,f.c),r=>ok(r)&&got(r).rows[0].amount===31);
}
// A current peer snapshot with a fault must remain partial even if the unusable row is filtered.
for(const fault of ['signature','amount']){
 try{
  const f=measurementA2Fixture();const a=f.planObservation({subject:'evt:fault',sourceEvent:'evt:fault:e',amount:8,at:100,contract:f.eventProducer});f.persistObservation(a);
  const rows=structuredClone(f.rows);if(fault==='signature')rows[0].signature='invalid';else rows[0].body.measurement.value=999;
  const bad=measurementA2Fixture(rows);const snap=bad.store.readForProjection();
  if(no(snap)){results.push({name:`peer:${fault}-owner-refuses-corrupt-source`,pass:true,actual:snap});continue;}
  const h=got(snap);
  test(`peer:${fault}-owner-status-not-complete`,()=>({entries:h.entries.map((r:any)=>({taint:r.taint,conflicts:r.conflicts})),result:m.mergeCurrentPeerMeasurements([peer(bad,h)],pp(bad),bad.c)}),r=>no(r.result)||(ok(r.result)&&got(r.result).state==='partial'));
 }catch(e){results.push({name:`peer:${fault}-setup`,pass:false,exception:String(e)});}
}
// Quantity identity must distinguish the source times for every sampled family, not only RSS.
for(const [family,subjectKind,unit] of [['cumulative-model-session','cumulative-model-session','tokens'],['quota','quota','percent'],['package-cost','observer-run','ms']] as [string,string,string][]){
 const f=measurementA2Fixture();const raw={...f.modelProducerInput,id:`producer:clock:${family}`,family,subjectKind,categories:[{name:'value',unit,relation:'standalone'}]};let c=f.withRegistered(raw,f.c);const reg={...c.types.register,subjects:{...c.types.register.subjects,[subjectKind]:[unit]}};c={...c,types:{...c.types,register:reg}};const contract=got(m.decodeMeasurementProducerContract(raw,c));
 // Create constitutional facts via the true subject decoder and signing/store ports.
 const ctx={...f.factContext,decode:c.types};const store=facts.createFactStore(ctx,f.storage);
 const entries=[100,150].map((at,i)=>{const clock=f.clock(at);const measurement=got(one.decodeMeasurement(subjectKind,{type:'Measurement',schemaVersion:1,subject:{kind:subjectKind,instance:'session:same'},value:10,unit,at:clock,by:'probe'},c.types));const evidence=f.admitEvidence(f.evidenceInput({id:`${family}:${i}`,observedAt:clock,freshFor:1000000,claim:{subject:'session:same',predicate:'usage-observed',value:{amount:10,category:'value',sourceSample:'unchanged-source-sample',producer:'probe',state:'reported',occurrenceAt:clock,hardwareProfile:null}}}));const identity=got(one.canonical({family,subject:'session:same',sourceSample:'unchanged-source-sample',category:'value',unit,relation:'standalone',hardwareProfile:null,sampleAt:clock})).hash;got(facts.authorAndAppend({kind:'measurement-observation',schemaVersion:1,machine:'machine-a',principal:f.facts.alice,provenance:f.facts.alice.provenance,at:clock,body:{identity,measurement,evidence,producerContract:got(one.canonical(contract)).bytes},required:[]},ctx,store,privateKey));return {input:{contract,subjectInstance:'session:same',sourceSample:'unchanged-source-sample',category:'value',measurement,evidence,sourceEvent:evidence.id,phase:'final',predecessors:[],state:'reported',hardwareProfile:null}};});
 const h=got(store.readForProjection());test(`sample-clock:${family}-successive-points-not-same-quantity`,()=>entries.map(e=>m.createCurrentQuantityWitness({...e,sourceHistory:h},c)),rs=>rs.every(ok)&&got(rs[0]).key!==got(rs[1]).key);
 const ff={...f,c};test(`sample-clock:${family}-read-retains-both-source-times`,()=>m.renderCurrentMeasurementRead(request(ff,h,[contract]),c),r=>ok(r)&&got(r).totalCount===2&&got(r).rows.map((row:any)=>row.at.value).join(',')==='100,150');
}
// Real Part Seven attribution and dispatch timing, independently from copied regression code.
{
 const {judgmentFixture}=await import(`${root}/tests/judgment/fixture.ts`);const j=judgmentFixture();got(await j.door.judge(j.input,j.start()));const f=measurementA2Fixture();const c={...f.c,register:j.ctx.decode.register,types:j.ctx.decode};const h=got(j.store.readForProjection());const a={attempt:`attempt:${j.input.id}:1`,claimed:{feature:'untrusted-feature',model:'untrusted-model',machine:'untrusted-machine'},evaluationClock:j.now,sourceHistory:h,candidates:[]};
 test('attribution:real-judgment-neighbor',()=>m.resolveCurrentAttribution(a,c),r=>ok(r)&&got(r).state==='attributed'&&got(r).feature==='judgment'&&got(r).model==='model');
 test('attribution:no-match-neighbor',()=>m.resolveCurrentAttribution({...a,attempt:'missing'},c),r=>ok(r)&&got(r).state==='unattributed');
 test('attribution:withdrawn-owner-decision-evidence',()=>m.resolveCurrentAttribution(a,{...c,types:{...c.types,evidence:[]}}),r=>no(r)||(ok(r)&&got(r).state!=='attributed'));
}
// Genuine unresolved events remain visible, then a fresh complete sequence can be rebuilt.
{
 const f=measurementA2Fixture();const os=[11,13].map((amount,i)=>f.planObservation({subject:'uncertain:event',sourceEvent:`uncertain:e:${i}`,amount,at:100,contract:f.eventProducer}));os.forEach(f.persistObservation);const plan=f.persistBurnWindow({id:'uncertain',start:0,end:200,samples:[{identity:os[0].subject,feature:'feature-a',source:'programmatic-event',observations:os}],comparisonScopeAmount:0});const h=f.snapshot();const w=got(m.createCurrentBurnWindow({window:plan.build(h),sourceHistory:h},f.c));
 test('burn:unresolved-events-retain-episode-and-debt',()=>m.evaluateCurrentBurn(f.burnPolicy(),open,w,[],f.c),r=>ok(r)&&got(r).episode.state==='open'&&got(r).currentAmount===null&&got(r).coverageDebt.includes('unresolved:uncertain:event'));
}
{
 const f=measurementA2Fixture();const o=f.planObservation({subject:'omitted:event',sourceEvent:'omitted:e',amount:60,at:100,contract:f.eventProducer});f.persistObservation(o);const plan=f.persistBurnWindow({id:'omitted',start:0,end:200,samples:[],comparisonScopeAmount:0});const h=f.snapshot();const w=got(m.createCurrentBurnWindow({window:plan.build(h),sourceHistory:h},f.c));
 test('burn:omitted-event-cannot-close-inactive',()=>m.evaluateCurrentBurn(f.burnPolicy(),open,w,[],f.c),r=>ok(r)&&got(r).episode.state==='open'&&got(r).classification==='incomplete');
}
{
 const {f,plans,windows:[base,high,low,next]}=eventWindows([['xb',0,200,10,90],['xh',200,400,150,50],['xl',400,600,0,20],['xn',600,800,0,20]]);const p=f.burnPolicy();const opened=got(m.evaluateCurrentBurn(p,closed,high,[base],f.c));const first=got(m.evaluateCurrentBurn(p,opened.episode,low,[high],f.c));const o=f.planObservation({subject:'new:future',sourceEvent:'new:future:e',amount:0,at:900,contract:f.eventProducer});f.persistObservation(o);const h=f.snapshot();const ws=plans.map(plan=>got(m.createCurrentBurnWindow({window:plan.build(h),sourceHistory:h},f.c)));
 test('burn:stale-episode-refuses-until-reconstruction',()=>m.evaluateCurrentBurn(p,first.episode,ws[3],[ws[2]],f.c),no);
 const ro=got(m.evaluateCurrentBurn(p,closed,ws[1],[ws[0]],f.c));const rf=got(m.evaluateCurrentBurn(p,ro.episode,ws[2],[ws[1]],f.c));
 test('burn:fresh-history-reconstruction-completes-recovery',()=>m.evaluateCurrentBurn(p,rf.episode,ws[3],[ws[2]],f.c),r=>ok(r)&&got(r).episode.state==='closed');
}
export const edgeCases=results;

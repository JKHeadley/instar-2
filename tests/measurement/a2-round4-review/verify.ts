const root=process.cwd();
const m=await import(`${root}/src/measurement/index.ts`);
const one=await import(`${root}/src/index.ts`);
const facts=await import(`${root}/src/facts/index.ts`);
const proj=await import(`${root}/src/projections/index.ts`);
const {measurementA2Fixture,captureRetentionProof}=await import(`${root}/tests/measurement/a2-fixture.ts`);
const {value,privateKey}=await import(`${root}/tests/facts/fixtures.ts`);
const results:any[]=[];
const got=value;
const ok=(r:any)=>r?.kind==='Success';
const no=(r:any)=>r?.kind==='Refused'&&typeof r.reason==='string';
function test(name:string,run:()=>any,expect:(r:any)=>boolean){try{const actual=run();results.push({name,pass:expect(actual),actual});}catch(e){results.push({name,pass:false,exception:String(e)});}}
const closed={state:'closed',recoveryCount:0,notified:false,investigation:null};
const open={state:'open',recoveryCount:0,notified:true,investigation:'existing'};
function request(f:any,h:any,producers=[f.producer],overrides:any={}){
 const lineages:any={};for(const r of h.entries)lineages[r.fact.machine]={head:r.fact.segment,observedAt:null,closed:true};
 const sourceGeneration={reference:f.c.register.generation,kinds:[...new Set(h.entries.map((r:any)=>r.fact.kind))],lineages};
 const sourceDefinition=got(m.measurementProjectionDefinition(sourceGeneration,h.entries.some((r:any)=>r.fact.kind==='measurement-observation')?{'measurement-observation':{identity:'identity',value:'measurement',merge:'set-union'}}:{},f.c));
 const binding=got(m.bindCurrentMeasurementReadSource({sourceHistory:h,sourceDefinition,sourceGeneration},f.c));
 return {sourceHistory:h,sourceDefinition,sourceGeneration,query:f.readQuery({...binding,...overrides}),producers,attributions:[],timedOut:false};
}
function peer(f:any,h:any,who='machine-a') {return {peer:who,state:'admitted',sourceHistory:h,...got(m.currentPeerHistoryBinding(h,f.c)),observedAt:f.clock(199),lastFrontier:null,quantities:[]};}
const pp=(f:any,names=['machine-a'])=>({requiredPeers:names,evaluationClock:f.clock(200),maximumClockSkewMs:10});
function eventWindows(spec:any[]){const f=measurementA2Fixture();const plans=spec.map(([id,start,end,target,other,complete=true])=>{const rows=[target,other].map((amount,i)=>f.planObservation({subject:`${id}:${i}`,sourceEvent:`${id}:${i}:e`,amount,at:start+10,contract:f.eventProducer}));rows.forEach(f.persistObservation);return f.persistBurnWindow({id,start,end,collectorsComplete:complete,samples:rows.map((o:any,i:number)=>({identity:o.subject,feature:i===0?'feature-a':'comparison',source:'programmatic-event',observations:[o]})),comparisonScopeAmount:target+other});});const h=f.snapshot();return {f,h,plans,windows:plans.map(p=>got(m.createCurrentBurnWindow({window:p.build(h),sourceHistory:h},f.c)))};}
// Current history, source binding, every evidence field, canonical ordering, copied inputs.
{
 const f=measurementA2Fixture();const a=f.planObservation({subject:'evt:own',sourceEvent:'evt:own:e',amount:19,at:99,contract:f.eventProducer});f.persistObservation(a);const h=f.snapshot();const req=request(f,h,[f.eventProducer]);
 test('history:well-formed-current-owner-neighbor',()=>m.renderCurrentMeasurementRead(req,f.c),r=>ok(r)&&got(r).rows[0].amount===19);
 test('history:invented-extra-row-refused',()=>m.renderCurrentMeasurementRead({...req,rows:[{amount:999}]},f.c),no);
 test('history:copied-source-refused',()=>m.renderCurrentMeasurementRead({...req,sourceHistory:structuredClone(h)},f.c),no);
 test('history:changed-source-digest-refused',()=>m.renderCurrentMeasurementRead({...req,query:f.readQuery({...req.query,sourceHistoryDigest:'foreign'})},f.c),no);
 test('history:unregistered-query-generation-refused',()=>m.renderCurrentMeasurementRead(req,{...f.c,register:{...f.c.register,generation:{...f.c.register.generation,id:'foreign'}}}),no);
 const w=f.witness(a,h);const q=f.quantity([a],h,200);
 const without={...f.c,types:{...f.types,evidence:[]}};
 test('quantity:withdrawn-evidence-refused',()=>m.resolveCurrentQuantity({witnesses:[w],sourceHistory:h,evaluationClock:f.clock(200)},without),no);
 test('quantity:copied-admitted-witness-refused',()=>m.resolveCurrentQuantity({witnesses:[structuredClone(w)],sourceHistory:h,evaluationClock:f.clock(200)},f.c),no);
 for(const [field,v] of [['state','missing'],['sourceSample','other'],['category','output'],['sourceEvent','other'],['measurement',{...a.measurement,value:99}],['evidence',{...a.evidence,observedAt:f.clock(100)}]]) test(`witness:changed-${field}-refuses`,()=>m.createCurrentQuantityWitness({input:{...a.input,[field]:v},sourceHistory:h},f.c),no);
 test('history:same-input-bytes-repeat',()=>[m.renderCurrentMeasurementRead(req,f.c),m.renderCurrentMeasurementRead(req,f.c)],r=>JSON.stringify(r[0])===JSON.stringify(r[1]));
 const view=got(proj.foldProjection(req.sourceDefinition,h,req.sourceGeneration,f.c));
 const b=f.planObservation({subject:'evt:new',sourceEvent:'evt:new:e',amount:21,at:100,contract:f.eventProducer});f.persistObservation(b);
 test('projection:old-snapshot-refuses-integrity',()=>proj.foldProjection(req.sourceDefinition,h,req.sourceGeneration,f.c),r=>no(r)&&r.reason==='integrity');
 test('projection:old-view-refuses-stale-base',()=>proj.readProjection(view,req.sourceDefinition,f.clock(200),f.c),r=>no(r)&&r.reason==='stale-base');
 test('quantity:old-value-after-history-advance-refuses',()=>m.resolveCurrentQuantity({witnesses:[w],sourceHistory:h,evaluationClock:f.clock(200)},f.c),no);
 const fresh=f.snapshot();test('history:fresh-owner-after-advance-accepts',()=>m.renderCurrentMeasurementRead(request(f,fresh,[f.eventProducer]),f.c),r=>ok(r)&&got(r).totalCount===2);
}
// Resolving without caller hints must agree with the same source read; valid correction must replace.
{
 const f=measurementA2Fixture();const os=[73,79].map((amount,i)=>f.planObservation({subject:'evt:disagree',sourceEvent:`evt:disagree:${i}`,amount,at:100,contract:f.eventProducer}));os.forEach(f.persistObservation);
 const evidence=f.admitEvidence(f.evidenceInput({id:'evt:resolution',observedAt:f.clock(110),freshFor:1000000,claim:{subject:os[0].identity,predicate:'quantity-resolved',value:{amount:76,witnesses:os.map(o=>o.sourceEvent)}}}));f.append('measurement-evidence',{evidence},f.clock(110));
 const plan=f.persistBurnWindow({id:'owner-resolved-burn',start:0,end:200,samples:[{identity:os[0].subject,feature:'feature-a',source:'programmatic-event',observations:os}],comparisonScopeAmount:76});
 const h=f.snapshot(),ws=os.map(o=>f.witness(o,h));const resolution={owner:'probe',key:os[0].identity,witnesses:os.map(o=>o.sourceEvent),amount:76,evidence};
 test('resolution:explicit-current-neighbor',()=>m.resolveCurrentQuantity({witnesses:ws,resolution,sourceHistory:h,evaluationClock:f.clock(200)},f.c),r=>ok(r)&&got(r).amount===76);
 test('resolution:signed-history-selected-without-caller-hint',()=>m.resolveCurrentQuantity({witnesses:[ws[0]],sourceHistory:h,evaluationClock:f.clock(200)},f.c),r=>ok(r)&&got(r).amount===76);
 test('resolution:historical-neighbor-selects-same-owner-value',()=>m.renderCurrentMeasurementRead(request(f,h,[f.eventProducer]),f.c),r=>ok(r)&&got(r).rows[0].amount===76);
 const raw=plan.build(h),unresolvedWindow=got(m.createCurrentBurnWindow({window:raw,sourceHistory:h},f.c));
 test('resolution:burn-re-resolves-owner-resolution-at-use',()=>m.evaluateCurrentBurn(f.burnPolicy(),open,unresolvedWindow,[],f.c),r=>ok(r)&&got(r).currentAmount===76);
 const q=got(m.resolveCurrentQuantity({witnesses:ws,resolution,sourceHistory:h,evaluationClock:f.clock(200)},f.c));
 const explicit=got(m.createCurrentBurnWindow({window:{...raw,samples:[{...raw.samples[0],quantities:[q]}]},sourceHistory:h},f.c));
 test('resolution:burn-explicit-resolution-neighbor',()=>m.evaluateCurrentBurn(f.burnPolicy(),open,explicit,[],f.c),r=>ok(r)&&got(r).currentAmount===76);

}
// Actual Part Two correction / retraction, including authorized absent observation.
for(const mode of ['correction','retraction']){
 const f=measurementA2Fixture();const a=f.planObservation({subject:`evt:${mode}`,sourceEvent:`${mode}:a`,amount:31,at:100,contract:f.eventProducer});const original=f.persistObservation(a);
 const schemas=[...f.factContext.schemas.map((s:any)=>s.kind==='measurement-observation'?{...s,fields:{...s.fields,corrects:{kind:'reference'}},optional:[...(s.optional??[]),'corrects']}:s),{...f.facts.schema,kind:'retraction',fields:{target:{kind:'reference'},reason:{kind:'text',maxLength:100}}}];
 const ctx={...f.factContext,schemas};const store=facts.createFactStore(ctx,f.storage);const b=f.planObservation({subject:a.subject,sourceEvent:`${mode}:b`,amount:37,at:100,contract:f.eventProducer});
 const body=mode==='correction'?{identity:b.identity,measurement:b.measurement,evidence:b.evidence,producerContract:got(one.canonical(f.eventProducer)).bytes,corrects:original}:{target:original,reason:'incorrect observation'};
 test(`${mode}:real-owner-append`,()=>facts.authorAndAppend({kind:mode==='correction'?'measurement-observation':'retraction',schemaVersion:1,machine:'machine-a',principal:f.facts.alice,provenance:f.facts.alice.provenance,at:f.clock(110),body,required:[original]},ctx,store,privateKey),ok);
 const h=got(store.readForProjection());
 test(`${mode}:read-current-source`,()=>m.renderCurrentMeasurementRead(request(f,h,[f.eventProducer]),f.c),r=>ok(r)&&(mode==='correction'?got(r).totalCount===1&&got(r).rows[0].amount===37:got(r).totalCount===0));
 test(`${mode}:peer-current-source`,()=>m.mergeCurrentPeerMeasurements([peer(f,h)],pp(f),f.c),r=>ok(r)&&got(r).state==='complete'&&(mode==='correction'?got(r).members.length===1:got(r).members.length===0));
}
// Clock differences should preserve admitted local data; the peer's clock must be witnessed.
{
 const f=measurementA2Fixture();const a=f.planObservation({subject:'peer:event',sourceEvent:'peer:event:e',amount:9,at:100,contract:f.eventProducer});f.persistObservation(a);const h=f.snapshot();const local=peer(f,h);const other={...local,peer:'remote'};
 test('peer:overlap-owner-neighbor',()=>m.mergeCurrentPeerMeasurements([local,other],pp(f,['machine-a','remote']),f.c),r=>ok(r)&&got(r).state==='partial'&&got(r).members.length===1);
 test('peer:missing-keeps-local',()=>m.mergeCurrentPeerMeasurements([local],pp(f,['machine-a','remote']),f.c),r=>ok(r)&&got(r).state==='partial'&&got(r).members.length===1);
 test('peer:clock-skew-keeps-local',()=>m.mergeCurrentPeerMeasurements([local,{...other,observedAt:f.clock(189)}],pp(f,['machine-a','remote']),f.c),r=>ok(r)&&got(r).state==='partial'&&got(r).admittedPeers.length===1);
 const foreignClock=got(one.decodeMeasurement('clock',{...f.clock(199),subject:{...f.clock(199).subject,instance:'hardware:other'}},f.types));
 test('peer:incomparable-clock-keeps-local-partial',()=>m.mergeCurrentPeerMeasurements([local,{...other,observedAt:foreignClock}],pp(f,['machine-a','remote']),f.c),r=>ok(r)&&got(r).state==='partial'&&got(r).admittedPeers.includes('machine-a'));
 test('peer:relabel-history-as-required-peer-needs-owner-binding',()=>m.mergeCurrentPeerMeasurements([{...local,peer:'never-observed-machine'}],pp(f,['never-observed-machine']),f.c),r=>no(r)||(ok(r)&&got(r).state==='partial'));
 test('peer:invented-frontier-keeps-local',()=>m.mergeCurrentPeerMeasurements([local,{...other,frontierDigest:'invented'}],pp(f,['machine-a','remote']),f.c),r=>ok(r)&&got(r).state==='partial'&&got(r).admittedPeers.length===1);
}
// Required recovery cases and stale recovery after real sequential history advance.
{
 const {f,h,plans,windows:[base,high,low,next]}=eventWindows([['b',0,200,10,90],['h',200,400,150,50],['l',400,600,0,20],['n',600,800,0,20]]);const p=f.burnPolicy();
 const opened=got(m.evaluateCurrentBurn(p,closed,high,[base],f.c));const first=got(m.evaluateCurrentBurn(p,opened.episode,low,[high],f.c));
 test('burn:event-only-adequate-opens',()=>opened,r=>r.confidence==='adequate'&&r.notify&&r.episode.state==='open');
 test('burn:repeat-interval-does-not-complete-recovery',()=>m.evaluateCurrentBurn(p,first.episode,low,[high],f.c),r=>ok(r)&&got(r).episode.recoveryCount===1&&got(r).episode.state==='open');
 test('burn:consecutive-next-completes-recovery',()=>m.evaluateCurrentBurn(p,first.episode,next,[low],f.c),r=>ok(r)&&got(r).episode.state==='closed');
 const newObs=f.planObservation({subject:'after:future',sourceEvent:'after:future:e',amount:0,at:900,contract:f.eventProducer});f.persistObservation(newObs);
 const fresh=f.snapshot();const rebuilt=plans.map(plan=>got(m.createCurrentBurnWindow({window:plan.build(fresh),sourceHistory:fresh},f.c)));
 test('burn:stale-prior-episode-requires-current-reconstruction',()=>m.evaluateCurrentBurn(p,first.episode,rebuilt[3],[rebuilt[2]],f.c),no);
}
export const verifyCases=results;

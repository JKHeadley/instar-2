import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const m = await import(`${root}/src/measurement/index.ts`);
const one = await import(`${root}/src/index.ts`);
const projections = await import(`${root}/src/projections/index.ts`);
const { measurementA2Fixture, captureRetentionProof } = await import(`${root}/tests/measurement/a2-fixture.ts`);
const { value } = await import(`${root}/tests/facts/fixtures.ts`);
const results: any[] = [];
function record(name: string, run: () => any, expected: (r: any) => boolean) {
  try { const actual = run(); results.push({ name, pass: expected(actual), actual }); }
  catch(e) { results.push({ name, pass: false, exception: String(e) }); }
}
const ok = (r: any) => r.kind === 'Success';
const no = (r: any) => r.kind === 'Refused';
const got = (r: any) => value(r);
const closed = {state:'closed', recoveryCount:0, notified:false, investigation:null};
const open = {state:'open', recoveryCount:0, notified:true, investigation:'existing'};
function readRequest(f: any, history: any, producers = [f.producer], overrides = {}): any {
  const frontier: any = {};
  for (const row of history.entries) frontier[row.fact.machine] = {head:row.fact.segment,observedAt:null,closed:true};
  const sourceGeneration = {reference:f.c.register.generation,kinds:[...new Set(history.entries.map((r:any)=>r.fact.kind))],lineages:frontier};
  const sourceDefinition = got(m.measurementProjectionDefinition(sourceGeneration, history.entries.length ? {'measurement-observation':{identity:'identity',value:'measurement',merge:'set-union'}} : {}, f.c));
  const binding = got(m.bindCurrentMeasurementReadSource({sourceHistory:history,sourceDefinition,sourceGeneration},f.c));
  return {sourceHistory:history,sourceDefinition,sourceGeneration,query:f.readQuery({...binding,...overrides}),producers,attributions:[],timedOut:false};
}
// Persist exactly the same two disagreeing witnesses; change only caller stream metadata.
{
  const f=measurementA2Fixture();
  const a=f.planObservation({subject:'exchange:stream',sourceEvent:'stream:a',amount:100,at:100,contract:f.eventProducer});
  const b=f.planObservation({subject:'exchange:stream',sourceEvent:'stream:b',amount:110,at:100,contract:f.eventProducer});
  [a,b].forEach(f.persistObservation); const h=f.snapshot();
  const aw=f.witness(a,h), bw=f.witness(b,h);
  record('stream:independent-disagreement',()=>m.resolveCurrentQuantity({witnesses:[aw,bw],sourceHistory:h,evaluationClock:f.clock(200)},f.c),r=>ok(r)&&got(r).state==='unresolved');
  const fake=m.createCurrentQuantityWitness({input:{...b.input,phase:'correction',predecessors:[a.sourceEvent]},sourceHistory:h},f.c);
  record('stream:invented-correction-must-not-select-winner',()=>ok(fake)?m.resolveCurrentQuantity({witnesses:[aw,got(fake)],sourceHistory:h,evaluationClock:f.clock(200)},f.c):fake,r=>no(r)||(ok(r)&&got(r).state==='unresolved'));
  record('history:disagreement-retains-both-witnesses-and-partial',()=>m.renderCurrentMeasurementRead(readRequest(f,h,[f.eventProducer]),f.c),r=>ok(r)&&got(r).partial&&JSON.stringify(got(r)).includes('stream:a')&&JSON.stringify(got(r)).includes('stream:b'));
}
// An existing event cannot vanish merely because the signed population list omits it.
{
  const f=measurementA2Fixture();
  const obs=f.planObservation({subject:'event:omitted',sourceEvent:'event:omitted:usage',amount:150,at:300,contract:f.eventProducer});
  f.persistObservation(obs);
  const p=f.persistBurnWindow({id:'omitted',start:200,end:400,samples:[],comparisonScopeAmount:0});
  const h=f.snapshot(); const w=got(m.createCurrentBurnWindow({window:p.build(h),sourceHistory:h},f.c));
  record('burn:omitted-current-event-must-not-close-inactive',()=>m.evaluateCurrentBurn(f.burnPolicy(),open,w,[],f.c),r=>no(r)||(ok(r)&&got(r).episode.state==='open'&&got(r).classification!=='inactive'));
}
function eventWindows(specs: any[]) {
  const f=measurementA2Fixture();
  const plans=specs.map(([id,start,end,target,other])=>{
    const a=f.planObservation({subject:`${id}:target`,sourceEvent:`${id}:a`,amount:target,at:start+10,contract:f.eventProducer});
    const b=f.planObservation({subject:`${id}:other`,sourceEvent:`${id}:b`,amount:other,at:start+10,contract:f.eventProducer});
    [a,b].forEach(f.persistObservation);
    return f.persistBurnWindow({id,start,end,samples:[{identity:a.subject,feature:'feature-a',source:'programmatic-event',observations:[a]},{identity:b.subject,feature:'comparison',source:'programmatic-event',observations:[b]}],comparisonScopeAmount:target+other});
  });
  const h=f.snapshot();const windows=plans.map(p=>got(m.createCurrentBurnWindow({window:p.build(h),sourceHistory:h},f.c)));
  return {f,h,windows,plans};
}
{
  const {f,h,windows:[base,high,low,next]}=eventWindows([['base',0,200,10,90],['high',200,400,150,50],['low',400,600,0,20],['next',600,800,0,20]]);
  const p=f.burnPolicy();
  record('burn:event-only-opens',()=>m.evaluateCurrentBurn(p,closed,high,[base],f.c),r=>ok(r)&&got(r).notify&&got(r).currentAmount===150);
  const opened=got(m.evaluateCurrentBurn(p,closed,high,[base],f.c));
  const recovery=got(m.evaluateCurrentBurn(p,opened.episode,low,[high],f.c));
  record('burn:same-interval-replay-stays-one',()=>m.evaluateCurrentBurn(p,recovery.episode,low,[high],f.c),r=>ok(r)&&got(r).episode.state==='open'&&got(r).episode.recoveryCount===1);
  record('burn:adjacent-window-recovers',()=>m.evaluateCurrentBurn(p,recovery.episode,next,[low],f.c),r=>ok(r)&&got(r).episode.state==='closed');
  record('burn:withdrawn-population-refuses',()=>m.evaluateCurrentBurn(p,closed,high,[base],{...f.c,types:{...f.types,evidence:f.evidence.filter((e:any)=>e.id!==high.populationEvidence.id)}}),no);
  record('burn:removed-producer-refuses',()=>m.evaluateCurrentBurn(p,closed,high,[base],{...f.c,types:{...f.types,register:{...f.types.register,producers:[]}}}),no);
  record('burn:malformed-episode-reference-is-not-accepted',()=>m.evaluateCurrentBurn(p,{...closed,lastEvaluatedWindow:42,lastEvaluatedObservation:{junk:true}},high,[base],f.c),no);
}
// Comparable finite baseline intervals need not touch; design names every selected preceding window.
{
  const {f,windows:[base,current]}=eventWindows([['gapped-base',0,100,10,90],['gapped-current',200,300,150,50]]);
  record('burn:declared-preceding-nonadjacent-baseline',()=>m.evaluateCurrentBurn(f.burnPolicy(),closed,current,[base],f.c),r=>ok(r)&&got(r).confidence==='adequate');
}
{
 const {f,plans}=eventWindows([['same-base',0,200,10,90],['same-high',200,400,150,50],['same-low',400,600,0,20]]);
 const original=plans[2].evidence;
 const evidence=f.admitEvidence(f.evidenceInput({id:'second-witness:low',observedAt:f.clock(600),freshFor:1_000_000,claim:{...original.claim,subject:'second-window-label'}}));
 f.append('measurement-evidence',{evidence},f.clock(600));const h=f.snapshot();
 const [base,high,low]=plans.map(p=>got(m.createCurrentBurnWindow({window:p.build(h),sourceHistory:h},f.c)));
 const alias=got(m.createCurrentBurnWindow({window:{...plans[2].build(h),id:'second-window-label',populationEvidence:evidence},sourceHistory:h},f.c));
 const opened=got(m.evaluateCurrentBurn(f.burnPolicy(),closed,high,[base],f.c));
 const recovery=got(m.evaluateCurrentBurn(f.burnPolicy(),opened.episode,low,[high],f.c));
 record('burn:second-witness-of-same-interval-does-not-recover',()=>m.evaluateCurrentBurn(f.burnPolicy(),recovery.episode,alias,[high],f.c),r=>ok(r)&&got(r).episode.state==='open'&&got(r).episode.recoveryCount===1);
}
{
 const {f,windows:[base,zero]}=eventWindows([['zero-base',0,200,10,90],['zero-all',200,400,0,0]]);
 record('burn:all-zero-share-does-not-recover-or-raise-debt',()=>m.evaluateCurrentBurn(f.burnPolicy(),open,zero,[base],f.c),r=>ok(r)&&got(r).share===null&&got(r).episode.state==='open'&&got(r).episode.recoveryCount===0&&got(r).coverageDebt.length===0);
}
// Current evaluation is after the baseline witnesses' freshness endpoint.
{
 const f=measurementA2Fixture();
 const plan=(id:string,start:number,end:number,target:number,other:number,expire:boolean)=>{
   const obs=[target,other].map((amount,i)=>{
     const o=f.planObservation({subject:`${id}:${i}`,sourceEvent:`${id}:usage:${i}`,amount,at:start+10,contract:f.eventProducer});
     if(!expire)return o;
     const index=f.evidence.findIndex((e:any)=>e.id===o.evidence.id);f.evidence.splice(index,1);
     const evidence=f.admitEvidence({...o.evidence,freshFor:250});
     return {...o,evidence,input:{...o.input,evidence}};
   });
   obs.forEach(f.persistObservation);
   return f.persistBurnWindow({id,start,end,comparisonScopeAmount:target+other,samples:obs.map((o:any,i:number)=>({identity:o.subject,feature:i===0?'feature-a':'comparison',source:'programmatic-event',observations:[o]}))});
 };
 const base=plan('fresh-base',0,200,10,90,true),high=plan('fresh-high',200,400,150,50,false);
 const h=f.snapshot();const b=got(m.createCurrentBurnWindow({window:base.build(h),sourceHistory:h},f.c));
 const w=got(m.createCurrentBurnWindow({window:high.build(h),sourceHistory:h},f.c));
 record('burn:expired-baseline-cannot-open',()=>m.evaluateCurrentBurn(f.burnPolicy(),closed,w,[b],f.c),r=>no(r)||(ok(r)&&!got(r).notify&&got(r).confidence!=='adequate'));
 // Round 7's composition invariant supersedes this case's original whole-read
 // refusal: valid but wholly expired evidence remains an unavailable quantity.
 record('quantity:expired-baseline-refuses-at-same-evaluation',()=>m.resolveCurrentQuantity({witnesses:b.samples[0].quantities[0].witnesses,sourceHistory:h,evaluationClock:f.clock(400)},f.c),r=>ok(r)&&got(r).state==='unavailable'&&got(r).amount===null);
}
// Resource sample time is part of quantity identity, independently of the witness event.
{
  const f=measurementA2Fixture();
  const a=f.planObservation({subject:'process:one',sourceEvent:'resource:100',category:'rss',amount:100,at:100,contract:f.resourceProducer,hardwareProfile:'hardware:m1'});
  const b=f.planObservation({subject:'process:one',sourceEvent:'resource:200',category:'rss',amount:100,at:200,contract:f.resourceProducer,hardwareProfile:'hardware:m1'});
  [a,b].forEach(f.persistObservation);const h=f.snapshot();
  record('resource:successive-samples-do-not-collapse',()=>m.renderCurrentMeasurementRead(readRequest(f,h,[f.resourceProducer]),f.c),r=>no(r)||(ok(r)&&got(r).totalCount===2));
}
record('capture:real-owner-pin-and-tombstone',()=>captureRetentionProof(),r=>r.protectedDetail.includes('protected')&&r.tombstone.status==='tombstoned');
{
 const f=measurementA2Fixture();const obs=[10,12].map((amount,i)=>f.planObservation({subject:'event:unresolved',sourceEvent:`event:unresolved:${i}`,amount,at:100,contract:f.eventProducer}));
 obs.forEach(f.persistObservation);
 const p=f.persistBurnWindow({id:'unresolved-event-window',start:0,end:200,samples:[{identity:obs[0].subject,feature:'feature-a',source:'programmatic-event',observations:obs}],comparisonScopeAmount:0});
 const h=f.snapshot();const w=got(m.createCurrentBurnWindow({window:p.build(h),sourceHistory:h},f.c));
 record('burn:well-formed-unresolved-event-retains-episode-and-debt',()=>m.evaluateCurrentBurn(f.burnPolicy(),open,w,[],f.c),r=>ok(r)&&got(r).episode.state==='open'&&got(r).currentAmount===null&&got(r).coverageDebt.includes('unresolved:event:unresolved'));
}
{
 const f=measurementA2Fixture();
 const model=f.planObservation({subject:'mixed:model',sourceEvent:'mixed:model:usage',amount:7,at:100});
 const event=f.planObservation({subject:'mixed:event',sourceEvent:'mixed:event:usage',amount:3,at:100,contract:f.eventProducer});
 [model,event].forEach(f.persistObservation);const h=f.snapshot();
 const witness=f.witness(model,h);
 record('quantity:other-valid-family-does-not-refuse-selected-key',()=>m.resolveCurrentQuantity({witnesses:[witness],sourceHistory:h,evaluationClock:f.clock(200)},f.c),r=>ok(r)&&got(r).amount===7);
 record('history:unwitnessed-model-quarantines-but-event-remains-readable',()=>m.renderCurrentMeasurementRead(readRequest(f,h,[f.producer,f.eventProducer]),f.c),r=>ok(r)&&got(r).partial&&got(r).totalCount===1&&got(r).rows[0].family==='programmatic-event');
}
{
 const f=measurementA2Fixture();
 const obs=[0,199,200].map((at,i)=>f.planObservation({subject:`bounded:${i}`,sourceEvent:`bounded:w:${i}`,amount:i,at,contract:f.eventProducer}));obs.forEach(f.persistObservation);
 const h=f.snapshot(),req=readRequest(f,h,[f.eventProducer],{start:f.clock(0),end:f.clock(200),evaluationClock:f.clock(200),pageSize:1});
 const first=m.renderCurrentMeasurementRead(req,f.c);
 record('read:exact-start-included-end-excluded-and-count-retained',()=>first,r=>ok(r)&&got(r).totalCount===2&&got(r).rows[0].at.value===0&&got(r).partial&&got(r).nextCursor!==null);
 const next={...req,query:f.readQuery({...req.query,cursor:got(first).nextCursor})};
 record('read:cursor-continuation',()=>m.renderCurrentMeasurementRead(next,f.c),r=>ok(r)&&got(r).rows[0].at.value===199&&got(r).totalCount===2&&got(r).nextCursor===null);
 record('read:changed-window-cursor-refuses',()=>m.renderCurrentMeasurementRead({...next,query:f.readQuery({...next.query,start:f.clock(1)})},f.c),no);
 record('read:timeout-is-explicit-partial',()=>m.renderCurrentMeasurementRead({...req,timedOut:true},f.c),r=>ok(r)&&got(r).partial&&got(r).reason.includes('timeout'));
 record('read:over-limit-page-refuses',()=>m.renderCurrentMeasurementRead({...req,query:f.readQuery({...req.query,pageSize:501})},f.c),no);
 record('read:insufficient-export-refuses',()=>m.renderCurrentMeasurementRead({...req,query:f.readQuery({...req.query,maxExportBytes:1})},f.c),no);
 const cache=got(m.createBoundedReadCache(got(m.decodeReadCachePolicy(f.cachePolicyInput,f.c)),f.c));
 got(cache.put({key:'render',createdAt:f.clock(100),bytes:JSON.stringify(got(first)).slice(0,500),byteLength:500}));
 got(cache.applyEviction(['render']));
 record('read:cache-drop-rebuild-is-byte-equal',()=>m.renderCurrentMeasurementRead(req,f.c),r=>ok(r)&&JSON.stringify(got(r))===JSON.stringify(got(first)));
}
{
 const f=measurementA2Fixture();const o=f.planObservation({subject:'peer:sample',sourceEvent:'peer:witness',amount:17,at:100});f.persistObservation(o);
 const h=f.snapshot(), q=f.quantity([o],h,200), binding=got(m.currentPeerHistoryBinding(h,f.c));
 const a={peer:'machine-a',state:'admitted',sourceHistory:h,...binding,observedAt:f.clock(190),lastFrontier:null,quantities:[q]};
 const policy={requiredPeers:['machine-a'],evaluationClock:f.clock(200),maximumClockSkewMs:10};
 record('peer:well-formed-boundary-clock',()=>m.mergeCurrentPeerMeasurements([a],policy,f.c),r=>ok(r)&&got(r).state==='complete');
 record('peer:overlap-union-once',()=>m.mergeCurrentPeerMeasurements([a,{...a,peer:'remote'}],{...policy,requiredPeers:['machine-a','remote']},f.c),r=>ok(r)&&got(r).state==='partial'&&got(r).members.length===1);
 record('peer:omitted-quantity-is-derived',()=>m.mergeCurrentPeerMeasurements([{...a,quantities:[]}],policy,f.c),r=>ok(r)&&got(r).members.includes('peer:witness'));
 record('peer:invented-frontier-is-partial',()=>m.mergeCurrentPeerMeasurements([{...a,frontierDigest:'invented'}],policy,f.c),r=>ok(r)&&got(r).state==='partial'&&got(r).missingPeers[0].reason==='unwitnessed-frontier');
 record('peer:clock-skew-is-partial',()=>m.mergeCurrentPeerMeasurements([a,{...a,peer:'remote',observedAt:f.clock(100)}],{...policy,requiredPeers:['machine-a','remote']},f.c),r=>ok(r)&&got(r).state==='partial'&&got(r).admittedPeers.includes('machine-a'));
 record('peer:missing-quantities-wrong-type-refuses',()=>m.mergeCurrentPeerMeasurements([a,{peer:'remote',state:'missing',sourceHistory:null,sourceHistoryDigest:null,frontier:null,frontierDigest:null,observedAt:null,lastFrontier:null,quantities:''}],{...policy,requiredPeers:['machine-a','remote']},f.c),no);
}
// A later disagreeing witness invalidates a former resolution without deleting either.
{
 const f=measurementA2Fixture();
 const rows=['a','b','c'].map((id,i)=>f.planObservation({subject:'exchange:later',sourceEvent:`later:${id}`,amount:100+i*10,at:100,contract:f.eventProducer}));
 rows.slice(0,2).forEach(f.persistObservation);
 const evidence=f.admitEvidence(f.evidenceInput({id:'later:resolution',observedAt:f.clock(110),freshFor:1_000_000,claim:{subject:rows[0].identity,predicate:'quantity-resolved',value:{amount:105,witnesses:['later:a','later:b']}}}));
 f.append('measurement-evidence',{evidence},f.clock(110));
 const h1=f.snapshot(), request1=readRequest(f,h1,[f.eventProducer]);
 const view=got(projections.foldProjection(request1.sourceDefinition,h1,request1.sourceGeneration,f.c));
 record('projection:current-owner-source-accepted',()=>projections.readProjection(view,request1.sourceDefinition,f.clock(200),f.c),ok);
 record('resolution:current-supported-read',()=>m.renderCurrentMeasurementRead(request1,f.c),r=>ok(r)&&got(r).rows[0].amount===105);
 f.persistObservation(rows[2]);const h2=f.snapshot();
 record('projection:stale-owner-fold-refuses-integrity',()=>projections.foldProjection(request1.sourceDefinition,h1,request1.sourceGeneration,f.c),r=>no(r)&&r.reason==='integrity');
 record('projection:stale-owner-read-refuses-stale-base',()=>projections.readProjection(view,request1.sourceDefinition,f.clock(200),f.c),r=>no(r)&&r.reason==='stale-base');
 record('history:stale-owner-snapshot-refuses',()=>m.renderCurrentMeasurementRead(request1,f.c),no);
 record('history:copied-owner-snapshot-refuses',()=>m.currentPeerHistoryBinding(structuredClone(h2),f.c),no);
 record('resolution:later-witness-retains-unresolved-current-history',()=>m.renderCurrentMeasurementRead(readRequest(f,h2,[f.eventProducer]),f.c),r=>ok(r)&&got(r).partial&&got(r).rows[0].amount===null&&got(r).rows[0].evidenceManifest.length===3);
}
// The source claims one sample time across measurement/evidence; rejecting a late witness
// as a new occurrence must not cause a model exchange to move to the usage arrival day.
{
 const {judgmentFixture}=await import(`${root}/tests/judgment/fixture.ts`);
 const owner=judgmentFixture();got(await owner.door.judge(owner.input,owner.start()));
 const f=measurementA2Fixture();
 const r={...owner.ctx.decode.register,entries:[...new Set([...owner.ctx.decode.register.entries,...f.types.register.entries])],subjects:{...owner.ctx.decode.register.subjects,...f.types.register.subjects}};
 const c={...f.c,register:r,types:{...owner.ctx.decode,register:r,evidence:[...owner.evidence,...f.evidence]}};
 const history=got(owner.store.readForProjection());
 const request={attempt:`attempt:${owner.input.id}:1`,claimed:{feature:'self-label',model:'self-model',machine:'self-machine'},evaluationClock:owner.now,sourceHistory:history,candidates:[]};
 record('attribution:real-owner-positive',()=>m.resolveCurrentAttribution(request,c),r=>ok(r)&&got(r).state==='attributed'&&got(r).feature==='judgment');
 record('attribution:absent-neighbor',()=>m.resolveCurrentAttribution({...request,attempt:'attempt:missing'},c),r=>ok(r)&&got(r).state==='unattributed');
 const attribution=got(m.resolveCurrentAttribution(request,c));
 const facts=await import(`${root}/src/facts/index.ts`);
 const {privateKey}=await import(`${root}/tests/facts/fixtures.ts`);
 const obs=f.planObservation({subject:request.attempt,sourceEvent:'late:usage',amount:11,at:300});
 const types={...c.types,evidence:[...c.types.evidence,obs.evidence],captures:{...owner.ctx.decode.captures,...f.types.captures}};
 const context={...owner.ctx,decode:types,schemas:[...owner.ctx.schemas,...f.factContext.schemas],captures:{...owner.ctx.captures,...f.factContext.captures}};
 const store=facts.createFactStore(context,owner.storage);
 got(facts.authorAndAppend({kind:'measurement-observation',schemaVersion:1,machine:'machine-a',principal:owner.alice,provenance:owner.alice.provenance,at:f.clock(300),body:{identity:obs.identity,measurement:obs.measurement,evidence:obs.evidence},required:[]},context,store,privateKey));
 const sourceHistory=got(store.readForProjection());
 const joined={...f,c:{...c,types},store,readQuery:(overrides:any)=>got(m.decodeMeasurementReadQuery({...f.readQuery(overrides),registerGeneration:r.generation.id},{...c,types}))};
 const req=readRequest(joined,sourceHistory,[f.producer],{start:f.clock(0),end:f.clock(200),evaluationClock:f.clock(400)});
 req.attributions=[got(m.resolveCurrentAttribution({...request,sourceHistory,evaluationClock:f.clock(400)},joined.c))];
 record('history:late-usage-keeps-owner-dispatch-window',()=>m.renderCurrentMeasurementRead(req,joined.c),r=>ok(r)&&got(r).totalCount===1&&got(r).rows[0].at.value===100);
 const after=readRequest(joined,sourceHistory,[f.producer],{start:f.clock(200),end:f.clock(400),evaluationClock:f.clock(400)});
 after.attributions=req.attributions;
 record('history:late-usage-does-not-enter-arrival-window',()=>m.renderCurrentMeasurementRead(after,joined.c),r=>ok(r)&&got(r).totalCount===0);
 const noOwnerEvidence={...joined.c,types:{...types,evidence:types.evidence.filter((e:any)=>e.id===obs.evidence.id)}};
 record('attribution:withdrawn-decision-evidence-current-resolution',()=>m.resolveCurrentAttribution({...request,sourceHistory,evaluationClock:f.clock(400)},noOwnerEvidence),r=>no(r)||(ok(r)&&got(r).state!=='attributed'));
 record('attribution:withdrawn-decision-evidence-prior-result-not-current',()=>m.renderCurrentMeasurementRead(after,noOwnerEvidence),r=>no(r)||(ok(r)&&got(r).rows.every((row:any)=>row.feature===null)));
}
// The ordinary landed input/output categories are executable even though expanded cache
// categories remain held. Their one exchange is one 18-token burn sample, not two samples.
{
 const {judgmentFixture}=await import(`${root}/tests/judgment/fixture.ts`);
 const facts=await import(`${root}/src/facts/index.ts`);
 const {privateKey}=await import(`${root}/tests/facts/fixtures.ts`);
 const owner=judgmentFixture();got(await owner.door.judge(owner.input,owner.start()));
 const f=measurementA2Fixture();
 const attempt=`attempt:${owner.input.id}:1`;
 const input=f.planObservation({subject:attempt,sourceEvent:'model-io:input',category:'input',amount:11,at:150});
 const output=f.planObservation({subject:attempt,sourceEvent:'model-io:output',category:'output',amount:7,at:150});
 const plan=f.persistBurnWindow({id:'model-io',start:0,end:200,attempts:[attempt],observed:[attempt],
  supported:[attempt],samples:[{identity:attempt,feature:'judgment',observations:[input,output]}],comparisonScopeAmount:18});
 const rawPolicy={...f.burnPolicyInput,id:'burn:judgment:model-io',feature:'judgment'};
 const mc=f.withRegistered(rawPolicy);
 const register={...mc.register,entries:[...new Set([...owner.ctx.decode.register.entries,...mc.register.entries])],
  sites:{...owner.ctx.decode.register.sites,...mc.register.sites},
  keys:{...owner.ctx.decode.register.keys,...mc.register.keys},
  subjects:{...owner.ctx.decode.register.subjects,...mc.types.register.subjects}};
 const types={...owner.ctx.decode,...mc.types,register,evidence:[...owner.evidence,...f.evidence],
  captures:{...owner.ctx.decode.captures,...mc.types.captures}};
 const context={...owner.ctx,decode:types,schemas:[...owner.ctx.schemas,...f.factContext.schemas],
  captures:{...owner.ctx.captures,...f.factContext.captures}};
 const store=facts.createFactStore(context,owner.storage);
 for(const observation of [input,output]) got(facts.authorAndAppend({kind:'measurement-observation',schemaVersion:1,
  machine:'machine-a',principal:owner.alice,provenance:owner.alice.provenance,at:f.clock(300),
  body:{identity:observation.identity,measurement:observation.measurement,evidence:observation.evidence,
   producerContract:got(one.canonical(observation.input.contract)).bytes},required:[]},context,store,privateKey));
 got(facts.authorAndAppend({kind:'measurement-evidence',schemaVersion:1,machine:'machine-a',
  principal:owner.alice,provenance:owner.alice.provenance,at:f.clock(400),
  body:{evidence:plan.evidence},required:[]},context,store,privateKey));
 const sourceHistory=got(store.readForProjection());
 const c={...mc,register,types};
 const window=got(m.createCurrentBurnWindow({window:plan.build(sourceHistory),sourceHistory},c));
 const evaluation=m.evaluateCurrentBurn(got(m.decodeBurnPolicy(rawPolicy,c)),closed,window,[],c);
 record('burn:landed-model-input-output-derivation',()=>evaluation,r=>ok(r)&&got(r).currentAmount===18&&got(r).eligibleSampleCount===1&&got(r).coverage===1);
}
// Owner resolution ordering is causal, including equal wall-clock ticks.
for (const early of [true,false]) {
 const f=measurementA2Fixture();
 const a=f.planObservation({subject:'ordered',sourceEvent:'ordered:a',amount:100,at:100,contract:f.eventProducer});
 const b=f.planObservation({subject:'ordered',sourceEvent:'ordered:b',amount:110,at:100,contract:f.eventProducer});
 const evidence=f.admitEvidence(f.evidenceInput({id:'ordered:resolution',observedAt:f.clock(100),freshFor:1000000,claim:{subject:a.identity,predicate:'quantity-resolved',value:{amount:105,witnesses:['ordered:a','ordered:b']}}}));
 if(early) f.append('measurement-evidence',{evidence},f.clock(100));
 [a,b].forEach(f.persistObservation);
 if(!early) f.append('measurement-evidence',{evidence},f.clock(100));
 const h=f.snapshot();
 record(early?'resolution:earlier-signed-resolution-refuses':'resolution:same-tick-causal-successor-accepts',()=>m.renderCurrentMeasurementRead(readRequest(f,h,[f.eventProducer]),f.c),r=>early?no(r):ok(r)&&got(r).rows[0].amount===105);
}

// The reviewer's separate fresh-process peer case belongs in the permanent roster too.
{
 const f=measurementA2Fixture();
 const o=f.planObservation({subject:'cold:sample',sourceEvent:'cold:witness',amount:7,at:100});
 f.persistObservation(o);
 const h=f.snapshot(),binding=got(m.currentPeerHistoryBinding(h,f.c));
 const peers=[{peer:'machine-a',state:'admitted',sourceHistory:h,...binding,observedAt:f.clock(190),lastFrontier:null,quantities:[]}];
 const policy={requiredPeers:['machine-a'],evaluationClock:f.clock(200),maximumClockSkewMs:10};
 const before=m.mergeCurrentPeerMeasurements(peers,policy,f.c);
 f.quantity([o],h,200);
 const after=m.mergeCurrentPeerMeasurements(peers,policy,f.c);
 results.push({name:'peer:identical-input-cold-versus-remembered-contract',before,after,
  actual:after,pass:JSON.stringify(before)===JSON.stringify(after)&&ok(before)});
}

export const round3ReviewCases = results;

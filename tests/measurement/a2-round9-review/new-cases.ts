import {writeFileSync} from 'node:fs';
const root=process.cwd();
const {m,one,got,ok,no,request,peer,pp,measurementA2Fixture:F,closed,open}=await import(`${root}/tests/measurement/a2-round4-review/common.ts`);
const results:any[]=[];
function check(name:string,run:()=>any,predicate:(r:any)=>boolean){try{const actual=run();results.push({name,pass:predicate(actual),actual});}catch(e){results.push({name,pass:false,exception:String(e)});}}
function event(f:any,id:string,amount:number,at:number,ttl=10000,subject=id){let o=f.planObservation({subject,sourceEvent:id,amount,at,contract:f.eventProducer});f.evidence.splice(f.evidence.findIndex((e:any)=>e.id===id),1);const evidence=f.admitEvidence(f.evidenceInput({id,observedAt:f.clock(at),freshFor:ttl,claim:o.evidence.claim}));return {...o,evidence,input:{...o.input,evidence}};}
function plan(f:any,id:string,start:number,rows:any[],features:string[],amount:number){return f.persistBurnWindow({id,start,end:start+200,samples:rows.map((o,i)=>({identity:o.subject,feature:features[i],source:'programmatic-event',observations:[o]})),comparisonScopeAmount:amount});}
function admitted(f:any,p:any,h:any){return got(m.createCurrentBurnWindow({window:p.build(h),sourceHistory:h},f.c));}
// A former recovery window is NOT the next call's baseline. Its support still must be current at use.
for(const expired of [false,true]){
 const f=F();const bt=event(f,'prior:base:t',10,50),bo=event(f,'prior:base:o',90,50),lt=event(f,'prior:low:t',0,250,expired?160:10000),lo=event(f,'prior:low:o',20,250),nt=event(f,'prior:next:t',0,450),noo=event(f,'prior:next:o',20,450);
 [bt,bo,lt,lo,nt,noo].forEach(f.persistObservation);
 const plans=[plan(f,'prior:base',0,[bt,bo],['feature-a','comparison'],100),plan(f,'prior:low',200,[lt,lo],['feature-a','comparison'],20),plan(f,'prior:next',400,[nt,noo],['feature-a','comparison'],20)];
 const h=f.snapshot();const [base,low,next]=plans.map(p=>admitted(f,p,h));const policy=f.burnPolicy();
 const first=got(m.evaluateCurrentBurn(policy,open,low,[base],f.c));
 check(`prior-recovery:${expired}:first-count-one`,()=>({kind:'Success',value:first}),r=>got(r).episode.recoveryCount===1);
 check(`prior-recovery:${expired}:stale-support-cannot-close`,()=>m.evaluateCurrentBurn(policy,first.episode,next,[base],f.c),r=>ok(r)&&(expired?got(r).episode.state==='open':got(r).episode.state==='closed'));
}
// Observed event whose quantity has expired cannot disappear into an affirmative zero-activity roster.
for(const expired of [false,true]){
 const f=F();const o=event(f,'omitted:event',19,250,expired?30:10000);f.persistObservation(o);
 const empty=plan(f,'omitted:window',200,[],[],0);const h=f.snapshot();const w=admitted(f,empty,h);
 check(`omitted-event:${expired}:retains-open-debt`,()=>m.evaluateCurrentBurn(f.burnPolicy(),open,w,[],f.c),r=>ok(r)&&got(r).episode.state==='open'&&got(r).coverageDebt.length>0&&got(r).classification!=='inactive');
}
// Missing amount must not force refusal of a fresh independently supported amount at the same key.
for(const expired of [false,true]){
 const f=F();const a=event(f,'aggregate:a',19,100,expired?50:10000,'agg:one'),b=event(f,'aggregate:b',23,100,10000,'agg:one');[a,b].forEach(f.persistObservation);const h=f.snapshot();const q=f.quantity([a,b],h,200);
 const raw={...f.aggregatePolicyInput,id:'aggregate:new',sourceKind:'programmatic-count'},c=f.withRegistered(raw,f.c),policy=got(m.decodeAggregateMeasurementsPolicy(raw,c));
 const req={policy,quantities:[q],unit:'tokens',category:'input',dimensions:['feature'],producer:'probe',scope:'scope:ordinary',start:f.clock(0),end:f.clock(200),evaluationClock:f.clock(200),frontier:got(m.currentPeerHistoryBinding(h,c)).frontierDigest};
 check(`aggregate:mixed-expiry:${expired}`,()=>m.aggregateCurrentMeasurements(req,c),r=>ok(r)&&got(r).amount===(expired?23:0));
}
// Keeping expired observation audit evidence must also work when an accepted quantity later loses one witness.
for(const later of [false,true]){
 const f=F();const a=event(f,'use:a',17,100,150,'use:one'),b=event(f,'use:b',17,100,10000,'use:one');[a,b].forEach(f.persistObservation);const h=f.snapshot();const q=f.quantity([a,b],h,200);
 const raw={...f.aggregatePolicyInput,id:'aggregate:use',sourceKind:'programmatic-count'},c=f.withRegistered(raw,f.c),policy=got(m.decodeAggregateMeasurementsPolicy(raw,c));
 check(`aggregate:accepted-quantity:${later}:fresh-support-remains`,()=>m.aggregateCurrentMeasurements({policy,quantities:[q],unit:'tokens',category:'input',dimensions:['feature'],producer:'probe',scope:'scope:ordinary',start:f.clock(0),end:f.clock(200),evaluationClock:f.clock(later?300:200),frontier:got(m.currentPeerHistoryBinding(h,c)).frontierDigest},c),r=>ok(r)&&got(r).amount===17);
}
// Interval endpoints and changed evidence are tested with owner-admitted observations, not altered sealed output.
for(const at of [199,200,399,400]){
 const f=F();const o=event(f,'boundary:event',7,at);f.persistObservation(o);const p=plan(f,'boundary:window',200,[o],['feature-a'],7);const h=f.snapshot();
 check(`membership:${at}`,()=>m.createCurrentBurnWindow({window:p.build(h),sourceHistory:h},f.c),at>=200&&at<400?ok:no);
 check(`read-membership:${at}`,()=>m.renderCurrentMeasurementRead(request(f,h,[f.eventProducer],{start:f.clock(200),end:f.clock(400),evaluationClock:f.clock(500)}),f.c),r=>ok(r)&&got(r).totalCount===(at>=200&&at<400?1:0));
}
for(const state of ['not-reported','unsupported','missing','failed','legacy-origin-lost']){
 const f=F();const o=f.planObservation({subject:'state:event',sourceEvent:'state:e',amount:0,at:100,state,contract:f.eventProducer});f.persistObservation(o);const h=f.snapshot();
 check(`unknown-state:${state}:resolve`,()=>m.resolveCurrentQuantity({witnesses:[f.witness(o,h)],sourceHistory:h,evaluationClock:f.clock(200)},f.c),r=>ok(r)&&got(r).state==='unavailable'&&got(r).amount===null);
 check(`unknown-state:${state}:read`,()=>m.renderCurrentMeasurementRead(request(f,h,[f.eventProducer]),f.c),r=>ok(r)&&got(r).rows[0].state===state&&got(r).rows[0].amount===null);
}
{
 const f=F(),o=event(f,'bound:e',31,100);f.persistObservation(o);const h=f.snapshot(),req=request(f,h,[f.eventProducer]);
 check('history:positive',()=>m.renderCurrentMeasurementRead(req,f.c),r=>ok(r)&&got(r).rows[0].amount===31);
 check('history:invented-extra-rows',()=>m.renderCurrentMeasurementRead({...req,rows:[{amount:999}]},f.c),no);
 check('history:copied-snapshot',()=>m.renderCurrentMeasurementRead({...req,sourceHistory:structuredClone(h)},f.c),no);
 const q=f.quantity([o],h,200);f.persistObservation(event(f,'bound:new',41,200));
 check('history:old-snapshot-after-append',()=>m.renderCurrentMeasurementRead(req,f.c),no);
 check('quantity:old-snapshot-after-append',()=>m.resolveCurrentQuantity({witnesses:q.witnesses,sourceHistory:h,evaluationClock:f.clock(300)},f.c),no);
 check('history:fresh-neighbor-after-append',()=>m.renderCurrentMeasurementRead(request(f,f.snapshot(),[f.eventProducer]),f.c),r=>ok(r)&&got(r).totalCount===2);
}
writeFileSync(process.argv[2]!,JSON.stringify(results,null,2));console.log(JSON.stringify({cases:results.length,failed:results.filter(r=>!r.pass)},null,2));

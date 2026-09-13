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

export {root,m,one,facts,proj,measurementA2Fixture,captureRetentionProof,value,privateKey,got,ok,no,closed,open,request,peer,pp,eventWindows};

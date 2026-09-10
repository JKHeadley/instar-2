import { afterEach, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { authorAndAppend, createFactStore, decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy } from '../../src/transport/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';
import { privateKey } from '../facts/fixtures.js';
afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));
const scope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' };
const ref = (loop: any) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
const result = (r: any): any => consumeResult(r, { Success: (value: any) => ({ kind: 'ACCEPT', value }),
  Refused: (refusal: any) => ({ kind: 'REFUSE', detail: refusal.detail }) } as any);
const reject = (r: any) => expect(result(r)).toMatchObject({kind:'REFUSE'});
function setup(overrides = {}) {
  const f = transportLoopFixture();
  const policy: any = value(decodeLoopPolicy({ ...f.sharedPolicy, id: 'independent-policy', ...overrides }, f.c));
  f.registerPolicy(policy);
  const token = value(f.api.acquire('independent-lease', '', 1000));
  const input: any = {command:'independent-schedule', fence:token, currentOwnerRun:f.run, policy, episodeKey:'one', operationFamily:'recovery', pressureScope:scope, sourceVector:f.vector};
  const loop = value(f.api.scheduleEpisode(input));
  return {f,policy,token,input,loop};
}
function admit(s: any, id: string, extra = {}) {
  return s.f.api.admitLoopAttempt({command:'admit:'+id, fence:s.token, episode:ref(s.loop), attempt:id, holderFamily:'sentinel', worker:'worker:'+id,machine:'machine-a',resource:1,sourceVector:s.f.vector,...extra});
}
function finish(s: any, id: string, kind = 'failed', extra = {}) {
  return s.f.api.recordLoopOutcome({command:'outcome:'+id,fence:s.token,episode:ref(s.loop),attempt:id,kind,failureClass:kind==='failed'?'transport':'',completion:s.f.appendOutcome(kind,id),jitterPermille:1000,restoration:[],sourceVector:s.f.vector,...extra});
}
function mutation(f: any, transform: any, extraRequired: string[] = []) {
  const stored = value(f.store.read()) as any[];
  const fact = stored.filter(x=>x.kind==='transport-SharedLoopRecord').at(-1)!;
  const wires = f.storage.read();
  const original = wires.find((x:any)=>x.id===fact.id);
  const ctx = {...f.ctx,facts:[...f.ctx.facts,...stored.filter(x=>x.id!==fact.id)]};
  const wire = signEnvelope({...original,predecessors:{...original.predecessors, required:[...new Set([...original.predecessors.required,...extraRequired])]},body:{record:transform(fact.body.record)}},privateKey);
  const prefix = wires.filter((x:any)=>x.id!==fact.id);
  const store = createFactStore(f.ctx,{owner:'part-ten',read:()=>prefix,append:(bytes:any,expected:any)=>f.result(()=>{
    expect(prefix.at(-1)?.contentHash??null).toBe(expected);prefix.push(JSON.parse(bytes));return {kind:'local-durable'};
  })});
  return { replay:()=>decodeHistoricalBody(value(decodeEnvelope(wire,ctx,'replication')),ctx,ctx.decode), replicate:()=>store.append(wire,{peer:f.host.machine}), store };
}

it('V01 accepts valid admission and completion; refuses missing/wrong-kind/mismatched outcome without losing pending owner',()=>{
 const s=setup();s.f.advance(1);value(admit(s,'one'));
 const completion=s.f.appendOutcome('accepted','one');
 for(const change of [{fact:{...completion.fact,id:'missing'}},{field:'evidence'},{type:'Result'}]) reject(finish(s,'one','accepted',{completion:{...completion,...change}}));
 reject(finish(s,'one','failed',{completion}));
 expect((value(s.f.api.inspect()).at(-1)!.record as any).pendingAttempts).toEqual(['one']);
 expect(value(finish(s,'one','accepted',{completion}))).toMatchObject({state:'waiting',pendingAttempts:[],attempts:1});
});
it('V02 refuses unwitnessed policy and owner references; accepts exact neighboring references',()=>{
 const s=setup();
 reject(s.f.api.scheduleEpisode({...s.input,policy:{...s.policy,id:'missing-policy'}}));
 reject(s.f.api.scheduleEpisode({...s.input,currentOwnerRun:{...s.f.run,id:'missing-run'}}));
 reject(s.f.api.scheduleEpisode({...s.input,currentOwnerRun:{...s.f.run,owner:'part-nine'}}));
 expect(value(s.f.api.scheduleEpisode({...s.input,command:'coalesce'}))).toEqual(s.loop);
});
it('V03 refuses incomparable time and unavailable shared clock; accepts restored comparable clock',()=>{
 const s=setup();s.f.advance(1);const clock=s.f.host.loopClock;
 Object.assign(s.f.host,{loopClock:{owner:'part-ten',now:()=>({...s.f.clock(101),subject:{kind:'clock',instance:'other'}})}});reject(admit(s,'one'));
 Object.assign(s.f.host,{loopClock:undefined});reject(admit(s,'one'));
 Object.assign(s.f.host,{loopClock:clock});expect(value(admit(s,'one'))).toMatchObject({attempts:1});
});
it('V04 refuses a signed transition with an omitted pending attempt on replay and replication',()=>{
 const s=setup();s.f.advance(1);value(admit(s,'one'));
 const m=mutation(s.f,(r:any)=>({...r,pending:'',pendingAttempts:[]}));reject(m.replay());reject(m.replicate());
});
it('V05 exhausted parent resources refuse another worker/machine; exact budget accepts',()=>{
 const s=setup({parentResourceBudget:1});s.f.advance(1);value(admit(s,'one'));value(finish(s,'one','accepted'));s.f.advance(1);
 reject(admit(s,'two',{machine:'machine-b',worker:'replacement'}));
 expect((value(s.f.api.inspect()).at(-1)!.record as any).rollingResource).toBe(1);
});
it('V06 unavailable parent capture refuses admission and preserves signed owner history',()=>{
 const s=setup();s.f.advance(1);const before=s.f.storage.read();
 Object.assign(s.f.ctx,{captures:{...s.f.ctx.captures,'message:1':{...s.f.ctx.captures['message:1'],status:'expired',bytes:null}}});
 reject(admit(s,'one'));expect(s.f.storage.read()).toEqual(before);
});
it('V07 missing independent restoration refuses closure; passing trial without it remains half-open',()=>{
 const s=setup({failureThreshold:1,halfOpenTrials:1});s.f.advance(1);value(admit(s,'failure'));value(finish(s,'failure'));s.f.advance(20);value(admit(s,'trial'));
 const completion=s.f.appendOutcome('accepted','trial');
 reject(finish(s,'trial','accepted',{completion,restoration:[{owner:'part-nine',name:'VerificationAssessment',id:'missing'}]}));
 expect(value(finish(s,'trial','accepted',{completion}))).toMatchObject({state:'half-open',halfOpenSucceeded:1,closureEvidence:[]});
});
it('SLB-PARENT-POLICY-51 V08 signed first record in a second pressure scope must refuse a different parent budget',()=>{
 const s=setup({parentAttemptBudget:1});
 const larger:any=value(decodeLoopPolicy({...s.policy,id:'larger-policy',parentAttemptBudget:2},s.f.c));
 const policyFact=s.f.registerPolicy(larger);
 s.f.advance(1);value(admit(s,'one'));value(finish(s,'one','accepted'));
 const second={...s.input,command:'second-scope',episodeKey:'two',pressureScope:{...scope,target:'other'}};
 reject(s.f.api.scheduleEpisode({...second,policy:larger}));
 value(s.f.api.scheduleEpisode(second));
 const m=mutation(s.f,(r:any)=>({...r,policy:larger}),[policyFact.id]);
 const replay=result(m.replay()),replication=result(m.replicate());
 console.log('V08 observed',JSON.stringify({replay:replay.kind,replication:replication.kind}));
 if(replication.kind==='ACCEPT') {
   const api=createTransportAuthority(s.f.host,createTransportSpine(s.f.host,{context:s.f.ctx,privateKey},m.store),s.f.c);
   const loop=(value(api.inspect()).at(-1)!.record as any);s.f.advance(1);
   const next=result(api.admitLoopAttempt({command:'over-original-budget',fence:s.token,episode:ref(loop),attempt:'two',holderFamily:'watchdog',worker:'worker-b',machine:'machine-b',resource:1,sourceVector:s.f.vector}));
   console.log('V08 next attempt',JSON.stringify(next));
 }
 expect(replay.kind).toBe('REFUSE');expect(replication.kind).toBe('REFUSE');
});

for (const [index,boundary] of ['scheduled','attempt-admitted','opened','half-opened','evidence-only-closed'].entries()) {
 for (const [sideIndex,side] of ['before','after'].entries()) {
  const cutEvidenceBase = [54, 56, 58, 60, 64][index]!;
  const cutEvidenceId = `SLB-CUT-${boundary.toUpperCase()}-${side.toUpperCase()}-${cutEvidenceBase + sideIndex}`;
  it(`V${11+index*2+sideIndex} cut ${side} ${boundary} ${cutEvidenceId} keeps the exact durable prefix and owned pending work`,()=>{
   const s=setup({failureThreshold:1,halfOpenTrials:1});
   let operation:(api:any)=>any;
   if(boundary==='scheduled') operation=api=>api.scheduleEpisode({...s.input,command:'cut-schedule',episodeKey:'cut-new',pressureScope:{...scope,target:'other'}});
   else if(boundary==='attempt-admitted') {
     s.f.advance(1);
     operation=api=>api.admitLoopAttempt({command:'cut-admit',fence:s.token,episode:ref(s.loop),attempt:'cut-one',holderFamily:'sentinel',worker:'worker-cut',machine:'machine-a',resource:1,sourceVector:s.f.vector});
   } else {
     s.f.advance(1);value(admit(s,'failure'));const failed=s.f.appendOutcome('failed','failure');
     const outcomeInput:any={command:'cut-open',fence:s.token,episode:ref(s.loop),attempt:'failure',kind:'failed',failureClass:'transport',completion:failed,jitterPermille:1000,restoration:[],sourceVector:s.f.vector};
     if(boundary==='opened') operation=api=>api.recordLoopOutcome(outcomeInput);
     else {
       value(s.f.api.recordLoopOutcome(outcomeInput));s.f.advance(20);
       const trialInput:any={command:'cut-trial',fence:s.token,episode:ref(s.loop),attempt:'trial',holderFamily:'sentinel',worker:'worker-cut',machine:'machine-a',resource:1,sourceVector:s.f.vector};
       if(boundary==='half-opened') operation=api=>api.admitLoopAttempt(trialInput);
       else {
         value(s.f.api.admitLoopAttempt(trialInput));
         const completion=s.f.appendOutcome('accepted','trial');
         const input:any={...outcomeInput,command:'cut-passing',attempt:'trial',kind:'accepted',failureClass:'',completion};
         value(s.f.api.recordLoopOutcome(input));
         operation=api=>api.recordLoopOutcome({...input,command:'cut-closure',restoration:[s.f.restorationReference('assessment:witnessed-review')]});
       }
     }
   }
   const before=s.f.storage.read();
   const storage={...s.f.storage,append:(bytes:any,expected:any)=>{
     const record=JSON.parse(bytes).body.record;
     const target=record?.transition===(boundary==='evidence-only-closed'?'closed':boundary);
     if(!target)return s.f.storage.append(bytes,expected);
     if(side==='after')value(s.f.storage.append(bytes,expected));
     return s.f.result(()=>{throw new Error('independent durable cut');});
   }};
   const store=createFactStore(s.f.ctx,storage);
   const api=createTransportAuthority(s.f.host,createTransportSpine(s.f.host,{context:s.f.ctx,privateKey},store),s.f.c);
   reject(operation!(api));
   const after=s.f.storage.read();expect(after.slice(0,before.length)).toEqual(before);expect(after.length).toBe(before.length+(side==='after'?1:0));
   const recovered=createFactStore(s.f.ctx,s.f.storage);
   const records=value(recovered.read()) as any[];
   expect(records.length).toBe(after.length);
   if(side==='after')expect(records.at(-1).body.record).toMatchObject({transition:boundary==='evidence-only-closed'?'closed':boundary});
   else expect(records.at(-1).id).toBe((before.at(-1) as any).id);
  });
 }
}

it('V24 conflicting signed values for the same policy refuse the next automatic attempt',()=>{
 const s=setup();s.f.advance(1);const before=s.f.storage.read();
 value(authorAndAppend({kind:'transport-LoopPolicy',schemaVersion:1,machine:s.f.host.machine,
  principal:s.f.host.principal as any,provenance:s.f.host.principal.provenance as any,at:s.f.host.current().clock as any,
  body:{policy:{...s.policy,parentAttemptBudget:s.policy.parentAttemptBudget+1},generation:'generation:1'},required:[]
 },s.f.ctx,s.f.store,privateKey));
 reject(admit(s,'conflicted'));
 expect(s.f.storage.read().slice(0,before.length)).toEqual(before);
});


it('V25 accepts a same-policy first record in a second pressure scope', () => {
  const s = setup({ parentAttemptBudget: 2 });
  s.f.advance(1);
  value(admit(s, 'one'));
  value(finish(s, 'one', 'accepted'));
  const neighbor = value(s.f.api.scheduleEpisode({
    ...s.input,
    command: 'same-policy-second-scope',
    episodeKey: 'two',
    pressureScope: { ...scope, target: 'other' },
  }));
  expect(neighbor.policy).toEqual(s.policy);
  expect(neighbor.rollingAttempts).toBe(1);
});

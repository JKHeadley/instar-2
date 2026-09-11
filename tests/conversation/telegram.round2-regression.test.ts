// @ts-nocheck -- The imported conformance harness deliberately constructs malformed runtime boundary inputs.
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { consumeResult, canonical } from '../../src/index.js';
import { createFactStore, hashBytes } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { createTelegramIngress, createTelegramIntakeAdapter, createTelegramReplyOperationAdapter, extractTelegramUpdate, renderTelegramHtml, telegramConversation } from '../../src/conversation/index.js';
import { conversationFixture, telegramRaw } from './fixture.js';
import { value } from '../intake/fixtures.js';
import { jointVerificationFixture } from '../verification/joint-fixture.js';
const observations: any[] = [];
const inspect = (name: string, result: any) => {observations.push({name,result}); console.log('QA '+JSON.stringify({name,result}));return result;};
it('P12-NF-01 P12-NF-02 governed document inventory and retained audit input remain executable',()=>{const root=readFileSync('docs/16-conversation-adapters.md','utf8');for(let section=1;section<=14;section++)expect(root).toContain(`${section}. [`);const audit=readFileSync('docs/16-conversation-adapters/evidence/CLAUDE.md.audit-input');expect(createHash('sha256').update(audit).digest('hex')).toBe('006756b58b8cddb60a0addd147f1d0a2393464f8d0a63b513d857ee77b8895b4');});
function wire(f: any, api=f.api, parse?: any) {
 const ta=createTelegramIntakeAdapter(f.admitted,api);
 Object.assign(f.intake.deps,{adapter:parse?{...ta,parse}:ta,governance:f.governed.governance});
 const intake=value(createIntakePort(f.intake.deps));
 const facts=createFactStore(f.intake.context,f.intake.storage);
 const ingress=createTelegramIngress({boundary:f.admissionDependencies.boundary,admitted:f.admitted,api,intake,facts,observer:f.intake.deps.author.principal.id});
 return {intake,facts,ingress};
}
function update(id: number, modify=(u:any)=>{}) {const u=JSON.parse(telegramRaw('reply'));u.update_id=id;modify(u);return JSON.stringify(u);}

it('A01 accepts matched probe and defaults to long-poll',()=>{const f=conversationFixture();expect(f.admitted.mode).toBe('long-poll');});
it('A02 refuses every mismatched, unauthenticated, stale, future, or captureless probe neighbor',()=>{const f=conversationFixture();for(const [name,patch] of Object.entries({bot:{botId:'9002'},username:{username:'@different_bot'},api:{apiVersion:'0'},unauthenticated:{authenticated:false},stale:{observedAt:0,freshFor:1},future:{observedAt:101},missingCapture:{capture:{reference:'',hash:''}}})){f.setProbe({...f.admitted.probe,...patch});expect(inspect(name,f.admit()).kind).toBe('Refused');}});
it('P12-NF-07 P12-NF-46 A03 refuses unresolved identity capture and an unrelated probe record',()=>{const f=conversationFixture();f.setProbe({...f.admitted.probe,capture:{reference:'capture:does-not-exist',hash:hashBytes('unrelated bytes')}});expect(inspect('unwitnessed probe',f.admit()).kind).toBe('Refused');});
it('P12-NF-18 A04 refuses absent signed endpoint choice fact',()=>{const f=conversationFixture();const d={...f.declaration,bot:{...f.declaration.bot,id:'9002'},recordedEndpointChoice:{mode:'webhook' as const,signedChoice:{owner:'part-two' as const,name:'FactEnvelope' as const,id:'fact:telegram-endpoint-choice'},endpointAvailabilityEvidence:['probe:webhook-route'],captureBeforeResponseEvidence:['check:integration']}};const result=inspect('unwitnessed webhook choice',f.admit(d));expect(result.kind).toBe('Refused');expect(result.detail).toContain('endpoint choice');});
it('A05 refuses bot admitted concurrently in another mode',()=>{const f=conversationFixture();const d={...f.declaration,recordedEndpointChoice:{mode:'webhook',signedChoice:{owner:'part-two',name:'FactEnvelope',id:'missing'},endpointAvailabilityEvidence:['missing'],captureBeforeResponseEvidence:['missing']}};expect(f.admit(d as any).kind).toBe('Refused');});
it('A06 refuses token-shaped bytes in vault field',()=>{const f=conversationFixture();const token={...f.declaration.token,vault:'123456'+':'+'A'.repeat(35)};expect(inspect('raw token in vault',f.admit({...f.declaration,token} as any)).kind).toBe('Refused');});
it('P12-NF-04 P12-NF-07 P12-NF-42 A07 refuses replacement custodian without matching admission probe',()=>{const f=conversationFixture();const other={...f.api,id:'other-bot-custodian'};expect(()=>createTelegramIntakeAdapter(f.admitted,other)).toThrow();});
it('P12-NF-09 P12-NF-10 P12-NF-38 captured admitted byte-identical duplicate yields one admission and two receipts',()=>{const f=conversationFixture();const raw=telegramRaw('reply');f.bind(extractTelegramUpdate(raw,f.declaration).route);const w=wire(f);f.queue(raw);expect(value(w.ingress.pollOnce()).captured[0].intake).toBe('admitted');f.queue(raw);expect(value(w.ingress.pollOnce()).captured[0].intake).toBe('duplicate');const facts=value(w.facts.read());expect(facts.filter((x:any)=>x.kind==='intake-admitted')).toHaveLength(1);expect(facts.filter((x:any)=>x.kind==='intake-receipt')).toHaveLength(2);});
it('P12-NF-09 P12-NF-10 changed stable bytes at same identity refuse with mismatch record',()=>{const f=conversationFixture();const raw=update(100);f.bind(extractTelegramUpdate(raw,f.declaration).route);const w=wire(f);f.queue(raw);value(w.ingress.pollOnce());f.queue(update(100,u=>u.message.text='changed'));expect(value(w.ingress.pollOnce()).captured[0].intake).toBe('owned-refusal');expect(value(w.facts.read()).some((x:any)=>x.kind==='intake-mismatch')).toBe(true);});
it('C03 gap after first durable update holds offset',()=>{const f=conversationFixture();const w=wire(f);f.queue(update(100),update(102));const r=value(w.ingress.pollOnce());expect(r.nextOffset).toBe(101);});
it('P12-NF-18 C04 explicit initial offset cannot skip first uncaptured position',()=>{const f=conversationFixture({initialOffset:100});const w=wire(f);f.queue(update(101));expect(inspect('initial gap',value(w.ingress.pollOnce())).nextOffset).toBe(100);});
it('P12-NF-13 P12-NF-39 P12-NF-51 C05 failed parser after capture leaves owned hold and expiry',()=>{const f=conversationFixture();const w=wire(f,f.api,()=>{throw Error('parser cut');});f.queue(update(100));const r=value(w.ingress.pollOnce());expect(r.nextOffset).toBe(101);const held=value(w.facts.read()).filter((x:any)=>x.kind==='intake-held');inspect('parser hold',held.map((x:any)=>x.body));expect(held.length).toBe(1);f.intake.setTime(1200);value(w.intake.expireHolds());expect(value(w.facts.read()).some((x:any)=>x.kind==='intake-expired')).toBe(true);});
it('C06 different bot same update id does not collide',()=>{const a=conversationFixture(),b=conversationFixture({botId:'9002'});expect(extractTelegramUpdate(update(100),a.declaration).route.channel).not.toBe(extractTelegramUpdate(update(100),b.declaration).route.channel);});
it('P12-NF-49 C07 an epoch change cannot overwrite the same admitted contract version',()=>{const f=conversationFixture();const w=wire(f);f.queue(update(100));value(w.ingress.pollOnce());const d={...f.declaration,bot:{...f.declaration.bot,identityEpoch:'installation-2'}};expect(f.admit(d).kind).toBe('Refused');expect(value(w.ingress.currentOffset())).toBe(101);});
it('R01 mismatched route refuses before authentication',()=>{const f=conversationFixture();const a=createTelegramIntakeAdapter(f.admitted,f.api),raw=update(100),route=extractTelegramUpdate(raw,f.declaration).route;const result=a.authenticate(raw,{...route,channel:route.channel.replace('9001','9002')},f.intake.f.clock(100));expect(result.kind).toBe('Refused');expect(f.calls.authenticate).toHaveLength(0);});
it('R02 channel post and edited channel post never map to human',()=>{const f=conversationFixture();const u=JSON.parse(telegramRaw('channel-post'));expect(extractTelegramUpdate(JSON.stringify(u),f.declaration).principal.kind).toBe('system');u.edited_channel_post=u.channel_post;delete u.channel_post;expect(extractTelegramUpdate(JSON.stringify(u),f.declaration).principal.kind).toBe('system');});
it('P12-NF-08 P12-NF-17 R03 sender_chat with compatibility from cannot become human',()=>{const f=conversationFixture();const raw=update(100,u=>{u.message.sender_chat={id:-200,type:'channel'};u.message.from={id:136817688,is_bot:true,first_name:'Channel'};});expect(inspect('sender-chat principal',extractTelegramUpdate(raw,f.declaration)).principal.kind).toBe('system');});
it('P12-NF-16 P12-NF-17 R04 contradictory simultaneous update variants refuse',()=>{const f=conversationFixture();const u=JSON.parse(update(100));u.channel_post=JSON.parse(telegramRaw('channel-post')).channel_post;expect(()=>extractTelegramUpdate(JSON.stringify(u),f.declaration)).toThrow();});
it('P12-NF-06 P12-NF-17 P12-NF-18 R05 known unsupported chat-scoped update receives durable disposition',()=>{const f=conversationFixture();const w=wire(f);f.queue(JSON.stringify({update_id:100,message_reaction_count:{chat:{id:-1001,type:'supergroup'},message_id:1,date:100,reactions:[]}}));const r=inspect('reaction count disposition',w.ingress.pollOnce());expect(r.kind).toBe('Success');expect(value(w.facts.read()).filter((x:any)=>x.kind==='intake-receipt')).toHaveLength(1);});
it('P12-NF-06 P12-NF-17 P12-NF-18 R06 malformed later envelope cannot prevent earlier valid capture',()=>{const f=conversationFixture();const w=wire(f);f.queue(update(100),JSON.stringify({update_id:101}));w.ingress.pollOnce();expect(value(w.facts.read()).filter((x:any)=>x.kind==='intake-receipt')).toHaveLength(1);});
it('O01 canonical forum-general targets agree',()=>{const f=conversationFixture();expect(telegramConversation('9001',{chatId:'-1001',forum:true,messageThreadId:null})).toBe(telegramConversation('9001',{chatId:'-1001',forum:true,messageThreadId:1}));});
it('O02 exact render boundary accepts 4096 and refuses 4097, Unicode byte ceiling and controls',()=>{const f=conversationFixture(),render=(s:string)=>renderTelegramHtml(s,f.declaration,f.admissionDependencies.boundary);expect(render('x'.repeat(4096)).kind).toBe('Success');for(const s of ['x'.repeat(4097),'😀'.repeat(1025),'a\u0000b'.replace('\\u0000','\u0000')]){if(s.includes('\\'))continue;expect(render(s).kind).toBe('Refused');}expect(value(render('<&>'))).toBe('&lt;&amp;&gt;');});
it('P12-NF-05 P12-NF-27 P12-NF-28 P12-NF-42 O03 unclaimed matching reply is refused before provider call',()=>{const f=conversationFixture();const target={chatId:'123',forum:false,messageThreadId:null};const a=createTelegramReplyOperationAdapter(f.admitted,f.api,target,f.admissionDependencies.boundary);const message={type:'OutboundMessage',schemaVersion:1,id:'fake',semanticMessage:'fake',run:'fake',speaker:'fake',account:f.admitted.account,conversation:telegramConversation('9001',target),text:'hi',purpose:'ordinary-reply',sourceResult:'fake'};const r=inspect('unclaimed reply',a.invoke({operation:'missing',claim:'missing',digest:hashBytes('wrong'),message} as any));expect(r.kind).toBe('Refused');expect(f.calls.send.length).toBe(0);});

import { createEffectDoorway, decodeOutboundMessage } from '../../src/effects/index.js';
import { installTelegramReplyOperation } from '../../src/conversation/index.js';
import { effectFixture } from '../effects/fixture.js';
function outbound(lost=false) {
  const telegram = conversationFixture();
  if (lost) telegram.loseSendResponse();
  const target: any = { chatId: '-1001', forum: true, messageThreadId: 42 } as const;
  const conversation = telegramConversation(telegram.declaration.bot.id, target);
  const effects = effectFixture();
  const registerEntries = effects.host.boundary.register.entries as string[];
  registerEntries.push('telegram-ordinary-reply', telegram.admitted.id);
  const definition = {
    type: 'OperationDefinition', schemaVersion: 1, id: 'telegram-reply-definition:1',
    feature: 'telegram-ordinary-reply',
    version: 'telegram:9.2:ordinary-reply:v1',
    adapter: telegram.admitted.id,
    account: telegram.admitted.account,
    conversation,
    generation: effects.host.current().decode.register.generation.id,
    speaker: effects.host.principal.id,
    scopeDigest: value(canonical(effects.host.scope)).hash,
    durability: 'replicated' as const,
    replicas: 1,
    lossModel: 'fixture peer custody; production loss model remains an assembly admission concern',
    maxBytes: telegram.declaration.limits.maxReplyBytes,
    maxCharge: telegram.declaration.limits.maxCharge,
    timeout: telegram.declaration.limits.timeout,
    verificationBar: 'reply-bar:1',
  };
  const approvedIn = effects.authorize({ id: 'telegram-reply-approval',
    artifact: effects.capture(value(canonical(definition)).bytes), base: 'telegram-reply-base:1' });
  effects.versions([{ id: definition.version, subject: definition.feature,
    content: JSON.parse(value(canonical(definition)).bytes), contentHash: value(canonical(definition)).hash,
    since: effects.pending.id, supersedes: [], approvedIn, base: approvedIn.base, landedIn: null }]);
  const installed = value(installTelegramReplyOperation({
    id: definition.id, generation: definition.generation, admitted: telegram.admitted, target,
    speaker: definition.speaker, scopeDigest: definition.scopeDigest, durability: definition.durability,
    replicas: definition.replicas, lossModel: definition.lossModel, verificationBar: definition.verificationBar,
  }, effects.host, effects.spine));
  const message = value(decodeOutboundMessage({
    type: 'OutboundMessage', schemaVersion: 1, id: 'telegram-message:1', semanticMessage: 'five-semantic-message:telegram:1',
    run: effects.run.id, speaker: effects.host.principal.id, account: telegram.admitted.account, conversation,
    text: 'Here is the requested result.', purpose: 'ordinary-reply', sourceResult: effects.pending.id,
  }, effects.host));
  const adapter = createTelegramReplyOperationAdapter(telegram.admitted, telegram.api, target, effects.host.boundary);
  const doorway = createEffectDoorway({ ...effects.composition, adapter, assessment: null });

  const requestId = `request:${value(canonical([message.account, message.conversation, message.semanticMessage])).hash}`;
  const messageDigest = value(canonical(message)).hash;
  value(effects.transport.reserve({ command: 'telegram-external-admit', fence: effects.fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: requestId }, attempt: 'attempt:telegram:1',
    payloadDigest: messageDigest, charge: definition.maxCharge, run: effects.run,
    semanticMessage: message.semanticMessage, durability: definition.durability, replicas: definition.replicas }));
  const request = value(doorway.adopt({
    definition: installed.id, message, run: effects.run, pending: effects.pending.id,
    attempt: 'attempt:telegram:1', verificationOwner: 'reply-verifier', obligation: effects.obligation, closure: [],
  }));

return {telegram,target,effects,message,adapter,doorway,request};
}

it('P12-NF-27 P12-NF-28 P12-NF-33 O04 mutable caller target cannot redirect a registered reply',()=>{const x=outbound();x.target.chatId='999';x.target.messageThreadId=77;const r=value(x.doorway.dispatch(x.request,x.effects.fence));inspect('mutated target',{observation:r,send:x.telegram.calls.send});expect(x.telegram.calls.send[0]).toMatchObject({chatId:'-1001',messageThreadId:42});});
it('P12-NF-05 P12-NF-28 P12-NF-42 O03b registered operation still refuses an absent claim or changed digest',()=>{for(const changed of ['claim','digest']){const x=outbound();const reservation=value(x.effects.transport.inspect()).filter((row:any)=>row.record.type==='AdmissionReservation'&&row.record.request===x.request.id).at(-1).record;const capability=value(x.effects.transport.claim('round2-direct-claim',x.effects.fence,reservation.operation));const claimFact=value(x.effects.transport.inspect()).find((row:any)=>row.record.type==='AdmissionReservation'&&row.record.operation===reservation.operation&&row.record.state==='dispatch-claimed').fact.id;value(x.effects.transport.consume(capability,x.effects.fence));const result=x.adapter.invoke({operation:reservation.operation,claim:changed==='claim'?'missing':claimFact,digest:changed==='digest'?hashBytes('changed'):x.request.digest,message:x.message});expect(result.kind).toBe('Refused');expect(x.telegram.calls.send).toHaveLength(0);}});
it('O05 lost response retained unknown and repeat dispatch makes no second send',()=>{const x=outbound(true);const r=value(x.doorway.dispatch(x.request,x.effects.fence));expect(r.stage).toBe('unknown');expect(value(x.doorway.dispatch(x.request,x.effects.fence)).id).toBe(r.id);expect(x.telegram.calls.send).toHaveLength(1);expect(x.doorway.settle(r.operation).kind).toBe('Refused');inspect('retained uncertainty',r);});
it('O06 successful response is response only, with exact claim consumed once',()=>{const x=outbound();const r=value(x.doorway.dispatch(x.request,x.effects.fence));expect(r.stage).toBe('response');expect(value(x.doorway.dispatch(x.request,x.effects.fence)).id).toBe(r.id);expect(x.telegram.calls.send).toHaveLength(1);expect(value(x.effects.transport.inspect()).filter((v:any)=>v.record.type==='AdmissionReservation').at(-1)?.record.state).toBe('consumed');});

it('P12-NF-14 R07 first sender stays requester without a binding',()=>{const f=conversationFixture();const w=wire(f);f.queue(update(100));const r=value(w.ingress.pollOnce());expect(r.captured[0].intake).toBe('admitted');const admitted=value(w.facts.read()).find((x:any)=>x.kind==='intake-admitted');expect(admitted?.body).toMatchObject({binding:'none',work:{standing:'requester'}});});
it('R08 same id in different chat and sender cannot collapse',()=>{const f=conversationFixture();const w=wire(f);f.queue(update(100),update(100,u=>u.message.chat.id=-1002),update(100,u=>u.message.from.id=8));value(w.ingress.pollOnce());const facts=value(w.facts.read());expect(facts.filter((x:any)=>x.kind==='intake-admitted')).toHaveLength(3);expect(facts.filter((x:any)=>x.kind==='intake-collapse')).toHaveLength(0);});
it('R09 bound stop and requester stop follow Part Four distinct results',()=>{for(const bound of [true,false]){const f=conversationFixture();const raw=update(100,u=>u.message.text='/stop');if(bound)f.bind(extractTelegramUpdate(raw,f.declaration).route);const w=wire(f);f.queue(raw);expect(value(w.ingress.pollOnce()).captured[0].intake).toBe(bound?'stopped':'stop-signal');}});
it('R10 outbound mismatched account rejected before provider call',()=>{const f=conversationFixture();const target={chatId:'123',forum:false,messageThreadId:null};const a=createTelegramReplyOperationAdapter(f.admitted,f.api,target,f.admissionDependencies.boundary);expect(a.invoke({operation:'x',claim:'x',digest:hashBytes('x'),message:{account:'other',conversation:telegramConversation('9001',target),text:'x',purpose:'ordinary-reply'}} as any).kind).toBe('Refused');expect(f.calls.send).toHaveLength(0);});
it('R11 channel-origin input cannot be admitted as person by Part Four',()=>{const f=conversationFixture();const w=wire(f);f.queue(update(100,u=>{u.message.sender_chat={id:-200,type:'channel'};u.message.from={id:136817688,is_bot:true,first_name:'Channel'};}));const r=value(w.ingress.pollOnce());inspect('channel through Part Four',r);expect(value(w.facts.read()).filter((x:any)=>x.kind==='intake-admitted')).toHaveLength(0);});

import {authorAndAppend} from '../../src/facts/index.js';
import {privateKey} from '../facts/fixtures.js';

it('P12-NF-15 R12 contested binding cannot select newest operator, and stop stays recognized',()=>{for(const stop of [false,true]){const f=conversationFixture();const raw=update(100,u=>{if(stop)u.message.text='/stop';});const binding=f.bind(extractTelegramUpdate(raw,f.declaration).route);const json=(v:any)=>JSON.parse(value(canonical(v)).bytes);value(authorAndAppend({kind:'conversation-binding',schemaVersion:1,machine:'machine-a',principal:json(f.intake.f.alice),provenance:json(f.intake.f.alice.provenance),at:json(f.intake.f.now),body:binding.body,required:[...binding.predecessors.required,binding.id]},f.intake.context,createFactStore(f.intake.context,f.intake.storage),privateKey));const w=wire(f);f.queue(raw);const result=value(w.ingress.pollOnce());if(stop)expect(result.captured[0].intake).toBe('stopped');else{const row=value(w.facts.read()).find((x:any)=>x.kind==='intake-admitted');expect(row?.body.binding).toBe('none');}}});

it('W01 failed webhook capture cannot return protocol success',()=>{const f=conversationFixture({mode:'webhook'});Object.assign(f.intake.deps,{capture:{owner:'part-ten',preserve(){throw Error('durable capture unavailable');}}});const w=wire(f);expect(w.ingress.receiveWebhook(update(100)).kind).toBe('Refused');expect(value(w.facts.read()).filter((x:any)=>x.kind==='intake-receipt')).toHaveLength(0);});
it('P12-NF-31 O07 provider parse rejection stays captured and never triggers alternate rendering',()=>{const x=outbound();const rejection='{"ok":false,"error_code":400,"description":"parse rejection"}';x.telegram.setSendResult(rejection);const r=value(x.doorway.dispatch(x.request,x.effects.fence));expect(r.stage).toBe('response');expect(x.effects.ctx.captures[r.capture.reference]?.bytes).toBe(rejection);expect(value(x.doorway.dispatch(x.request,x.effects.fence)).id).toBe(r.id);expect(x.telegram.calls.send).toHaveLength(1);expect(x.doorway.settle(r.operation).kind).toBe('Refused');});
it('O08 stopped operation refuses at Eight and performs zero provider calls',()=>{const x=outbound();x.effects.stop();expect(x.doorway.dispatch(x.request,x.effects.fence).kind).toBe('Refused');expect(x.telegram.calls.send).toHaveLength(0);});
it('P12-NF-35 real Part Nine assessment evaluates the captured operation before settlement',()=>{const f=jointVerificationFixture();const reference=value(f.assessment.assess(f.input));const assessment=value(f.assessment.read(reference,f.input));expect(assessment.outcome.kind).toBe('happened');const records=value(f.runtime.inspect()).map((row:any)=>row.record);const stored=records.find((record:any)=>record.type==='VerificationAssessment'&&record.operation===f.reservation.operation);expect(stored).toMatchObject({type:'VerificationAssessment',operation:f.reservation.operation,operationDigest:f.request.digest});expect(records.find((record:any)=>record.type==='VerificationRequest'&&record.id===stored.request)).toMatchObject({operation:f.reservation.operation,operationDigest:f.request.digest});});
it('P12-NF-50 capability declaration remains honestly dark and names every inhibited Telegram operation',()=>{const capabilities=readFileSync('generated/capabilities.md','utf8');expect(capabilities).toContain('telegram-conversation-adapter: dark');for(const operation of ['media','reaction','typing','delete','edit','aggregate'])expect(capabilities).toContain(`telegram.operation.${operation}.inhibited`);expect(capabilities).toContain('live proof: unavailable');});

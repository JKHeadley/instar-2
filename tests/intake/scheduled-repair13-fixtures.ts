import { canonical,decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { intakeFixture,json,message,route,value } from './fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';

export function packageRecorderPersonAdmission(channel:string,directory?:string,record=true) {
  const f=intakeFixture(directory?{ directory }:{});
  const declarations=structuredClone(f.registerInput.sources.map(source=>source.declaration)) as any[];
  declarations.find(declaration=>declaration.id==='host')!.requiredFacts.authenticationClass.push(
    { stimulusType:'scheduled-tick',class:'verified' });
  const governance=f.govern(declarations).governance;
  const identity={ id:f.deps.author.principal.id,kind:'system' as const };
  const proof=f.f.proof(identity,identity,'package-system-principal'); f.syncCaptures();
  const principal=value(decode('VerifiedPrincipal',{ type:'VerifiedPrincipal',schemaVersion:1,...identity },
    { ...f.context.decode,provenance:proof.p }));
  const deps={ ...f.deps,governance,author:{ ...f.deps.author,principal,provenance:principal.provenance } };
  const port=value(createIntakePort(deps));
  const admitted=record?value(port.receive(message('ordinary message with a package-authenticated recorder'),
    { ...route,channel })):undefined;
  if(admitted&&admitted.kind!=='admitted') throw new Error('expected ordinary person admission');
  return { f,deps,port,admitted };
}

export function mixedPersonThenScheduled() {
  const f=scheduledFixture(),grant=f.grant(),tick=f.tick(),discovery=f.discovery(tick.eventId);
  const declarations=structuredClone(f.deps.governance.register.entries.map(entry=>{
    const { declaredBy:_,...declaration }=entry.declaration; return declaration;
  })) as any[];
  declarations.find(declaration=>declaration.id==='scheduled-ingress')!.requiredFacts.authenticationClass.push(
    { stimulusType:'message',class:'channel-attested' });
  const governance=f.govern(declarations).governance;
  const proof=f.f.proof({ id:'alice',kind:'person' },{ id:'alice',kind:'person' },'identity',true); f.syncCaptures();
  const adapter={ ...f.deps.adapter,authenticate(raw:string,inputRoute:any,at:any) {
    if(JSON.parse(raw).kind==='message') return f.f.success({ provenance:{ ...proof.input,adapter:'scheduled-ingress' },
      principalId:'alice',principalKind:'person' as const,channel:inputRoute.channel,sender:inputRoute.sender,
      identityEpoch:inputRoute.identityEpoch });
    return f.deps.adapter.authenticate(raw,inputRoute,at);
  } };
  const deps={ ...f.deps,adapter,governance },port=value(createIntakePort(deps as any));
  const ordinary=value(port.receive(message('ordinary person history'),{ ...route,eventId:'ordinary-before-tick' }));
  if(ordinary.kind!=='admitted') throw new Error('expected ordinary admission before tick');
  return { f,grant,tick,discovery,deps,port,input:{ raw:tick.raw,route:tick.route,
    discovery:{ owner:'part-two' as const,name:'FactEnvelope' as const,id:discovery.fact.id } } };
}

export function changedRecorderCandidate(recordType:'identity'|'package-system-principal',calendar=false) {
  const x=scheduledRepair6Setup(); value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any;
  const removed=x.f.facts().filter(fact=>['intake-scheduled-principal','intake-resolved'].includes(fact.kind)).map(fact=>fact.id);
  x.f.frames.splice(x.f.frames.findIndex((fact:any)=>fact.kind==='intake-scheduled-principal'));
  const identity={ id:x.f.principal.id,kind:'system' as const };
  const proof=x.f.f.proof(identity,identity,recordType); x.f.syncCaptures();
  const provenance=value(decode('Provenance',{ ...proof.input,adapter:'scheduled-ingress' },x.f.context.decode));
  const principal=value(decode('VerifiedPrincipal',{ type:'VerifiedPrincipal',schemaVersion:1,...identity },
    { ...x.f.context.decode,provenance }));
  const base=scheduledOwnerContext(x.f);
  const context={ ...base,decode:{ ...base.decode,
    principals:[...base.decode.principals?.filter(candidate=>candidate.id!==principal.id)??[],principal],provenance } };
  const body=structuredClone(original.body) as any;
  if(calendar) body.intent.ask.calendarPolicyVersion='unwitnessed-calendar';
  const required=original.predecessors.required.filter((id:string)=>!removed.includes(id));
  const previous=x.f.frames.at(-1) as any;
  const candidate=x.f.f.next(previous,{ kind:original.kind,principal,provenance,at:original.at,body,
    predecessors:{ inSegment:previous.id,frontier:{},required } },context);
  const append=()=>authorAndAppend({ kind:original.kind,schemaVersion:1,machine:'machine-a',principal:json(principal),
    provenance:json(provenance),at:json(original.at),body,required },context,createFactStore(context,x.f.storage),
  x.f.deps.author.privateKey);
  return { ...x,context,candidate,append };
}

export function unregisteredScheduledCandidate(recordType:'identity'|'package-system-principal') {
  const x=scheduledRepair6Setup(); value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any;
  const start=x.f.frames.findIndex((fact:any)=>fact.kind==='intake-receipt');
  const oldReceipt=x.f.frames[start] as any; x.f.frames.splice(start);
  const identity={ id:x.f.principal.id,kind:'system' as const };
  const proof=x.f.f.proof(identity,identity,recordType); x.f.syncCaptures();
  const principal=value(decode('VerifiedPrincipal',{ type:'VerifiedPrincipal',schemaVersion:1,...identity },
    { ...x.f.context.decode,provenance:proof.p }));
  const context=scheduledOwnerContext(x.f),inputRoute={ ...x.input.route,adapter:'host',identityEpoch:proof.p.record.hash };
  const receiptBody={ ...oldReceipt.body,adapter:'host',ingress:value(canonical({ channel:inputRoute.channel,
    sender:inputRoute.sender,identityEpoch:inputRoute.identityEpoch,eventId:inputRoute.eventId })).bytes };
  const receipt=value(authorAndAppend({ kind:'intake-receipt',schemaVersion:1,machine:'machine-a',
    principal:json(original.principal),provenance:json(original.provenance),at:json(oldReceipt.at),body:receiptBody,
    required:[] },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey)).fact;
  const logicalId=value(canonical([inputRoute.adapter,inputRoute.channel,inputRoute.sender,inputRoute.identityEpoch,inputRoute.eventId])).hash;
  const body={ ...original.body,adapter:'host',receipt:receipt.id,identityEpoch:inputRoute.identityEpoch,logicalId,
    intent:{ ...original.body.intent,id:logicalId,via:'host',principal:json(principal) } };
  const required=[receipt.id,x.grant.fact.id,x.discovery.fact.id],previous=receipt;
  const candidate=x.f.f.next(previous,{ kind:original.kind,principal:original.principal,provenance:original.provenance,
    at:original.at,body,predecessors:{ inSegment:receipt.id,frontier:{},required } },context);
  const append=()=>authorAndAppend({ kind:original.kind,schemaVersion:1,machine:'machine-a',
    principal:json(original.principal),provenance:json(original.provenance),at:json(original.at),body,required },
  context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey);
  return { ...x,context,candidate,append };
}

export function durableScheduledTarget(source:ReturnType<typeof changedRecorderCandidate>,directory:string) {
  const target=scheduledFixture({ directory }); target.installSchemas();
  Object.assign(target.context,{ schemas:source.f.context.schemas });
  Object.assign(target.f.captures,source.f.f.captures); target.syncCaptures();
  return { target,store:createFactStore(scheduledOwnerContext(target),target.storage) };
}

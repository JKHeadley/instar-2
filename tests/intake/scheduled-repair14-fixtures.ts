import { decode } from '../../src/index.js';
import { authorAndAppend, createFactStore, signEnvelope } from '../../src/facts/index.js';
import { json, value } from './fixtures.js';
import { scheduledOwnerContext, scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';

export function mismatchedIntentPrincipal(kind: 'person' | 'agent') {
  const x=scheduledRepair6Setup(); value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,identity={ id:`repair14:${kind}`,kind };
  const proof=x.f.f.proof(identity,identity,'identity'); x.f.syncCaptures();
  const provenance=value(decode('Provenance',{ ...proof.input,adapter:'scheduled-ingress' },x.f.context.decode));
  const principal=value(decode('VerifiedPrincipal',{ type:'VerifiedPrincipal',schemaVersion:1,...identity },
    { ...x.f.context.decode,provenance }));
  const base=scheduledOwnerContext(x.f),context={ ...base,
    decode:{ ...base.decode,principals:[...base.decode.principals??[],principal] } };
  const body={ ...original.body,intent:{ ...original.body.intent,principal:json(principal) } };
  const signed=signEnvelope({ ...original,body },x.f.deps.author.privateKey) as any;
  return { ...x,original,body,context,signed };
}

export function resolutionCandidate(mutation: 'none' | 'wrong-principal' | 'wrong-binding') {
  const x=scheduledRepair6Setup(); value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,resolution=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f);
  const body=structuredClone(resolution.body) as Record<string,unknown>;
  if(mutation==='wrong-principal') body.principalId='different:principal';
  if(mutation==='wrong-binding') body.binding='different:binding';
  const changed=value(authorAndAppend({ kind:'intake-resolved',schemaVersion:1,machine:'machine-a',
    principal:json(resolution.principal),provenance:json(resolution.provenance),at:json(resolution.at),body:json(body),
    required:resolution.predecessors.required },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey)).fact;
  const signed=x.f.f.next(changed,{ kind:original.kind,principal:original.principal,provenance:original.provenance,
    at:original.at,body:original.body,predecessors:{ ...original.predecessors,inSegment:changed.id,
      required:original.predecessors.required.map((id:string)=>id===resolution.id?changed.id:id) } },context);
  const receipt=x.f.facts().find(fact=>fact.kind==='intake-receipt')!,pin=(receipt.body as any).capture;
  return { ...x,original,context,signed,receipt,pin };
}

export function addSecondGrant(x: ReturnType<typeof scheduledRepair6Setup>) {
  const grant=x.f.f.grant({ id:'scheduled-grant:repair14-second',grantee:x.f.principal,
    standing:'delegate',actions:['work'],scope:x.f.f.scope }); x.f.syncCaptures();
  const context={ ...x.f.context,decode:{ ...x.f.context.decode,provenance:grant.source } };
  return value(authorAndAppend({ kind:'scheduled-system-grant',schemaVersion:1,machine:'machine-a',
    principal:json(x.f.f.alice),provenance:json(grant.source),at:json(x.f.f.now),body:json({ grant }),required:[] },
  context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey)).fact;
}

export function admissionWithSecondGrant() {
  const x=scheduledRepair6Setup(),admitted:any=value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any; addSecondGrant(x);
  const context=scheduledOwnerContext(x.f),appended=value(authorAndAppend({ kind:original.kind,schemaVersion:1,
    machine:'machine-a',principal:json(original.principal),provenance:json(original.provenance),at:json(original.at),
    body:original.body,required:original.predecessors.required },context,createFactStore(context,x.f.storage),
  x.f.deps.author.privateKey));
  return { ...x,admitted,original,context,appended };
}

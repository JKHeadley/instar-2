import { decode } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { json, value } from './fixtures.js';
import { scheduledOwnerContext, scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';
import { scheduledEvidenceBundle } from './scheduled-repair9-fixtures.js';

export function unavailableDiscoveryAdmission(mutation: 'wrong-event'|'negative'|'stale') {
  const x=scheduledRepair6Setup(),pin=`repair15:${mutation}`;
  const hash=x.f.f.capture('repair15 signed discovery',pin); x.f.syncCaptures();
  const claim=mutation==='wrong-event'
    ?{ ...x.discovery.evidence.claim,subject:'another-event' }
    :mutation==='negative'?{ ...x.discovery.evidence.claim,value:false }:x.discovery.evidence.claim;
  const evidence=value(decode('Evidence',{
    ...json(x.discovery.evidence) as Record<string,unknown>,id:`repair15:${mutation}:evidence`,claim,
    capture:{ reference:pin,hash },
    ...(mutation==='stale'?{ freshFor:0,observedAt:json(x.f.clock(99,'machine-a')) }:{}),
  },x.f.context.decode));
  const replacement=scheduledEvidenceBundle(x,{ evidence }); x.f.setTime(101);
  value(x.f.port().receiveScheduledTick(x.input));
  const admission=x.f.frames.pop() as any,resolution=x.f.frames.pop() as any;
  const context=scheduledOwnerContext(x.f),store=createFactStore(context,x.f.storage);
  const resolutionRequired=resolution.predecessors.required.map((id:string)=>
    id===x.discovery.fact.id?replacement.id:id);
  const changed=value(authorAndAppend({
    kind:resolution.kind,schemaVersion:1,machine:'machine-a',principal:json(resolution.principal),
    provenance:json(resolution.provenance),at:json(resolution.at),body:resolution.body,
    required:resolutionRequired,
  },context,store,x.f.deps.author.privateKey)).fact;
  const required=admission.predecessors.required.map((id:string)=>
    id===x.discovery.fact.id?replacement.id:id===resolution.id?changed.id:id);
  const signed=x.f.f.next(changed,{
    kind:admission.kind,principal:admission.principal,provenance:admission.provenance,
    at:admission.at,body:admission.body,
    predecessors:{ ...admission.predecessors,inSegment:changed.id,required },
  },context);
  delete x.f.f.captures[pin];
  Object.assign((x.f.context.captures as any)[pin],{ status:'missing',bytes:null });
  return { ...x,pin,context,signed };
}

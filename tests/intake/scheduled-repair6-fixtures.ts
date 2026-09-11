import { canonical } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { scheduledIntakeWorkRegistration } from '../../src/intake/scheduled-a/index.js';
import { json, value } from './fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';

export const scheduledFactRef = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });

export function scheduledRepair6Setup() {
  const f=scheduledFixture(),grant=f.grant(),tick=f.tick(),discovery=f.discovery(tick.eventId);
  return { f,grant,tick,discovery,input: { raw: tick.raw,route: tick.route,discovery: scheduledFactRef(discovery.fact.id) } };
}

export function scheduledOwnerContext(f: ReturnType<typeof scheduledFixture>) {
  const registration=value(scheduledIntakeWorkRegistration({ site: f.context.site,preserved: f.context.preserved,
    register: f.context.decode.register },f.principal.id,f.deps.governance.register));
  return { ...f.context,ownedBodies: [...f.context.ownedBodies??[],registration],
    decode: { ...f.context.decode,provenance: f.provenance } };
}

export function missingScheduledPrincipalHistory(change=false) {
  const x=scheduledRepair6Setup(),admitted=value(x.f.port().receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const frames=x.f.frames as FactEnvelope[],original=frames.pop()!;
  const principalIndex=frames.findIndex(fact => fact.kind==='intake-scheduled-principal');
  const priorPrincipal=frames[principalIndex]!;
  const priorResolution=frames.find(fact => fact.kind==='intake-resolved')!;
  frames.splice(principalIndex);
  const context=scheduledOwnerContext(x.f);
  const append=(kind: string,body: any,required: readonly string[]) => authorAndAppend({ kind,schemaVersion: 1,
    machine: 'machine-a',principal: json(x.f.principal),provenance: json(x.f.provenance),at: json(x.f.f.now),body,required },
  context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey);
  const resolved=value(append('intake-resolved',priorResolution.body,
    priorResolution.predecessors.required)).fact;
  const required=original.predecessors.required.filter(id => id!==priorPrincipal.id)
    .map(id => id===priorResolution.id?resolved.id:id);
  const body=structuredClone(original.body) as any;
  if(change) body.intent.ask.calendarPolicyVersion='calendar:unwitnessed';
  return { ...x,admitted,original,context,body,required,append };
}

export function changedScheduledRoute(field: 'adapter'|'channel'|'identityEpoch'|'sender',replacement: string,
  mode: 'append'|'signed'='append') {
  const x=scheduledRepair6Setup(),admitted=value(x.f.port().receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const frames=x.f.frames as FactEnvelope[],start=frames.findIndex(fact => fact.kind==='intake-receipt');
  const tail=frames.splice(start),ids=new Map<string,string>();
  const route={ ...x.tick.route,[field]: replacement };
  const logicalId=value(canonical([route.adapter,route.channel,route.sender,route.identityEpoch,route.eventId])).hash;
  const context=scheduledOwnerContext(x.f);
  let result: Result<any>|undefined,signed: FactEnvelope|undefined;
  for(const old of tail) {
    const body=structuredClone(old.body) as any;
    if(old.kind==='intake-receipt') body.ingress=value(canonical({ channel: route.channel,sender: route.sender,
      identityEpoch: route.identityEpoch,eventId: route.eventId })).bytes;
    if(body.adapter) body.adapter=route.adapter;
    if(body.logicalId) Object.assign(body,{ logicalId,channel: route.channel,sender: route.sender,
      identityEpoch: route.identityEpoch,eventId: route.eventId });
    if(body.receipt) body.receipt=ids.get(body.receipt)??body.receipt;
    if(body.intent) { body.intent.id=logicalId; body.intent.via=route.adapter; }
    const required=old.predecessors.required.map(id => ids.get(id)??id);
    if(old.kind==='intake-admitted'&&mode==='signed') {
      const previous=frames.at(-1)!;
      signed=x.f.f.next(previous,{ kind: old.kind,principal: old.principal,provenance: old.provenance,
        at: old.at,body,predecessors: { ...old.predecessors,inSegment: previous.id,required } },context);
      continue;
    }
    result=authorAndAppend({ kind: old.kind,schemaVersion: 1,machine: old.machine,principal: json(old.principal),
      provenance: json(old.provenance),at: json(old.at),body,required },context,
    createFactStore(context,x.f.storage),x.f.deps.author.privateKey);
    if(old.kind!=='intake-admitted') ids.set(old.id,value(result).fact.id);
  }
  return { ...x,admitted,context,result,signed };
}

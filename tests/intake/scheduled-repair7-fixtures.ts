import { canonical,decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { intakeFixture,json,value } from './fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';
import { scheduledOwnerContext } from './scheduled-repair6-fixtures.js';

const ref=(id: string) => ({ owner: 'part-two' as const,name: 'FactEnvelope' as const,id });

export function conversationPort(f: ReturnType<typeof scheduledFixture>) {
  const ordinary=intakeFixture();
  return value(createIntakePort({ ...f.deps,adapter: ordinary.deps.adapter,governance: f.govern().governance }));
}

export function unwitnessedScheduledAdmission(variant: 'version'|'text'|'missing-version'|'valid-shape') {
  const f=scheduledFixture(); f.grant();
  const tick=f.tick(),discovery=f.discovery(tick.eventId);
  const admitted=value(f.port().receiveScheduledTick({ raw: tick.raw,route: tick.route,discovery: ref(discovery.fact.id) }));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const start=f.frames.findIndex((row: any) => row.kind==='intake-receipt');
  const tail=f.frames.splice(start) as any[];
  let ask: any=structuredClone(tick.body);
  if(variant==='version') ask.schemaVersion=2;
  if(variant==='text') ask='ordinary text';
  if(variant==='missing-version') delete ask.schemaVersion;
  const raw=value(canonical(ask)).bytes,capture=value(f.deps.capture.preserve(raw,f.f.now));
  const context=scheduledOwnerContext(f),ids=new Map<string,string>(); let candidate: any;
  for(const old of tail) {
    if(old.kind==='intake-scheduled-principal') continue;
    const body=structuredClone(old.body);
    if(old.kind==='intake-receipt') body.capture=json(capture);
    if(body.rawHash) body.rawHash=capture.hash;
    if(body.receipt) body.receipt=ids.get(body.receipt)??body.receipt;
    if(body.intent) { body.intent.raw=capture.hash; body.intent.ask=ask; }
    const required=old.predecessors.required.filter((id: string) => id!==discovery.fact.id&&id!==admitted.principal.fact.id)
      .map((id: string) => ids.get(id)??id);
    const input={ kind: old.kind,schemaVersion: 1,machine: 'machine-a',principal: json(old.principal),
      provenance: json(old.provenance),at: json(old.at),body,required };
    if(old.kind==='intake-admitted') { candidate=input; break; }
    const written=value(authorAndAppend(input,context,createFactStore(context,f.storage),f.deps.author.privateKey));
    ids.set(old.id,written.fact.id);
  }
  return { f,context,candidate,admitted };
}

export function messageOnlyScheduledAttempt() {
  const f=scheduledFixture(); f.grant();
  const tick=f.tick(),discovery=f.discovery(tick.eventId);
  const admitted=value(f.port().receiveScheduledTick({ raw: tick.raw,route: tick.route,discovery: ref(discovery.fact.id) }));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const all=f.frames.splice(0) as any[],template=all.find(row => row.kind==='intake-admitted');
  const provenance=value(decode('Provenance',{ ...f.provenanceInput,adapter: 'host' },f.context.decode));
  const principal=value(decode('VerifiedPrincipal',{ type: 'VerifiedPrincipal',schemaVersion: 1,id: f.principal.id,kind: 'system' },
    { ...f.context.decode,provenance }));
  f.f.principals.splice(f.f.principals.findIndex(candidate => candidate.id===principal.id),1,principal);
  Object.assign(f.context,{ decode: { ...f.context.decode,principals: [
    ...f.context.decode.principals!.filter(candidate => candidate.id!==principal.id),principal] } });
  const grant=f.f.grant({ id: 'grant:host-scheduled',grantee: principal,standing: 'delegate',actions: ['work'],scope: f.f.scope });
  f.syncCaptures();
  const context=scheduledOwnerContext(f); context.decode={ ...context.decode,provenance };
  const append=(kind: string,body: any,required: string[],actor=principal,source=provenance) => authorAndAppend({
    kind,schemaVersion: 1,machine: 'machine-a',principal: json(actor),provenance: json(source),at: json(f.f.now),body,required,
  },{ ...context,decode: { ...context.decode,provenance: source } },createFactStore({ ...context,decode: {
    ...context.decode,provenance: source } },f.storage),f.deps.author.privateKey);
  const grantFact=value(append('scheduled-system-grant',json({ grant }),[],f.f.alice,grant.source)).fact;
  const evidence=value(append('scheduled-discovery-evidence',json({ evidence: discovery.evidence }),[])).fact;
  const receiptBody=structuredClone(all.find(row => row.kind==='intake-receipt').body); receiptBody.adapter='host';
  const receipt=value(append('intake-receipt',receiptBody,[])).fact;
  const witness=value(append('intake-scheduled-principal',json({ principal }),[grantFact.id])).fact;
  const logicalId=value(canonical(['host',tick.route.channel,principal.id,provenance.record.hash,tick.eventId])).hash;
  const body=structuredClone(template.body);
  Object.assign(body,{ adapter: 'host',logicalId,receipt: receipt.id });
  body.intent.id=logicalId; body.intent.via='host'; body.intent.principal=json(principal);
  const resolved=structuredClone(all.find(row => row.kind==='intake-resolved').body);
  Object.assign(resolved,{ adapter: 'host',logicalId,receipt: receipt.id,authentication: json(provenance.record) });
  const resolution=value(append('intake-resolved',resolved,[receipt.id,grantFact.id,evidence.id])).fact;
  Object.assign(f,{ principal,provenance,deps: { ...f.deps,author: { ...f.deps.author,principal,provenance } } });
  return { f,context,admitted: { ...admitted,standing: { ...admitted.standing,id: grant.id,fact: ref(grantFact.id) },
    principal: { ...admitted.principal,fact: ref(witness.id) } },append,body,
    required: [receipt.id,witness.id,grantFact.id,evidence.id,resolution.id],principal,provenance };
}

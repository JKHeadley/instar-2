import { canonical, consumeResult, decode } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { intakeFixture, json, message, route, value } from './fixtures.js';
import { scheduledRepair6Setup, scheduledOwnerContext } from './scheduled-repair6-fixtures.js';

export const scheduledFactReference=(id: string) =>
  ({ owner: 'part-two' as const,name: 'FactEnvelope' as const,id });

export function extraScheduledEvidence(x: ReturnType<typeof scheduledRepair6Setup>,id: string,
  claim: ReturnType<typeof scheduledRepair6Setup>['discovery']['evidence']['claim'],freshFor=1000) {
  return value(decode('Evidence',{ ...json(x.discovery.evidence) as any,id,claim,freshFor },x.f.context.decode));
}

export function scheduledEvidenceBundle(x: ReturnType<typeof scheduledRepair6Setup>,body: Record<string,any>) {
  const fields=Object.fromEntries(Object.keys(body).map(key=>[key,{ kind: 'constitutional',type: 'Evidence' }]));
  Object.assign(x.f.context,{ schemas: [...x.f.context.schemas,{ ...x.f.evidenceSchema,
    kind: 'reviewer-evidence-bundle',fields }] });
  const context={ ...x.f.context,decode: { ...x.f.context.decode,provenance: x.f.provenance } };
  return value(authorAndAppend({ kind: 'reviewer-evidence-bundle',schemaVersion: 1,machine: 'machine-a',
    principal: json(x.f.principal),provenance: json(x.f.provenance),at: json(x.f.f.now),body: json(body),required: [] },
  context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey)).fact;
}

export function bundledScheduledCandidate(order: 'discovery-first'|'unrelated-first') {
  const x=scheduledRepair6Setup();
  const unrelated=extraScheduledEvidence(x,'evidence:unrelated',
    { subject: 'other',predicate: 'unrelated-observation',value: true });
  const matching=extraScheduledEvidence(x,'evidence:bundled-discovery',x.discovery.evidence.claim);
  const bundle=scheduledEvidenceBundle(x,order==='discovery-first'
    ?{ a: matching,b: unrelated }:{ a: unrelated,b: matching });
  const admitted:any=value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,resolution=x.f.frames.pop() as any;
  const context=scheduledOwnerContext(x.f),store=createFactStore(context,x.f.storage);
  const replacement=value(authorAndAppend({ kind: resolution.kind,schemaVersion: 1,machine: 'machine-a',
    principal: json(resolution.principal),provenance: json(resolution.provenance),at: json(resolution.at),
    body: resolution.body,required: resolution.predecessors.required.map((id: string)=>
      id===x.discovery.fact.id?bundle.id:id) },context,store,x.f.deps.author.privateKey)).fact;
  const required=original.predecessors.required.map((id: string)=>id===x.discovery.fact.id?bundle.id
    :id===resolution.id?replacement.id:id);
  return { ...x,bundle,admitted,original,context,store,required };
}

export function appendAdmissionWithUnrelatedEvidence(freshFor: number) {
  const x=scheduledRepair6Setup();
  const evidence=extraScheduledEvidence(x,'evidence:unrelated',
    { subject: 'other',predicate: 'unrelated-observation',value: true },freshFor);
  const extra=scheduledEvidenceBundle(x,{ evidence }); x.f.setTime(101);
  const admitted:any=value(x.f.port().receiveScheduledTick(x.input)),original=x.f.frames.pop() as any;
  const context=scheduledOwnerContext(x.f);
  const written=value(authorAndAppend({ kind: original.kind,schemaVersion: 1,machine: 'machine-a',
    principal: json(original.principal),provenance: json(original.provenance),at: json(original.at),body: original.body,
    required: [...original.predecessors.required,extra.id] },context,createFactStore(context,x.f.storage),
  x.f.deps.author.privateKey));
  return { ...x,admitted,written,context };
}

export const BASE_32E5961_ORDINARY_TRANSCRIPT =
  'sha256:6afe17cbb0dbf1ceb199a397039866d5e2f0f7cd76aae316bf7d816cf1dfc044';

export function ordinaryPortTranscript(membership: 'absent'|'present'|'none') {
  const f=intakeFixture(),declared=f.registerInput.sources.map(source=>source.declaration);
  if(membership!=='none') declared.push(f.r.declaration('unrelated-parser','parsers',{
    fixture: 'check',authenticationClass: [{ stimulusType: 'message',class: 'channel-attested' }],
    eventIdAuthority: { mintedBy: 'provider',uniquenessScope: 'channel-and-sender',replayWindow: 1000,
      fallbackFingerprint: { policy: 'none',basis: 'provider id required' } },ackPolicy: 'never',
  },{ profile: f.r.profile }));
  if(membership==='present') Object.assign(f.context,{ decode: { ...f.context.decode,register: {
    ...f.context.decode.register,entries: [...f.context.decode.register.entries,'unrelated-parser'],
  } } });
  const construction=createIntakePort({ ...f.deps,governance: f.govern(declared).governance });
  const port=consumeResult(construction,{ Success: result=>result,Refused: ()=>null });
  const result=port?.receive(message('unchanged ordinary input'),route);
  const wire:any=result?consumeResult<any,any>(result,{ Success: result=>({ kind: 'Success',value: result }),
    Refused: refusal=>({ kind: 'Refused',refusal }) }):consumeResult<any,any>(construction,{
    Success: ()=>null,Refused: refusal=>({ kind: 'RefusedConstruction',refusal }),
  });
  return { f,construction,result,hash: value(canonical({ wire,facts: f.facts() })).hash };
}

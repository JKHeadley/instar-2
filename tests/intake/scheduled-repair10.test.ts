import { expect,it } from 'vitest';
import { canonical,consumeResult,decode } from '../../src/index.js';
import { authorAndAppend,createFactStore,prepareSnapshot,signEnvelope,verifyAndAdmit } from '../../src/facts/index.js';
import { createIntakePort,intakeWorkRegistration } from '../../src/intake/index.js';
import { intakeFixture,json,message,refused,route,value } from './fixtures.js';
import { scheduledRepair6Setup,scheduledOwnerContext } from './scheduled-repair6-fixtures.js';
import { extraScheduledEvidence,scheduledEvidenceBundle,scheduledFactReference } from './scheduled-repair9-fixtures.js';

const ref=scheduledFactReference;

it.each(['single','identical','different-identity'] as const)
('P4-ST-47 V109 Slice A requires one discovery witness field (%s)',mode=>{
  const x=scheduledRepair6Setup();
  const second=mode==='identical'?x.discovery.evidence:extraScheduledEvidence(x,'evidence:second',{
    subject:x.tick.eventId,predicate:'scheduled-discovery',value:true,
  });
  const fact=scheduledEvidenceBundle(x,mode==='single'?{ a:x.discovery.evidence }:{ entrer:x.discovery.evidence,again:second });
  const result=x.f.port().receiveScheduledTick({ ...x.input,discovery:ref(fact.id) });
  if(mode==='single') expect(value(result).kind).toBe('scheduled-admitted');
  else refused(result,'unsupported-in-slice-a');
});

it.each(['plain','dual'] as const)
('P4-PRESERVE-03 V110 classifies ordinary input by stimulus rather than adapter capability (%s)',mode=>{
  const f=intakeFixture(),declared=structuredClone(f.registerInput.sources.map(source=>source.declaration)) as any[];
  if(mode==='dual') {
    const host=declared.find(declaration=>declaration.id==='host')!;
    (host.requiredFacts.authenticationClass as unknown[]).push({ stimulusType:'scheduled-tick',class:'verified' });
  }
  const port=value(createIntakePort({ ...f.deps,governance:f.govern(declared).governance }));
  const result=port.receive(message('unchanged ordinary input'),route);
  expect(value(result).kind).toBe('admitted');
  const wire=consumeResult<any,any>(result,{ Success:admitted=>({ kind:'Success',value:admitted }),
    Refused:refusal=>({ kind:'Refused',refusal }) });
  expect(value(canonical({ wire,facts:f.facts() })).hash)
    .toBe('sha256:6afe17cbb0dbf1ceb199a397039866d5e2f0f7cd76aae316bf7d816cf1dfc044');
});

it.each(['available','unrelated-unavailable','discovery-unavailable'] as const)
('P4-ST-48 V111 retains signed partial admission without promoting it (%s)',mode=>{
  const x=scheduledRepair6Setup(),captureReference='reviewer:independent-unrelated';
  const captureHash=x.f.f.capture('unrelated independent observation',captureReference); x.f.syncCaptures();
  const extra=value(decode('Evidence',{ ...json(x.discovery.evidence) as Record<string,unknown>,id:'reviewer:unrelated',
    claim:{ subject:'other',predicate:'unrelated-observation',value:true },capture:{ reference:captureReference,hash:captureHash } },x.f.context.decode));
  const extraFact=scheduledEvidenceBundle(x,{ evidence:extra });
  const admitted=value(x.f.port().receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const original=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f);
  const written=value(authorAndAppend({ kind:original.kind,schemaVersion:1,machine:'machine-a',principal:json(original.principal),
    provenance:json(original.provenance),at:json(original.at),body:original.body,
    required:[...original.predecessors.required,extraFact.id] },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
  expect(written.taint).toEqual([]);
  if(mode!=='available') x.f.dropCapture(mode==='unrelated-unavailable'?captureReference:x.discovery.evidence.capture.reference);
  const status=value(prepareSnapshot(x.f.frames as any,{ ...scheduledOwnerContext(x.f),facts:x.f.frames as any }));
  const row=status.entries.find(candidate=>candidate.fact.id===written.fact.id)!;
  const pending=x.f.port().pendingScheduledAdmissions({ owner:admitted.owner,frontier:x.f.frontier(),limit:10,after:null });
  if(mode==='available') {
    expect(row.taint).toEqual([]);
    expect(value(pending).admissions).toEqual([ref(written.fact.id)]);
  } else {
    expect(row.taint).toEqual(['evidence-unavailable']);
    expect(value(pending).admissions).toEqual([]);
  }
});

it.each(['single-missing','extra-available','extra-missing'] as const)
('P4-ST-49 V112 signed replay retains unresolved Evidence without inventing conflict (%s)',mode=>{
  const x=scheduledRepair6Setup();
  let extraFact:ReturnType<typeof scheduledEvidenceBundle>|undefined,extraReference='reviewer:isolated-extra';
  if(mode!=='single-missing') {
    const captureHash=x.f.f.capture('isolated unrelated data',extraReference); x.f.syncCaptures();
    const extra=value(decode('Evidence',{ ...json(x.discovery.evidence) as Record<string,unknown>,id:'reviewer:extra',
      claim:{ subject:'other',predicate:'other',value:true },capture:{ reference:extraReference,hash:captureHash } },x.f.context.decode));
    extraFact=scheduledEvidenceBundle(x,{ evidence:extra });
  }
  value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f);
  const required=extraFact?[...original.predecessors.required,extraFact.id]:original.predecessors.required;
  const written=value(authorAndAppend({ kind:original.kind,schemaVersion:1,machine:'machine-a',principal:json(original.principal),
    provenance:json(original.provenance),at:json(original.at),body:original.body,required },context,
  createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
  const candidate=x.f.frames.pop() as any;
  const missing=mode==='extra-missing'?extraReference:x.discovery.evidence.capture.reference;
  const saved=x.f.f.captures[missing]; x.f.dropCapture(missing);
  const replay=verifyAndAdmit(json(candidate),'machine-a',{ ...scheduledOwnerContext(x.f),facts:x.f.frames as any });
  if(saved===undefined) throw new Error('expected saved capture');
  x.f.f.captures[missing]=saved; x.f.syncCaptures();
  expect(value(replay).id).toBe(candidate.id);
  expect(value(verifyAndAdmit(json(candidate),'machine-a',{ ...scheduledOwnerContext(x.f),facts:x.f.frames as any })).id).toBe(candidate.id);
  expect(written.fact.id).toBe(candidate.id);
});

it.each(['plain','dual'] as const)
('P4-PRESERVE-03 V113 signed ordinary receipt/resolution/admission replay on a multi-stimulus adapter (%s)',mode=>{
  const source=intakeFixture(),sourceDeclarations=structuredClone(source.registerInput.sources.map(row=>row.declaration)) as any[];
  if(mode==='dual') (sourceDeclarations.find(row=>row.id==='host')!.requiredFacts.authenticationClass as unknown[])
    .push({ stimulusType:'scheduled-tick',class:'verified' });
  const sourceGovernance=source.govern(sourceDeclarations).governance;
  value(value(createIntakePort({ ...source.deps,governance:sourceGovernance })).receive(message('unchanged ordinary input'),route));

  const target=intakeFixture(),targetDeclarations=structuredClone(target.registerInput.sources.map(row=>row.declaration)) as any[];
  if(mode==='dual') (targetDeclarations.find(row=>row.id==='host')!.requiredFacts.authenticationClass as unknown[])
    .push({ stimulusType:'scheduled-tick',class:'verified' });
  const targetGovernance=target.govern(targetDeclarations).governance;
  value(createIntakePort({ ...target.deps,governance:targetGovernance }));
  Object.assign(target.f.captures,source.f.captures); target.syncCaptures();
  const registration=value(intakeWorkRegistration({ site:target.context.site,preserved:target.context.preserved,
    register:target.context.decode.register },target.deps.author.principal.id));
  const context={ ...target.context,ownedBodies:[...target.context.ownedBodies??[],registration] };
  const store=createFactStore(context,target.storage);
  for(const fact of source.frames as any[]) expect(value(store.append(json(fact),{ peer:fact.machine })).taint).toEqual([]);
  expect(target.facts().filter(fact=>fact.kind==='intake-admitted')).toHaveLength(1);
});

it.each([91,92,1000])
('P4-ST-50 V116 canonical scheduled instant excludes discovery timestamp (%s)',at=>{
  const x=scheduledRepair6Setup(),tick=x.f.tick({ scheduledInstant:{ ...json(x.tick.body.scheduledInstant) as any,at } });
  expect(tick.eventId).toBe(x.tick.eventId);
  const before=x.f.frames.length,result=x.f.port().receiveScheduledTick({ ...x.input,raw:tick.raw,route:tick.route });
  if(at===1000) expect(value(result).kind).toBe('scheduled-admitted');
  else {
    refused(result);
    expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
  }
});

it.each(['single','identical'] as const)
('P4-ST-47 V117 live intake refuses every copied discovery identity in Slice A (%s)',mode=>{
  const x=scheduledRepair6Setup(),bundle=scheduledEvidenceBundle(x,mode==='single'
    ?{ a:x.discovery.evidence }:{ a:x.discovery.evidence,b:x.discovery.evidence });
  const result=x.f.port().receiveScheduledTick({ ...x.input,discovery:ref(bundle.id) });
  if(mode==='single') expect(value(result).kind).toBe('scheduled-admitted');
  else refused(result,'unsupported-in-slice-a');
});

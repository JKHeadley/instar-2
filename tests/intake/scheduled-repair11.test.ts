import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore,verifyAndAdmit } from '../../src/facts/index.js';
import { createIntakePort,intakeWorkRegistration } from '../../src/intake/index.js';
import { intakeFixture,json,message,refused,route,value } from './fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';
import { scheduledEvidenceBundle } from './scheduled-repair9-fixtures.js';

const ref=(id:string)=>({ owner:'part-two' as const,name:'FactEnvelope' as const,id });

it.each(['plain','dual'].flatMap(mode=>['scheduled:','scheduled:calendar'].map(channel=>({ mode,channel }))))
('P4-ST-51 V118 preserves a base-valid ordinary person channel ($mode $channel)',({ mode,channel })=>{
  const f=intakeFixture(),declarations=structuredClone(f.registerInput.sources.map(source=>source.declaration)) as any[];
  if(mode==='dual') declarations.find(row=>row.id==='host')!.requiredFacts.authenticationClass
    .push({ stimulusType:'scheduled-tick',class:'verified' });
  const result=value(createIntakePort({ ...f.deps,governance:f.govern(declarations).governance }))
    .receive(message('ordinary channel preservation'),{ ...route,channel });
  expect(value(result)).toMatchObject({ kind:'admitted',lastInboundId:'event-1' });
  expect(f.facts().map(fact=>fact.kind)).toEqual(['intake-receipt','intake-resolved','intake-admitted']);
});

it.each([false,true])
('P4-ST-52 V119 Slice A refuses repeated signed principal copies (repeat=%s)',repeat=>{
  const x=scheduledRepair6Setup(); value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f),store=createFactStore(context,x.f.storage);
  const witness=x.f.facts().find(fact=>fact.kind==='intake-scheduled-principal')!;
  let required=original.predecessors.required;
  if(repeat) {
    const extra=value(authorAndAppend({ kind:witness.kind,schemaVersion:1,machine:'machine-a',principal:json(witness.principal),
      provenance:json(witness.provenance),at:json(witness.at),body:witness.body,required:witness.predecessors.required },context,
    store,x.f.deps.author.privateKey)).fact;
    required=[...required,extra.id];
  }
  const previous=x.f.frames.at(-1) as any;
  const candidate=x.f.f.next(previous,{ kind:original.kind,principal:original.principal,provenance:original.provenance,
    at:original.at,body:original.body,predecessors:{ ...original.predecessors,inSegment:previous.id,required } },context);
  const replay=verifyAndAdmit(json(candidate),'machine-a',{ ...context,facts:x.f.frames as any });
  const appended=authorAndAppend({ kind:original.kind,schemaVersion:1,machine:'machine-a',principal:json(original.principal),
    provenance:json(original.provenance),at:json(original.at),body:original.body,required },context,store,
  x.f.deps.author.privateKey);
  if(repeat) { refused(replay,'unsupported-in-slice-a'); refused(appended,'unsupported-in-slice-a'); }
  else { expect(value(replay).id).toBe(candidate.id); expect(value(appended).taint).toEqual([]); }
});

it.each(['earlier','later','both'] as const)
('P4-ST-55 V122 Slice A resolves the one referenced discovery identity (%s)',selection=>{
  const x=scheduledRepair6Setup(),bundle=scheduledEvidenceBundle(x,{ evidence:x.discovery.evidence });
  expect(value(x.f.port().receiveScheduledTick({ ...x.input,
    discovery:ref(selection==='earlier'?x.discovery.fact.id:bundle.id) })).kind).toBe('scheduled-admitted');
});

it.each(['single','repeat-fields','repeat-facts'] as const)
('P4-ST-56 V123 Slice A refuses every Directive field and fact (%s)',mode=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const directive=value(decode('Directive',x.f.f.directiveInput(),{ ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant) }));
  const fields=mode==='repeat-fields'
    ?{ a:{ kind:'constitutional' as const,type:'Directive' as const },b:{ kind:'constitutional' as const,type:'Directive' as const } }
    :{ a:{ kind:'constitutional' as const,type:'Directive' as const } };
  Object.assign(x.f.context,{ schemas:[...x.f.context.schemas,{ ...x.f.f.schema,kind:'repair11-directive-bundle',fields }] });
  const body=mode==='repeat-fields'?{ a:json(directive),b:json(directive) }:{ a:json(directive) };
  for(let index=0;index<(mode==='repeat-facts'?2:1);index++) expect(value(authorAndAppend({ kind:'repair11-directive-bundle',
    schemaVersion:1,machine:'machine-a',principal:json(x.f.f.alice),provenance:json(x.f.f.alice.provenance),at:json(x.f.f.now),
    body,required:[] },x.f.context,createFactStore(x.f.context,x.f.storage),x.f.deps.author.privateKey)).taint).toEqual([]);
  refused(x.f.port().receiveScheduledTick(x.input),'unsupported-in-slice-a');
});

it('P4-ST-51 V118 keeps the legacy decoder function free of scheduled policy',()=>{
  const source=String(intakeWorkRegistration);
  expect(source).not.toContain("arrival.route.channel.startsWith('scheduled:')");
  expect(source).not.toContain('isScheduledIntakeAdmission');
});

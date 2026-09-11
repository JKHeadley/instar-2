import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { intakeFixture,json,message,refused,route,value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';
import { scheduledEvidenceBundle } from '../intake/scheduled-repair9-fixtures.js';

const ref=(id:string)=>({ owner:'part-two' as const,name:'FactEnvelope' as const,id });
function declarations(f:ReturnType<typeof intakeFixture>,mode:'plain'|'dual') {
  const rows=structuredClone(f.registerInput.sources.map(source=>source.declaration)) as any[];
  if(mode==='dual') rows.find(row=>row.id==='host')!.requiredFacts.authenticationClass
    .push({ stimulusType:'scheduled-tick',class:'verified' });
  return f.govern(rows).governance;
}

it.each(['intake-receipt','intake-resolved'].flatMap(kind=>(['plain','dual'] as const).flatMap(mode=>
  ['scheduled:','scheduled:calendar'].map(channel=>({ kind,mode,channel })))))
('P4-ST-54 V121 recovers a durable ordinary $channel admission after $kind ($mode)',({ kind,mode,channel })=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-r11-v121-')),source=intakeFixture({ directory });
  const append=source.storage.append.bind(source.storage); let hit=false;
  const storage={ ...source.storage,append(bytes:string,expected:string|null) {
    const result=append(bytes,expected);
    if(JSON.parse(bytes).kind===kind) { hit=true; throw new Error('cut after real fsync'); }
    return result;
  } };
  refused(value(createIntakePort({ ...source.deps,governance:declarations(source,mode),storage }))
    .receive(message('ordinary durable recovery'),{ ...route,channel }));
  expect(hit).toBe(true);
  const receipt=(source.frames as any[]).find(fact=>fact.kind==='intake-receipt')!;
  const restarted=intakeFixture({ directory });
  expect(value(value(createIntakePort({ ...restarted.deps,governance:declarations(restarted,mode) })).recover(receipt.id)).kind)
    .toBe('admitted');
  expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toHaveLength(1);
});

it.each(['principal-single','principal-repeat','discovery-later','discovery-both'].flatMap(mode=>
  [false,true].map(cut=>({ mode,cut }))))
('P4-ST-58 V125 enforces exactly one referenced witness across restart ($mode, lost ack=$cut)',({ mode,cut })=>{
  const x=scheduledRepair6Setup();
  const evidence=mode.startsWith('discovery')?scheduledEvidenceBundle(x,{ evidence:x.discovery.evidence }):undefined;
  const first=x.f.port().receiveScheduledTick(evidence?{ ...x.input,discovery:ref(evidence.id) }:x.input);
  const admitted=value(first);
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const original=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f),store=createFactStore(context,x.f.storage);
  let required=original.predecessors.required;
  if(mode==='principal-repeat') {
    const witness=x.f.facts().find(fact=>fact.kind==='intake-scheduled-principal')!;
    const second=value(authorAndAppend({ kind:witness.kind,schemaVersion:1,machine:'machine-a',principal:json(witness.principal),
      provenance:json(witness.provenance),at:json(witness.at),body:witness.body,required:witness.predecessors.required },context,
    store,x.f.deps.author.privateKey)).fact;
    required=[...required,second.id];
  }
  if(mode==='discovery-both') required=[...required,x.discovery.fact.id];
  const previous=x.f.frames.at(-1) as any;
  const signed=x.f.f.next(previous,{ kind:original.kind,principal:original.principal,provenance:original.provenance,
    at:original.at,body:original.body,predecessors:{ ...original.predecessors,inSegment:previous.id,required } },context);
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-r11-v125-')),target=scheduledFixture({ directory });
  target.installSchemas(); Object.assign(target.context,{ schemas:x.f.context.schemas });
  Object.assign(target.f.captures,x.f.f.captures); target.syncCaptures();
  const durableAppend=target.storage.append.bind(target.storage); let hit=false;
  target.storage.append=(bytes,expected)=>{
    const result=durableAppend(bytes,expected);
    if(cut&&JSON.parse(bytes).kind==='intake-admitted') { hit=true; throw new Error('lost acknowledgement after fsync'); }
    return result;
  };
  const durableStore=createFactStore(scheduledOwnerContext(target),target.storage);
  for(const fact of x.f.frames as any[]) expect(value(durableStore.append(json(fact),{ peer:fact.machine })).taint).toEqual([]);
  const result=durableStore.append(json(signed),{ peer:'machine-a' });
  if(mode==='principal-repeat'||mode==='discovery-both'||cut) refused(result); else expect(value(result).taint).toEqual([]);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas(); Object.assign(restarted.context,{ schemas:x.f.context.schemas });
  const retained=restarted.facts().filter(fact=>fact.kind==='intake-admitted').map(fact=>fact.id);
  if(mode==='principal-repeat'||mode==='discovery-both') { expect(retained).toEqual([]); expect(hit).toBe(false); }
  else {
    expect(retained).toEqual([signed.id]);
    expect(value(restarted.port().pendingScheduledAdmissions({ owner:admitted.owner,frontier:restarted.frontier(),limit:10,after:null })).admissions)
      .toEqual([ref(signed.id)]);
    expect(hit).toBe(cut);
  }
});

it.each(['single','repeat-fields'].flatMap(mode=>[false,true].map(cut=>({ mode,cut }))))
('P4-ST-59 V126 refuses Directive fields before restart ($mode, lost ack=$cut)',({ mode,cut })=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const directive=value(decode('Directive',x.f.f.directiveInput(),{ ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant) }));
  const fields=mode==='single'?{ a:{ kind:'constitutional' as const,type:'Directive' as const } }:{
    a:{ kind:'constitutional' as const,type:'Directive' as const },b:{ kind:'constitutional' as const,type:'Directive' as const },
  };
  Object.assign(x.f.context,{ schemas:[...x.f.context.schemas,{ ...x.f.f.schema,kind:'repair11-directive-bundle',fields }] });
  expect(value(authorAndAppend({ kind:'repair11-directive-bundle',schemaVersion:1,machine:'machine-a',principal:json(x.f.f.alice),
    provenance:json(x.f.f.alice.provenance),at:json(x.f.f.now),body:mode==='single'?{ a:json(directive) }:{ a:json(directive),b:json(directive) },
    required:[] },x.f.context,createFactStore(x.f.context,x.f.storage),x.f.deps.author.privateKey)).taint).toEqual([]);
  refused(x.f.port().receiveScheduledTick(x.input),'unsupported-in-slice-a');
  expect(x.f.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
  expect(cut).toBeTypeOf('boolean');
});

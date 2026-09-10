import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort,intakeWorkRegistration } from '../../src/intake/index.js';
import { intakeFixture,json,message,route,value } from '../intake/fixtures.js';
import { scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';

it.each(['plain','dual'].flatMap(mode=>['scheduled:','scheduled:calendar'].map(channel=>({ mode,channel }))))
('P4-ST-53 V120 replays a signed ordinary person admission on $mode $channel',({ mode,channel })=>{
  const setup=()=>{
    const f=intakeFixture(),declarations=structuredClone(f.registerInput.sources.map(source=>source.declaration)) as any[];
    if(mode==='dual') declarations.find(row=>row.id==='host')!.requiredFacts.authenticationClass
      .push({ stimulusType:'scheduled-tick',class:'verified' });
    return { f,governance:f.govern(declarations).governance };
  };
  const source=setup();
  expect(value(value(createIntakePort({ ...source.f.deps,governance:source.governance }))
    .receive(message('ordinary signed replay'),{ ...route,channel })).kind).toBe('admitted');
  const target=setup(); Object.assign(target.f.f.captures,source.f.f.captures); target.f.syncCaptures();
  const boundary={ site:target.f.context.site,preserved:target.f.context.preserved,register:target.f.context.decode.register };
  const registration=value(intakeWorkRegistration(boundary,target.f.deps.author.principal.id));
  const context={ ...target.f.context,ownedBodies:[...target.f.context.ownedBodies??[],registration] };
  const store=createFactStore(context,target.f.storage);
  for(const fact of source.f.frames as any[]) expect(value(store.append(json(fact),{ peer:fact.machine })).taint).toEqual([]);
  expect(target.f.facts().filter(fact=>fact.kind==='intake-admitted')).toHaveLength(1);
});

it.each(['pending','duplicate'] as const)
('P4-ST-57 V124 re-resolves repeated Directive fields for %s lookup',operation=>{
  const x=scheduledRepair6Setup(); x.f.bind();
  const directive=value(decode('Directive',x.f.f.directiveInput(),{ ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant) }));
  Object.assign(x.f.context,{ schemas:[...x.f.context.schemas,{ ...x.f.f.schema,kind:'repair11-directive-bundle',fields:{
    a:{ kind:'constitutional' as const,type:'Directive' as const },b:{ kind:'constitutional' as const,type:'Directive' as const },
  } }] });
  expect(value(authorAndAppend({ kind:'repair11-directive-bundle',schemaVersion:1,machine:'machine-a',principal:json(x.f.f.alice),
    provenance:json(x.f.f.alice.provenance),at:json(x.f.f.now),body:{ a:json(directive),b:json(directive) },required:[] },
  x.f.context,createFactStore(x.f.context,x.f.storage),x.f.deps.author.privateKey)).taint).toEqual([]);
  const admitted=value(x.f.port().receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  if(operation==='pending') expect(value(x.f.port().pendingScheduledAdmissions({ owner:admitted.owner,
    frontier:x.f.frontier(),limit:10,after:null })).admissions).toEqual([admitted.fact]);
  else expect(value(x.f.port().receiveScheduledTick(x.input))).toMatchObject({ kind:'duplicate',original:admitted.fact });
});

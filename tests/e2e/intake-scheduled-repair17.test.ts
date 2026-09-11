import { expect,it } from 'vitest';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';

it('P4-ST-96 V190 a later principal copy outside the admission cone preserves historical work',()=>{
  const x=scheduledRepair6Setup(),admitted:any=value(x.f.port().receiveScheduledTick(x.input));
  const principal=x.f.facts().find(fact=>fact.kind==='intake-scheduled-principal')!;
  const context=scheduledOwnerContext(x.f);
  value(authorAndAppend({
    kind:principal.kind,schemaVersion:1,machine:'machine-a',principal:json(principal.principal),
    provenance:json(principal.provenance),at:json(principal.at),body:principal.body,
    required:principal.predecessors.required,
  },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
  expect(value(x.f.port().pendingScheduledAdmissions({
    owner:admitted.owner,frontier:x.f.frontier(),limit:10,after:null,
  })).admissions).toEqual([admitted.fact]);
  expect(value(x.f.port().receiveScheduledTick(x.input))).toMatchObject({
    kind:'duplicate',original:admitted.fact,
  });
  const tick=x.f.tick({ jobInstance:'later-job' }),discovery=x.f.discovery(tick.eventId),before=x.f.facts().length;
  refused(x.f.port().receiveScheduledTick({
    raw:tick.raw,route:tick.route,
    discovery:{ owner:'part-two',name:'FactEnvelope',id:discovery.fact.id },
  }),'unsupported-in-slice-a');
  expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
});

import { expect,it } from 'vitest';
import { authorAndAppend,createFactStore,verifyAndAdmit } from '../../src/facts/index.js';
import { json,refused,value } from './fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';

function admissionWithPrincipalCopy(named: boolean,status: 'available'|'missing'|'expired'|'tombstoned') {
  const x=scheduledRepair6Setup();
  value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any;
  const principal=x.f.facts().find(fact=>fact.kind==='intake-scheduled-principal')!;
  const context=scheduledOwnerContext(x.f);
  const second=value(authorAndAppend({
    kind:principal.kind,schemaVersion:1,machine:'machine-a',principal:json(principal.principal),
    provenance:json(principal.provenance),at:json(principal.at),body:principal.body,
    required:principal.predecessors.required,
  },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey)).fact;
  const required=[...original.predecessors.required,...named?[second.id]:[]];
  const signed=x.f.f.next(second,{
    kind:original.kind,principal:original.principal,provenance:original.provenance,at:original.at,
    body:original.body,predecessors:{ ...original.predecessors,inSegment:second.id,required },
  },context);
  if(status!=='available') {
    const pin=x.f.principal.provenance.record.reference;
    delete x.f.f.captures[pin];
    Object.assign((x.f.context.captures as any)[pin],{ status,bytes:null });
  }
  return { ...x,context,original,required,signed };
}

it.each([false,true].flatMap(named=>
  (['available','missing','expired','tombstoned'] as const).map(status=>({ named,status }))))
('P4-ST-94 V186 signed replay refuses an extra identical principal named=$named status=$status',({ named,status })=>{
  const x=admissionWithPrincipalCopy(named,status);
  refused(verifyAndAdmit(json(x.signed),'machine-a',{ ...x.context,facts:x.f.facts() }),
    'unsupported-in-slice-a');
});

it.each([false,true])
('P4-ST-94 V187 owner append refuses an extra identical principal omitted=%s',named=>{
  const x=admissionWithPrincipalCopy(named,'available'),before=x.f.facts().length;
  refused(authorAndAppend({
    kind:x.original.kind,schemaVersion:1,machine:'machine-a',principal:json(x.original.principal),
    provenance:json(x.original.provenance),at:json(x.original.at),body:x.original.body,
    required:x.required,
  },x.context,createFactStore(x.context,x.f.storage),x.f.deps.author.privateKey),'unsupported-in-slice-a');
  expect(x.f.facts()).toHaveLength(before);
});

it('P4-ST-94 V188 two identical principal witnesses present before receipt refuse early',()=>{
  const x=admissionWithPrincipalCopy(false,'available');
  const tick=x.f.tick({ jobInstance:'new-job' }),discovery=x.f.discovery(tick.eventId),before=x.f.facts().length;
  refused(x.f.port().receiveScheduledTick({
    raw:tick.raw,route:tick.route,
    discovery:{ owner:'part-two',name:'FactEnvelope',id:discovery.fact.id },
  }),'unsupported-in-slice-a');
  expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
});

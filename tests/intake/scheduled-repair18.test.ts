import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore,verifyAndAdmit } from '../../src/facts/index.js';
import { json,refused,value } from './fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';

it('P4-ST-97 F1 counts an omitted discovery copy during signed replay',()=>{
  const x=scheduledRepair6Setup();
  value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f);
  const second=value(authorAndAppend({
    kind:x.discovery.fact.kind,schemaVersion:1,machine:'machine-a',principal:json(x.discovery.fact.principal),
    provenance:json(x.discovery.fact.provenance),at:json(x.discovery.fact.at),body:x.discovery.fact.body,
    required:x.discovery.fact.predecessors.required,
  },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey)).fact;
  const signed=x.f.f.next(second,{
    kind:original.kind,principal:original.principal,provenance:original.provenance,at:original.at,body:original.body,
    predecessors:{ ...original.predecessors,inSegment:second.id,required:original.predecessors.required },
  },context);
  refused(verifyAndAdmit(json(signed),'machine-a',{ ...context,facts:x.f.facts() }),'unsupported-in-slice-a');
  expect(x.f.facts().some(fact=>fact.id===signed.id)).toBe(false);
});

it('P4-ST-97 F2 refuses a known same-id principal mismatch before seam writes',()=>{
  const x=scheduledRepair6Setup(),identity={ id:x.f.principal.id,kind:'system' };
  const proof=x.f.f.proof(identity,identity,'identity'); x.f.syncCaptures();
  const provenance=value(decode('Provenance',{ ...proof.input,adapter:'scheduled-ingress' },x.f.context.decode));
  const principal=value(decode('VerifiedPrincipal',{ type:'VerifiedPrincipal',schemaVersion:1,...identity },{
    ...x.f.context.decode,provenance,
  }));
  x.f.f.principals.push(principal);
  Object.assign(x.f.context,{ decode:{ ...x.f.context.decode,
    principals:[...x.f.context.decode.principals??[],principal] } });
  const base=scheduledOwnerContext(x.f),context={ ...base,decode:{ ...base.decode,provenance } };
  value(authorAndAppend({
    kind:'intake-scheduled-principal',schemaVersion:1,machine:'machine-a',principal:json(principal),
    provenance:json(provenance),at:json(x.f.f.now),body:json({ principal }),required:[x.grant.fact.id],
  },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
  const before=x.f.facts().length;
  refused(x.f.port().receiveScheduledTick(x.input),'unsupported-in-slice-a');
  expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
});

import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';

it('P4-ST-98 F1 rechecks all discovery witnesses introduced before admission',()=>{
  const x=scheduledRepair6Setup(),append=x.f.storage.append.bind(x.f.storage);
  let injected=false;
  const storage={ ...x.f.storage,append(bytes:string,expected:string|null) {
    const result=append(bytes,expected);
    if(JSON.parse(bytes).kind==='intake-resolved'&&!injected) {
      injected=true;
      const context=scheduledOwnerContext(x.f);
      value(authorAndAppend({
        kind:x.discovery.fact.kind,schemaVersion:1,machine:'machine-a',principal:json(x.discovery.fact.principal),
        provenance:json(x.discovery.fact.provenance),at:json(x.discovery.fact.at),body:x.discovery.fact.body,required:[],
      },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
    }
    return result;
  } };
  const result=value(createIntakePort({ ...x.f.deps,storage })).receiveScheduledTick(x.input);
  expect(injected).toBe(true);
  refused(result,'unsupported-in-slice-a');
  expect(x.f.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
});

it('P4-ST-98 F2 resolves a reverified same-id principal before resolution append',()=>{
  const x=scheduledRepair6Setup(),identity={ id:x.f.principal.id,kind:'system' };
  const proof=x.f.f.proof(identity,identity,'package-system-principal'); x.f.syncCaptures();
  const provenance=value(decode('Provenance',{
    ...proof.input,adapter:'scheduled-ingress',verifiedAt:x.f.clock(99,'machine-a'),
  },x.f.context.decode));
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
  const before=x.f.facts().length,result=x.f.port().receiveScheduledTick(x.input);
  refused(result,'unsupported-in-slice-a');
  expect(x.f.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
});

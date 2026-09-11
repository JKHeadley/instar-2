import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';

const ref=(id:string)=>({ owner:'part-two' as const,name:'FactEnvelope' as const,id });

it('P4-ST-99 F1 retry after a principal cut cannot promote an omitted discovery copy',()=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair18-discovery-'));
  const f=scheduledFixture({ directory }); f.grant();
  const tick=f.tick(),discovery=f.discovery(tick.eventId),input={
    raw:tick.raw,route:tick.route,discovery:ref(discovery.fact.id),
  };
  const append=f.storage.append.bind(f.storage); let cut=false;
  const storage={ ...f.storage,append(bytes:string,expected:string|null) {
    const result=append(bytes,expected);
    if(JSON.parse(bytes).kind==='intake-scheduled-principal'&&!cut) {
      cut=true;
      const context=scheduledOwnerContext(f);
      value(authorAndAppend({
        kind:discovery.fact.kind,schemaVersion:1,machine:'machine-a',principal:json(discovery.fact.principal),
        provenance:json(discovery.fact.provenance),at:json(discovery.fact.at),body:discovery.fact.body,required:[],
      },context,createFactStore(context,f.storage),f.deps.author.privateKey));
      throw new Error('repair18 cut after principal append');
    }
    return result;
  } };
  refused(value(createIntakePort({ ...f.deps,storage })).receiveScheduledTick(input));
  expect(cut).toBe(true);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  const before=restarted.facts().length;
  refused(restarted.port().receiveScheduledTick(input),'unsupported-in-slice-a');
  expect(restarted.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
  expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
});

it('P4-ST-99 F2 same-id principal mismatch remains receipt-only after restart',()=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair18-principal-'));
  const f=scheduledFixture({ directory }),grant=f.grant(),tick=f.tick(),discovery=f.discovery(tick.eventId);
  const identity={ id:f.principal.id,kind:'system' },proof=f.f.proof(identity,identity,'identity'); f.syncCaptures();
  const provenance=value(decode('Provenance',{ ...proof.input,adapter:'scheduled-ingress' },f.context.decode));
  const principal=value(decode('VerifiedPrincipal',{ type:'VerifiedPrincipal',schemaVersion:1,...identity },{
    ...f.context.decode,provenance,
  }));
  f.f.principals.push(principal);
  Object.assign(f.context,{ decode:{ ...f.context.decode,
    principals:[...f.context.decode.principals??[],principal] } });
  const base=scheduledOwnerContext(f),context={ ...base,decode:{ ...base.decode,provenance } };
  value(authorAndAppend({
    kind:'intake-scheduled-principal',schemaVersion:1,machine:'machine-a',principal:json(principal),
    provenance:json(provenance),at:json(f.f.now),body:json({ principal }),required:[grant.fact.id],
  },context,createFactStore(context,f.storage),f.deps.author.privateKey));
  const input={ raw:tick.raw,route:tick.route,discovery:ref(discovery.fact.id) };
  const append=f.storage.append.bind(f.storage); let cut=false;
  const storage={ ...f.storage,append(bytes:string,expected:string|null) {
    const result=append(bytes,expected);
    if(JSON.parse(bytes).kind==='intake-receipt'&&!cut) {
      cut=true; throw new Error('repair18 cut after receipt');
    }
    return result;
  } };
  refused(value(createIntakePort({ ...f.deps,storage })).receiveScheduledTick(input));
  expect(cut).toBe(true);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  const before=restarted.facts().length;
  refused(restarted.port().receiveScheduledTick(input),'unsupported-in-slice-a');
  expect(restarted.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
  expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
});

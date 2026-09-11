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

it.each(['intake-scheduled-principal','intake-resolved'].flatMap(boundary=>
  ['none','same','other'].map(copy=>({ boundary,copy }))))
('P4-ST-95 V185 live intake recounts principal witnesses after $boundary ($copy)',({ boundary,copy })=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair17-live-'));
  const f=scheduledFixture({ directory }),grant=f.grant(),tick=f.tick(),discovery=f.discovery(tick.eventId);
  let principal=f.principal;
  if(copy==='other') {
    const identity={ id:'package:unrelated',kind:'system' };
    const proof=f.f.proof(identity,identity,'package-system-principal');
    f.syncCaptures();
    const provenance=value(decode('Provenance',{ ...proof.input,adapter:'scheduled-ingress' },f.context.decode));
    principal=value(decode('VerifiedPrincipal',{ type:'VerifiedPrincipal',schemaVersion:1,...identity },{
      ...f.context.decode,provenance,
    }));
  }
  f.f.principals.push(principal);
  Object.assign(f.context,{ decode:{
    ...f.context.decode,principals:[...f.context.decode.principals??[],principal],
  } });
  const append=f.storage.append.bind(f.storage);
  let hit=false;
  const storage={ ...f.storage,append(bytes:string,expected:string|null) {
    const result=append(bytes,expected);
    if(JSON.parse(bytes).kind===boundary&&!hit) {
      hit=true;
      if(copy!=='none') {
        const base=scheduledOwnerContext(f),context={ ...base,decode:{ ...base.decode,provenance:principal.provenance } };
        value(authorAndAppend({
          kind:'intake-scheduled-principal',schemaVersion:1,machine:'machine-a',principal:json(principal),
          provenance:json(principal.provenance),at:json(f.f.now),body:json({ principal }),required:[grant.fact.id],
        },context,createFactStore(context,f.storage),f.deps.author.privateKey));
      }
    }
    return result;
  } };
  const result=value(createIntakePort({ ...f.deps,storage })).receiveScheduledTick({
    raw:tick.raw,route:tick.route,discovery:ref(discovery.fact.id),
  });
  expect(hit).toBe(true);
  const restarted=scheduledFixture({ directory });
  restarted.installSchemas();
  restarted.f.principals.push(principal);
  Object.assign(restarted.context,{ decode:{
    ...restarted.context.decode,principals:[...restarted.context.decode.principals??[],principal],
  } });
  if(copy==='same') {
    refused(result,'unsupported-in-slice-a');
    expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
  } else {
    expect(value(result).kind).toBe('scheduled-admitted');
    expect(value(restarted.port().pendingScheduledAdmissions({
      owner:restarted.deps.workOwner,frontier:restarted.frontier(),limit:10,after:null,
    })).admissions).toHaveLength(1);
  }
});

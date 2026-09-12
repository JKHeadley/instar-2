import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { refused,json,value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';

it('P4-ST-108 F1 V220/V223 a durable invalid no-admission retry never stores a mismatch',()=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair21-'));
  try {
    const f=scheduledFixture({ directory }); f.grant(); f.bind();
    const tick=f.tick(),discovery=f.discovery(tick.eventId);
    const input={ raw:tick.raw,route:tick.route,
      discovery:{ owner:'part-two' as const,name:'FactEnvelope' as const,id:discovery.fact.id } };
    const directive=value(decode('Directive',f.f.directiveInput(),{
      ...f.context.decode,grants:f.context.grants.map(row=>row.grant),
    }));
    const schema={ ...f.f.schema,kind:'repair21-durable-directive',fields:{
      directive:{ kind:'constitutional' as const,type:'Directive' as const },
    } };
    Object.assign(f.context,{ schemas:[...f.context.schemas,schema] });
    expect(value(authorAndAppend({
      kind:schema.kind,schemaVersion:1,machine:'machine-a',principal:json(f.f.alice),
      provenance:json(f.f.alice.provenance),at:json(f.f.now),body:{ directive:json(directive) },required:[],
    },f.context,createFactStore(f.context,f.storage),f.deps.author.privateKey)).taint).toEqual([]);

    const append=f.storage.append.bind(f.storage); let cut=false;
    const storage={ ...f.storage,append(bytes:string,expected:string|null) {
      const result=append(bytes,expected);
      if(!cut&&JSON.parse(bytes).kind==='intake-receipt') { cut=true; throw new Error('cut after receipt fsync'); }
      return result;
    } };
    value(createIntakePort({ ...f.deps,storage })).receiveScheduledTick(input);
    expect(cut).toBe(true);

    const changed={ ...input,raw:f.tick({ calendarPolicyVersion:'cron-v2' }).raw };
    const restart=()=>{ const next=scheduledFixture({ directory }); next.installSchemas();
      Object.assign(next.context,{ schemas:f.context.schemas }); return next; };
    const first=restart(),before=first.facts().length,result=first.port().receiveScheduledTick(changed);
    refused(result,'unsupported-in-slice-a');
    const suffix=first.facts().slice(before);
    expect(suffix.map(fact=>fact.kind)).toEqual(['intake-receipt']);
    expect(suffix.slice(1)).toEqual([]);
    const ids=new Set(suffix.map(fact=>fact.id));
    const disk=readFileSync(join(directory,'segment.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
    expect(disk.filter(fact=>ids.has(fact.id)).map(fact=>fact.kind)).toEqual(['intake-receipt']);

    const second=restart(),retryBefore=second.facts().length,retry=second.port().receiveScheduledTick(changed);
    refused(retry,'unsupported-in-slice-a');
    expect(second.facts().slice(retryBefore).map(fact=>fact.kind)).toEqual(['intake-receipt']);
    expect(second.facts().filter(fact=>fact.kind==='intake-mismatch')).toEqual([]);
    expect(second.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
  } finally { rmSync(directory,{ recursive:true,force:true }); }
});

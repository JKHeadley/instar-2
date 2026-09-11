import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { refused,value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';

it.each(['none','directives'].flatMap(field=>[false,true].map(cut=>({ field,cut }))))
('P4-ST-102 restart preserves refusal of Directive-bearing input ($field receipt-cut=$cut)',({ field,cut })=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-input-fields-'));
  try {
    const f=scheduledFixture({ directory }); f.grant(); f.bind();
    const tick=f.tick(),discovery=f.discovery(tick.eventId);
    const directive=value(decode('Directive',f.f.directiveInput(),{
      ...f.context.decode,grants:f.context.grants.map(row=>row.grant),
    }));
    const input={ raw:tick.raw,route:tick.route,
      discovery:{ owner:'part-two' as const,name:'FactEnvelope' as const,id:discovery.fact.id },
      ...(field==='none'?{}:{ directives:[directive] }),
    };
    const append=f.storage.append.bind(f.storage); let hit=false;
    const storage={ ...f.storage,append(bytes:string,expected:string|null) {
      const result=append(bytes,expected);
      if(cut&&!hit&&JSON.parse(bytes).kind==='intake-receipt') {
        hit=true; throw new Error('cut after receipt fsync');
      }
      return result;
    } };
    const first=value(createIntakePort({ ...f.deps,storage })).receiveScheduledTick(input);
    if(cut||field!=='none') refused(first); else expect(value(first).kind).toBe('scheduled-admitted');
    expect(hit).toBe(cut);
    const restarted=scheduledFixture({ directory }); restarted.installSchemas();
    Object.assign(restarted.context,{ schemas:f.context.schemas });
    const before=restarted.facts().length,result=restarted.port().receiveScheduledTick(input);
    const pending=value(restarted.port().pendingScheduledAdmissions({
      owner:f.deps.workOwner,frontier:restarted.frontier(),limit:10,after:null,
    }));
    if(field==='none') {
      expect(['scheduled-admitted','duplicate']).toContain(value(result).kind);
      expect(pending.admissions).toHaveLength(1);
    } else {
      refused(result,'unsupported-in-slice-a');
      expect(restarted.facts().slice(before).map(fact=>fact.kind)).toEqual(['intake-receipt']);
      expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toEqual([]);
      expect(pending.admissions).toEqual([]);
    }
  } finally { rmSync(directory,{ recursive:true,force:true }); }
});

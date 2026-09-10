import { mkdtempSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { createFactStore,prepareSnapshot } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { json,message,refused,route,value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';
import { changedRecorderCandidate,durableScheduledTarget,packageRecorderPersonAdmission } from '../intake/scheduled-repair13-fixtures.js';

it.each([false,true].flatMap(cut=>['chat-a','scheduled:calendar'].map(channel=>({ cut,channel }))))
('P4-ST-73 V139 durable package-recorded person history survives restart ($channel cut=$cut)',({ cut,channel })=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-r13-person-'));
  const before=packageRecorderPersonAdmission(channel,directory,false); let fired=false;
  const storage={ ...before.f.storage,append(bytes:string,expected:string|null) {
    const result=before.f.storage.append(bytes,expected);
    if(cut&&JSON.parse(bytes).kind==='intake-admitted'&&!fired) { fired=true; throw new Error('lost admission acknowledgement'); }
    return result;
  } };
  const result=value(createIntakePort({ ...before.deps,storage })).receive(
    message('ordinary message with a package-authenticated recorder'),{ ...route,channel });
  if(cut) refused(result); else expect(value(result).kind).toBe('admitted');
  const disk=readFileSync(join(directory,'segment.jsonl'),'utf8'); expect(disk).toContain('intake-admitted');
  const restarted=packageRecorderPersonAdmission(channel,directory,false),head=restarted.f.frames.at(-1) as any;
  expect(value(restarted.port.pendingScheduledAdmissions({ owner:restarted.deps.workOwner,
    frontier:{ 'machine-a':{ epoch:head.segment.epoch,position:head.segment.position } },limit:10,after:null })))
    .toEqual({ admissions:[],next:null });
  expect(readFileSync(join(directory,'segment.jsonl'),'utf8')).toBe(disk);
});

it.each(['identity','package-system-principal'] as const)
('P4-ST-74 V144 unwitnessed scheduled data is refused before fsync and restart (%s)',recordType=>{
  const source=changedRecorderCandidate(recordType,true),directory=mkdtempSync(join(tmpdir(),'instar-p4-r13-refusal-'));
  const { target,store }=durableScheduledTarget(source,directory);
  for(const fact of source.f.frames as any[]) expect(value(store.append(json(fact),{ peer:fact.machine })).taint).toEqual([]);
  refused(store.append(json(source.candidate),{ peer:'machine-a' }));
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  Object.assign(restarted.context,{ schemas:source.f.context.schemas });
  const rows=value(prepareSnapshot(restarted.facts(),{ ...scheduledOwnerContext(restarted),facts:restarted.facts() })).entries;
  expect(rows.find(row=>row.fact.id===source.candidate.id)).toBeUndefined();
});

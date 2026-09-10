import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { authorAndAppend,createFactStore,prepareSnapshot } from '../../src/facts/index.js';
import { scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';
import { bundledScheduledCandidate,appendAdmissionWithUnrelatedEvidence,
  BASE_32E5961_ORDINARY_TRANSCRIPT,ordinaryPortTranscript,scheduledFactReference } from '../intake/scheduled-repair9-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';
import { json,refused,value } from '../intake/fixtures.js';

it.each([false,true])
('P4-ST-44 V105 e2e restarts an unrelated-first bundled discovery (lost acknowledgement=%s)',cut=>{
  const x=bundledScheduledCandidate('unrelated-first');
  const written=value(authorAndAppend({ kind: x.original.kind,schemaVersion: 1,machine: 'machine-a',
    principal: json(x.original.principal),provenance: json(x.original.provenance),at: json(x.original.at),
    body: x.original.body,required: x.required },x.context,x.store,x.f.deps.author.privateKey));
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair9-v105-')),f=scheduledFixture({ directory });
  f.installSchemas(); Object.assign(f.context,{ schemas: x.f.context.schemas });
  Object.assign(f.f.captures,x.f.f.captures); f.syncCaptures();
  const context=scheduledOwnerContext(f),store=createFactStore(context,f.storage),append=f.storage.append.bind(f.storage);
  let hit=false;
  f.storage.append=(bytes,expected)=>{
    const receipt=append(bytes,expected);
    if(cut&&JSON.parse(bytes).kind==='intake-admitted') { hit=true; throw new Error('lost acknowledgement after fsync'); }
    return receipt;
  };
  for(const fact of x.f.frames as any[]) {
    const result=store.append(json(fact),{ peer: fact.machine });
    if(cut&&fact.kind==='intake-admitted') refused(result); else value(result);
  }
  expect(hit).toBe(cut);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  Object.assign(restarted.context,{ schemas: x.f.context.schemas });
  const expected=scheduledFactReference(written.fact.id);
  expect(value(restarted.port().pendingScheduledAdmissions({ owner: x.admitted.owner,frontier: restarted.frontier(),limit: 10,after: null })).admissions)
    .toEqual([expected]);
  expect(value(restarted.port().receiveScheduledTick({ ...x.input,discovery: scheduledFactReference(x.bundle.id) })))
    .toMatchObject({ kind: 'duplicate',original: expected });
  const harness=scheduledRunHarness(restarted,{ ...x.admitted,fact: expected });
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(expected);
});

it.each([false,true])
('P4-ST-45 V107 e2e restarts an admission with stale unrelated Evidence (lost acknowledgement=%s)',cut=>{
  const x=appendAdmissionWithUnrelatedEvidence(0);
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair9-v107-')),f=scheduledFixture({ directory });
  f.installSchemas(); Object.assign(f.context,{ schemas: x.f.context.schemas });
  Object.assign(f.f.captures,x.f.f.captures); f.syncCaptures();
  const context=scheduledOwnerContext(f),store=createFactStore(context,f.storage),append=f.storage.append.bind(f.storage);
  let hit=false;
  f.storage.append=(bytes,expected)=>{
    const receipt=append(bytes,expected);
    if(cut&&JSON.parse(bytes).kind==='intake-admitted') { hit=true; throw new Error('lost acknowledgement after fsync'); }
    return receipt;
  };
  for(const fact of x.f.frames as any[]) {
    const result=store.append(json(fact),{ peer: fact.machine });
    if(cut&&fact.kind==='intake-admitted') refused(result); else value(result);
  }
  expect(hit).toBe(cut);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  Object.assign(restarted.context,{ schemas: x.f.context.schemas });
  const rows=value(prepareSnapshot(restarted.frames as any,{ ...scheduledOwnerContext(restarted),facts: restarted.frames as any })).entries;
  expect(rows.find(row=>row.fact.id===x.written.fact.id)!.taint).toEqual([]);
  const expected=scheduledFactReference(x.written.fact.id);
  expect(value(restarted.port().pendingScheduledAdmissions({ owner: x.admitted.owner,frontier: restarted.frontier(),limit: 10,after: null })).admissions)
    .toEqual([expected]);
  const harness=scheduledRunHarness(restarted,{ ...x.admitted,fact: expected });
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(expected);
});

it('P4-ST-46 V108 e2e ordinary port construction remains the base 32e5961 transcript',()=>{
  const result=ordinaryPortTranscript('absent');
  expect(value(result.result!).kind).toBe('admitted');
  expect(result.hash).toBe(BASE_32E5961_ORDINARY_TRANSCRIPT);
});

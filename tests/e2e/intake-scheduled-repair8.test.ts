import { expect,it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore,prepareSnapshot } from '../../src/facts/index.js';
import { scheduledRepair6Setup,scheduledOwnerContext } from '../intake/scheduled-repair6-fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';
import { json,refused,value } from '../intake/fixtures.js';

const ref=(id: string) => ({ owner: 'part-two' as const,name: 'FactEnvelope' as const,id });

it.each([false,true])('P4-ST-42 V98 durable admission excludes source-machine tick data (lost acknowledgement=%s)',cut => {
  const directory=mkdtempSync(join(tmpdir(),'V98-durable-')),f=scheduledFixture({ directory }); f.grant();
  const tick=f.tick({ scheduledInstant: f.clock(1000,'machine-a') }),discovery=f.discovery(tick.eventId);
  const append=f.storage.append.bind(f.storage); let hit=false;
  f.storage.append=(bytes,expected) => {
    const result=append(bytes,expected);
    if(cut&&JSON.parse(bytes).kind==='intake-admitted') { hit=true; throw new Error('lost acknowledgement after fsync'); }
    return result;
  };
  const result=f.port().receiveScheduledTick({ raw: tick.raw,route: tick.route,discovery: ref(discovery.fact.id) });
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  expect(restarted.facts().filter(row => row.kind==='intake-admitted')).toEqual([]);
  expect(hit).toBe(false);
  refused(result);
});

it.each([[false,false],[true,false],[true,true]] as const)
('P4-ST-43 V99 durable complete admission with unrelated Evidence remains pending (extra=%s, cut=%s)',(extra,cut) => {
  const x=scheduledRepair6Setup();
  const evidence=value(decode('Evidence',{ ...json(x.discovery.evidence) as any,id: 'evidence:unrelated',
    claim: { subject: 'other',predicate: 'unrelated-observation',value: true } },x.f.context.decode));
  const evidenceContext={ ...x.f.context,decode: { ...x.f.context.decode,provenance: x.f.provenance } };
  const evidenceFact=value(authorAndAppend({ kind: 'scheduled-discovery-evidence',schemaVersion: 1,machine: 'machine-a',
    principal: json(x.f.principal),provenance: json(x.f.provenance),at: json(x.f.f.now),body: json({ evidence }),required: [] },
  evidenceContext,createFactStore(evidenceContext,x.f.storage),x.f.deps.author.privateKey)).fact;
  const admitted: any=value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any;
  const context=scheduledOwnerContext(x.f);
  const appended=value(authorAndAppend({ kind: original.kind,schemaVersion: 1,machine: 'machine-a',
    principal: json(original.principal),provenance: json(original.provenance),at: json(original.at),body: original.body,
    required: [...original.predecessors.required,...extra?[evidenceFact.id]:[]] },context,
  createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
  const directory=mkdtempSync(join(tmpdir(),'V99-durable-')),f=scheduledFixture({ directory }); f.installSchemas();
  Object.assign(f.f.captures,x.f.f.captures); f.syncCaptures();
  const durableContext=scheduledOwnerContext(f),store=createFactStore(durableContext,f.storage);
  const append=f.storage.append.bind(f.storage); let hit=false;
  f.storage.append=(bytes,expected) => {
    const result=append(bytes,expected);
    if(cut&&JSON.parse(bytes).kind==='intake-admitted') { hit=true; throw new Error('lost acknowledgement after fsync'); }
    return result;
  };
  for(const fact of x.f.frames as any[]) {
    const result=store.append(json(fact),{ peer: fact.machine });
    if(cut&&fact.kind==='intake-admitted') refused(result); else value(result);
  }
  expect(hit).toBe(cut);
  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  const rows=value(prepareSnapshot(restarted.frames as any,{ ...scheduledOwnerContext(restarted),facts: restarted.frames as any })).entries;
  expect(rows.find(row => row.fact.id===appended.fact.id)!.taint).toEqual([]);
  const pending=restarted.port().pendingScheduledAdmissions({ owner: f.deps.workOwner,frontier: restarted.frontier(),limit: 10,after: null });
  const harness=scheduledRunHarness(restarted,{ ...admitted,fact: ref(appended.fact.id) });
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(ref(appended.fact.id));
  expect(value(pending).admissions).toEqual([ref(appended.fact.id)]);
});

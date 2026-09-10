import { expect,it } from 'vitest';
import { canonical,decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { scheduledRepair6Setup,scheduledOwnerContext } from './scheduled-repair6-fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';
import { scheduledRunHarness } from './scheduled-run-fixtures.js';
import { json,refused,value } from './fixtures.js';

const ref=(id: string) => ({ owner: 'part-two' as const,name: 'FactEnvelope' as const,id });

it.each(['machine-a','machine-b','scheduled-clock'])
('P4-ST-39 V93 tick excludes discovery source machine (%s)',source => {
  const f=scheduledFixture(); f.grant();
  const tick=f.tick({ scheduledInstant: f.clock(1000,source) });
  const discovery=f.discovery(tick.eventId,source==='machine-b'?'machine-b':'machine-a');
  const before=f.frames.length;
  const result=f.port().receiveScheduledTick({ raw: tick.raw,route: tick.route,discovery: ref(discovery.fact.id) });
  if(source==='scheduled-clock') expect(value(result).kind).toBe('scheduled-admitted');
  else {
    refused(result);
    expect(f.facts().slice(before).map(fact => fact.kind)).toEqual(['intake-receipt']);
  }
});

it.each([91,92,1000])('P4-ST-39 V94 tick does not carry the discovery clock (%s)',observedAt => {
  const f=scheduledFixture(); f.grant();
  const scheduledInstant={ ...f.f.clockRaw(1000,'scheduled-clock'),at: observedAt } as any;
  const tick=f.tick({ scheduledInstant });
  const discovery=f.discovery(tick.eventId,'machine-a',observedAt===1000?100:observedAt);
  const result=f.port().receiveScheduledTick({ raw: tick.raw,route: tick.route,discovery: ref(discovery.fact.id) });
  if(observedAt===1000) expect(value(result).kind).toBe('scheduled-admitted');
  else refused(result);
});

it.each([false,true])
('P4-ST-40 V95 an additional unrelated Evidence dependency does not invalidate a well-formed admission (%s)',extra => {
  const x=scheduledRepair6Setup();
  const evidence=value(decode('Evidence',{ ...json(x.discovery.evidence) as any,id: 'evidence:unrelated',
    claim: { subject: 'other',predicate: 'unrelated-observation',value: true } },x.f.context.decode));
  const evidenceContext={ ...x.f.context,decode: { ...x.f.context.decode,provenance: x.f.provenance } };
  const evidenceFact=value(authorAndAppend({ kind: 'scheduled-discovery-evidence',schemaVersion: 1,machine: 'machine-a',
    principal: json(x.f.principal),provenance: json(x.f.provenance),at: json(x.f.f.now),body: json({ evidence }),required: [] },
  evidenceContext,createFactStore(evidenceContext,x.f.storage),x.f.deps.author.privateKey)).fact;
  const admitted: any=value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f);
  const required=[...original.predecessors.required,...extra?[evidenceFact.id]:[]];
  const appended=value(authorAndAppend({ kind: original.kind,schemaVersion: 1,machine: 'machine-a',
    principal: json(original.principal),provenance: json(original.provenance),at: json(original.at),
    body: original.body,required },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
  expect(appended.taint).toEqual([]);
  const pending=x.f.port().pendingScheduledAdmissions({ owner: x.f.deps.workOwner,frontier: x.f.frontier(),limit: 10,after: null });
  const harness=scheduledRunHarness(x.f,{ ...admitted,fact: ref(appended.fact.id) });
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(ref(appended.fact.id));
  expect(value(pending).admissions).toEqual([ref(appended.fact.id)]);
});

it('P4-ST-39 V96 two discovery machines cannot insert identities into otherwise equal canonical tick bytes',() => {
  const f=scheduledFixture(); f.grant();
  const a=f.tick({ scheduledInstant: f.clock(1000,'machine-a') });
  const b=f.tick({ scheduledInstant: f.clock(1000,'machine-b') });
  expect(a.eventId).toBe(b.eventId);
  expect(a.route).toEqual(b.route);
  expect(a.raw).not.toBe(b.raw);
  const da=f.discovery(a.eventId,'machine-a',91),db=f.discovery(b.eventId,'machine-b',92);
  const first=f.portForMachine('machine-a').receiveScheduledTick({ raw: a.raw,route: a.route,discovery: ref(da.fact.id) });
  f.portForMachine('machine-b').receiveScheduledTick({ raw: b.raw,route: b.route,discovery: ref(db.fact.id) });
  refused(first);
});

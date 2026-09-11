import { expect,it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { json,refused,value } from './fixtures.js';
import { changedScheduledRoute,missingScheduledPrincipalHistory,scheduledFactRef,scheduledOwnerContext,
  scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';

const pending=(f: ReturnType<typeof scheduledRepair6Setup>['f'],owner=f.deps.workOwner) => f.port().pendingScheduledAdmissions({
  owner,frontier: f.frontier(),limit: 10,after: null,
});

it.each([false,true])('P4-ST-32 V72 absent signed principal history refuses owner origin (changed tick=%s)',changed => {
  const x=missingScheduledPrincipalHistory(changed);
  refused(x.append('intake-admitted',x.body,x.required));
  expect(x.f.facts().filter(fact => fact.kind==='intake-admitted')).toEqual([]);
});

it.each([
  ['channel','chat:ordinary'],['channel','scheduled:'],['identityEpoch','epoch:unsigned'],
  ['sender','other:system'],['adapter','host'],
] as const)('P4-ST-33 V74 shared owner origin refuses inconsistent signed route %s=%s',(field,replacement) => {
  const x=changedScheduledRoute(field,replacement);
  refused(x.result!);
  expect(x.f.facts().filter(fact => fact.kind==='intake-admitted')).toEqual([]);
});

it('P4-ST-33 V75 a valid second scheduled installation remains accepted by origin and pending',() => {
  const x=changedScheduledRoute('channel','scheduled:installation-b'),written=value(x.result!);
  expect(written.taint).toEqual([]);
  expect(value(pending(x.f)).admissions).toEqual([scheduledFactRef(written.fact.id)]);
});

it.each(['principalId','authentication','binding','receipt','clock','required-discovery'] as const)
('P4-ST-33 V77 owner admission refuses inconsistent resolution %s',field => {
  const x=scheduledRepair6Setup(); value(x.f.port().receiveScheduledTick(x.input));
  const frames=x.f.frames as FactEnvelope[],original=frames.pop()!,resolution=frames.pop()!;
  expect(resolution.kind).toBe('intake-resolved');
  const body=structuredClone(resolution.body) as any;
  let at=resolution.at,required=resolution.predecessors.required;
  if(field==='principalId') body.principalId='wrong:principal';
  if(field==='authentication') body.authentication=json(x.grant.grant.source.record);
  if(field==='binding') body.binding='unexpected-binding';
  if(field==='receipt') body.receipt=x.grant.fact.id;
  if(field==='clock') at=x.f.clock(101);
  if(field==='required-discovery') required=required.filter(id => id!==x.discovery.fact.id);
  const context=scheduledOwnerContext(x.f),store=createFactStore(context,x.f.storage);
  const changed=value(authorAndAppend({ kind: 'intake-resolved',schemaVersion: 1,machine: 'machine-a',
    principal: json(x.f.principal),provenance: json(x.f.provenance),at: json(at),body,required },context,store,
  x.f.deps.author.privateKey));
  const result=authorAndAppend({ kind: 'intake-admitted',schemaVersion: 1,machine: 'machine-a',
    principal: json(x.f.principal),provenance: json(x.f.provenance),at: json(original.at),body: original.body,
    required: original.predecessors.required.map(id => id===resolution.id?changed.fact.id:id) },context,store,
  x.f.deps.author.privateKey);
  refused(result);
});

it('P4-ST-35 V78 pending owner filter accepts two well-formed owners in one signed history',() => {
  const x=scheduledRepair6Setup();
  const first=value(value(createIntakePort({ ...x.f.deps,workOwner: 'owner:one' })).receiveScheduledTick(x.input));
  if(first.kind!=='scheduled-admitted') throw new Error('expected first scheduled admission');
  const tick=x.f.tick({ jobInstance: 'job:second' }),discovery=x.f.discovery(tick.eventId);
  const second=value(value(createIntakePort({ ...x.f.deps,workOwner: 'owner:two' })).receiveScheduledTick({
    raw: tick.raw,route: tick.route,discovery: scheduledFactRef(discovery.fact.id),
  }));
  if(second.kind!=='scheduled-admitted') throw new Error('expected second scheduled admission');
  const reader=value(createIntakePort({ ...x.f.deps,workOwner: 'owner:one' }));
  const before=value(canonical(x.f.facts())).bytes;
  expect(value(reader.pendingScheduledAdmissions({ owner: 'owner:one',frontier: x.f.frontier(),limit: 10,after: null })).admissions)
    .toEqual([first.fact]);
  expect(value(reader.pendingScheduledAdmissions({ owner: 'owner:two',frontier: x.f.frontier(),limit: 10,after: null })).admissions)
    .toEqual([second.fact]);
  expect(value(canonical(x.f.facts())).bytes).toBe(before);
});

it('P4-ST-35 V79 equal route and bytes returns the original after configured owner changes',() => {
  const x=scheduledRepair6Setup();
  const first=value(value(createIntakePort({ ...x.f.deps,workOwner: 'owner:one' })).receiveScheduledTick(x.input));
  if(first.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const before=x.f.facts().filter(fact => fact.kind==='intake-admitted');
  expect(value(value(createIntakePort({ ...x.f.deps,workOwner: 'owner:two' })).receiveScheduledTick(x.input)))
    .toMatchObject({ kind: 'duplicate',original: first.fact });
  expect(x.f.facts().filter(fact => fact.kind==='intake-admitted')).toEqual(before);
});

it('P4-ST-35 V80 one recorded owner remains queryable and a foreign-owner query is empty',() => {
  const x=scheduledRepair6Setup(),port=value(createIntakePort({ ...x.f.deps,workOwner: 'owner:one' }));
  const admitted=value(port.receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  expect(value(port.pendingScheduledAdmissions({ owner: 'owner:one',frontier: x.f.frontier(),limit: 10,after: null })).admissions)
    .toEqual([admitted.fact]);
  expect(value(port.pendingScheduledAdmissions({ owner: 'owner:two',frontier: x.f.frontier(),limit: 10,after: null })).admissions)
    .toEqual([]);
});

import { expect,it } from 'vitest';
import { canonical,consumeResult } from '../../src/index.js';
import { authorAndAppend,createFactStore,prepareSnapshot } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { intakeFixture,json,message,refused,route,value } from './fixtures.js';
import { changedScheduledRoute,scheduledFactRef,scheduledOwnerContext,scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';
import { conversationPort,messageOnlyScheduledAttempt,unwitnessedScheduledAdmission } from './scheduled-repair7-fixtures.js';

it.each([false,true])('P4-PRESERVE-02 V81 ordinary conversation remains admissible with a scheduled predecessor=%s',scheduled => {
  const f=scheduledFixture(); f.grant();
  if(scheduled) {
    const tick=f.tick(),discovery=f.discovery(tick.eventId);
    expect(value(f.port().receiveScheduledTick({ raw: tick.raw,route: tick.route,discovery: scheduledFactRef(discovery.fact.id) })).kind)
      .toBe('scheduled-admitted');
  }
  expect(value(conversationPort(f).receive(message('ordinary message'),route)).kind).toBe('admitted');
});

it.each([false,true])('P4-PRESERVE-02 V82 ordinary replay remains valid after a later scheduled tick=%s',scheduled => {
  const f=scheduledFixture(); f.grant(); const port=conversationPort(f);
  expect(value(port.receive(message('ordinary message'),route)).kind).toBe('admitted');
  if(scheduled) {
    const tick=f.tick(),discovery=f.discovery(tick.eventId);
    expect(value(f.port().receiveScheduledTick({ raw: tick.raw,route: tick.route,discovery: scheduledFactRef(discovery.fact.id) })).kind)
      .toBe('scheduled-admitted');
  }
  expect(value(port.receive(message('ordinary message'),route)).kind).toBe('duplicate');
});

it.each(['version','text','missing-version','valid-shape'] as const)
('P4-ST-36 V83 owner origin refuses scheduled data without principal/discovery witnesses (%s)',variant => {
  const x=unwitnessedScheduledAdmission(variant);
  refused(authorAndAppend(x.candidate,x.context,createFactStore(x.context,x.f.storage),x.f.deps.author.privateKey));
  expect(x.f.facts().filter(fact => fact.kind==='intake-admitted')).toEqual([]);
});

it.each(['chat:ordinary','scheduled:'])('P4-ST-38 V85 malformed scheduled route is invalid before consumption (%s)',channel => {
  const x=changedScheduledRoute('channel',channel,'signed');
  x.f.frames.push(x.signed!);
  const rows=value(prepareSnapshot(x.f.frames as FactEnvelope[],{ ...x.context,facts: x.f.frames as FactEnvelope[] })).entries;
  expect(rows.find(row => row.fact.id===x.signed!.id)!.taint.length).toBeGreaterThan(0);
  refused(x.f.port().pendingScheduledAdmissions({ owner: x.f.deps.workOwner,frontier: x.f.frontier(),limit: 10,after: null }));
});

it.each([
  ['jobInstance','sha256:a4442eff631a643510fa15d5d252f359288eca84db746082c7f1babd196a04db'],
  ['calendarPolicyVersion','sha256:7ff55be5d7c13d739131f4bce8e3c6242b99ba15d12baaa4b1016c7c6c0bcf5c'],
  ['job','sha256:90fe045826e1a4ee7af3e6cbc5a4ddc0d1160f8221692bb210a2805c0f3aa876'],
] as const)('P4-PRESERVE-02 V88 ordinary adapter metadata preserves the base decoder output (%s)',(key,expected) => {
  const raw=JSON.stringify({ schemaVersion: 1,[key]: 'ordinary provider metadata',text: 'hello' });
  const translate=(input: string) => ({ schemaVersion: 1,kind: 'message',text: JSON.parse(input).text });
  const f=intakeFixture();
  const result=value(createIntakePort({ ...f.deps,adapter: { ...f.deps.adapter,parse: translate } })).receive(raw,route);
  const wire=consumeResult(result,{ Success: (value): unknown => ({ kind: 'Success',value }),
    Refused: (refusal): unknown => ({ kind: 'Refused',refusal }) });
  expect(value(result).kind).toBe('admitted');
  expect(value(canonical(wire)).hash).toBe(expected);
});

it('P4-ST-37 V89 registered message-only adapter cannot admit scheduled work at owner origin',() => {
  const x=messageOnlyScheduledAttempt();
  refused(x.append('intake-admitted',x.body,x.required),'not registered for verified scheduled ticks');
});

it('P4-ST-37 V91 live receive applies the same message-only adapter refusal after preservation',() => {
  const x=messageOnlyScheduledAttempt(),f=x.f;
  const adapter={ ...f.deps.adapter,id: 'host',authenticate: (_raw: string,inputRoute: typeof route) => f.f.success({
    provenance: { ...f.provenanceInput,adapter: 'host' },principalKind: 'system' as const,principalId: x.principal.id,
    channel: inputRoute.channel,sender: inputRoute.sender,identityEpoch: inputRoute.identityEpoch }) };
  const port=value(createIntakePort({ ...f.deps,adapter,governance: f.govern().governance }));
  const before=f.frames.length;
  const result=port.receiveScheduledTick({ raw: value(canonical(x.body.intent.ask)).bytes,route: {
    adapter: 'host',channel: x.body.channel,sender: x.body.sender,identityEpoch: x.body.identityEpoch,eventId: x.body.eventId,
  },discovery: scheduledFactRef((f.frames as FactEnvelope[]).find(fact => fact.kind==='scheduled-discovery-evidence')!.id) });
  refused(result,'not registered for verified scheduled ticks');
  expect((f.frames as FactEnvelope[]).slice(before).map(fact => fact.kind)).toEqual(['intake-receipt']);
});

it.each(['channel','identityEpoch'] as const)
('P4-ST-38 owner origin refuses admission %s inconsistent with its signed receipt and resolution',field => {
  const x=scheduledRepair6Setup(); value(x.f.port().receiveScheduledTick(x.input));
  const original=(x.f.frames as FactEnvelope[]).pop()!,body=structuredClone(original.body) as any;
  body[field]=field==='channel'?'scheduled:other-installation':'sha256:'+'a'.repeat(64);
  const context=scheduledOwnerContext(x.f);
  refused(authorAndAppend({ kind: 'intake-admitted',schemaVersion: 1,machine: 'machine-a',principal: json(x.f.principal),
    provenance: json(x.f.provenance),at: json(original.at),body,required: original.predecessors.required },context,
  createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
});

it.each(['channel','identityEpoch'] as const)
('P4-ST-38 owner origin refuses resolution %s inconsistent with its receipt and admission',field => {
  const x=scheduledRepair6Setup(); value(x.f.port().receiveScheduledTick(x.input));
  const frames=x.f.frames as FactEnvelope[],admission=frames.pop()!,resolution=frames.pop()!,body=structuredClone(resolution.body) as any;
  body[field]=field==='channel'?'scheduled:other-installation':'sha256:'+'b'.repeat(64);
  const context=scheduledOwnerContext(x.f),store=createFactStore(context,x.f.storage);
  const changed=value(authorAndAppend({ kind: 'intake-resolved',schemaVersion: 1,machine: 'machine-a',principal: json(x.f.principal),
    provenance: json(x.f.provenance),at: json(resolution.at),body,required: resolution.predecessors.required },context,store,
  x.f.deps.author.privateKey));
  refused(authorAndAppend({ kind: 'intake-admitted',schemaVersion: 1,machine: 'machine-a',principal: json(x.f.principal),
    provenance: json(x.f.provenance),at: json(admission.at),body: admission.body,
    required: admission.predecessors.required.map(id => id===resolution.id?changed.fact.id:id) },context,store,
  x.f.deps.author.privateKey));
});

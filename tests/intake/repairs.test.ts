import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import type { Json,Scope } from '../../src/index.js';
import { authorAndAppend,createFactStore,hashBytes,prepareSnapshot,signEnvelope } from '../../src/facts/index.js';
import { createIntakePort,intakeFactSchemas,intakeWorkRegistration,intakeStopRegistration } from '../../src/intake/index.js';
import type { IntakeDisposition,IntakePort } from '../../src/intake/index.js';
import { intakeFixture,message,route,stop,value,refused,json } from './fixtures.js';
import { privateKey } from '../facts/fixtures.js';

it('P4-NF-01 P4-NF-10 receipt-only lost acknowledgment retains original route and clock on later redelivery', () => {
  const f=intakeFixture();
  const port=value(createIntakePort({ ...f.deps,storage: { ...f.storage,append(bytes,head) {
    const result=f.storage.append(bytes,head);
    if(JSON.parse(bytes).kind==='intake-receipt') throw new Error('lost receipt ack');
    return result;
  } } }));
  refused(port.receive(message(),route),'lost receipt ack');
  const receipt=f.facts()[0]!;
  expect(JSON.parse((receipt.body as { ingress: string }).ingress)).toEqual(route);
  f.setTime(500);
  const admitted=value(f.port().receive(message(),route));
  if(admitted.kind!=='admitted') throw new Error('expected admitted');
  expect(admitted.intent.receivedAt.value).toBe(100);
  expect(f.facts().at(-1)!.at.value).toBe(500);
});

it('P4-NF-01 P4-NF-14 overlapping message and stop retain recoverable receipts before the busy refusal', () => {
  for(const raw of [message('overlap'),stop]) {
    const f=intakeFixture(); f.bind();
    let port: IntakePort,queued='';
    port=value(createIntakePort({ ...f.deps,adapter: { ...f.deps.adapter,parse(input) {
      if(!queued) queued=refused(port.receive(raw,{ ...route,eventId: 'overlap' }),'durably queued').preserved;
      return JSON.parse(input);
    } } }));
    expect(value(port.receive(message(),route)).kind).toBe('admitted');
    expect(f.context.captures[hashBytes(raw)]?.bytes).toBe(raw);
    expect(f.facts().filter(f => f.kind==='intake-receipt')).toHaveLength(2);
    expect(f.facts().find(f => f.id===queued)?.kind).toBe('intake-receipt');
    expect(value(f.port().recover(queued)).kind).toBe(raw===stop? 'stopped':'admitted');
  }
  const f=intakeFixture(); const port=f.port();
  expect(value(port.receive(message(),route)).kind).toBe('admitted');
  expect(value(port.receive(message('next'),{ ...route,eventId: 'next' })).kind).toBe('admitted');
});

it('P4-NF-03 two ports interleaving on one ledger return exactly one executable admission', () => {
  const f=intakeFixture(); const second=f.port(); let inner: IntakeDisposition|undefined;
  const first=value(createIntakePort({ ...f.deps,adapter: { ...f.deps.adapter,parse(raw) {
    inner=value(second.receive(raw,route)); return JSON.parse(raw);
  } } }));
  expect(value(first.receive(message(),route)).kind).toBe('duplicate');
  expect(inner?.kind).toBe('admitted');
  expect(f.facts().filter(f => f.kind==='intake-admitted')).toHaveLength(1);
  expect(value(second.receive(message(),route)).kind).toBe('duplicate');
});

it('P4-NF-01 P4-NF-03 P4-NF-10 owner admission refuses altered receipt route, arrival clock and causally repeated work', () => {
  const f=intakeFixture(),admitted=value(f.port().receive(message(),route));
  if(admitted.kind!=='admitted') throw new Error('expected admitted');
  const original=f.facts().at(-1)!,body=original.body as Record<string,Json>;
  const c={ ...f.context,decode: { ...f.context.decode,principals: [...f.context.decode.principals??[],admitted.intent.principal] },
    ownedBodies: [value(intakeWorkRegistration({ site: 'intake.admit',preserved: original.id,register: f.context.decode.register },f.deps.author.principal.id))] };
  const prefix=f.frames.slice(0,-1);
  for(const [change,detail] of [
    [{ channel: 'chat-b' },'changed ingress'],
    [{ intent: { ...admitted.intent,receivedAt: f.f.clock(500) } },'original arrival clock'],
  ] as const) {
    const wire=signEnvelope({ ...original,body: { ...body,...change } },privateKey);
    refused(createFactStore(c,{ ...f.storage,read: () => prefix }).append(wire),detail);
  }
  const wire=signEnvelope({ ...original,id: `machine-a:0:${original.segment.position+1}`,segment: { ...original.segment,position: original.segment.position+1 },
    prevInSegment: original.contentHash,predecessors: { ...original.predecessors,inSegment: original.id } },privateKey);
  refused(createFactStore(c,f.storage).append(wire),'already admitted');
});

it('P4-NF-03 P4-NF-08 P4-NF-10 P4-NF-15 held event commits its first hash; changed bytes cannot close its hold', () => {
  const f=intakeFixture();
  const unresolved=value(createIntakePort({ ...f.deps,adapter: { ...f.deps.adapter,authenticate() { throw new Error('pending'); } } }));
  refused(unresolved.receive(message('first preserved ask'),route),'unresolved-sender');
  f.setTime(500);
  refused(f.port().receive(message('different ask'),route),'different arrival bytes');
  expect(f.facts().filter(f => f.kind==='intake-mismatch')).toHaveLength(1);
  expect(f.facts().filter(f => f.kind==='intake-admitted')).toHaveLength(0);
  f.setTime(1200); expect(value(f.port().expireHolds())).toBe(1);
  expect(f.facts().filter(f => f.kind==='intake-expired')).toHaveLength(1);
  // The attack does not poison a later authentic retry of the committed input.
  const recovered=value(f.port().receive(message('first preserved ask'),route));
  if(recovered.kind!=='admitted') throw new Error('expected original input');
  expect(recovered.intent.receivedAt.value).toBe(100);
});

function withScope(f: ReturnType<typeof intakeFixture>,scope: Scope) {
  Object.assign(f.context,{ schemas: [...f.context.schemas.filter(s => !s.kind.startsWith('intake-')
    &&s.kind!=='conversation-binding'&&s.kind!=='authorization-request'),...intakeFactSchemas(scope)] });
  return value(createIntakePort({ ...f.deps,scope }));
}

it('P4-NF-04 P4-NF-05 P4-NF-14 narrow binding does not select broader work; overlapping stops block, disjoint work survives', () => {
  const f=intakeFixture();
  const organization=value(decode('Scope',{ type: 'Scope',schemaVersion: 1,kind: 'organization' },f.context.decode));
  const narrow=f.f.scope;
  // Grant is genuinely organization-wide; only its selected binding is narrow.
  const broad=withScope(f,organization);
  Object.assign(f.f,{ scope: organization }); f.bind({ scope: json(narrow) });
  const before=value(broad.receive(message(),route));
  if(before.kind!=='admitted') throw new Error('expected requester service');
  expect(before.boundOperator).toBe(false);
  expect(value(broad.receive(stop,{ ...route,eventId: 'stop' })).kind).toBe('stopped');
  refused(broad.receive(message('overlap'),{ ...route,eventId: 'overlap' }),'stopped');
  const disjoint=value(decode('Scope',{ type: 'Scope',schemaVersion: 1,kind: 'project',members: ['project-b'] },f.context.decode));
  expect(value(withScope(f,disjoint).receive(message('disjoint'),{ ...route,eventId: 'disjoint' })).kind).toBe('admitted');
});

it('P4-NF-04 P4-NF-05 P4-NF-14 a covered binding selects operator context and its stop inhibits later covered work', () => {
  const covered=intakeFixture(); covered.bind();
  const result=value(covered.port().receive(message(),route));
  if(result.kind!=='admitted') throw new Error('expected admission');
  expect(result.boundOperator).toBe(true);
  value(covered.port().receive(stop,{ ...route,eventId: 'stop' }));
  refused(covered.port().receive(message(),{ ...route,eventId: 'after' }),'stopped');
});

it('P4-NF-14 direct origin and receiver admission enforce causal stop, without retroactively rejecting pre-stop work', () => {
  const f=intakeFixture(); f.bind();
  const port=f.port(),before=value(port.receive(message(),route));
  if(before.kind!=='admitted') throw new Error('expected pre-stop admission');
  value(port.receive(stop,{ ...route,eventId: 'stop' }));
  refused(port.receive(message('after'),{ ...route,eventId: 'after' }),'stopped');
  const facts=f.facts(),held=facts.at(-1)!,body=held.body as Record<string,Json>;
  const receipt=facts.find(f => f.id===body.receipt)!;
  const b={ site: 'intake.admit',preserved: receipt.id,register: f.context.decode.register };
  const c={ ...f.context,decode: { ...f.context.decode,principals: [...f.context.decode.principals??[],before.intent.principal] },
    ownedBodies: [value(intakeWorkRegistration(b,f.deps.author.principal.id)),value(intakeStopRegistration(b,f.deps.author.principal.id))] };
  const intent=value(decode('Intent',{ ...json(before.intent) as object,id: body.logicalId,raw: body.rawHash,receivedAt: receipt.at,ask: 'after' },c.decode));
  const candidate={ kind: 'intake-admitted',schemaVersion: 1,machine: 'machine-a',principal: json(f.deps.author.principal),provenance: json(f.deps.author.provenance),
    at: json(f.f.now),required: [receipt.id],body: { ...Object.fromEntries(['logicalId','receipt','rawHash','adapter','channel','sender','identityEpoch','eventId'].map(k => [k,body[k]!])),
      intent: json(intent),work: { type: 'IntakeWork',schemaVersion: 1,owner: f.deps.workOwner,blockedOn: 'run-admission',standing: 'requester' },binding: 'none' } };
  refused(authorAndAppend(candidate,c,createFactStore(c,f.storage),privateKey),'in-cone stop');
  const { required: _required,...envelopeFields }=candidate;
  const wire=signEnvelope({ ...held,...envelopeFields,id: `machine-a:0:${held.segment.position+1}`,segment: { ...held.segment,position: held.segment.position+1 },
    prevInSegment: held.contentHash,predecessors: { inSegment: held.id,frontier: {},required: [receipt.id] } },privateKey);
  refused(createFactStore(c,f.storage).append(wire),'in-cone stop');
  const forged=value(createFactStore(c,{ ...f.storage,read: () => [...f.frames,wire] }).read());
  const rejected=value(prepareSnapshot(forged,{ ...c,facts: forged })).entries.at(-1)!;
  expect(rejected.conflicts.some(c => c.kind==='poison-fact'&&c.detail.includes('in-cone stop'))).toBe(true);
  expect(rejected.taint).toContain('contested');
  expect(value(prepareSnapshot(facts,{ ...c,facts })).entries.find(r => r.fact.id===before.fact.id)?.taint).toEqual([]);
});

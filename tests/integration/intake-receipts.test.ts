import { expect,it } from 'vitest';
import { canonical,decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { authorAndAppend,createFactStore,prepareSnapshot } from '../../src/facts/index.js';
import type { FactEnvelope,SegmentStoragePort } from '../../src/facts/index.js';
import { createIntakePort,intakeWorkRegistration,intakeStopRegistration } from '../../src/intake/index.js';
import type { InboundRoute } from '../../src/intake/index.js';
import { intakeFixture,message,route,stop,value,refused,json } from '../intake/fixtures.js';
import { privateKey } from '../facts/fixtures.js';

function ownerContext(f: ReturnType<typeof intakeFixture>) {
  const b={ site: 'intake.admit',preserved: 'receipt-eligibility',register: f.context.decode.register };
  return { ...f.context,ownedBodies: [value(intakeWorkRegistration(b,f.deps.author.principal.id)),value(intakeStopRegistration(b,f.deps.author.principal.id))] };
}

it('P4-NF-10 P4-NF-14 P4-NF-24 malformed preserved routes cannot poison unrelated admission, reconstruction or the authenticated brake', () => {
  for(const malformed of [{},null,[],{ ...route,channel: 4 },{ ...route,eventId: {} },{ ...route,extra: 'not a route field' }]) {
    const f=intakeFixture(); f.bind();
    // Deliberately cross the public unknown-at-runtime boundary; do not validate
    // malformed inputs away in a transport test double before preservation.
    const bad=refused(f.port().receive(message('malformed'),malformed as InboundRoute));
    const retained=f.facts().filter(r => r.kind==='intake-receipt').at(-1)!;
    expect(bad.preserved).toBe(f.facts().at(-1)!.id);
    expect(JSON.parse((retained.body as { ingress: string }).ingress)).toEqual(malformed);
    expect(value(f.port().receive(message('valid'),route)).kind).toBe('admitted');
    expect(value(f.port().receive(message('other conversation'),{ ...route,channel: 'chat-b',eventId: 'other' })).kind).toBe('admitted');
    expect(value(f.port().receive(stop,{ ...route,eventId: 'brake' })).kind).toBe('stopped');
    const facts=f.facts(),c=ownerContext(f);
    expect(value(prepareSnapshot(facts,{ ...c,facts })).entries.flatMap(r => r.taint)).toEqual([]);
    expect(f.facts().find(r => r.id===retained.id)).toEqual(retained);
  }
});

it('P4-NF-10 P4-NF-14 P4-NF-24 invalid JSON in a genuinely signed retained receipt is inert, never a global parsing failure', () => {
  const f=intakeFixture(); f.bind();
  const capture=value(f.deps.capture.preserve(message('invalid ingress'),f.f.now));
  const observation=value(authorAndAppend({ kind: 'intake-receipt',schemaVersion: 1,machine: 'machine-a',
    principal: json(f.deps.author.principal),provenance: json(f.deps.author.provenance),at: json(f.f.now),required: [],
    body: { adapter: 'host',capture: json(capture),rawHash: capture.hash,ingress: '{invalid JSON' } },
  f.context,createFactStore(f.context,f.storage),privateKey)).fact;
  expect(refused(f.port().recover(observation.id),'not an eligible').preserved).toBe(observation.id);
  expect(value(f.port().receive(message(),route)).kind).toBe('admitted');
  expect(value(f.port().receive(stop,{ ...route,eventId: 'brake' })).kind).toBe('stopped');
  const facts=f.facts(),c=ownerContext(f);
  expect(value(prepareSnapshot(facts,{ ...c,facts })).entries.flatMap(r => r.taint)).toEqual([]);
});

function replicatedFixture() {
  const f=intakeFixture();
  // P2's storage CAS covers the append ledger; P2 separately checks each lineage.
  const storage: SegmentStoragePort={ owner: 'part-ten',read: () => f.frames,append(bytes,head) {
    const wire=JSON.parse(bytes) as FactEnvelope;
    expect((f.frames.at(-1) as FactEnvelope|undefined)?.contentHash??null).toBe(head);
    f.frames.push(wire); return f.f.success({ kind: 'local-durable' as const });
  } };
  const deps={ ...f.deps,storage,dedupGeneration: () => ({ ...f.deps.dedupGeneration(),lineages: Object.fromEntries(['machine-a','machine-b'].map(machine =>
    [machine,{ head: (f.frames as FactEnvelope[]).filter(r => r.machine===machine).at(-1)?.segment??null,observedAt: 100,closed: false }])) }) };
  function appendReceipt(principal: typeof f.f.bob,raw: string) {
    f.syncCaptures(); const capture=value(f.deps.capture.preserve(raw,f.f.now));
    const wire=f.f.wire({ kind: 'intake-receipt',machine: 'machine-b',principal,provenance: principal.provenance,
      segment: { machine: 'machine-b',epoch: 0,position: 0 },predecessors: { inSegment: null,frontier: {},required: [] },
      body: { adapter: 'host',capture,rawHash: capture.hash,ingress: value(canonical(route)).bytes } });
    const receipt=value(createFactStore(f.context,storage).append(wire,{ peer: 'machine-b' }));
    expect(receipt.taint).toEqual([]);
    // The replication owner truthfully records the received causal frontier.
    Object.assign(f.context,{ folded: { 'machine-b': { epoch: receipt.fact.segment.epoch,position: receipt.fact.segment.position } } });
    return receipt.fact;
  }
  return { f,storage,deps,appendReceipt,port: () => value(createIntakePort(deps)) };
}

it('P4-NF-02 P4-NF-03 P4-NF-08 foreign signed receipt claims cannot preempt another sender or recover as the configured observer', () => {
  for(const signer of ['requester','other-system'] as const) {
    const r=replicatedFixture(),f=r.f;
    const principal=signer==='requester'? f.f.bob:f.f.principal('foreign-observer','system');
    const foreign=r.appendReceipt(principal,message('foreign bytes claiming Alice event'));
    expect(foreign.principal.id).toBe(principal.id);
    expect(refused(r.port().recover(foreign.id),'not an eligible').preserved).toBe(foreign.id);
    const admitted=value(r.port().receive(message('Alice genuine event'),route));
    if(admitted.kind!=='admitted') throw new Error('Alice must remain reachable');
    expect((f.frames as FactEnvelope[]).filter(f => f.kind==='intake-mismatch')).toHaveLength(0);
    expect(value(r.port().receive(message('Alice genuine event'),route)).kind).toBe('duplicate');
    const facts=value(createFactStore(f.context,r.storage).read()),c={ ...ownerContext(f),facts };
    expect(value(prepareSnapshot(facts,c)).entries.flatMap(r => r.taint)).toEqual([]);
    // The P4 owner consumer cannot launder the foreign receipt through a genuine
    // observer-authored work fact either. Remove existing work so dedup cannot mask it.
    const body=facts.find(f => f.id===admitted.fact.id)!.body as Record<string,Json>;
    const prefix=facts.filter(f => f.machine==='machine-b');
    const context={ ...c,facts: [],decode: { ...c.decode,principals: [...c.decode.principals??[],admitted.intent.principal] } };
    const intent=value(decode('Intent',{ ...admitted.intent,raw: (foreign.body as { rawHash: string }).rawHash,receivedAt: foreign.at },context.decode));
    refused(authorAndAppend({ kind: 'intake-admitted',schemaVersion: 1,machine: 'machine-a',principal: json(f.deps.author.principal),
      provenance: json(f.deps.author.provenance),at: json(f.f.now),required: [foreign.id],
      body: { ...body,receipt: foreign.id,rawHash: intent.raw,intent: json(intent) } },context,
    createFactStore(context,{ ...r.storage,read: () => prefix }),privateKey),'not an eligible observer');
  }
});

it('P4-NF-02 P4-NF-03 P4-NF-10 genuine observer replication retains the first clock and supports equal-byte rebuild/recovery', () => {
  const r=replicatedFixture(),f=r.f;
  const original=r.appendReceipt(f.deps.author.principal,message());
  f.setTime(500);
  const admitted=value(r.port().recover(original.id));
  if(admitted.kind!=='admitted') throw new Error('expected genuine replicated arrival');
  expect(admitted.intent.receivedAt.value).toBe(100);
  expect(value(r.port().receive(message(),route)).kind).toBe('duplicate');
  const facts=value(createFactStore(f.context,r.storage).read()),c={ ...ownerContext(f),facts };
  expect(value(prepareSnapshot(facts,c)).entries.flatMap(r => r.taint)).toEqual([]);
  expect(facts.find(f => f.id===original.id)).toEqual(original);
});

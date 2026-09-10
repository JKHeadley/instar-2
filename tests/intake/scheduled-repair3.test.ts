import { expect, it } from 'vitest';
import { canonical, consumeResult, decode } from '../../src/index.js';
import { authorAndAppend, createFactStore, prepareSnapshot, verifyAndAdmit } from '../../src/facts/index.js';
import { createIntakePort, scheduledIntakeWorkRegistration } from '../../src/intake/index.js';
import { json, refused, value } from './fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';

const ref = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });
function setup() {
  const f = scheduledFixture(), grant = f.grant(), tick = f.tick(), discovery = f.discovery(tick.eventId);
  return { f, grant, tick, discovery,
    input: { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) } };
}
const pending = (f: ReturnType<typeof scheduledFixture>) => f.port().pendingScheduledAdmissions({
  owner: f.deps.workOwner, frontier: f.frontier(), limit: 10, after: null,
});
function directiveRecord(x: ReturnType<typeof setup>) {
  const directive = value(decode('Directive', x.f.f.directiveInput(), {
    ...x.f.context.decode, grants: x.f.context.grants.map(grant => grant.grant),
  }));
  if (!x.f.context.schemas.some(schema => schema.kind === 'directive-record')) Object.assign(x.f.context, {
    schemas: [...x.f.context.schemas, { ...x.f.f.schema, kind: 'directive-record',
      fields: { directive: { kind: 'constitutional' as const, type: 'Directive' as const } } }],
  });
  const appended = value(authorAndAppend({ kind: 'directive-record', schemaVersion: 1, machine: 'machine-a',
    principal: json(x.f.f.alice), provenance: json(x.f.f.alice.provenance), at: json(x.f.f.now),
    body: { directive: json(directive) }, required: [] }, x.f.context,
  createFactStore(x.f.context, x.f.storage), x.f.deps.author.privateKey));
  expect(appended.taint).toEqual([]);
  return { directive, fact: appended.fact };
}
function historicalOnly(x: ReturnType<typeof setup>) {
  Object.assign(x.f.context, { decode: { ...x.f.context.decode, provenance: x.f.provenance,
    principals: [x.f.principal], directives: [] } });
}
function statuses(x: ReturnType<typeof setup>) {
  const registration = value(scheduledIntakeWorkRegistration({ site: x.f.context.site, preserved: x.f.context.preserved,
    register: x.f.context.decode.register }, x.f.principal.id,x.f.deps.governance.register));
  return value(prepareSnapshot(x.f.frames as any, { ...x.f.context, facts: x.f.frames as any,
    ownedBodies: [...x.f.context.ownedBodies ?? [], registration] })).entries;
}

it('P4-ST-24 V47/V48 valid signed historical directives need no optional live issuer token', () => {
  const x = setup(); x.f.bind(); const directive = directiveRecord(x);
  const admitted = value(x.f.port().receiveScheduledTick(x.input));
  expect(admitted.kind).toBe('scheduled-admitted');
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');
  historicalOnly(x);
  const row = statuses(x).find(candidate => candidate.fact.id === directive.fact.id)!;
  expect(row.taint).toEqual([]); expect(row.conflicts).toEqual([]);
  expect(row.historical[0]!.captureStatus).toBe('available'); expect(row.constitutional).toEqual([]);
  expect(value(x.f.port().receiveScheduledTick(x.input))).toMatchObject({ kind: 'duplicate', original: admitted.fact });
  expect(value(pending(x.f)).admissions).toEqual([admitted.fact]);

  const fresh = setup(); fresh.f.bind(); const freshDirective = directiveRecord(fresh); historicalOnly(fresh);
  const accepted = value(fresh.f.port().receiveScheduledTick(fresh.input));
  expect(accepted.kind).toBe('scheduled-admitted');
  expect((fresh.f.facts().find(fact => fact.id === (accepted as any).fact.id)!.body as any).intent.under)
    .toEqual([freshDirective.directive.id]);
});

it.each(['conflicting-grant', 'conflicting-discovery', 'unavailable-discovery', 'unavailable-grant'])
('P4-ST-25 V50-%s invalidated admission dependency refuses without losing receipt/resolution', kind => {
  const x = setup(), original = x.f.storage.append.bind(x.f.storage); let injected = false;
  const storage = { ...x.f.storage, append(bytes: string, expected: string | null) {
    const result = original(bytes, expected);
    if (JSON.parse(bytes).kind === 'intake-resolved' && !injected) {
      injected = true;
      if (kind === 'unavailable-discovery') x.f.dropCapture(x.discovery.evidence.capture.reference);
      if (kind === 'unavailable-grant') x.f.dropCapture(x.grant.grant.source.record.reference);
      if (kind === 'conflicting-grant') {
        const grant = x.f.f.grant({ id: x.grant.grant.id, grantee: x.f.principal,
          standing: 'delegate', actions: ['work', 'other'], scope: x.f.f.scope });
        x.f.syncCaptures();
        const context = { ...x.f.context, decode: { ...x.f.context.decode, provenance: grant.source } };
        expect(value(authorAndAppend({ kind: 'scheduled-system-grant', schemaVersion: 1, machine: 'machine-a',
          principal: json(x.f.f.alice), provenance: json(grant.source), at: json(x.f.f.now),
          body: json({ grant }), required: [] }, context, createFactStore(context, x.f.storage),
        x.f.deps.author.privateKey)).taint).toEqual([]);
      }
      if (kind === 'conflicting-discovery') {
        const evidence = value(decode('Evidence', { ...json(x.discovery.evidence) as any,
          claim: { ...x.discovery.evidence.claim, value: false } }, x.f.context.decode));
        Object.assign(x.f.context, { decode: { ...x.f.context.decode, recordSubjects: {
          ...x.f.context.decode.recordSubjects,
          [value(canonical(x.discovery.evidence)).hash]: x.f.f.scope,
          [value(canonical(evidence)).hash]: x.f.f.scope,
        } } });
        expect(value(authorAndAppend({ kind: 'scheduled-discovery-evidence', schemaVersion: 1, machine: 'machine-a',
          principal: json(x.f.principal), provenance: json(x.f.provenance), at: json(x.f.f.now),
          body: json({ evidence }), required: [] }, x.f.context, createFactStore(x.f.context, x.f.storage),
        x.f.deps.author.privateKey)).taint).toEqual([]);
      }
    }
    return result;
  } };
  const result = value(createIntakePort({ ...x.f.deps, storage })).receiveScheduledTick(x.input);
  expect(injected).toBe(true); refused(result);
  expect(x.f.facts().filter(fact => fact.kind === 'intake-admitted')).toHaveLength(0);
  expect(x.f.facts().some(fact => fact.kind === 'intake-receipt')).toBe(true);
  expect(x.f.facts().some(fact => fact.kind === 'intake-resolved')).toBe(true);
  expect(consumeResult(pending(x.f), { Success: page => page.admissions.length, Refused: () => 0 })).toBe(0);
});

it('P4-ST-25 signed origin and replication admissions cannot bypass invalid discovery dependencies', () => {
  const unavailable = setup();
  value(unavailable.f.port().receiveScheduledTick(unavailable.input));
  const originalAdmission = unavailable.f.frames.pop() as any;
  unavailable.f.dropCapture(unavailable.discovery.evidence.capture.reference);
  const registration = value(scheduledIntakeWorkRegistration({ site: unavailable.f.context.site,
    preserved: unavailable.f.context.preserved, register: unavailable.f.context.decode.register },
  unavailable.f.principal.id,unavailable.f.deps.governance.register));
  const originContext = { ...unavailable.f.context,
    ownedBodies: [...unavailable.f.context.ownedBodies ?? [], registration],
    decode: { ...unavailable.f.context.decode, provenance: unavailable.f.provenance } };
  refused(authorAndAppend({ kind: 'intake-admitted', schemaVersion: 1, machine: 'machine-a',
    principal: json(unavailable.f.principal), provenance: json(unavailable.f.provenance), at: json(unavailable.f.f.now),
    body: originalAdmission.body, required: originalAdmission.predecessors.required }, originContext,
  createFactStore(originContext, unavailable.f.storage), unavailable.f.deps.author.privateKey));

  const conflicting = setup();
  value(conflicting.f.port().receiveScheduledTick(conflicting.input));
  const validAdmission = conflicting.f.frames.pop() as any;
  const evidence = value(decode('Evidence', { ...json(conflicting.discovery.evidence) as any,
    claim: { ...conflicting.discovery.evidence.claim, value: false } }, conflicting.f.context.decode));
  Object.assign(conflicting.f.context, { decode: { ...conflicting.f.context.decode, recordSubjects: {
    ...conflicting.f.context.decode.recordSubjects,
    [value(canonical(conflicting.discovery.evidence)).hash]: conflicting.f.f.scope,
    [value(canonical(evidence)).hash]: conflicting.f.f.scope,
  } } });
  const conflict = value(authorAndAppend({ kind: 'scheduled-discovery-evidence', schemaVersion: 1,
    machine: 'machine-a', principal: json(conflicting.f.principal), provenance: json(conflicting.f.provenance),
    at: json(conflicting.f.f.now), body: json({ evidence }), required: [] }, conflicting.f.context,
  createFactStore(conflicting.f.context, conflicting.f.storage), conflicting.f.deps.author.privateKey)).fact;
  const forged = conflicting.f.f.next(conflict, { kind: 'intake-admitted', principal: conflicting.f.principal,
    provenance: conflicting.f.provenance, at: conflicting.f.f.now, body: validAdmission.body,
    predecessors: { inSegment: conflict.id, frontier: {}, required: validAdmission.predecessors.required } },
  conflicting.f.context);
  const replicationRegistration = value(scheduledIntakeWorkRegistration({ site: conflicting.f.context.site,
    preserved: conflicting.f.context.preserved, register: conflicting.f.context.decode.register },
  conflicting.f.principal.id,conflicting.f.deps.governance.register));
  const replicationContext = { ...conflicting.f.context, facts: conflicting.f.frames as any,
    ownedBodies: [...conflicting.f.context.ownedBodies ?? [], replicationRegistration] };
  refused(verifyAndAdmit(json(forged), 'machine-a', replicationContext), 'discovery Evidence dependency is conflicted');
});

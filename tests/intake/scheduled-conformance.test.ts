import { expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, consumeResult, decode } from '../../src/index.js';
import { authorAndAppend, createFactStore, prepareSnapshot } from '../../src/facts/index.js';
import { createIntakePort, intakeWorkRegistration } from '../../src/intake/index.js';
import type { IntakeDisposition, ScheduledIntakeDisposition } from '../../src/intake/index.js';
import { intakeFixture, json, refused, value } from './fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';
import { recoverScheduledDisposition, scheduledRunHarness } from './scheduled-run-fixtures.js';

const ref = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });
const pending = (f: ReturnType<typeof scheduledFixture>, overrides = {}) => f.port().pendingScheduledAdmissions({
  owner: f.deps.workOwner, frontier: f.frontier(), limit: 10, after: null, ...overrides,
});
function setup() {
  const f = scheduledFixture(), grant = f.grant(), tick = f.tick(), discovery = f.discovery(tick.eventId);
  return { f, grant, tick, discovery,
    input: { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) } };
}
function scheduled(result: IntakeDisposition): ScheduledIntakeDisposition {
  expect(result.kind).toBe('scheduled-admitted');
  return result as ScheduledIntakeDisposition;
}

it('P4-ST-09 V19 a signed malformed Run cannot hide a valid pending admission', () => {
  const x = setup(), admission = scheduled(value(x.f.port().receiveScheduledTick(x.input)));
  scheduledRunHarness(x.f, admission);
  const previous = x.f.frames.at(-1) as any;
  const bad = x.f.f.next(previous, { kind: 'run-opening', principal: x.f.principal, provenance: x.f.provenance,
    body: { run: 'invented', record: { opening: admission.fact } } }, x.f.context);
  x.f.frames.push(bad);
  const snapshot = value(prepareSnapshot(x.f.frames as any, { ...x.f.context, facts: x.f.frames as any }));
  expect(snapshot.entries.find(row => row.fact.id === bad.id)!.conflicts.length).toBeGreaterThan(0);
  expect(value(pending(x.f)).admissions).toEqual([admission.fact]);
});

it('P4-ST-09 a clean Run payload with a mismatched outer subject cannot hide pending work', () => {
  const x = setup(), admission = scheduled(value(x.f.port().receiveScheduledTick(x.input)));
  const harness = scheduledRunHarness(x.f, admission);
  value(harness.graph.open(harness.run));
  const original = x.f.frames.pop() as any, previous = x.f.frames.at(-1) as any;
  const mismatched = x.f.f.next(previous, { kind: original.kind, principal: original.principal,
    provenance: original.provenance, body: { ...original.body, run: 'run:forged-subject' },
    predecessors: original.predecessors }, x.f.context);
  x.f.frames.push(mismatched);
  const snapshot = value(prepareSnapshot(x.f.frames as any, { ...x.f.context, facts: x.f.frames as any }));
  const row = snapshot.entries.find(candidate => candidate.fact.id === mismatched.id)!;
  expect(row.taint).toEqual([]); expect(row.conflicts).toEqual([]);
  expect(value(pending(x.f)).admissions).toEqual([admission.fact]);
});

it('P4-ST-10 V24 pending projection refuses an admission that differs from its preserved tick', () => {
  const x = setup(); value(x.f.port().receiveScheduledTick(x.input));
  const original = x.f.frames.pop() as any, previous = x.f.frames.at(-1) as any;
  const body = structuredClone(original.body); body.intent.ask.jobInstance = 'job:forged';
  x.f.frames.push(x.f.f.next(previous, { kind: original.kind, principal: original.principal,
    provenance: original.provenance, body, predecessors: original.predecessors }, x.f.context));
  refused(pending(x.f), 'differs from the preserved tick');
});

it('P4-ST-11 V28 negative discovery Evidence cannot witness a scheduled tick', () => {
  const x = setup(), previous = x.f.frames.at(-1) as any;
  const evidence = value(decode('Evidence', { ...(json(x.discovery.evidence) as Record<string, any>), id: 'evidence:negative',
    claim: { ...(x.discovery.evidence.claim as any), value: false } }, x.f.context.decode));
  const bad = x.f.f.next(previous, { kind: 'scheduled-discovery-evidence', principal: x.f.principal,
    provenance: x.f.provenance, body: json({ evidence }) }, x.f.context);
  x.f.frames.push(bad);
  refused(x.f.port().receiveScheduledTick({ ...x.input, discovery: ref(bad.id) }), 'does not bind the event id');
});

it('P4-ST-12 V25 identical redelivery returns the original after discovery freshness expires', () => {
  const x = setup(), admitted = scheduled(value(x.f.port().receiveScheduledTick(x.input)));
  x.f.setTime(1101);
  expect(value(x.f.port().receiveScheduledTick(x.input))).toMatchObject({ kind: 'duplicate', original: admitted.fact });
});

it('P4-ST-13 V30 matching signed witnesses count as one immutable grant identity', () => {
  const x = setup(), previous = x.f.frames.at(-1) as any;
  const repeated = x.f.f.next(previous, { kind: 'scheduled-system-grant', principal: x.f.f.alice,
    provenance: x.grant.grant.source, body: json({ grant: x.grant.grant }) },
  { ...x.f.context, decode: { ...x.f.context.decode, provenance: x.grant.grant.source } });
  x.f.frames.push(repeated);
  const rows = value(prepareSnapshot(x.f.frames as any, { ...x.f.context, facts: x.f.frames as any })).entries
    .filter(row => row.fact.id === x.grant.fact.id || row.fact.id === repeated.id);
  expect(rows.every(row => row.taint.length === 0 && row.conflicts.length === 0)).toBe(true);
  expect(rows[0]!.historical[0]!.view).toEqual(rows[1]!.historical[0]!.view);
  expect(value(x.f.port().receiveScheduledTick(x.input)).kind).toBe('scheduled-admitted');
});

it('P4-ST-14 V32 conversation-only construction accepts the pre-scheduled schema roster', () => {
  const f = intakeFixture();
  Object.assign(f.context, { schemas: f.context.schemas.filter(schema => schema.kind !== 'intake-scheduled-principal') });
  value(createIntakePort(f.deps));
});

it('P4-ST-15 signed scheduled references require available, consistent owner-decoded history', () => {
  const unavailable = setup(); value(unavailable.f.port().receiveScheduledTick(unavailable.input));
  unavailable.f.dropCapture(unavailable.discovery.evidence.capture.reference);
  expect(value(pending(unavailable.f)).admissions).toEqual([]);

  const required = setup(), parent = required.f.discovery(required.tick.eventId, 'machine-b', 99);
  const previous = required.discovery.fact;
  const child = required.f.f.next(previous, { kind: 'scheduled-discovery-evidence', principal: required.f.principal,
    provenance: required.f.provenance, body: json({ evidence: required.discovery.evidence }),
    predecessors: { inSegment: previous.id, frontier: {}, required: [parent.fact.id] } }, required.f.context);
  required.f.frames.push(child); required.f.dropCapture(parent.evidence.capture.reference);
  const before = required.f.frames.length;
  refused(required.f.port().receiveScheduledTick({ ...required.input, discovery: ref(child.id) }));
  expect(required.f.frames.slice(before).map((row: any) => row.kind)).toEqual(['intake-receipt']);
});

it.each(['intake-receipt', 'intake-scheduled-principal', 'intake-resolved', 'intake-admitted'])
('P4-ST-16 durable cut after %s retains exactly one eventual scheduled admission', kind => {
  const directory = mkdtempSync(join(tmpdir(), 'p4-st-16-'));
  const f = scheduledFixture({ directory }); f.grant(); const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const input = { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) };
  const original = f.storage.append.bind(f.storage); let hit = false;
  const storage = { ...f.storage, append(bytes: string, expected: string | null) {
    const result = original(bytes, expected);
    if (JSON.parse(bytes).kind === kind) { hit = true; throw new Error('simulated crash after durable append'); }
    return result;
  } };
  refused(value(createIntakePort({ ...f.deps, storage })).receiveScheduledTick(input)); expect(hit).toBe(true);
  const restarted = scheduledFixture({ directory }); restarted.installSchemas();
  restarted.setTime(101);
  expect(['scheduled-admitted', 'duplicate']).toContain(value(restarted.port().receiveScheduledTick(input)).kind);
  expect(restarted.facts().filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
  expect(value(pending(restarted)).admissions).toHaveLength(1);
  expect(value(restarted.port().receiveScheduledTick(input)).kind).toBe('duplicate');
});

it.each(['intake-collapse', 'intake-mismatch'])
('P4-ST-17 durable cut after %s retains the admission and exact retry result', kind => {
  const directory = mkdtempSync(join(tmpdir(), 'p4-st-17-'));
  const f = scheduledFixture({ directory }); f.grant(); const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const input = { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) };
  const admitted = scheduled(value(f.port().receiveScheduledTick(input)));
  const original = f.storage.append.bind(f.storage); let hit = false;
  const storage = { ...f.storage, append(bytes: string, expected: string | null) {
    const result = original(bytes, expected);
    if (JSON.parse(bytes).kind === kind) { hit = true; throw new Error('simulated crash after durable append'); }
    return result;
  } };
  const retry = kind === 'intake-mismatch' ? { ...input, raw: f.tick({ calendarPolicyVersion: 'changed' }).raw } : input;
  refused(value(createIntakePort({ ...f.deps, storage })).receiveScheduledTick(retry)); expect(hit).toBe(true);
  const restarted = scheduledFixture({ directory }); restarted.installSchemas();
  if (kind === 'intake-mismatch') refused(restarted.port().receiveScheduledTick(retry), 'different arrival bytes');
  else expect(value(restarted.port().receiveScheduledTick(retry))).toMatchObject({ kind: 'duplicate', original: admitted.fact });
  expect(restarted.facts().filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
  expect(restarted.facts().some(row => row.kind === kind)).toBe(true);
});

it('P4-ST-18 a lost acknowledgement after durable Run append returns that Run on restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p4-st-18-'));
  const f = scheduledFixture({ directory }); f.grant(); const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const admitted = scheduled(value(f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) })));
  const harness = scheduledRunHarness(f, admitted), original = f.storage.append.bind(f.storage); let hit = false;
  f.storage.append = (bytes, expected) => {
    const result = original(bytes, expected);
    if (JSON.parse(bytes).kind === 'run-opening') { hit = true; throw new Error('lost Run acknowledgement after fsync'); }
    return result;
  };
  refused(harness.graph.open(harness.run)); expect(hit).toBe(true);
  const root = f.facts().find(row => row.kind === 'run-opening')!;
  const restarted = scheduledFixture({ directory }), recovered = recoverScheduledDisposition(restarted, admitted.fact.id);
  const next = scheduledRunHarness(restarted, recovered), result = value(next.graph.open(next.run));
  expect(result.head).toBe(harness.run.id); expect(result.run.id).toBe((root.body as any).record.id);
  expect(next.createCalls()).toBe(0); expect(value(pending(restarted)).admissions).toEqual([]);
});

it('P4-ST-19 V35 a valid retry after missing discovery remains readable when the clock advances', () => {
  const x = setup();
  const before = x.f.frames.length;
  refused(x.f.port().receiveScheduledTick({ ...x.input, discovery: ref('missing:discovery') }));
  expect(x.f.frames.slice(before).map((row: any) => row.kind)).toEqual(['intake-receipt']);
  x.f.setTime(101);
  const admitted = scheduled(value(x.f.port().receiveScheduledTick(x.input)));
  expect(value(pending(x.f)).admissions).toEqual([admitted.fact]);
  expect(value(x.f.port().receiveScheduledTick(x.input))).toMatchObject({ kind: 'duplicate', original: admitted.fact });
});

function rewriteScheduledRoute(x: ReturnType<typeof setup>, field: 'adapter'|'channel', replacement: string) {
  value(x.f.port().receiveScheduledTick(x.input));
  const first = x.f.frames.findIndex((row: any) => row.kind === 'intake-receipt');
  const tail = x.f.frames.splice(first) as any[], ids = new Map<string, string>();
  const adapter = field === 'adapter' ? replacement : x.tick.route.adapter!;
  const channel = field === 'channel' ? replacement : x.tick.route.channel;
  const logicalId = value(canonical([adapter, channel, x.tick.route.sender,
    x.tick.route.identityEpoch, x.tick.eventId])).hash;
  for (const old of tail) {
    const body = structuredClone(old.body);
    if (old.kind === 'intake-receipt') {
      body.adapter = adapter;
      const route = JSON.parse(body.ingress); route.channel = channel;
      body.ingress = value(canonical(route)).bytes;
    }
    if (body.logicalId) { body.logicalId = logicalId; body.adapter = adapter; body.channel = channel; }
    if (body.receipt) body.receipt = ids.get(body.receipt) ?? body.receipt;
    if (body.intent) body.intent.id = logicalId;
    const previous = x.f.frames.at(-1) as any;
    const fact = x.f.f.next(previous, { kind: old.kind, principal: old.principal, provenance: old.provenance,
      at: old.at, body, predecessors: { ...old.predecessors, inSegment: previous.id,
        required: old.predecessors.required.map((id: string) => ids.get(id) ?? id) } }, x.f.context);
    ids.set(old.id, fact.id); x.f.frames.push(fact);
  }
  const registration = value(intakeWorkRegistration({ site: x.f.context.site, preserved: x.f.context.preserved,
    register: x.f.context.decode.register }, x.f.principal.id));
  const rows = value(prepareSnapshot(x.f.frames as any, { ...x.f.context, facts: x.f.frames as any,
    ownedBodies: [...x.f.context.ownedBodies ?? [], registration] })).entries;
  return { rows, admission: x.f.frames.at(-1) as any };
}

it.each([['V36', 'chat:ordinary'], ['V36b', 'scheduled:']] as const)
('P4-ST-20 %s signed scheduled history with channel %s is refused while a valid second installation remains readable',
(_id, channel) => {
  const invalid = setup(), history = rewriteScheduledRoute(invalid, 'channel', channel);
  expect(history.rows.every(row => row.taint.length === 0 && row.conflicts.length === 0)).toBe(true);
  refused(pending(invalid.f), 'channel must name its installation');

  const direct = setup(), before = direct.f.frames.length;
  refused(direct.f.port().receiveScheduledTick({ ...direct.input,
    route: { ...direct.input.route, channel } }), 'channel must name its installation');
  expect(direct.f.frames.slice(before).map((row: any) => row.kind)).toEqual(['intake-receipt']);

  const valid = setup(), control = rewriteScheduledRoute(valid, 'channel', 'scheduled:installation-b');
  expect(value(pending(valid.f)).admissions).toEqual([ref(control.admission.id)]);
});

it('P4-ST-21 V42 a valid scheduled tick records every applicable signed directive', () => {
  const x = setup(); x.f.bind();
  const directive = value(decode('Directive', x.f.f.directiveInput(), {
    ...x.f.context.decode, grants: x.f.context.grants.map(grant => grant.grant),
  }));
  Object.assign(x.f.context, { schemas: [...x.f.context.schemas, { ...x.f.f.schema, kind: 'directive-record',
    fields: { directive: { kind: 'constitutional', type: 'Directive' } } }] });
  const appended = value(authorAndAppend({ kind: 'directive-record', schemaVersion: 1, machine: 'machine-a',
    principal: json(x.f.f.alice), provenance: json(x.f.f.alice.provenance), at: json(x.f.f.now),
    body: { directive: json(directive) }, required: [] }, x.f.context,
  createFactStore(x.f.context, x.f.storage), x.f.deps.author.privateKey));
  expect(appended.taint).toEqual([]);
  const admitted = scheduled(value(x.f.port().receiveScheduledTick(x.input)));
  const fact = x.f.facts().find(row => row.id === admitted.fact.id)!;
  expect((fact.body as any).intent.under).toEqual([directive.id]);
  expect(fact.predecessors.required).toContain(appended.fact.id);
  expect(value(pending(x.f)).admissions).toEqual([admitted.fact]);
});

it.each(['missing', 'wrong-kind', 'wrong-owner', 'unavailable', 'mismatched-event'])
('P4-ST-22 V43 duplicate with %s discovery is refused after preservation without a collapse', kind => {
  const x = setup(), admitted = scheduled(value(x.f.port().receiveScheduledTick(x.input)));
  let discovery: any = x.input.discovery;
  if (kind === 'missing') discovery = ref('missing:discovery');
  if (kind === 'wrong-kind') discovery = ref(x.grant.fact.id);
  if (kind === 'wrong-owner') discovery = { ...discovery, owner: 'part-five' };
  if (kind === 'unavailable') {
    const other = x.f.discovery(x.tick.eventId, 'machine-b', 99);
    x.f.dropCapture(other.evidence.capture.reference); discovery = ref(other.fact.id);
  }
  if (kind === 'mismatched-event') discovery = ref(x.f.discovery('another-event', 'machine-b', 99).fact.id);
  const before = x.f.frames.length;
  refused(x.f.port().receiveScheduledTick({ ...x.input, discovery }));
  expect(x.f.frames.slice(before).map((row: any) => row.kind)).toEqual(['intake-receipt']);
  expect(x.f.facts().filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
  expect(admitted.fact.id).toBeTruthy();
});

function recordScheduledRevocation(x: ReturnType<typeof setup>) {
  const payload = { id: 'scheduled-grant-revocation', grantId: x.grant.grant.id,
    by: x.f.f.alice, at: x.f.f.now, reason: 'grant withdrawn' };
  const proof = x.f.f.proof(payload); x.f.syncCaptures();
  const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p },
    { ...x.f.context.decode, provenance: proof.p, grants: [x.grant.grant, ...x.f.context.grants.map(grant => grant.grant)] }));
  Object.assign(x.f.context, { schemas: [...x.f.context.schemas, { ...x.f.f.schema, kind: 'scheduled-grant-revocation',
    fields: { revocation: { kind: 'constitutional', type: 'Revocation' } } }] });
  const revocationContext = { ...x.f.context,
    grants: [...x.f.context.grants, { factId: x.grant.fact.id, grant: x.grant.grant }],
    decode: { ...x.f.context.decode, provenance: proof.p } };
  const appended = value(authorAndAppend({ kind: 'scheduled-grant-revocation', schemaVersion: 1, machine: 'machine-a',
    principal: json(x.f.f.alice), provenance: json(proof.p), at: json(x.f.f.now),
    body: { revocation: json(revocation) }, required: [x.grant.fact.id] }, revocationContext,
  createFactStore(revocationContext, x.f.storage), x.f.deps.author.privateKey));
  expect(appended.taint).toEqual([]); return appended.fact;
}

it('P4-ST-23 V44/V45/V46 scheduled standing is revalidated at admission while historical replay stays stable', () => {
  const revoked = setup(); revoked.f.bind(); recordScheduledRevocation(revoked);
  const before = revoked.f.frames.length;
  refused(revoked.f.port().receiveScheduledTick(revoked.input));
  expect(revoked.f.frames.slice(before).map((row: any) => row.kind)).toEqual(['intake-receipt']);

  const racing = setup(); racing.f.bind();
  const original = racing.f.storage.append.bind(racing.f.storage); let revocation: any;
  const storage = { ...racing.f.storage, append(bytes: string, expected: string | null) {
    const result = original(bytes, expected);
    if (JSON.parse(bytes).kind === 'intake-resolved') revocation = recordScheduledRevocation(racing);
    return result;
  } };
  refused(value(createIntakePort({ ...racing.f.deps, storage })).receiveScheduledTick(racing.input));
  expect(revocation).toBeDefined();
  expect(racing.f.facts().filter(row => row.kind === 'intake-admitted')).toEqual([]);
  expect(value(pending(racing.f)).admissions).toEqual([]);

  const historical = setup(); historical.f.bind();
  const admitted = scheduled(value(historical.f.port().receiveScheduledTick(historical.input)));
  recordScheduledRevocation(historical);
  expect(value(pending(historical.f)).admissions).toEqual([admitted.fact]);
  expect(value(historical.f.port().receiveScheduledTick(historical.input)))
    .toMatchObject({ kind: 'duplicate', original: admitted.fact });
});

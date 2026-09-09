import { expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, consumeResult, decode } from '../../src/index.js';
import { authorAndAppend, createFactStore, prepareSnapshot } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
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
  expect(['scheduled-admitted', 'duplicate']).toContain(value(restarted.port().receiveScheduledTick(input)).kind);
  expect(restarted.facts().filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
  expect(value(pending(restarted)).admissions).toHaveLength(1);
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

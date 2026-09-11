import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decode } from '../../src/index.js';
import { authorAndAppend, createFactStore, prepareSnapshot } from '../../src/facts/index.js';
import { scheduledIntakeWorkRegistration } from '../../src/intake/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { json, refused, value } from './fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';
import { recoverScheduledDisposition, scheduledRunHarness } from './scheduled-run-fixtures.js';

const ref = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });
function setup() {
  const f = scheduledFixture(), grant = f.grant(), tick = f.tick(), discovery = f.discovery(tick.eventId);
  return { f, grant, tick, discovery,
    input: { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) } };
}
const pending = (f: ReturnType<typeof scheduledFixture>) => f.port().pendingScheduledAdmissions({
  owner: f.deps.workOwner, frontier: f.frontier(), limit: 10, after: null,
});
function admit(f: ReturnType<typeof scheduledFixture>, input: ReturnType<typeof setup>['input']) {
  const disposition = value(f.port().receiveScheduledTick(input));
  if (disposition.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');
  return disposition;
}
function directiveRecord(x: ReturnType<typeof setup>) {
  const directive = value(decode('Directive', x.f.f.directiveInput(), {
    ...x.f.context.decode, grants: x.f.context.grants.map(row => row.grant),
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
function removeLiveAuthority(f: ReturnType<typeof scheduledFixture>) {
  Object.assign(f.context, { grants: [], decode: { ...f.context.decode, provenance: f.provenance,
    principals: [f.principal], grants: [], directives: [] } });
}
function statuses(f: ReturnType<typeof scheduledFixture>) {
  const registration = value(scheduledIntakeWorkRegistration({ site: f.context.site, preserved: f.context.preserved,
    register: f.context.decode.register }, f.principal.id,f.deps.governance.register));
  return value(prepareSnapshot(f.frames as any, { ...f.context, facts: f.frames as any,
    ownedBodies: [...f.context.ownedBodies ?? [], registration] })).entries;
}
function durable<T>(run: (directory: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), 'instar-p4-repair4-directive-'));
  try { return run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

it('P4-ST-26 V55 Slice A refuses a complete signed Directive without live caches', () => {
  const x = setup(); x.f.bind(); const directive = directiveRecord(x);
  removeLiveAuthority(x.f);
  const rows = statuses(x.f);
  expect(rows.every(row => !row.taint.length && !row.conflicts.length)).toBe(true);
  expect(rows.find(row => row.fact.id === directive.fact.id)!.historical[0]!.captureStatus).toBe('available');
  refused(x.f.port().receiveScheduledTick(x.input),'unsupported-in-slice-a');
});

it('P4-ST-26 V58 durable cold-reader refuses complete signed Directive history', () => durable(directory => {
  const f = scheduledFixture({ directory }), grant = f.grant(), tick = f.tick(), discovery = f.discovery(tick.eventId);
  const input = { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) };
  const x = { f, grant, tick, discovery, input };
  f.bind(); const directive = directiveRecord(x);
  const restarted = scheduledFixture({ directory }); restarted.installSchemas(); restarted.setTime(101);
  Object.assign(restarted.context, { schemas: structuredClone(f.context.schemas) });
  removeLiveAuthority(restarted);
  const rows = statuses(restarted);
  expect(rows.every(row => !row.taint.length && !row.conflicts.length)).toBe(true);
  expect(rows.find(row => row.fact.id === directive.fact.id)!.historical[0]!.captureStatus).toBe('available');
  refused(restarted.port().receiveScheduledTick(input),'unsupported-in-slice-a');
}));

function appendConstitutional(f: ReturnType<typeof scheduledFixture>, kind: string,
  field: 'evidence' | 'grant', type: 'Evidence' | 'StandingGrant', valueInput: unknown,
  actor = f.principal, provenance = f.provenance) {
  Object.assign(f.context, { schemas: [...f.context.schemas, { ...f.f.schema, kind,
    fields: { [field]: { kind: 'constitutional' as const, type } } }] });
  const context = { ...f.context, decode: { ...f.context.decode, provenance } };
  return value(authorAndAppend({ kind, schemaVersion: 1, machine: 'machine-a', principal: json(actor),
    provenance: json(provenance), at: json(f.f.now), body: json({ [field]: valueInput }), required: [] },
  context, createFactStore(context, f.storage), f.deps.author.privateKey)).fact;
}

it.each(['new', 'duplicate'])
('P4-ST-27 V56 %s accepts signed Evidence from another registered constitutional schema', operation => {
  const x = setup(); const admitted = operation === 'duplicate' ? admit(x.f, x.input) : null;
  const evidence = appendConstitutional(x.f, 'other-discovery-evidence', 'evidence', 'Evidence', x.discovery.evidence);
  const result = x.f.port().receiveScheduledTick({ ...x.input, discovery: ref(evidence.id) });
  if (operation === 'new') expect(value(result).kind).toBe('scheduled-admitted');
  else expect(value(result)).toMatchObject({ kind: 'duplicate', original: admitted!.fact });
});

it.each(['scheduled-system-grant', 'registered-job-grant'])
('P4-ST-27 V61 accepts a live job grant from registered StandingGrant schema %s', kind => {
  const f = scheduledFixture(); f.installSchemas();
  const grant = f.f.grant({ id: 'scheduled-grant:1', grantee: f.principal,
    standing: 'delegate', actions: ['work'], scope: f.f.scope });
  f.syncCaptures();
  let grantFact;
  if (kind === 'scheduled-system-grant') {
    const context = { ...f.context, decode: { ...f.context.decode, provenance: grant.source } };
    grantFact = value(authorAndAppend({ kind, schemaVersion: 1, machine: 'machine-a', principal: json(f.f.alice),
      provenance: json(grant.source), at: json(f.f.now), body: json({ grant }), required: [] }, context,
    createFactStore(context, f.storage), f.deps.author.privateKey)).fact;
  } else grantFact = appendConstitutional(f, kind, 'grant', 'StandingGrant', grant, f.f.alice, grant.source);
  const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const admitted = admit(f, { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) });
  expect(value(pending(f)).admissions).toEqual([admitted.fact]);
  expect(f.facts().find(fact => fact.id === admitted.fact.id)!.predecessors.required).toContain(grantFact.id);
});

it('P4-ST-27 wrong constitutional type cannot witness scheduled discovery', () => {
  const x = setup();
  const wrong = appendConstitutional(x.f, 'wrong-discovery-type', 'grant', 'StandingGrant', x.grant.grant,
    x.f.f.alice, x.grant.grant.source);
  const before = x.f.frames.length;
  refused(x.f.port().receiveScheduledTick({ ...x.input, discovery: ref(wrong.id) }), 'discovery Evidence');
  expect(x.f.frames.slice(before).map((fact: any) => fact.kind)).toEqual(['intake-receipt']);
});

it('P4-ST-27 wrong constitutional type cannot witness scheduled standing', () => {
  const f = scheduledFixture(); f.installSchemas();
  const tick = f.tick(), discovery = f.discovery(tick.eventId);
  appendConstitutional(f, 'wrong-grant-type', 'evidence', 'Evidence', discovery.evidence);
  const before = f.frames.length;
  refused(f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) }),
    'current covering package-system grant');
  expect(f.frames.slice(before).map((fact: any) => fact.kind)).toEqual(['intake-receipt']);
});

it.each(['jobInstance', 'calendarPolicyVersion'] as const)
('P4-ST-28 V62 direct append refuses an Intent whose %s differs from its canonical tick', field => {
  const x = setup(); admit(x.f, x.input);
  const original = x.f.frames.pop() as FactEnvelope, body = structuredClone(original.body) as Record<string, any>;
  body.intent.ask[field] = 'different';
  const registration = value(scheduledIntakeWorkRegistration({ site: x.f.context.site, preserved: x.f.context.preserved,
    register: x.f.context.decode.register }, x.f.principal.id,x.f.deps.governance.register));
  const context = { ...x.f.context, ownedBodies: [...x.f.context.ownedBodies ?? [], registration],
    decode: { ...x.f.context.decode, provenance: x.f.provenance } };
  refused(authorAndAppend({ kind: original.kind, schemaVersion: original.schemaVersion, machine: original.machine,
    principal: json(original.principal), provenance: json(original.provenance), at: json(original.at), body: json(body),
    required: original.predecessors.required }, context, createFactStore(context, x.f.storage), x.f.deps.author.privateKey),
  'unsupported-in-slice-a');
  expect(x.f.facts().filter(fact => fact.kind === 'intake-admitted')).toEqual([]);
  expect(() => recoverScheduledDisposition(x.f, original.id)).toThrow('durable scheduled admission absent');
});

it('P4-ST-28 V63 an unmodified signed scheduled admission opens exactly one Run', () => {
  const x = setup(), admitted = admit(x.f, x.input), harness = scheduledRunHarness(x.f, admitted);
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(admitted.fact);
  expect(x.f.facts().filter(fact => fact.kind === 'run-opening')).toHaveLength(1);
});

it('P4-ST-29 NF-66 alternate-schema Evidence must be fresh at owner admission', () => {
  const x = setup();
  const alternate = appendConstitutional(x.f, 'other-stale-discovery-evidence', 'evidence', 'Evidence', x.discovery.evidence);
  x.f.setTime(1101);
  const before = x.f.frames.length;
  refused(x.f.port().receiveScheduledTick({ ...x.input, discovery: ref(alternate.id) }));
  expect(x.f.frames.slice(before).map((fact: any) => fact.kind)).toEqual(['intake-receipt']);
});

it('P4-ST-29 NF-66 unavailable historical tick capture remains retained but cannot promote', () => {
  const x = setup(), admitted = admit(x.f, x.input);
  const admission = x.f.facts().find(fact => fact.id === admitted.fact.id)!;
  const receipt = x.f.facts().find(fact => fact.id === (admission.body as Record<string, any>).receipt)!;
  const reference = (receipt.body as Record<string, any>).capture.reference;
  Object.assign((x.f.context.captures as Record<string, any>)[reference], { status: 'missing', bytes: null });
  expect(x.f.facts().some(fact => fact.id === admitted.fact.id)).toBe(true);
  expect(value(pending(x.f)).admissions).toEqual([]);
});

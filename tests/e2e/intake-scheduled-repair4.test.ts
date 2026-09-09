import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { intakeWorkRegistration } from '../../src/intake/index.js';
import { json, refused, value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { recoverScheduledDisposition, scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';

const ref = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });
function durable<T>(run: (directory: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), 'instar-p4-repair4-'));
  try { return run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}
function removeLiveAuthority(f: ReturnType<typeof scheduledFixture>) {
  Object.assign(f.context, { grants: [], decode: { ...f.context.decode, provenance: f.provenance,
    principals: [f.principal], grants: [], directives: [] } });
}

it('P4-ST-26 V58 fsync restart projects and deduplicates complete directive history with empty caches', () => durable(directory => {
  const before = scheduledFixture({ directory }); before.grant(); before.bind();
  const tick = before.tick(), discovery = before.discovery(tick.eventId);
  const directive = value(decode('Directive', before.f.directiveInput(), {
    ...before.context.decode, grants: before.context.grants.map(row => row.grant),
  }));
  Object.assign(before.context, { schemas: [...before.context.schemas, { ...before.f.schema, kind: 'directive-record',
    fields: { directive: { kind: 'constitutional' as const, type: 'Directive' as const } } }] });
  value(authorAndAppend({ kind: 'directive-record', schemaVersion: 1, machine: 'machine-a',
    principal: json(before.f.alice), provenance: json(before.f.alice.provenance), at: json(before.f.now),
    body: json({ directive }), required: [] }, before.context, createFactStore(before.context, before.storage),
  before.deps.author.privateKey));
  const input = { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) };
  removeLiveAuthority(before);
  const admitted = value(before.port().receiveScheduledTick(input));
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');

  const restarted = scheduledFixture({ directory }); restarted.installSchemas(); restarted.setTime(101);
  Object.assign(restarted.context, { schemas: structuredClone(before.context.schemas) });
  removeLiveAuthority(restarted);
  expect(value(restarted.port().pendingScheduledAdmissions({ owner: restarted.deps.workOwner,
    frontier: restarted.frontier(), limit: 10, after: null })).admissions).toEqual([admitted.fact]);
  expect(value(restarted.port().receiveScheduledTick(input))).toMatchObject({ kind: 'duplicate', original: admitted.fact });
}));

it('P4-ST-27 V56/V61 fsync restart retains alternate registered Evidence and StandingGrant witnesses', () => durable(directory => {
  const before = scheduledFixture({ directory }); before.installSchemas();
  const grant = before.f.grant({ id: 'scheduled-grant:1', grantee: before.principal,
    standing: 'delegate', actions: ['work'], scope: before.f.scope });
  before.syncCaptures();
  const grantSchema = { ...before.grantSchema, kind: 'registered-job-grant' };
  const evidenceSchema = { ...before.evidenceSchema, kind: 'registered-discovery-evidence' };
  Object.assign(before.context, { schemas: [...before.context.schemas, grantSchema, evidenceSchema] });
  const grantContext = { ...before.context, decode: { ...before.context.decode, provenance: grant.source } };
  value(authorAndAppend({ kind: grantSchema.kind, schemaVersion: 1, machine: 'machine-a', principal: json(before.f.alice),
    provenance: json(grant.source), at: json(before.f.now), body: json({ grant }), required: [] }, grantContext,
  createFactStore(grantContext, before.storage), before.deps.author.privateKey));
  const tick = before.tick(), originalDiscovery = before.discovery(tick.eventId);
  const evidenceContext = { ...before.context, decode: { ...before.context.decode, provenance: before.provenance } };
  const discovery = value(authorAndAppend({ kind: evidenceSchema.kind, schemaVersion: 1, machine: 'machine-a',
    principal: json(before.principal), provenance: json(before.provenance), at: json(before.f.now),
    body: json({ evidence: originalDiscovery.evidence }), required: [] }, evidenceContext,
  createFactStore(evidenceContext, before.storage), before.deps.author.privateKey)).fact;
  const admitted = value(before.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.id) }));
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');

  const restarted = scheduledFixture({ directory }); restarted.installSchemas();
  Object.assign(restarted.context, { schemas: structuredClone(before.context.schemas) });
  expect(value(restarted.port().pendingScheduledAdmissions({ owner: restarted.deps.workOwner,
    frontier: restarted.frontier(), limit: 10, after: null })).admissions).toEqual([admitted.fact]);
}));

it.each(['jobInstance', 'calendarPolicyVersion'] as const)
('P4-ST-28 V62 fsync history never appends a scheduled admission with mismatched %s', field => durable(directory => {
  const before = scheduledFixture({ directory }); before.grant(); const tick = before.tick(), discovery = before.discovery(tick.eventId);
  const input = { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) };
  const admitted = value(before.port().receiveScheduledTick(input));
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');
  const original = before.frames.pop() as FactEnvelope, body = structuredClone(original.body) as Record<string, any>;
  body.intent.ask[field] = 'different';
  const registration = value(intakeWorkRegistration({ site: before.context.site, preserved: before.context.preserved,
    register: before.context.decode.register }, before.principal.id));
  const context = { ...before.context, ownedBodies: [...before.context.ownedBodies ?? [], registration],
    decode: { ...before.context.decode, provenance: before.provenance } };
  refused(authorAndAppend({ kind: original.kind, schemaVersion: original.schemaVersion, machine: original.machine,
    principal: json(original.principal), provenance: json(original.provenance), at: json(original.at), body: json(body),
    required: original.predecessors.required }, context, createFactStore(context, before.storage), before.deps.author.privateKey));

  const restarted = scheduledFixture({ directory }); restarted.installSchemas();
  const admissions = restarted.facts().filter(fact => fact.kind === 'intake-admitted');
  expect(admissions).toHaveLength(1);
  expect((admissions[0]!.body as Record<string, any>).intent.ask).toEqual(tick.body);
  const recovered = recoverScheduledDisposition(restarted, admitted.fact.id), harness = scheduledRunHarness(restarted, recovered);
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(admitted.fact);
  expect(restarted.facts().filter(fact => fact.kind === 'run-opening')).toHaveLength(1);
}));

it('P4-ST-29 NF-66 fsync path refuses stale alternate-schema Evidence without an admission', () => durable(directory => {
  const before = scheduledFixture({ directory }); before.grant(); const tick = before.tick(), discovery = before.discovery(tick.eventId);
  const schema = { ...before.evidenceSchema, kind: 'registered-stale-discovery-evidence' };
  Object.assign(before.context, { schemas: [...before.context.schemas, schema] });
  const evidenceContext = { ...before.context, decode: { ...before.context.decode, provenance: before.provenance } };
  const alternate = value(authorAndAppend({ kind: schema.kind, schemaVersion: 1, machine: 'machine-a',
    principal: json(before.principal), provenance: json(before.provenance), at: json(before.f.now),
    body: json({ evidence: discovery.evidence }), required: [] }, evidenceContext,
  createFactStore(evidenceContext, before.storage), before.deps.author.privateKey)).fact;
  before.setTime(1101);
  refused(before.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(alternate.id) }));
  const restarted = scheduledFixture({ directory }); restarted.installSchemas();
  Object.assign(restarted.context, { schemas: [...restarted.context.schemas, schema] });
  expect(restarted.facts().filter(fact => fact.kind === 'intake-admitted')).toEqual([]);
}));

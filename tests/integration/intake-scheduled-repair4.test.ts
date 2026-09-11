import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend, createFactStore, verifyAndAdmit } from '../../src/facts/index.js';
import { scheduledIntakeWorkRegistration } from '../../src/intake/scheduled-a/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { json, refused, value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';

const ref = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });
function registration(f: ReturnType<typeof scheduledFixture>) {
  return value(scheduledIntakeWorkRegistration({ site: f.context.site, preserved: f.context.preserved,
    register: f.context.decode.register }, f.principal.id,f.deps.governance.register));
}
function removeLiveAuthority(f: ReturnType<typeof scheduledFixture>) {
  Object.assign(f.context, { grants: [], decode: { ...f.context.decode, provenance: f.provenance,
    principals: [f.principal], grants: [], directives: [] } });
}

it('P4-ST-26 V55 Slice A refuses complete Directive history without cache authority', () => {
  const f = scheduledFixture(); f.grant(); f.bind(); const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const directive = value(decode('Directive', f.f.directiveInput(), {
    ...f.context.decode, grants: f.context.grants.map(row => row.grant),
  }));
  Object.assign(f.context, { schemas: [...f.context.schemas, { ...f.f.schema, kind: 'directive-record',
    fields: { directive: { kind: 'constitutional' as const, type: 'Directive' as const } } }] });
  value(authorAndAppend({ kind: 'directive-record', schemaVersion: 1, machine: 'machine-a',
    principal: json(f.f.alice), provenance: json(f.f.alice.provenance), at: json(f.f.now),
    body: json({ directive }), required: [] }, f.context, createFactStore(f.context, f.storage),
  f.deps.author.privateKey));
  removeLiveAuthority(f);
  const before=f.frames.length;
  refused(f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) }),
    'unsupported-in-slice-a');
  expect(f.frames.slice(before).map((fact: any)=>fact.kind)).toEqual(['intake-receipt']);
});

it('P4-ST-27 V56/V61 alternate constitutional schemas survive the signed replication decoder', () => {
  const f = scheduledFixture(); f.installSchemas();
  const grant = f.f.grant({ id: 'scheduled-grant:1', grantee: f.principal,
    standing: 'delegate', actions: ['work'], scope: f.f.scope });
  f.syncCaptures();
  const grantSchema = { ...f.grantSchema, kind: 'registered-job-grant' };
  const evidenceSchema = { ...f.evidenceSchema, kind: 'registered-discovery-evidence' };
  Object.assign(f.context, { schemas: [...f.context.schemas, grantSchema, evidenceSchema] });
  const grantContext = { ...f.context, decode: { ...f.context.decode, provenance: grant.source } };
  value(authorAndAppend({ kind: grantSchema.kind, schemaVersion: 1, machine: 'machine-a', principal: json(f.f.alice),
    provenance: json(grant.source), at: json(f.f.now), body: json({ grant }), required: [] }, grantContext,
  createFactStore(grantContext, f.storage), f.deps.author.privateKey));
  const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const evidenceContext = { ...f.context, decode: { ...f.context.decode, provenance: f.provenance } };
  const evidence = value(authorAndAppend({ kind: evidenceSchema.kind, schemaVersion: 1, machine: 'machine-a',
    principal: json(f.principal), provenance: json(f.provenance), at: json(f.f.now),
    body: json({ evidence: discovery.evidence }), required: [] }, evidenceContext,
  createFactStore(evidenceContext, f.storage), f.deps.author.privateKey)).fact;
  const admitted = value(f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(evidence.id) }));
  expect(admitted.kind).toBe('scheduled-admitted');
  const signedAdmission = f.frames.pop() as any;
  const context = { ...f.context, facts: f.frames as any,
    ownedBodies: [...f.context.ownedBodies ?? [], registration(f)] };
  expect(value(verifyAndAdmit(json(signedAdmission), 'machine-a', context)).id).toBe(signedAdmission.id);
});

it.each(['jobInstance', 'calendarPolicyVersion'] as const)
('P4-ST-28 V62 owner admission blocks mismatched %s before the joint Run consumer', field => {
  const f = scheduledFixture(); f.grant(); const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const input = { raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) };
  const admitted = value(f.port().receiveScheduledTick(input));
  if (admitted.kind !== 'scheduled-admitted') throw new Error('expected scheduled admission');
  const original = f.frames.pop() as FactEnvelope, body = structuredClone(original.body) as Record<string, any>;
  body.intent.ask[field] = 'different';
  const context = { ...f.context, ownedBodies: [...f.context.ownedBodies ?? [], registration(f)],
    decode: { ...f.context.decode, provenance: f.provenance } };
  refused(authorAndAppend({ kind: original.kind, schemaVersion: original.schemaVersion, machine: original.machine,
    principal: json(original.principal), provenance: json(original.provenance), at: json(original.at), body: json(body),
    required: original.predecessors.required }, context, createFactStore(context, f.storage), f.deps.author.privateKey),
  'differs from');
  expect(f.facts().filter(fact => fact.kind === 'run-opening')).toEqual([]);
  const valid = value(f.port().receiveScheduledTick(input));
  if (valid.kind !== 'scheduled-admitted') throw new Error('expected valid scheduled admission');
  const harness = scheduledRunHarness(f, valid);
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(valid.fact);
  expect(f.facts().filter(fact => fact.kind === 'run-opening')).toHaveLength(1);
});

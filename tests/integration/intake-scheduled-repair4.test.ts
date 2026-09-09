import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend, createFactStore, verifyAndAdmit } from '../../src/facts/index.js';
import { intakeWorkRegistration } from '../../src/intake/index.js';
import { json, value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';

const ref = (id: string) => ({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id });
function registration(f: ReturnType<typeof scheduledFixture>) {
  return value(intakeWorkRegistration({ site: f.context.site, preserved: f.context.preserved,
    register: f.context.decode.register }, f.principal.id));
}
function removeLiveAuthority(f: ReturnType<typeof scheduledFixture>) {
  Object.assign(f.context, { grants: [], decode: { ...f.context.decode, provenance: f.provenance,
    principals: [f.principal], grants: [], directives: [] } });
}

it('P4-ST-26 V55 signed origin and replication use complete directive history without cache authority', () => {
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
  const admitted = value(f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: ref(discovery.fact.id) }));
  expect(admitted.kind).toBe('scheduled-admitted');
  const signedAdmission = f.frames.pop() as any;
  const context = { ...f.context, facts: f.frames as any,
    ownedBodies: [...f.context.ownedBodies ?? [], registration(f)] };
  expect(value(verifyAndAdmit(json(signedAdmission), 'machine-a', context)).id).toBe(signedAdmission.id);
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

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { createIntakePort, intakeStopRegistration, intakeWorkRegistration } from '../../src/intake/index.js';
import { authorAndAppend, createFactStore, signEnvelope } from '../../src/facts/index.js';
import { privateKey } from '../facts/fixtures.js';
import { intakeFixture, message, route, stop, value, refused, json } from './fixtures.js';

it('P4-NF-02 an attested adapter cannot claim verified, change route evidence or impersonate a principal', () => {
  const f = intakeFixture();
  for (const changes of [ { channel: 'somewhere-else' }, { sender: 'another-sender' }, { identityEpoch: 'recycled' }, { principalId: 'operator' } ]) {
    const adapter = { ...f.deps.adapter, authenticate: (...args: Parameters<typeof f.deps.adapter.authenticate>) =>
      f.f.success({ ...value(f.deps.adapter.authenticate(...args)), ...changes }) };
    refused(value(createIntakePort({ ...f.deps, adapter })).receive(message(), { ...route, eventId: JSON.stringify(changes) }), 'unresolved-sender');
  }
  const entry = f.deps.governance.register.entries.find(e => e.declaration.id === 'host')!;
  const register = f.r.build([JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8'))[0],
    f.r.declaration('host', 'parsers', { ...entry.declaration.requiredFacts, authenticationClass: [{ stimulusType: 'message', class: 'verified' }] }, { profile: f.r.profile })]);
  refused(value(createIntakePort({ ...f.deps, governance: { ...f.deps.governance, register } })).receive(message(), route), 'unresolved-sender');
});

it('P4-NF-06 undeclared adapters/schemas cannot bypass the one receive port', () => {
  const f = intakeFixture();
  refused(createIntakePort({ ...f.deps, adapter: { ...f.deps.adapter, id: 'undeclared' } }), 'missing live');
  refused(createIntakePort({ ...f.deps, context: () => ({ ...f.context, schemas: f.context.schemas.filter(s => s.kind !== 'intake-admitted') }) }), 'schema changed or missing');
  const source = readFileSync('src/intake/index.ts', 'utf8');
  expect(source).not.toMatch(/append|private|internal/);
  for (const file of readdirSync('src/intake').filter(f => f.endsWith('.ts'))) {
    const source = readFileSync(`src/intake/${file}`, 'utf8');
    expect(source).not.toMatch(/from ['"]\.\.\/(?:types|decode)\//);
    expect(source).not.toMatch(/from ['"]\.\.\/(?:facts|register|projections)\/(?!index\.js)/);
  }
});

it('P4-NF-09 local/system stimuli without verified credentials never gain ambient authority', () => {
  const f = intakeFixture();
  const adapter = { ...f.deps.adapter, authenticate: (...args: Parameters<typeof f.deps.adapter.authenticate>) =>
    f.f.success({ ...value(f.deps.adapter.authenticate(...args)), principalKind: 'system' as const }) };
  refused(value(createIntakePort({ ...f.deps, adapter })).receive(message(), route), 'unresolved-sender');
  refused(createIntakePort({ ...f.deps, author: { ...f.deps.author, principal: f.f.alice } }), 'verified system identity');
});

it('P4-NF-11 intake retains the native last-inbound id for the session owner', () => {
  const f = intakeFixture(), admitted = value(f.port().receive(message(), route));
  if (admitted.kind !== 'admitted') throw new Error('expected admission');
  expect(admitted.lastInboundId).toBe(route.eventId);
  expect((f.facts().at(-1)!.body as { eventId: string }).eventId).toBe(route.eventId);
});

it('P4-NF-12 direct fact admission refuses ownerless and incorrectly unblocked work', () => {
  const f = intakeFixture(); value(f.port().receive(message(), route));
  const admitted = f.frames.at(-1) as Record<string, unknown>;
  const body = admitted.body as Record<string, unknown>, segment = admitted.segment as { machine: string; epoch: number; position: number };
  const evidence = value(f.deps.adapter.authenticate(message(), route, f.f.now));
  const provenance = value(decode('Provenance', evidence.provenance, f.context.decode));
  const principal = value(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id: 'alice', kind: 'person' }, { ...f.context.decode, provenance }));
  const c = { ...f.context, decode: { ...f.context.decode, principals: [...f.context.decode.principals ?? [], principal] },
    ownedBodies: [value(intakeWorkRegistration({ site: 'intake.admit', preserved: 'capture:work', register: f.context.decode.register }, f.deps.author.principal.id))] };
  for (const work of [ { owner: '', blockedOn: 'run-admission', standing: 'requester' },
    { owner: 'worker', blockedOn: '', standing: 'requester' }, { owner: 'worker', blockedOn: 'run-admission', standing: 'operator' } ]) {
    const wire = signEnvelope({ ...admitted, id: `machine-a:0:${segment.position + 1}`,
      segment: { ...segment, position: segment.position + 1 }, prevInSegment: admitted.contentHash,
      predecessors: { ...(admitted.predecessors as object), inSegment: admitted.id },
      body: { ...body, work: { type: 'IntakeWork', schemaVersion: 1, ...work } } }, privateKey);
    const result = createFactStore(c, f.storage).append(wire);
    expect(refused(result).detail).toMatch(/P4-NF-12/);
  }
});

it('P4-NF-13 P4-NF-16 ordinary protected conversation remains requester work, without heuristic blocking or unnecessary approval', () => {
  const f = intakeFixture(); f.bind();
  const result = value(f.port().receive(JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'Please discuss this.', signal: 'cannot-decide' }), route));
  expect(result.kind).toBe('admitted');
  if (result.kind !== 'admitted') throw new Error('expected delivery with flags');
  expect(result.flags).toEqual(['cannot-decide']);
  expect((f.facts().at(-1)!.body as { work: { deliveryFlag: string } }).work.deliveryFlag).toBe('cannot-decide');
  expect(f.facts().some(f => /authorization|grant-request/.test(f.kind))).toBe(false);
  // Authority-needing unclassified input is a different, decided hold; it cannot ride talk.
  refused(f.port().receive(JSON.stringify({ schemaVersion: 1, kind: 'operation', action: 'grant' }), { ...route, eventId: 'authority' }), 'needs-judgment');
});

it('P4-NF-25 directives are derived from admitted facts even if the provider omits the convenience list', () => {
  const f = intakeFixture(); f.bind();
  const directive = value(decode('Directive', f.f.directiveInput(), { ...f.context.decode, grants: f.context.grants.map(g => g.grant) }));
  Object.assign(f.context, { schemas: [...f.context.schemas, { ...f.f.schema, kind: 'directive-record',
    fields: { directive: { kind: 'constitutional', type: 'Directive' } } }] });
  value(authorAndAppend({ kind: 'directive-record', schemaVersion: 1, machine: 'machine-a', principal: json(f.f.alice), provenance: json(f.f.alice.provenance),
    at: json(f.f.now), body: { directive: json(directive) }, required: [] }, f.context, createFactStore(f.context, f.storage), privateKey));
  const result = value(f.port().receive(message(), route));
  if (result.kind !== 'admitted') throw new Error('expected admission');
  expect(result.intent.under).toEqual(['d1']);
  const last = f.facts().at(-1)!;
  const body = last.body as Record<string, Json>;
  const c = { ...f.context, decode: { ...f.context.decode, principals: [...f.context.decode.principals ?? [], result.intent.principal] },
    ownedBodies: [value(intakeWorkRegistration({ site: 'intake.admit', preserved: 'capture:omitted-directive', register: f.context.decode.register }, f.deps.author.principal.id))] };
  const wire = signEnvelope({ ...last, id: `machine-a:0:${last.segment.position + 1}`, segment: { ...last.segment, position: last.segment.position + 1 },
    prevInSegment: last.contentHash, predecessors: { ...last.predecessors, inSegment: last.id }, body: { ...body, intent: { ...result.intent, under: [] } } }, privateKey);
  refused(createFactStore(c, f.storage).append(wire), 'P4-NF-25');
});

it('P4-NF-14 receiver admission refuses a requester-authored stop and a stop with widened reach', () => {
  const f = intakeFixture(); f.bind(); value(f.port().receive(stop, route));
  const last = f.facts().at(-1)!;
  const b = { site: 'intake.admit', preserved: 'capture:forged-stop', register: f.context.decode.register };
  const c = { ...f.context, ownedBodies: [value(intakeStopRegistration(b, f.deps.author.principal.id))] };
  const next = { ...last, id: `machine-a:0:${last.segment.position + 1}`, segment: { ...last.segment, position: last.segment.position + 1 },
    prevInSegment: last.contentHash, predecessors: { ...last.predecessors, inSegment: last.id } };
  refused(createFactStore(c, f.storage).append(signEnvelope({ ...next, principal: f.f.alice, provenance: f.f.alice.provenance }, privateKey)), 'configured verified intake observer');
  refused(createFactStore(c, f.storage).append(signEnvelope({ ...next, body: { ...(last.body as object), scope: f.f.org } }, privateKey)), 'stop changed binding scope');
});

it('P4-NF-14 identity churn cannot select the old brake; verified prior holder keeps it through supersession', () => {
  const f = intakeFixture(); const prior = f.bind();
  expect(value(f.port().receive(stop, { ...route, identityEpoch: 'recycled' })).kind).toBe('stop-signal');
  f.bind({ supersedes: prior.id, identityEpoch: 'account-2' });
  const result = value(f.port().receive(stop, route)); expect(result.kind).toBe('stopped');
});

describe('explicitly unbuilt parts of the approved design', () => {
  it.skip('P4-NF-07 out of slice scope: secret-store custody and redaction adapter; designed, not yet built', () => {});
  it.skip('P4-NF-11 out of slice scope: actual-start grounding and post-compaction reply belong to part five', () => {});
  it.skip('P4-NF-14 out of slice scope: verified operator-surface stop without a binding and native discovery UI belong to part eleven', () => {});
  it.skip('P4-NF-17 P4-NF-18 P4-NF-19 P4-NF-20 out of slice scope: authorization routing/rendering/rate limits, effect revalidation and awaiting type', () => {});
  it.skip('P4-NF-21 P4-NF-22 out of slice scope: candidate standing grants and recurrence; designed, not yet built', () => {});
  it.skip('P4-NF-23 out of slice scope: peer delivery and silence concurrence; designed, not yet built', () => {});
  it.skip('P4-NF-27 out of slice scope: full registered authority-command surface, language normalization and precedence; designed, not yet built', () => {});
  it.skip('P4-NF-28 out of slice scope: acknowledgment delivery surfaces; designed, not yet built', () => {});
  it.skip('P4-NF-29 out of slice scope: live transport probe cadence; designed, not yet built', () => {});
});

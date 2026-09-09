import { expect, it } from 'vitest';
import type { ProvenanceInput, Result } from '../../src/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import type { IntakeDisposition } from '../../src/intake/index.js';
import { refused, value } from './fixtures.js';
import { scheduledAdapterId, scheduledFixture } from './scheduled-fixtures.js';

it('P4-ST-01 admits only canonical scheduled ticks under the current package-system grant', () => {
  const f = scheduledFixture(), grant = f.grant(), tick = f.tick(), discovery = f.discovery(tick.eventId);
  const result = value(f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: {
    owner: 'part-two', name: 'FactEnvelope', id: discovery.fact.id,
  } }));
  expect(result).toMatchObject({ kind: 'scheduled-admitted', owner: 'run-admission:owner', blockedOn: 'run-admission',
    scheduledIdentity: { jobInstance: tick.body.jobInstance, scheduledInstant: tick.body.scheduledInstant },
    principal: { type: 'VerifiedPrincipal', id: f.principal.id, field: 'intent.principal' },
    standing: { type: 'StandingGrant', id: grant.grant.id, fact: { id: grant.fact.id }, field: 'grant' },
  });
  expect(f.facts().filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
  const admission = f.facts().at(-1)!;
  expect(admission.body).toMatchObject({ work: { owner: 'run-admission:owner', blockedOn: 'run-admission', standing: 'requester' } });
  expect(admission.predecessors.required).toEqual(expect.arrayContaining([discovery.fact.id, grant.fact.id]));
});

it('P4-ST-02 two machine identities retain separate discovery Evidence and return one scheduled admission', () => {
  const f = scheduledFixture(); f.grant(); const tick = f.tick();
  const firstEvidence = f.discovery(tick.eventId, 'machine-a', 91);
  const first = value(f.portForMachine('machine-a').receiveScheduledTick({ raw: tick.raw, route: tick.route,
    discovery: { owner: 'part-two', name: 'FactEnvelope', id: firstEvidence.fact.id } }));
  const secondEvidence = f.discovery(tick.eventId, 'machine-b', 92);
  const second = value(f.portForMachine('machine-b').receiveScheduledTick({ raw: tick.raw, route: tick.route,
    discovery: { owner: 'part-two', name: 'FactEnvelope', id: secondEvidence.fact.id } }));
  expect(first.kind).toBe('scheduled-admitted');
  expect(second).toMatchObject({ kind: 'duplicate', original: { id: first.kind === 'scheduled-admitted' ? first.fact.id : '' } });
  expect(f.facts().filter(row => row.kind === 'scheduled-discovery-evidence').map(row => row.machine).sort()).toEqual(['machine-a', 'machine-b']);
  expect(f.facts().filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
  expect(tick.raw).not.toContain('machine-a'); expect(tick.raw).not.toContain('machine-b');
  const body = JSON.parse(tick.raw) as Record<string, unknown>;
  expect(body).not.toHaveProperty('discovery'); expect(body).not.toHaveProperty('sourceMachine');
  expect(body.scheduledInstant).not.toBe(91); expect(body.scheduledInstant).not.toBe(92);
});

it('P4-ST-03 same scheduled event with changed package or calendar bytes records the existing mismatch', () => {
  const f = scheduledFixture(); f.grant(); const tick = f.tick(), discovery = f.discovery(tick.eventId);
  const input = { route: tick.route, discovery: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: discovery.fact.id } };
  expect(value(f.port().receiveScheduledTick({ ...input, raw: tick.raw })).kind).toBe('scheduled-admitted');
  // Preserve the original event id while changing authenticated package/calendar bytes.
  const changed = f.tick({ packageDigest: f.f.nextArtifact, calendarPolicyVersion: 'cron-v2' });
  refused(f.port().receiveScheduledTick({ ...input, raw: changed.raw }), 'different arrival bytes');
  expect(f.facts().filter(row => row.kind === 'intake-mismatch')).toHaveLength(1);
  expect(changed.eventId).toBe(tick.eventId);
});

it('P4-ST-04 malformed, missing-evidence, person, unverified and unregistered scheduled input stops after its receipt', () => {
  const cases: Array<(f: ReturnType<typeof scheduledFixture>) => Result<IntakeDisposition>> = [
    f => { const tick = f.tick(), discovery = f.discovery(tick.eventId); return f.port().receiveScheduledTick({ raw: '{"bad":true}', route: tick.route,
      discovery: { owner: 'part-two', name: 'FactEnvelope', id: discovery.fact.id } }); },
    f => { const tick = f.tick(); return f.port().receiveScheduledTick({ raw: tick.raw, route: tick.route,
      discovery: { owner: 'part-two', name: 'FactEnvelope', id: 'missing:evidence' } }); },
    f => { const tick = f.tick(), discovery = f.discovery(tick.eventId), proof = f.f.proof({ id: 'alice', kind: 'person' },
      { id: 'alice', kind: 'person' }, 'package-system-principal'); f.syncCaptures();
      const provenance = { ...proof.input, adapter: scheduledAdapterId } as ProvenanceInput;
      const port = value(createIntakePort({ ...f.deps, adapter: { ...f.deps.adapter, authenticate: (_raw, route) => f.f.success({
        provenance, principalId: 'alice', principalKind: 'person', channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch }) } }));
      return port.receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: { owner: 'part-two', name: 'FactEnvelope', id: discovery.fact.id } }); },
    f => { const tick = f.tick(), discovery = f.discovery(tick.eventId), attested = f.f.proof({ id: f.principal.id, kind: 'system' },
      { id: f.principal.id, kind: 'system' }, 'package-system-principal', true); f.syncCaptures();
      const provenance = { ...attested.input, adapter: scheduledAdapterId } as ProvenanceInput;
      const port = value(createIntakePort({ ...f.deps, adapter: { ...f.deps.adapter, authenticate: (_raw, route) => f.f.success({
        provenance, principalId: f.principal.id, principalKind: 'system', channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch }) } }));
      return port.receiveScheduledTick({ raw: tick.raw, route: tick.route, discovery: { owner: 'part-two', name: 'FactEnvelope', id: discovery.fact.id } }); },
    f => { const tick = f.tick(), discovery = f.discovery(tick.eventId); return f.port().receiveScheduledTick({ raw: tick.raw,
      route: { ...tick.route, adapter: 'not-registered' }, discovery: { owner: 'part-two', name: 'FactEnvelope', id: discovery.fact.id } }); },
  ];
  for (const run of cases) {
    const f = scheduledFixture(); f.grant(); const receipts = f.facts().filter(row => row.kind === 'intake-receipt').length;
    refused(run(f));
    const facts = f.facts(); let receipt = -1;
    facts.forEach((row, index) => { if (row.kind === 'intake-receipt') receipt = index; });
    expect(facts.filter(row => row.kind === 'intake-receipt')).toHaveLength(receipts + 1);
    expect(facts.slice(receipt).map(row => row.kind)).toEqual(['intake-receipt']);
  }
});

it('P4-ST-05 pending scheduled admissions is a bounded, frontier-pinned, read-only owner cursor', () => {
  const f = scheduledFixture(); f.grant(); const port = f.port();
  for (const jobInstance of ['job:one', 'job:two']) {
    const tick = f.tick({ jobInstance }), discovery = f.discovery(tick.eventId);
    expect(value(port.receiveScheduledTick({ raw: tick.raw, route: tick.route,
      discovery: { owner: 'part-two', name: 'FactEnvelope', id: discovery.fact.id } })).kind).toBe('scheduled-admitted');
  }
  const before = f.facts().length, frontier = f.frontier();
  const first = value(port.pendingScheduledAdmissions({ owner: 'run-admission:owner', frontier, limit: 1, after: null }));
  expect(first.admissions).toHaveLength(1); expect(first.next).toEqual(first.admissions[0]);
  const second = value(port.pendingScheduledAdmissions({ owner: 'run-admission:owner', frontier, limit: 1, after: first.next }));
  expect(second.admissions).toHaveLength(1); expect(second.next).toBeNull();
  expect(value(port.pendingScheduledAdmissions({ owner: 'another-owner', frontier, limit: 10, after: null })).admissions).toEqual([]);
  refused(port.pendingScheduledAdmissions({ owner: 'run-admission:owner', frontier, limit: 0, after: null }), 'page limit');
  refused(port.pendingScheduledAdmissions({ owner: 'run-admission:owner', frontier: { 'machine-a': { epoch: 99, position: 99 } }, limit: 1, after: null }), 'unavailable history');
  expect(f.facts()).toHaveLength(before);
});

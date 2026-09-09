import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import type { ScheduledIntakeDisposition } from '../../src/intake/index.js';
import { json, value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { recoverScheduledDisposition, scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';

function durableFixture<T>(run: (directory: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), 'instar-p4-scheduled-'));
  try { return run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

it('P4-ST-07 restart after scheduled admission enumerates the durable pending item and opens one P5 Run', () => durableFixture(directory => {
  const before = scheduledFixture({ directory }); before.grant(); const tick = before.tick();
  const evidence = before.discovery(tick.eventId);
  const accepted = value(before.port().receiveScheduledTick({ raw: tick.raw, route: tick.route,
    discovery: { owner: 'part-two', name: 'FactEnvelope', id: evidence.fact.id } })) as ScheduledIntakeDisposition;

  const restarted = scheduledFixture({ directory }); restarted.installSchemas();
  const pending = value(restarted.port().pendingScheduledAdmissions({ owner: accepted.owner,
    frontier: restarted.frontier(), limit: 10, after: null }));
  expect(pending.admissions).toEqual([accepted.fact]);
  const recovered = recoverScheduledDisposition(restarted, pending.admissions[0]!.id);
  const h = scheduledRunHarness(restarted, recovered), opened = value(h.graph.open(h.run));
  expect(opened.run.opening).toEqual(accepted.fact); expect(h.createCalls()).toBe(1);
  expect(restarted.facts().filter(row => row.kind === 'run-opening')).toHaveLength(1);
}));

it('P4-ST-24 V51 durable restart resolves a signed directive without copying its live issuer or value', () => durableFixture(directory => {
  const before = scheduledFixture({ directory }); before.grant(); const tick = before.tick();
  const discovery = before.discovery(tick.eventId); before.bind();
  const directive = value(decode('Directive', before.f.directiveInput(), {
    ...before.context.decode, grants: before.context.grants.map(grant => grant.grant),
  }));
  Object.assign(before.context, { schemas: [...before.context.schemas, { ...before.f.schema, kind: 'directive-record',
    fields: { directive: { kind: 'constitutional' as const, type: 'Directive' as const } } }] });
  const directiveFact = value(authorAndAppend({ kind: 'directive-record', schemaVersion: 1, machine: 'machine-a',
    principal: json(before.f.alice), provenance: json(before.f.alice.provenance), at: json(before.f.now),
    body: { directive: json(directive) }, required: [] }, before.context,
  createFactStore(before.context, before.storage), before.deps.author.privateKey)).fact;
  const accepted = value(before.port().receiveScheduledTick({ raw: tick.raw, route: tick.route,
    discovery: { owner: 'part-two', name: 'FactEnvelope', id: discovery.fact.id } }));
  expect(accepted.kind).toBe('scheduled-admitted');

  const restarted = scheduledFixture({ directory }); restarted.installSchemas(); restarted.setTime(101);
  Object.assign(restarted.context, { schemas: structuredClone(before.context.schemas) });
  const pending = value(restarted.port().pendingScheduledAdmissions({ owner: restarted.deps.workOwner,
    frontier: restarted.frontier(), limit: 10, after: null }));
  expect(pending.admissions).toEqual(accepted.kind === 'scheduled-admitted' ? [accepted.fact] : []);
  expect(value(restarted.port().receiveScheduledTick({ raw: tick.raw, route: tick.route,
    discovery: { owner: 'part-two', name: 'FactEnvelope', id: discovery.fact.id } })))
    .toMatchObject({ kind: 'duplicate', original: accepted.kind === 'scheduled-admitted' ? accepted.fact : undefined });
  expect(restarted.facts().some(fact => fact.id === directiveFact.id)).toBe(true);
}));

it.each(['grant', 'discovery'])
('P4-ST-25 V54 an admitted fact becomes honestly partial when %s capture disappears and recovers from exact bytes', kind => {
  const f = scheduledFixture(); const grant = f.grant(), tick = f.tick(), discovery = f.discovery(tick.eventId);
  const input = { raw: tick.raw, route: tick.route,
    discovery: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: discovery.fact.id } };
  const admitted = value(f.port().receiveScheduledTick(input));
  expect(admitted.kind).toBe('scheduled-admitted');
  const reference = kind === 'grant' ? grant.grant.source.record.reference : discovery.evidence.capture.reference;
  const bytes = f.f.captures[reference]!; f.dropCapture(reference);
  expect(value(f.port().pendingScheduledAdmissions({ owner: f.deps.workOwner,
    frontier: f.frontier(), limit: 10, after: null })).admissions).toEqual([]);
  f.f.captures[reference] = bytes; f.syncCaptures();
  expect(value(f.port().pendingScheduledAdmissions({ owner: f.deps.workOwner,
    frontier: f.frontier(), limit: 10, after: null })).admissions)
    .toEqual(admitted.kind === 'scheduled-admitted' ? [admitted.fact] : []);
});

it('P4-ST-08 restart after the P5 Run append returns that Run without a second conditional admission', () => durableFixture(directory => {
  const before = scheduledFixture({ directory }); before.grant(); const tick = before.tick();
  const evidence = before.discovery(tick.eventId);
  const accepted = value(before.port().receiveScheduledTick({ raw: tick.raw, route: tick.route,
    discovery: { owner: 'part-two', name: 'FactEnvelope', id: evidence.fact.id } })) as ScheduledIntakeDisposition;
  const initial = scheduledRunHarness(before, accepted), opened = value(initial.graph.open(initial.run));
  expect(initial.createCalls()).toBe(1);

  const restarted = scheduledFixture({ directory });
  const recovered = recoverScheduledDisposition(restarted, accepted.fact.id);
  const h = scheduledRunHarness(restarted, recovered);
  const pending = value(restarted.port().pendingScheduledAdmissions({ owner: recovered.owner,
    frontier: restarted.frontier(), limit: 10, after: null }));
  expect(pending.admissions).toEqual([]);
  const replayed = value(h.graph.open(h.run));
  expect(replayed.head).toBe(opened.head); expect(h.createCalls()).toBe(0);
  expect(restarted.facts().filter(row => row.kind === 'run-opening')).toHaveLength(1);
}));

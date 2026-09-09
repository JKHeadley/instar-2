import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { ScheduledIntakeDisposition } from '../../src/intake/index.js';
import { value } from '../intake/fixtures.js';
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

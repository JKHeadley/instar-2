import { expect, it } from 'vitest';
import type { ScheduledIntakeDisposition } from '../../src/intake/index.js';
import { value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';

it('P4-ST-06 real P2 facts from two machines converge on one P4 admission and one conditional P5 Run', () => {
  const f = scheduledFixture(); f.grant(); const tick = f.tick();
  const evidenceA = f.discovery(tick.eventId, 'machine-a', 91);
  const first = value(f.portForMachine('machine-a').receiveScheduledTick({ raw: tick.raw, route: tick.route,
    discovery: { owner: 'part-two', name: 'FactEnvelope', id: evidenceA.fact.id } }));
  expect(first.kind).toBe('scheduled-admitted');
  const evidenceB = f.discovery(tick.eventId, 'machine-b', 92);
  const second = value(f.portForMachine('machine-b').receiveScheduledTick({ raw: tick.raw, route: tick.route,
    discovery: { owner: 'part-two', name: 'FactEnvelope', id: evidenceB.fact.id } }));
  expect(second).toMatchObject({ kind: 'duplicate', original: first.kind === 'scheduled-admitted' ? first.fact : undefined });
  const admitted = first as ScheduledIntakeDisposition;
  const h = scheduledRunHarness(f, admitted);
  const opened = value(h.graph.open(h.run)), replayed = value(h.graph.open(h.run));
  expect(opened.run.id).toBe(h.runId); expect(replayed.head).toBe(opened.head);
  expect(opened.run.opening).toEqual(admitted.fact); expect(opened.run.owner.id).toBe('bob');
  expect(f.facts().filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
  expect(f.facts().filter(row => row.kind === 'run-opening')).toHaveLength(1);
  expect(h.createCalls()).toBe(1);
  expect(f.facts().filter(row => row.kind === 'scheduled-discovery-evidence').map(row => row.machine).sort())
    .toEqual(['machine-a', 'machine-b']);
});

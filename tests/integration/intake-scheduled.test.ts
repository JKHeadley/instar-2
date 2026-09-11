import { expect, it } from 'vitest';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import type { ScheduledIntakeDisposition } from '../../src/intake/scheduled-a/index.js';
import { json, refused, value } from '../intake/fixtures.js';
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

it.each(['grant', 'discovery'])
('P4-ST-25 V53 re-resolves a %s witness introduced at the resolution/admission boundary', kind => {
  const f = scheduledFixture(); const grant = f.grant(), tick = f.tick(), discovery = f.discovery(tick.eventId);
  const original = f.storage.append.bind(f.storage); let injected = false;
  const storage = { ...f.storage, append(bytes: string, expected: string | null) {
    const result = original(bytes, expected);
    if (JSON.parse(bytes).kind === 'intake-resolved' && !injected) {
      injected = true;
      const isGrant = kind === 'grant', provenance = isGrant ? grant.grant.source : f.provenance;
      const context = { ...f.context, decode: { ...f.context.decode, provenance } };
      const appended = value(authorAndAppend({ kind: isGrant ? 'scheduled-system-grant' : 'scheduled-discovery-evidence',
        schemaVersion: 1, machine: 'machine-a', principal: json(isGrant ? f.f.alice : f.principal),
        provenance: json(provenance), at: json(f.f.now),
        body: json(isGrant ? { grant: grant.grant } : { evidence: discovery.evidence }), required: [] },
      context, createFactStore(context, f.storage), f.deps.author.privateKey));
      expect(appended.taint).toEqual([]);
    }
    return result;
  } };
  const result=value(createIntakePort({ ...f.deps, storage })).receiveScheduledTick({
    raw: tick.raw, route: tick.route, discovery: { owner: 'part-two', name: 'FactEnvelope', id: discovery.fact.id },
  });
  expect(injected).toBe(true);
  refused(result,'unsupported-in-slice-a');
  expect(f.facts().filter(fact => fact.kind === 'intake-admitted')).toHaveLength(0);
});

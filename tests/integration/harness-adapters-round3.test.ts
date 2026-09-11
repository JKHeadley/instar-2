import { expect, it } from 'vitest';
import { createHarnessEvidenceHolder, createMemoryHarnessAdapterStateStore } from '../../src/harness-adapters/index.js';
import { redactCapture } from '../../src/facts/index.js';
import type { FactContext } from '../../src/facts/index.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { factsFixture, point, refused, value } from '../facts/fixtures.js';
import { setup as runGraphFixture } from '../rungraph/fixtures.js';
import { decodedEvent, evidenceOwners } from '../harness-adapters/fixture.js';

it('R3-F1 P13-NF-31 real Part Five work state is required for each progress transition', () => {
  const run = runGraphFixture();
  const ready = value(run.graph.open(run.run));
  const grounding = value(run.graph.ground(run.id, 'w', 'h', 'start', run.lease));
  const running = value(run.graph.transition(run.start(ready, grounding)));
  const assembly = assemblyRuntimeFixture();
  const work = { read: (id: string) => id === 'run:1' ? run.graph.read(run.id) : run.graph.read(id) };
  const evidence = createHarnessEvidenceHolder({ adapter: 'adapter:claude-code', machine: 'machine-a', maxEvents: 8,
    maxCaptureBytes: 32, context: assembly.c, state: createMemoryHarnessAdapterStateStore('round3-real-work'),
    owners: evidenceOwners(assembly, work) });
  const transition = decodedEvent(assembly, 'work-transition', { predecessor: running.pending[0]!.expected,
    workSubject: running.pending[0]!.id, workPhase: running.state, operation: running.pending[0]!.operation.key });
  expect(evidence.admit(transition)).toMatchObject({ disposition: 'recorded', progress: true });
  expect(evidence.admit(decodedEvent(assembly, 'work-transition', { id: 'work:invented-phase',
    predecessor: running.pending[0]!.expected, workSubject: running.pending[0]!.id,
    workPhase: 'invented', operation: running.pending[0]!.operation.key })))
    .toMatchObject({ disposition: 'refused', progress: false });
});

it('R3-F8 P13-NF-34 real Part Two captures survive age; only an admitted tombstone may remove unpinned bytes', () => {
  const f = factsFixture(), root = f.fact();
  const schema = { ...f.schema, standing: 'operator' as const, causallyBound: true,
    requiredReferences: [root.id], authority: 'conferring' as const };
  const redactionSchema = { ...schema, kind: 'redaction' };
  const base: FactContext = { ...f.ctx, schemas: [schema, redactionSchema], facts: [root],
    grants: [{ factId: root.id, grant: f.g }], folded: { 'machine-a': point(root) }, captures: {
      pinned: { hash: f.capture('pinned bytes'), bytes: 'pinned bytes', status: 'available', byteLength: 12 },
      unpinned: { hash: f.capture('unpinned bytes'), bytes: 'unpinned bytes', status: 'available', byteLength: 14 },
    } };
  expect(base.captures.pinned?.status).toBe('available');
  expect(base.captures.unpinned?.status).toBe('available');
  const predecessors = { inSegment: root.id, frontier: { 'machine-a': point(root) }, required: [root.id] };
  const tombstone = f.next(root, { kind: 'redaction', predecessors,
    body: { reference: 'unpinned', reason: 'erasure-obligation' } }, base);
  const context = { ...base, facts: [root, tombstone] };
  expect(value(redactCapture(tombstone, context, f.clock(1000), 10, []))).toMatchObject({ status: 'tombstoned', bytes: null });
  const pinnedTombstone = f.next(root, { kind: 'redaction', predecessors,
    body: { reference: 'pinned', reason: 'erasure-obligation' } }, base);
  refused(redactCapture(pinnedTombstone, { ...base, facts: [root, pinnedTombstone] }, f.clock(1000), 10,
    [{ reference: 'pinned', factId: root.id, kind: 'unresolved-judgment' }]), 'protected');
});

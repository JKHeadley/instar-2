import { describe, expect, it } from 'vitest';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import {
  compareHarnessAdapterRecords,
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  decodeHarnessAdapterStateSnapshot,
  decodeHarnessRuntimeEvent,
  preventiveCompactionDisposition,
  correlatedRecoveryProgress,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/index.js';
import { inspectPendingInputCustody } from '../../src/intake/pending-custody.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { refused, value } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { adapterFixture, decodedEvent, decodedHandle, digest, eventInput, evidenceOwners, handleInput } from './fixture.js';

function holder(f: ReturnType<typeof assemblyRuntimeFixture>, state = createMemoryHarnessAdapterStateStore('round3')) {
  return createHarnessEvidenceHolder({ adapter: 'adapter:claude-code', machine: 'machine-a', maxEvents: 20,
    maxCaptureBytes: 100, context: f.c, state, owners: evidenceOwners(f) });
}

function invalidate(f: ReturnType<typeof assemblyRuntimeFixture>, reference: string) {
  const row = value(f.c.history!.lookup(reference))!;
  const record = row.record!;
  const conflict = value(decodeAssemblyRecord(record.type, { ...record, detail: `${'detail' in record ? record.detail : ''}:immutable-disagreement` },
    { ...f.c, validateReferences: false }));
  value(f.spine.append(conflict));
  expect(value(f.c.history!.resolve(record)).admitted).toBe(false);
}

describe('round-3 independent conformance regressions', () => {
  it('R3-F1 unrelated owner records, invented phases, and unresolved captures cannot become process or progress evidence', () => {
    const f = assemblyRuntimeFixture(), evidence = holder(f), handle = decodedHandle(f);
    const growth = value(f.runtime.inspect()).find(row => row.record.type === 'GrowthPolicy')!.record.id;
    for (const kind of ['heartbeat', 'work-transition', 'turn-closed', 'diagnostic'] as const) {
      const event = value(decodeHarnessRuntimeEvent(eventInput(kind, { id: `unrelated:${kind}`, sourceEvidence: [growth],
        ...(kind === 'diagnostic' ? { diagnosticCode: 'transcript-resume-compatible' } : {}) }), f.c));
      expect(evidence.admit(event)).toMatchObject({ disposition: 'refused', progress: false });
    }
    expect(evidence.liveness(handle, 100).state).toBe('unknown');
    expect(evidence.completion(handle, 100).state).toBe('unknown');
    expect(evidence.resume(handle, 100).state).toBe('unknown');

    expect(evidence.admit(decodedEvent(f, 'work-transition', { workPhase: 'invented-local-phase' })))
      .toMatchObject({ disposition: 'refused', progress: false });
    const missing = decodedEvent(f, 'output-chunk', { id: 'unresolved:captured-bytes', output: {
      ...eventInput('output-chunk').output as object, captureReference: 'capture:missing',
    } });
    delete (evidenceOwners(f).captures as Record<string, unknown>)['capture:missing'];
    expect(evidence.admit(missing)).toMatchObject({ disposition: 'refused', progress: false });

    const six = transportFixture(), fence = value(six.api.acquire('acquire', '', 500));
    const local = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine, maxHandles: 1,
      maxAttempts: 2, context: f.c, state: createMemoryHarnessAdapterStateStore('round3-handles') });
    local.put(decodedHandle(f, { incarnation: fence.incarnation }));
    expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine, incarnation: fence.incarnation,
      fence, now: 100, evidence, authority: six.api }, local).disposition).toBe('refused');
  });

  it('R3-F2 retained events are re-resolved after owner conflict, including reconstructed journals', () => {
    const f = assemblyRuntimeFixture(), state = createMemoryHarnessAdapterStateStore('round3-current');
    const evidence = holder(f, state), handle = decodedHandle(f);
    const heartbeat = decodedEvent(f, 'heartbeat');
    const closure = decodedEvent(f, 'turn-closed', { id: 'current:closure' });
    const resume = decodedEvent(f, 'diagnostic', { id: 'current:resume', diagnosticCode: 'transcript-resume-compatible' });
    for (const event of [heartbeat, closure, resume]) expect(evidence.admit(event).disposition).toBe('recorded');
    expect(evidence.liveness(handle, 20).state).toBe('live');
    expect(evidence.completion(handle, 20).state).toBe('complete');
    expect(evidence.resume(handle, 20).state).toBe('eligible');
    for (const event of [heartbeat, closure, resume]) invalidate(f, event.sourceEvidence[0]!);
    for (const current of [evidence, holder(f, state)]) {
      expect(current.events(handle.launch)).toHaveLength(3);
      expect(current.liveness(handle, 20).state).toBe('unknown');
      expect(current.completion(handle, 20).state).toBe('unknown');
      expect(current.resume(handle, 20).state).toBe('unknown');
    }
  });

  it('R3-F4 future closure and newer pending children cannot report complete', () => {
    const f = assemblyRuntimeFixture(), evidence = holder(f), handle = decodedHandle(f);
    expect(evidence.admit(decodedEvent(f, 'turn-closed', { id: 'future:closure', sourceClock: 1_000_000_000,
      observedAt: 1_000_000_000 })).disposition).toBe('recorded');
    expect(evidence.completion(handle, 100).state).toBe('unknown');

    const other = holder(f, createMemoryHarnessAdapterStateStore('round3-pending-child'));
    other.admit(decodedEvent(f, 'turn-closed', { id: 'closed:10', sourceClock: 10, observedAt: 10 }));
    other.admit(decodedEvent(f, 'turn-closed', { id: 'pending:20', sourceClock: 20, observedAt: 20,
      childrenState: 'pending' }));
    expect(other.completion(handle, 100).state).toBe('pending');
  });

  it('R3-F5 launch and observation requests bind all landed operation and delivery identities before invocation', () => {
    const h = adapterFixture();
    refused(h.package.adapter.launch(h.spec, 'operation:FOREIGN', 'claim:launch'), 'owner-resolved process operation');
    expect(h.calls.launch).toBe(0);
    value(h.package.adapter.launch(h.spec, h.spec.processOperation, 'claim:launch'));
    const delivery = value(h.f.runtime.record('HarnessObservation', {
      ...assemblyInput('HarnessObservation'), id: 'delivery:round3', launch: h.spec.id, run: h.spec.run,
      step: h.spec.step, input: h.spec.input, incarnation: h.spec.incarnation, phase: 'input-accepted', observedAt: 20,
    }));
    refused(h.package.adapter.observe({ launch: h.spec.id, delivery: '', operation: 'observe:1' }), 'exact operation and delivery');
    refused(h.package.adapter.observe({ launch: h.spec.id, delivery: 'delivery:foreign', operation: 'observe:2' }), 'absent from Ten');
    refused(h.package.adapter.observe({ launch: h.spec.id, delivery: delivery.id, operation: '' }), 'exact operation and delivery');
    expect(h.calls.observe).toBe(0);
  });

  it('R3-F6 journal restoration rejects reversed attempt clocks and incompatible duplicate event identities', () => {
    const f = assemblyRuntimeFixture();
    const base = { type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'state:round3',
      adapter: 'adapter:claude-code', machine: 'machine-a', revision: 1, maxHandles: 2, maxAttempts: 2,
      maxEvents: 2, maxCaptureBytes: 10, handles: [], attempts: [], events: [] };
    refused(decodeHarnessAdapterStateSnapshot({ ...base, attempts: [{ kind: 'launch', operation: 'operation:1',
      launch: 'launch:1', incarnation: 'incarnation:1', subjectDigest: digest('a'), state: 'observed', evidence: 'process:1',
      attemptedAt: 10, observedAt: 1 }] }, f.c), 'cannot predate');
    refused(decodeHarnessAdapterStateSnapshot({ ...base, events: [
      eventInput('heartbeat', { id: 'event:same' }), eventInput('process-exited', { id: 'event:same' }),
    ] }, f.c), 'duplicate immutable event identity');
  });

  it('R3-F7 canonical tuple encoding keeps distinct colon-bearing handles out of immutable conflict', () => {
    const f = assemblyRuntimeFixture();
    const left = handleInput({ id: 'handle:left', launch: 'launch:a:b', machine: 'machine:c' });
    const right = handleInput({ id: 'handle:right', launch: 'launch:a', machine: 'b:machine:c' });
    const result = value(compareHarnessAdapterRecords('HarnessRuntimeHandle', left, right, f.c));
    expect(result).toEqual({ equal: false });
  });

  it('R3-F8 P13-NF-24 P13-NF-46 makes EACCES/EIO custody unknown and correlates recovery growth to worker A', () => {
    for (const code of ['EACCES', 'EIO']) {
      const view = inspectPendingInputCustody({ owner: 'part-four', enumerate: () => { throw new Error(code); } }, ['input:pending']);
      expect(view).toMatchObject({ state: 'unknown', pending: ['input:pending'], permitsNextAction: false });
    }
    expect(inspectPendingInputCustody({ owner: 'part-four', enumerate: () => ['input:pending'] }, []))
      .toMatchObject({ state: 'readable', pending: ['input:pending'], permitsNextAction: false });
    expect(correlatedRecoveryProgress('worker:A', [{ worker: 'worker:B', before: 100, after: 200 }]).state).toBe('pending');
    expect(correlatedRecoveryProgress('worker:A', [{ worker: 'worker:A', before: 100, after: 101 }]).state).toBe('progressed');
  });

  it('R3-F8 P13-NF-46 P13-NF-52 every preventive-compaction signal tuple remains explicitly unsupported', () => {
    for (const work of ['idle', 'working', 'indeterminate', 'unreadable'] as const)
      for (const dryRun of [false, true])
        expect(preventiveCompactionDisposition({ panePercentage: 99, work, elapsed: 999_999, spaced: true, dryRun }))
          .toEqual({ capability: 'unsupported', action: 'none', reason: expect.any(String) });
    expect(preventiveCompactionDisposition({ panePercentage: null, work: 'idle', elapsed: 0, spaced: false, dryRun: false }).action).toBe('none');
  });
});

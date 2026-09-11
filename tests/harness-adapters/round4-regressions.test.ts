import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import {
  correlatedRecoveryProgress,
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  decodeHarnessRuntimeEvent,
} from '../../src/harness-adapters/index.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { setup as runGraphFixture } from '../rungraph/fixtures.js';
import { value } from '../facts/fixtures.js';
import {
  decodedEvent,
  decodedHandle,
  digest,
  eventInput,
  evidenceOwners,
  removeCapture,
} from './fixture.js';

function holder(f: ReturnType<typeof assemblyRuntimeFixture>, id: string, work?: Parameters<typeof evidenceOwners>[1]) {
  return createHarnessEvidenceHolder({ adapter: 'adapter:claude-code', artifact: digest('4'), platform: 'claude-code',
    machine: 'machine-a', maxEvents: 24,
    maxCaptureBytes: 256, context: f.c, state: createMemoryHarnessAdapterStateStore(id), owners: evidenceOwners(f, work) });
}

function invalidate(f: ReturnType<typeof assemblyRuntimeFixture>, reference: string): void {
  const row = value(f.c.history!.lookup(reference))!;
  const record = row.record!;
  const disagreement = value(decodeAssemblyRecord(record.type, { ...record, detail: `${'detail' in record ? record.detail : ''}:round4-conflict` },
    { ...f.c, validateReferences: false }));
  value(f.spine.append(disagreement));
}

describe('round-4 independent data-validation regressions', () => {
  it('R4-F1 P13-NF-25 P13-NF-29 binds both event clocks and uses the signed source lifetime', () => {
    const f = assemblyRuntimeFixture(), handle = decodedHandle(f), evidence = holder(f, 'r4-f1');
    const heartbeat = decodedEvent(f, 'heartbeat');
    expect(evidence.admit(heartbeat).disposition).toBe('recorded');
    expect(evidence.liveness(handle, 20).state).toBe('live');
    expect(evidence.liveness(handle, 1_001).state).toBe('unknown');

    const replay = value(decodeHarnessRuntimeEvent({ ...heartbeat, observedAt: 1_000, freshFor: 5_000 }, f.c));
    const alternate = holder(f, 'r4-f1-replay');
    expect(alternate.admit(replay)).toMatchObject({ disposition: 'refused', progress: false });
    expect(alternate.liveness(handle, 1_001).state).toBe('unknown');

    const resume = decodedEvent(f, 'diagnostic', { diagnosticCode: 'transcript-resume-compatible' });
    evidence.admit(resume);
    expect(evidence.resume(handle, 20).state).toBe('eligible');
    expect(evidence.resume(handle, 1_000_000).state).toBe('unknown');
  });

  it('R4-F2 P13-NF-32 P13-NF-34 retains pending when later closure or captured output becomes unavailable', () => {
    const f = assemblyRuntimeFixture(), handle = decodedHandle(f), evidence = holder(f, 'r4-f2');
    evidence.admit(decodedEvent(f, 'turn-closed', { id: 'closure:older' }));
    const later = decodedEvent(f, 'turn-closed', { id: 'closure:later-pending', sourceClock: 20, observedAt: 20,
      freshFor: 100, childrenState: 'pending' });
    evidence.admit(later);
    expect(evidence.completion(handle, 25).state).toBe('pending');
    invalidate(f, later.sourceEvidence[0]!);
    expect(evidence.completion(handle, 25)).toMatchObject({ state: 'pending', event: later.id });

    const outputFixture = assemblyRuntimeFixture(), outputHandle = decodedHandle(outputFixture), outputEvidence = holder(outputFixture, 'r4-f2-output');
    const chunk = decodedEvent(outputFixture, 'output-chunk', { freshFor: 100 });
    outputEvidence.admit(chunk);
    outputEvidence.admit(decodedEvent(outputFixture, 'turn-closed', { id: 'closure:after-output', sourceClock: 20,
      observedAt: 20, freshFor: 100 }));
    expect(outputEvidence.completion(outputHandle, 25).state).toBe('complete');
    removeCapture(outputFixture, chunk.output!.captureReference);
    expect(outputEvidence.completion(outputHandle, 25)).toMatchObject({ state: 'pending', event: chunk.id });
  });

  it('R4-F3 P13-NF-15 P13-NF-25 P13-NF-29 refuses absent and mismatched signed launch subjects', () => {
    const absent = assemblyRuntimeFixture();
    const raw = value(decodeHarnessRuntimeEvent(eventInput('heartbeat', { sourceEvidence: ['witness:absent-launch'] }), absent.c));
    value(absent.runtime.record('HarnessObservation', {
      type: 'HarnessObservation', schemaVersion: 1, id: 'witness:absent-launch', predecessors: [], dependencyFacts: [],
      launch: raw.launch, run: raw.run, step: raw.step, input: raw.input, incarnation: raw.incarnation,
      sourceEvidence: [], contextDigests: [digest('9')], generation: 'generation:fixture', causalReferences: [],
      observedAt: raw.sourceClock, freshFor: raw.freshFor, phase: 'launched', boundaryEvidence: raw.processIdentity,
      detail: 'admitted observation cannot establish an absent launch',
    }));
    expect(holder(absent, 'r4-f3-absent').admit(raw)).toMatchObject({ disposition: 'refused', progress: false });

    const mismatch = assemblyRuntimeFixture();
    decodedHandle(mismatch);
    const foreign = decodedEvent(mismatch, 'heartbeat', { processIdentity: 'process:invented', artifactDigest: digest('e'), platform: 'foreign-platform' });
    const foreignHandle = decodedHandle(mismatch, { processIdentity: foreign.processIdentity,
      artifactDigest: foreign.artifactDigest, platform: foreign.platform });
    const foreignEvidence = holder(mismatch, 'r4-f3-mismatch');
    expect(foreignEvidence.admit(foreign)).toMatchObject({ disposition: 'refused', progress: false });
    expect(foreignEvidence.liveness(foreignHandle, 20).state).toBe('unknown');

    const platformOnly = decodedEvent(mismatch, 'heartbeat', { id: 'heartbeat:foreign-platform', platform: 'foreign-platform' });
    const processOnly = decodedEvent(mismatch, 'heartbeat', { id: 'heartbeat:foreign-process', processIdentity: 'process:invented' });
    expect(foreignEvidence.admit(platformOnly)).toMatchObject({ disposition: 'refused', progress: false });
    expect(foreignEvidence.admit(processOnly)).toMatchObject({ disposition: 'refused', progress: false });
  });

  it('R4-F4 P13-NF-31 P13-NF-34 hashes current Part Two capture bytes before crediting progress', () => {
    const f = assemblyRuntimeFixture(), evidence = holder(f, 'r4-f4');
    decodedHandle(f);
    const invented = decodedEvent(f, 'output-chunk', { output: { ...eventInput('output-chunk').output as object, digest: digest('b') } });
    expect(evidence.admit(invented)).toMatchObject({ disposition: 'refused', progress: false });

    const neighbor = decodedEvent(f, 'output-chunk', { id: 'output:real-capture' });
    expect(evidence.admit(neighbor)).toMatchObject({ disposition: 'recorded', progress: true });
    removeCapture(f, neighbor.output!.captureReference);
    expect(evidence.progress(decodedHandle(f), 20).state).toBe('unknown');
  });

  it('R4-F7 P13-NF-46 keeps raw growth diagnostic until current owner-resolved work proves recovery', () => {
    expect(correlatedRecoveryProgress('worker:A', [{ worker: 'worker:A', before: 100, after: 101 }]).state).toBe('pending');
    expect(correlatedRecoveryProgress('worker:A', [{ worker: 'worker:A', before: 100, after: Infinity }])).toEqual({ state: 'pending', evidence: [] });

    const f = assemblyRuntimeFixture(), handle = decodedHandle(f), evidence = holder(f, 'r4-f7');
    evidence.admit(decodedEvent(f, 'output-chunk'));
    expect(correlatedRecoveryProgress(handle.processIdentity,
      [{ worker: handle.processIdentity, before: 100, after: 101 }], { holder: evidence, handle, now: 20 }).state).toBe('progressed');
  });

  it('R4-F11 malformed attempt clocks return typed refusals and retain prior journal state', () => {
    const f = assemblyRuntimeFixture();
    const handles = createRuntimeHandleHolder({ adapter: 'adapter:claude-code', machine: 'machine-a', maxHandles: 2,
      maxAttempts: 4, context: f.c, state: createMemoryHarnessAdapterStateStore('r4-f11') });
    const attempt = { kind: 'launch' as const, operation: 'operation:clock', launch: 'launch:1', incarnation: 'incarnation:1',
      subjectDigest: digest('a'), attemptedAt: -1 };
    expect(handles.beginAttempt(attempt)).toMatchObject({ disposition: 'refused', attempt: null });
    expect(handles.beginAttempt({ ...attempt, attemptedAt: 10 })).toMatchObject({ disposition: 'started', attempt: { attemptedAt: 10 } });
    expect(handles.finishAttempt(attempt.operation, 'process:1', 5)).toMatchObject({ disposition: 'refused', attempt: { state: 'pending' } });
    expect(handles.finishAttempt(attempt.operation, 'process:1', 20)).toMatchObject({ disposition: 'observed', attempt: { observedAt: 20 } });
  });
});

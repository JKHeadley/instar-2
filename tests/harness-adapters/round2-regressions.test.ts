import { describe, expect, it } from 'vitest';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  decodeHarnessRuntimeEvent,
} from '../../src/harness-adapters/index.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { refused, value } from '../facts/fixtures.js';
import { decodedEvent, decodedHandle, digest, eventInput, evidenceOwners } from './fixture.js';

function evidence(f: ReturnType<typeof assemblyRuntimeFixture>, id: string, maxEvents = 20) {
  return createHarnessEvidenceHolder({ adapter: 'adapter:claude-code', artifact: digest('4'), platform: 'claude-code',
    machine: 'machine-a', maxEvents,
    maxCaptureBytes: 100, context: f.c, state: createMemoryHarnessAdapterStateStore(id), owners: evidenceOwners(f) });
}

describe('round-2 owner-witness and uncertainty regressions', () => {
  it('REVIEW-F3 refuses missing evidence and never promotes future or superseded fields', () => {
    const f = assemblyRuntimeFixture(), handle = decodedHandle(f), holder = evidence(f, 'f3');
    expect(holder.admit(decodedEvent(f, 'heartbeat', { sourceEvidence: ['missing:evidence'] }))).toMatchObject({ disposition: 'refused', progress: false });
    expect(holder.admit(decodedEvent(f, 'work-transition', { sourceEvidence: ['missing:evidence'],
      workSubject: 'missing:work', predecessor: 'missing:predecessor' }))).toMatchObject({ disposition: 'refused', progress: false });
    expect(holder.admit(decodedEvent(f, 'turn-closed', { sourceEvidence: ['missing:evidence'] })).disposition).toBe('refused');
    expect(holder.admit(decodedEvent(f, 'diagnostic', { sourceEvidence: ['missing:evidence'],
      diagnosticCode: 'transcript-resume-compatible' })).disposition).toBe('refused');
    expect(holder.liveness(handle, 20).state).toBe('unknown');
    expect(holder.completion(handle, 20).state).toBe('unknown');
    expect(holder.resume(handle, 20).state).toBe('unknown');

    expect(holder.admit(decodedEvent(f, 'process-exited', { observedAt: 1_000 })).disposition).toBe('recorded');
    expect(holder.liveness(handle, 20).state).toBe('unknown');
    expect(holder.admit(decodedEvent(f, 'turn-closed', { id: 'closure:old', observedAt: 10 })).disposition).toBe('recorded');
    expect(holder.completion(handle, 20).state).toBe('complete');
    expect(holder.admit(decodedEvent(f, 'turn-closed', { id: 'closure:new-pending', observedAt: 20,
      sourceClock: 20, childrenState: 'pending' })).progress).toBe(false);
    expect(holder.completion(handle, 30).state).toBe('pending');
  });

  it('REVIEW-F5 binds output to the exact subject, advances only contiguous coverage, and durably deduplicates progress', () => {
    const f = assemblyRuntimeFixture();
    const state = createMemoryHarnessAdapterStateStore('f5');
    const make = () => createHarnessEvidenceHolder({ adapter: 'adapter:claude-code', artifact: digest('4'), platform: 'claude-code',
      machine: 'machine-a', maxEvents: 20,
      maxCaptureBytes: 100, context: f.c, state, owners: evidenceOwners(f) });
    const holder = make();
    expect(holder.admit(decodedEvent(f, 'output-chunk'))).toMatchObject({ disposition: 'recorded', progress: true });
    expect(holder.admit(decodedEvent(f, 'output-chunk', { id: 'output:overlap', output: {
      ...eventInput('output-chunk').output as object, start: 2, end: 6, captureReference: 'capture:overlap',
    } }))).toMatchObject({ disposition: 'recorded', progress: false });
    expect(holder.admit(decodedEvent(f, 'output-chunk', { id: 'output:gap', output: {
      ...eventInput('output-chunk').output as object, start: 10, end: 14, captureReference: 'capture:gap',
    } }))).toMatchObject({ disposition: 'recorded', progress: false });
    expect(holder.admit(decodedEvent(f, 'turn-closed', { observedAt: 30 })).disposition).toBe('recorded');
    expect(holder.completion(decodedHandle(f), 100).state).toBe('pending');

    const foreign = holder.admit(decodedEvent(f, 'output-chunk', { id: 'output:foreign',
      processIdentity: 'process:foreign', incarnation: 'incarnation:foreign' }));
    expect(foreign).toMatchObject({ disposition: 'refused', progress: false });

    const contiguous = evidence(f, 'f5-contiguous');
    contiguous.admit(decodedEvent(f, 'output-chunk'));
    contiguous.admit(decodedEvent(f, 'output-chunk', { id: 'output:next', output: {
      ...eventInput('output-chunk').output as object, start: 4, end: 8, captureReference: 'capture:next',
    } }));
    contiguous.admit(decodedEvent(f, 'turn-closed', { sourceClock: 20, observedAt: 20 }));
    expect(contiguous.completion(decodedHandle(f), 25).state).toBe('complete');
  });

  it('REVIEW-F6 rejects all 33 malformed v1 fields before migration while clean neighbors migrate', () => {
    const f = assemblyRuntimeFixture();
    const kinds = ['process-started', 'probe-live', 'probe-failed', 'input-accepted', 'context-consumed',
      'heartbeat', 'work-transition', 'output-chunk', 'turn-closed', 'process-exited', 'diagnostic'] as const;
    let refusals = 0;
    for (const kind of kinds) {
      const { sourceClock: _sourceClock, observedAt: _observedAt, freshFor: _freshFor, ...rest } = eventInput(kind);
      const v1 = { ...rest, schemaVersion: 1, at: 10 };
      expect(value(decodeHarnessRuntimeEvent(v1, f.c))).toMatchObject({ schemaVersion: 2, sourceClock: 10, observedAt: 10, freshFor: 0 });
      for (const [field, malformed] of [['sourceClock', -1], ['observedAt', 'bad'], ['freshFor', -1]] as const) {
        refused(decodeHarnessRuntimeEvent({ ...v1, [field]: malformed }, f.c), 'closed fields');
        refusals++;
      }
    }
    expect(refusals).toBe(33);
  });

  it('REVIEW-F7 decodes honest pending-stream closure and unavailable exit status', () => {
    const f = assemblyRuntimeFixture();
    const pending = decodedEvent(f, 'turn-closed', { streamState: 'open' });
    const unavailable = value(decodeHarnessRuntimeEvent(eventInput('process-exited', { exitStatus: null }), f.c));
    expect(pending.streamState).toBe('open');
    expect(unavailable.exitStatus).toBeNull();
    const holder = evidence(f, 'f7');
    holder.admit(pending);
    expect(holder.completion(decodedHandle(f), 100).state).toBe('pending');
  });
});

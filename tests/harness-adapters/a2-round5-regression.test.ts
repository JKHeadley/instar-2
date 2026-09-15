import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
} from '../../src/harness-adapters/holder.js';
import { assemblyInput } from '../assembly/fixture.js';
import { value } from '../facts/fixtures.js';
import { setup } from '../rungraph/fixtures.js';
import { a2Fixture } from './a2-fixture.js';
import { decodedHandle, digest, harnessFixture, witnessedEvent } from './fixture.js';

it('A2-UNIT R5-F01 P13-NF-29 P13-NF-33 P13-NF-38 P13-NF-46 equal-clock liveness conflicts ignore journal placement and source-id order', () => {
  for (const negative of ['probe-failed', 'process-exited'] as const) {
    for (const placement of ['both-recorded', 'both-omitted', 'positive-omitted', 'negative-omitted'] as const) {
      for (const order of ['positive-first', 'negative-first'] as const) {
        const f = a2Fixture();
        f.owner.time(20);
        const positive = witnessedEvent(f, 'heartbeat', { id: `r5:${negative}:${placement}:${order}:positive`,
          sourceEvidence: [order === 'positive-first' ? 'owner:a' : 'owner:z'], streamState: 'closed' });
        const contrary = witnessedEvent(f, negative, { id: `r5:${negative}:${placement}:${order}:negative`,
          sourceEvidence: [order === 'positive-first' ? 'owner:z' : 'owner:a'], streamState: 'closed' });
        if (placement === 'both-recorded' || placement === 'negative-omitted') f.evidence.admit(positive);
        if (placement === 'both-recorded' || placement === 'positive-omitted') f.evidence.admit(contrary);
        expect(f.evidence.liveness(f.handle, 20), `${negative}:${placement}:${order}`)
          .toMatchObject({ state: 'unknown' });
      }
    }
  }
}, 15_000);

it('A2-UNIT R5-F02 P13-NF-24 P13-NF-32 P13-NF-34 unknown stream state on every later exact-subject event defeats old completion', () => {
  for (const kind of ['heartbeat', 'diagnostic', 'probe-failed', 'process-exited',
    'probe-live', 'process-started'] as const) {
    for (const streamState of ['closed', 'open', 'unknown'] as const) {
      const f = a2Fixture();
      f.owner.time(20);
      f.evidence.admit(witnessedEvent(f, 'turn-closed', { id: `r5:closure:${kind}:${streamState}`,
        sourceClock: 10, observedAt: 10, streamState: 'closed', childrenState: 'closed' }));
      expect(f.evidence.admit(witnessedEvent(f, kind, { id: `r5:later:${kind}:${streamState}`,
        sourceClock: 20, observedAt: 20, streamState, childrenState: 'closed', unresolvedOperations: [] })))
        .toMatchObject({ disposition: 'recorded' });
      expect(f.evidence.completion(f.handle, 20), `${kind}:${streamState}`)
        .toMatchObject({ state: streamState === 'closed' ? 'complete' : 'pending' });
    }
  }
}, 15_000);

it('A2-UNIT R5-F04 P13-NF-15 P13-NF-25 P13-NF-28 P13-NF-29 omitted owner liveness requires current exact local handle custody', () => {
  for (const mode of ['control', 'different-process', 'missing-custody', 'unreadable-custody'] as const) {
    let unreadable = false;
    let retained: unknown = null;
    const state = {
      owner: 'part-thirteen' as const,
      id: `r5:handles:${mode}`,
      load() {
        if (unreadable) throw new Error('EIO');
        return retained;
      },
      save(_expected: unknown, snapshot: unknown) { retained = snapshot; },
    };
    const f = a2Fixture({ handleState: state as never });
    f.owner.time(20);
    const handle = mode === 'different-process' ? decodedHandle(f, { processIdentity: 'pid:unretained' }) : f.handle;
    const event = witnessedEvent(f, 'heartbeat', { processIdentity: handle.processIdentity, streamState: 'closed' });
    if (mode === 'missing-custody') retained = { ...(retained as object), handles: [] };
    if (mode === 'unreadable-custody') unreadable = true;
    expect(f.evidence.admit(event).disposition, mode).toBe(mode === 'control' ? 'recorded' : 'refused');
    expect(f.evidence.liveness(handle, 20).state, mode).toBe(mode === 'control' ? 'live' : 'unknown');
  }
});

it('A2-UNIT R5-F05 P13-NF-31 P13-NF-34 duplicate work evidence adds no progress and removes no witnessed progress', () => {
  for (const capacity of [1, 8]) {
    const five = setup();
    const take = <T>(result: import('../../src/index.js').Result<T>): T => consumeResult(result, {
      Success: row => row,
      Refused: refusal => { throw new Error(refusal.detail); },
    });
    const ready = take(five.graph.open(five.run));
    const grounding = take(five.graph.ground(five.id, 'w', 'h', 'start', five.lease));
    const running = take(five.graph.transition(five.start(ready, grounding)));
    const step = running.pending[0]!;
    const ten = harnessFixture();
    ten.owner.time(20);
    const spec = value(ten.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
      id: `launch:r5:duplicate:${capacity}`, artifactDigest: digest('native-artifact'), run: five.id, step: step.id }));
    const handle = decodedHandle(ten, { launch: spec.id, run: five.id, step: step.id });
    const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
      maxHandles: 2, maxAttempts: 4, context: ten.owner.c,
      state: createMemoryHarnessAdapterStateStore(`r5:duplicate:${capacity}:handles`), admission: ten.port });
    handles.put(handle);
    const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
      platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: capacity,
      maxCaptureBytes: 64, context: ten.owner.c,
      state: createMemoryHarnessAdapterStateStore(`r5:duplicate:${capacity}:events`), admission: ten.port,
      owners: { handles, current: ten.owner.host, work: five.graph } });
    const common = { launch: spec.id, run: five.id, step: step.id, workSubject: step.id,
      predecessor: step.expected, workPhase: running.state, operation: step.operation.key };
    expect(evidence.admit(witnessedEvent(ten, 'work-transition', { ...common,
      id: `r5:duplicate:${capacity}:first`, sourceEvidence: [`owner:r5:duplicate:${capacity}:first`] })))
      .toMatchObject({ disposition: 'recorded', progress: true });
    expect(evidence.progress(handle, 20)).toMatchObject({ state: 'progressed' });
    expect(evidence.admit(witnessedEvent(ten, 'work-transition', { ...common,
      id: `r5:duplicate:${capacity}:repeat`, sourceEvidence: [`owner:r5:duplicate:${capacity}:repeat`] })))
      .toMatchObject({ disposition: 'duplicate', progress: false });
    expect(evidence.progress(handle, 20)).toMatchObject({ state: 'progressed' });
    expect(evidence.events(handle.launch).events).toHaveLength(1);
  }
});

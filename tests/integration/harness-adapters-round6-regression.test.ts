import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import { decodeHarnessRuntimeEvent } from '../../src/harness-adapters/index.js';
import type { HarnessRuntimeEvent, HarnessRuntimeHandle } from '../../src/harness-adapters/contracts.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { value } from '../facts/fixtures.js';
import { decodedHandle, digest, harnessFixture, witnessedEvent } from '../harness-adapters/fixture.js';
import { setup as runGraphFixture } from '../rungraph/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';

function take<T>(result: import('../../src/index.js').Result<T>): T {
  return consumeResult(result, {
    Success: row => row,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

function exactSubject(event: HarnessRuntimeEvent): string {
  return take(canonical([event.harness, event.artifactDigest, event.platform, event.machine,
    event.launch, event.run, event.step, event.input, event.incarnation, event.processIdentity])).bytes;
}

function confirmResume(event: HarnessRuntimeEvent, at: number) {
  const nine = verificationRuntimeFixture();
  nine.setGeneration('generation:fixture');
  nine.time(at);
  const base = verificationInput('VerificationPlan');
  const plan = { ...base, id: 'r6:plan:resume-compatible',
    subject: { ...base.subject, holder: 'part-thirteen:resume-compatible', governed: exactSubject(event),
      scope: 'conversation:1', generation: 'generation:fixture' },
    arms: [{ ...base.arms[0]!, id: 'resume-compatible', executable: 'harness.resume-compatible',
      fixture: 'P13-NF-38' }],
    bar: { ...base.bar, sources: ['runtime-conversation'] },
    consumers: [{ ...base.consumers[0]!, id: 'part-thirteen:resume-compatible' }] };
  value(nine.runtime.record('VerificationPlan', plan));
  const planFact = value(nine.runtime.inspectCurrent())
    .find(row => row.record.type === 'VerificationPlan' && row.record.id === plan.id)!.fact.id;
  const probe = value(decodeProbeRecord({ ...verificationInput('ProbeRecord'), id: 'r6:probe:resume-compatible',
    predecessors: [planFact], plan: plan.id, planVersion: plan.bar.version,
    arm: 'resume-compatible', subject: plan.subject.governed }, nine.c));
  const witness = nine.witnessFor(probe, 'r6:evidence:resume-compatible');
  nine.setEvidence([...nine.host.current().evidence, witness]);
  value(nine.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
  return nine;
}

function resumeFixture(change: Partial<HarnessRuntimeHandle> = {}, factReference = false) {
  const ten = harnessFixture();
  ten.owner.time(20);
  const six = transportFixture();
  const fence = value(six.api.acquire('r6:acquire', '', 500));
  const spec = value(ten.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'r6:launch:resume', artifactDigest: digest('native-artifact'), incarnation: fence.incarnation }));
  const exact = {
    launch: spec.id,
    incarnation: spec.incarnation,
    inputDigest: spec.inputDigest,
    contextDigests: spec.contextManifest.map(row => row.digest),
    launchOperation: spec.processOperation,
    dependencyFacts: spec.dependencyFacts,
  };
  const handle = decodedHandle(ten, { ...exact, ...change });
  const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
    maxHandles: 4, maxAttempts: 8, context: ten.owner.c,
    state: createMemoryHarnessAdapterStateStore(`r6:resume:${Object.keys(change).join('-') || 'control'}:handles`),
    admission: ten.port });
  handles.put(handle);
  let compatible = witnessedEvent(ten, 'diagnostic', {
    id: 'r6:event:resume-compatible', sourceEvidence: ['r6:observation:resume-compatible'],
    launch: handle.launch, incarnation: handle.incarnation,
    diagnosticCode: 'resume-compatible:r6:plan:resume-compatible',
  });
  if (factReference) {
    const row = value(ten.owner.c.history!.lookup(compatible.sourceEvidence[0]!));
    if (!row) throw new Error('fact-addressed resume requires its signed source row');
    compatible = value(decodeHarnessRuntimeEvent({ ...compatible, sourceEvidence: [row.fact.id] }, ten.owner.c));
  }
  const nine = confirmResume(compatible, 20);
  const eventState = createMemoryHarnessAdapterStateStore(`r6:resume:${Object.keys(change).join('-') || 'control'}:events`);
  const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
    maxCaptureBytes: 64, context: ten.owner.c, state: eventState, admission: ten.port,
    owners: { handles, current: ten.owner.host, verification: nine.runtime } });
  expect(evidence.admit(witnessedEvent(ten, 'heartbeat', {
    id: 'r6:event:live', sourceEvidence: ['r6:observation:live'], launch: handle.launch,
    incarnation: handle.incarnation, streamState: 'closed',
  }))).toMatchObject({ disposition: 'recorded' });
  expect(evidence.admit(compatible)).toMatchObject({ disposition: 'recorded' });
  ten.owner.time(22);
  nine.time(22);
  return { ten, six, fence, spec, handle, handles, compatible, nine, eventState, evidence };
}

it('A2-INTEGRATION R6-F02 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 a fact-addressed Nine-confirmed observation remains eligible and reconnects through real Six', () => {
  const fixture = resumeFixture({}, true);
  expect(fixture.evidence.resume(fixture.handle, 22)).toMatchObject({ state: 'eligible' });
  expect(sameMachineReconnectCandidate({ launch: fixture.handle.launch, machine: fixture.handle.machine,
    incarnation: fixture.handle.incarnation, fence: fixture.fence, now: 22,
    evidence: fixture.evidence, authority: fixture.six.api }, fixture.handles)).toMatchObject({ disposition: 'reconnect' });
});

it('A2-INTEGRATION R6-F03 P13-NF-15 P13-NF-25 P13-NF-28 P13-NF-38 reconnect verifies retained launch fields against signed Ten history and rejects future acquisition', () => {
  const cases: ReadonlyArray<readonly [string, Partial<HarnessRuntimeHandle>]> = [
    ['wrong-input-digest', { inputDigest: digest('r6:different-input') }],
    ['wrong-context-digests', { contextDigests: [digest('r6:different-context')] }],
    ['wrong-launch-operation', { launchOperation: 'r6:operation:not-the-launch' }],
    ['wrong-dependency-facts', { dependencyFacts: ['r6:dependency:not-in-launch'] }],
    ['future-acquisition', { acquiredAt: 900 }],
  ];
  for (const [name, change] of cases) {
    const fixture = resumeFixture(change);
    expect(fixture.evidence.resume(fixture.handle, 22), name).toMatchObject({ state: 'unknown' });
    expect(sameMachineReconnectCandidate({ launch: fixture.handle.launch, machine: fixture.handle.machine,
      incarnation: fixture.handle.incarnation, fence: fixture.fence, now: 22,
      evidence: fixture.evidence, authority: fixture.six.api }, fixture.handles), name)
      .toMatchObject({ disposition: 'refused' });
  }
  const control = resumeFixture();
  expect(control.evidence.resume(control.handle, 22)).toMatchObject({ state: 'eligible' });
  expect(sameMachineReconnectCandidate({ launch: control.handle.launch, machine: control.handle.machine,
    incarnation: control.handle.incarnation, fence: control.fence, now: 22,
    evidence: control.evidence, authority: control.six.api }, control.handles))
    .toMatchObject({ disposition: 'reconnect' });
}, 20_000);

it('A2-INTEGRATION R6-MONOTONICITY P13-NF-25 P13-NF-28 P13-NF-31 P13-NF-38 removing progress or resume evidence never improves progress, resume, or reconnect', () => {
  let evidenceLossScenarios = 0;

  const run = runGraphFixture();
  const ready = value(run.graph.open(run.run));
  const grounding = value(run.graph.ground(run.id, 'w', 'h', 'start', run.lease));
  const running = value(run.graph.transition(run.start(ready, grounding)));
  const step = running.pending[0]!;
  const ten = harnessFixture();
  ten.owner.time(20);
  const spec = value(ten.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'r6:launch:progress', artifactDigest: digest('native-artifact'), run: run.id, step: step.id }));
  const handle = decodedHandle(ten, { launch: spec.id, run: run.id, step: step.id });
  const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
    maxHandles: 2, maxAttempts: 4, context: ten.owner.c,
    state: createMemoryHarnessAdapterStateStore('r6:progress:handles'), admission: ten.port });
  handles.put(handle);
  const prefix = structuredClone(ten.owner.raw);
  const transition = witnessedEvent(ten, 'work-transition', {
    id: 'r6:event:progress', sourceEvidence: ['r6:observation:progress'], launch: spec.id,
    run: run.id, step: step.id, workSubject: step.id, predecessor: step.expected,
    workPhase: running.state, operation: step.operation.key,
  });
  const progressState = createMemoryHarnessAdapterStateStore('r6:progress:events');
  const progressEvidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
    maxCaptureBytes: 64, context: ten.owner.c, state: progressState, admission: ten.port,
    owners: { handles, current: ten.owner.host, work: run.graph } });
  expect(progressEvidence.admit(transition)).toMatchObject({ disposition: 'recorded', progress: true });
  expect(progressEvidence.progress(handle, 20)).toMatchObject({ state: 'progressed' });
  const fullProgressHistory = structuredClone(ten.owner.raw);
  const transitionRow = value(ten.owner.c.history!.lookup(transition.sourceEvidence[0]!));
  if (!transitionRow) throw new Error('progress transition requires its signed source row');
  const history = ten.owner.c.history!;
  const hiddenContext = { ...ten.owner.c, history: { ...history, lookup: (reference: string) =>
    reference === transition.sourceEvidence[0] || reference === transitionRow.fact.id
      ? ten.owner.success(null) : history.lookup(reference) } } as typeof ten.owner.c;
  const hiddenProgress = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
    maxCaptureBytes: 64, context: hiddenContext, state: progressState, admission: ten.port,
    owners: { handles, current: ten.owner.host, work: run.graph } });
  expect(hiddenProgress.progress(handle, 20).state).not.toBe('progressed');
  evidenceLossScenarios++;
  ten.owner.raw.splice(0, ten.owner.raw.length, ...prefix);
  expect(progressEvidence.progress(handle, 20).state).not.toBe('progressed');
  evidenceLossScenarios++;
  ten.owner.raw.splice(0, ten.owner.raw.length, ...fullProgressHistory);
  const emptyProgress = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
    maxCaptureBytes: 64, context: ten.owner.c, state: createMemoryHarnessAdapterStateStore('r6:progress:empty'),
    admission: ten.port, owners: { handles, current: ten.owner.host, work: run.graph } });
  expect(emptyProgress.progress(handle, 20).state).not.toBe('progressed');
  evidenceLossScenarios++;

  for (const loss of ['lookup', 'prefix', 'journal'] as const) {
    const fixture = resumeFixture();
    expect(fixture.evidence.resume(fixture.handle, 22).state).toBe('eligible');
    const fullOwner = structuredClone(fixture.ten.owner.raw);
    const eventIndex = fixture.ten.owner.raw.findIndex(row => {
      try {
        return value(fixture.ten.owner.c.history!.lookup(fixture.compatible.sourceEvidence[0]!))?.fact.id
          === (row as { id?: string }).id;
      } catch { return false; }
    });
    const compatibleRow = value(fixture.ten.owner.c.history!.lookup(fixture.compatible.sourceEvidence[0]!));
    if (!compatibleRow) throw new Error('resume-compatible event requires its signed source row');
    let context = fixture.ten.owner.c;
    let state = fixture.eventState;
    if (loss === 'lookup') {
      const ownerHistory = fixture.ten.owner.c.history!;
      context = { ...fixture.ten.owner.c, history: { ...ownerHistory, lookup: (reference: string) =>
        reference === fixture.compatible.sourceEvidence[0] || reference === compatibleRow.fact.id
          ? fixture.ten.owner.success(null) : ownerHistory.lookup(reference) } } as typeof fixture.ten.owner.c;
    } else if (loss === 'prefix') {
      expect(eventIndex).toBeGreaterThanOrEqual(0);
      fixture.ten.owner.raw.splice(0, fixture.ten.owner.raw.length,
        ...fullOwner.filter(row => (row as { id?: string }).id !== compatibleRow.fact.id));
    } else {
      state = createMemoryHarnessAdapterStateStore('r6:resume:empty');
    }
    const evidence = createHarnessEvidenceHolder({ adapter: fixture.handle.harness,
      artifact: fixture.handle.artifactDigest, platform: fixture.handle.platform,
      machine: fixture.handle.machine, scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
      context, state, admission: fixture.ten.port,
      owners: { handles: fixture.handles, current: fixture.ten.owner.host, verification: fixture.nine.runtime } });
    expect(evidence.resume(fixture.handle, 22).state, loss).not.toBe('eligible');
    expect(sameMachineReconnectCandidate({ launch: fixture.handle.launch, machine: fixture.handle.machine,
      incarnation: fixture.handle.incarnation, fence: fixture.fence, now: 22,
      evidence, authority: fixture.six.api }, fixture.handles).disposition, loss).not.toBe('reconnect');
    evidenceLossScenarios++;
  }
  expect(evidenceLossScenarios).toBe(6);
});

it('A2-INTEGRATION R6-F04 P13-NF-31 the process-local run fixture is not production Six admission evidence', () => {
  const run = runGraphFixture();
  const ready = value(run.graph.open(run.run));
  const grounding = value(run.graph.ground(run.id, 'w', 'h', 'start', run.lease));
  value(run.graph.transition(run.start(ready, grounding)));
  const ownerFacts = value(run.store.read());
  expect(ownerFacts.filter(row => /lease|fence|reservation|transport/i.test(row.kind))).toEqual([]);
  expect(run.admissions.size).toBeGreaterThan(0);
  run.admissions.clear();
  const afterClear = consumeResult(run.graph.read(run.id), {
    Success: () => ({ state: 'accepted', detail: '' }),
    Refused: refusal => ({ state: 'refused', detail: refusal.detail }),
  });
  expect(afterClear).toMatchObject({ state: 'refused', detail: expect.stringContaining('not admitted by six') });
});

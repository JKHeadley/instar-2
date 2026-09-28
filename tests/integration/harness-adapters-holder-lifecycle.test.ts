import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import { createFutureHarnessAdapter } from '../../src/harness-adapters/adapter.js';
import { boundary as assemblyBoundary } from '../../src/assembly/boundary.js';
import { correlatedRecoveryProgress } from '../../src/harness-adapters/regression-boundaries.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy } from '../../src/transport/loop-a1/index.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
import type { HarnessRuntimeEvent } from '../../src/harness-adapters/contracts.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { digest, harnessFixture, witnessedEvent } from '../harness-adapters/fixture.js';
import { a2Fixture, signedHandle } from '../harness-adapters/a2-fixture.js';
import { setup as runGraphFixture } from '../rungraph/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { transportLoopFixture } from '../transport/loop-fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { stallCoverageFixture } from '../assembly/stall-coverage-fixture.js';

function exactSubject(event: HarnessRuntimeEvent): string {
  return consumeResult(canonical([event.harness, event.artifactDigest, event.platform, event.machine,
    event.launch, event.run, event.step, event.input, event.incarnation, event.processIdentity]), {
    Success: encoded => encoded.bytes,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

function resumeOwner(event: HarnessRuntimeEvent,
  holder: 'part-thirteen:resume-compatible' | 'part-thirteen:transcript-poison', scope = 'conversation:1',
  purpose: 'runtime-resume' | 'generic-verification' = 'runtime-resume') {
  const f = verificationRuntimeFixture();
  f.setGeneration('generation:fixture');
  f.time(event.observedAt);
  const arm = holder === 'part-thirteen:resume-compatible' ? 'resume-compatible' : 'transcript-poison';
  const fixture = holder === 'part-thirteen:resume-compatible' ? 'P13-NF-38' : 'P13-NF-51';
  const base = verificationInput('VerificationPlan');
  const plan = { ...base, id: `plan:${holder.split(':').at(-1)}${purpose === 'runtime-resume' ? '' : ':generic-verification'}`,
    subject: { ...verificationInput('VerificationPlan').subject, holder, governed: exactSubject(event),
      scope, generation: 'generation:fixture' },
    ...(purpose === 'runtime-resume' ? {
      arms: [{ ...base.arms[0]!, id: arm, executable: `harness.${arm}`, fixture }],
      bar: { ...base.bar, sources: ['runtime-conversation'] },
      consumers: [{ ...base.consumers[0]!, id: holder }],
    } : {}) };
  value(f.runtime.record('VerificationPlan', plan));
  const planFact = value(f.runtime.inspect())[0]!.fact.id;
  const probeArm = plan.arms[0]!.id;
  const rawProbe = { ...verificationInput('ProbeRecord'), id: `probe:${plan.id}`, predecessors: [planFact],
    plan: plan.id, planVersion: plan.bar.version, arm: probeArm, subject: plan.subject.governed };
  const probe = value(decodeProbeRecord(rawProbe, f.c));
  const witness = f.witnessFor(probe, `evidence:${probe.id}`);
  f.setEvidence([...f.host.current().evidence, witness]);
  value(f.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
  return f.runtime;
}

it('A2-INTEGRATION R2-F07 P13-NF-31 real Part Five transition records progress but cannot authenticate caller-claimed recovery growth', () => {
  const run = runGraphFixture();
  const ready = value(run.graph.open(run.run));
  const grounding = value(run.graph.ground(run.id, 'w', 'h', 'start', run.lease));
  const running = value(run.graph.transition(run.start(ready, grounding)));
  const assembly = harnessFixture();
  value(assembly.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'launch:work', harness: 'native', artifactDigest: digest('native-artifact'),
    run: run.id, step: running.pending[0]!.id }));
  const process = signedHandle(assembly, { launch: 'launch:work', run: run.id, step: running.pending[0]!.id });
  const handles = createRuntimeHandleHolder({ adapter: process.harness, machine: process.machine,
    maxHandles: 2, maxAttempts: 4, context: assembly.owner.c,
    state: createMemoryHarnessAdapterStateStore('a2:work:handles'), admission: assembly.port });
  handles.put(process);
  const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: digest('native-artifact'),
    platform: 'darwin-arm64', machine: 'machine-a', scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
    context: assembly.owner.c, state: createMemoryHarnessAdapterStateStore('a2:work:evidence'), admission: assembly.port,
    owners: { handles, current: assembly.owner.host, work: run.graph } });
  const transition = witnessedEvent(assembly, 'work-transition', {
    launch: 'launch:work', predecessor: running.pending[0]!.expected, run: run.id, step: running.pending[0]!.id,
    workSubject: running.pending[0]!.id, workPhase: running.state,
    operation: running.pending[0]!.operation.key,
  });
  const admitted = evidence.admit(transition);
  expect(admitted, admitted.reason).toMatchObject({ disposition: 'recorded', progress: true });
  assembly.owner.time(20);
  expect(correlatedRecoveryProgress(process.processIdentity,
    [{ worker: process.processIdentity, before: 1, after: 2 }], { holder: evidence, handle: process, now: 20 }))
    .toMatchObject({ state: 'pending' });
});

it('A2-INTEGRATION R2-F02 R2-F10 P13-NF-51 literal diagnostics grant nothing; only exact-purpose current Part Nine posture owns resume', () => {
  const f = harnessFixture();
  f.owner.time(20);
  const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 2,
    maxAttempts: 4, context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:resume:handles'), admission: f.port });
  const handle = signedHandle(f);
  handles.put(handle);
  const diagnostic = witnessedEvent(f, 'diagnostic', { id: 'diagnostic:resume',
    diagnosticCode: 'resume-compatible:plan:resume-compatible' });
  const noOwner = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:resume:none'), admission: f.port,
    owners: { handles, current: f.owner.host } });
  noOwner.admit(diagnostic);
  expect(noOwner.resume(handle, 20).state).toBe('unknown');

  const verification = resumeOwner(diagnostic, 'part-thirteen:resume-compatible');
  const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:resume:owned'), admission: f.port,
    owners: { handles, current: f.owner.host, verification } });
  evidence.admit(diagnostic);
  expect(evidence.resume(handle, 20)).toMatchObject({ state: 'eligible', event: diagnostic.id });

  const foreignPlan = resumeOwner(diagnostic, 'part-thirteen:resume-compatible', 'conversation:FOREIGN');
  const foreignRows = value(foreignPlan.inspectCurrent());
  expect(foreignRows.some(row => row.record.type === 'VerificationPlan')).toBe(true);
  const foreign = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:resume:foreign'), admission: f.port,
    owners: { handles, current: f.owner.host, verification: foreignPlan } });
  foreign.admit(diagnostic);
  expect(foreign.resume(handle, 20)).toMatchObject({ state: 'unknown' });

  const genericDiagnostic = witnessedEvent(f, 'diagnostic', { id: 'diagnostic:resume:generic',
    diagnosticCode: 'resume-compatible:plan:resume-compatible:generic-verification' });
  const genericPlan = resumeOwner(genericDiagnostic, 'part-thirteen:resume-compatible', 'conversation:1',
    'generic-verification');
  const generic = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:resume:generic'), admission: f.port,
    owners: { handles, current: f.owner.host, verification: genericPlan } });
  generic.admit(genericDiagnostic);
  expect(generic.resume(handle, 20)).toMatchObject({ state: 'unknown' });

  const poisoned = harnessFixture();
  poisoned.owner.time(20);
  const poisonHandles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 2,
    maxAttempts: 4, context: poisoned.owner.c,
    state: createMemoryHarnessAdapterStateStore('a2:resume:poison-handles'), admission: poisoned.port });
  const poisonHandle = signedHandle(poisoned);
  poisonHandles.put(poisonHandle);
  const poison = witnessedEvent(poisoned, 'diagnostic', { id: 'diagnostic:poison',
    diagnosticCode: 'transcript-poison:plan:transcript-poison' });
  const poisonEvidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: poisonHandle.artifactDigest,
    platform: poisonHandle.platform, machine: poisonHandle.machine, scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
    context: poisoned.owner.c, state: createMemoryHarnessAdapterStateStore('a2:resume:poison'), admission: poisoned.port,
    owners: { handles: poisonHandles, current: poisoned.owner.host,
      verification: resumeOwner(poison, 'part-thirteen:transcript-poison') } });
  poisonEvidence.admit(poison);
  expect(poisonEvidence.resume(poisonHandle, 20)).toMatchObject({ state: 'poisoned', event: poison.id });
});

it('A2-INTEGRATION P13-NF-28 P13-NF-38 same-machine reconnect consumes real Six fence, exact liveness, and Part Nine resume', () => {
  const six = transportFixture();
  const fence = value(six.api.acquire('acquire', '', 500));
  const f = harnessFixture();
  f.owner.time(20);
  value(f.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'launch:reconnect', harness: 'native', artifactDigest: digest('native-artifact'),
    incarnation: fence.incarnation }));
  const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 2,
    maxAttempts: 4, context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:reconnect:handles'), admission: f.port });
  const handle = signedHandle(f, { launch: 'launch:reconnect', incarnation: fence.incarnation });
  handles.put(handle);
  const diagnostic = witnessedEvent(f, 'diagnostic', { id: 'diagnostic:reconnect', launch: handle.launch,
    incarnation: fence.incarnation,
    diagnosticCode: 'resume-compatible:plan:resume-compatible' });
  const verification = resumeOwner(diagnostic, 'part-thirteen:resume-compatible');
  const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:reconnect:evidence'), admission: f.port,
    owners: { handles, current: f.owner.host, verification } });
  evidence.admit(witnessedEvent(f, 'heartbeat', { id: 'heartbeat:reconnect', launch: handle.launch,
    incarnation: fence.incarnation }));
  evidence.admit(diagnostic);
  const reconnect = sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine,
    incarnation: handle.incarnation, fence, now: 20, evidence, authority: six.api }, handles);
  expect(reconnect, reconnect.reason)
    .toMatchObject({ disposition: 'reconnect', handle });
  expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: 'machine-b',
    incarnation: handle.incarnation, fence, now: 20, evidence, authority: six.api }, handles))
    .toMatchObject({ disposition: 'unsupported', handle: null });

  const foreignSix = transportFixture();
  (foreignSix.host as unknown as { domain: string }).domain = 'conversation:FOREIGN';
  const foreignFence = value(foreignSix.api.acquire('foreign-domain-acquire', '', 500));
  expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine,
    incarnation: handle.incarnation, fence: foreignFence, now: 20, evidence, authority: foreignSix.api }, handles))
    .toMatchObject({ disposition: 'refused', handle: null });
});

it('A2-INTEGRATION REVIEW-F8 P13-NF-37 real Six stops a recovery observation at its bound', () => {
  const f = transportFixture();
  const { token, reservation } = f.prepared();
  value(f.api.claim('claim', token, reservation.operation));
  f.advance(100);
  let calls = 0;
  const recovered = value(f.api.recover('bounded-observe', token, reservation.operation, {
    owner: 'part-eight', observe: () => { calls++; throw new Error('must not run beyond bound'); },
  }));
  expect(recovered.disposition).toBe('stopped-at-bound');
  expect(calls).toBe(0);
});

it('A2-INTEGRATION R2-F09 P13-NF-35 P13-NF-37 P13-NF-47 landed Six one-episode breaker opens, refuses cooldown, and reaches half-open', () => {
  const f = transportLoopFixture();
  const pressureScope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
  const policy = value(decodeLoopPolicyA1({ ...f.sharedPolicy, id: 'p13-a2-breaker', failureThreshold: 1 }, f.c)) as SharedBreakerLoopPolicy;
  f.registerPolicy(policy);
  const fence = value(f.api.acquire('p13-breaker-acquire', '', 1_000));
  const scheduled = value(f.api.scheduleEpisode({ command: 'p13-breaker-schedule', fence,
    currentOwnerRun: f.run, policy, episodeKey: 'one', operationFamily: 'recovery',
    pressureScope,
    sourceVector: f.vector }));
  const episode = { owner: 'part-six' as const, name: 'LoopRecord' as const, id: scheduled.episode };
  f.advance(1);
  value(f.api.admitLoopAttempt({ command: 'p13-breaker-attempt', fence, episode, attempt: 'attempt:first' }));
  const completion = f.appendOutcome('failed', 'attempt:first');
  const opened = value(f.api.recordLoopOutcome({ command: 'p13-breaker-failed', fence, episode,
    attempt: 'attempt:first', kind: 'failed', failureClass: 'transport', completion,
    jitterPermille: 500, restoration: [] }));
  const refused = consumeResult(f.api.admitLoopAttempt({ command: 'p13-breaker-too-soon', fence, episode,
    attempt: 'attempt:too-soon' }), { Success: () => '', Refused: row => row.detail });
  f.advance(21);
  const trial = value(f.api.admitLoopAttempt({ command: 'p13-breaker-half-open', fence, episode,
    attempt: 'attempt:trial' }));
  expect({ scheduled: scheduled.state, opened: opened.state, refused, trial: trial.state,
    breaker: policy.breaker }).toEqual({ scheduled: 'scheduled', opened: 'open-breaker',
    refused: 'breaker cooldown or wake is not eligible', trial: 'half-open', breaker: 'shared-circuit-v1' });
});

it('A2-INTEGRATION R2-F05 R2-F06 P13-NF-24 P13-NF-39 delivery replay preserves its first clock and requires a current Ten receipt', () => {
  const f = a2Fixture();
  const spec = value(f.owner.runtime.record('HarnessLaunchSpec', {
    ...assemblyInput('HarnessLaunchSpec'), id: 'launch:delivery-replay', run: 'run:delivery-replay',
    step: 'step:delivery-replay', artifactDigest: f.handle.artifactDigest, inputDigest: f.handle.inputDigest,
  }));
  const handle = signedHandle(f, { id: 'handle:delivery-replay', launch: spec.id, run: spec.run, step: spec.step });
  expect(f.handles.put(handle)).toMatchObject({ disposition: 'stored' });
  const contract = value(f.owner.runtime.record('AdapterEvidenceContract', {
    ...assemblyInput('AdapterEvidenceContract'), id: 'contract:replay', adapter: 'native', artifact: f.handle.artifactDigest,
  }));
  const conformance = value(f.owner.runtime.record('AdapterConformance', {
    ...assemblyInput('AdapterConformance'), id: 'conformance:replay', contract: contract.id,
    adapter: 'native', artifact: f.handle.artifactDigest, platform: f.handle.platform, mode: 'advisory',
  }));
  let now = 20;
  let driverCalls = 0;
  const tripwire = () => { driverCalls++; throw new Error('replay must not invoke the driver'); };
  const packageView = createFutureHarnessAdapter({ id: 'native', stallCoverage: stallCoverageFixture('native'), artifact: f.handle.artifactDigest,
    platform: handle.platform, conformance: conformance.id, machine: handle.machine,
    driver: { owner: 'part-eight', launch: tripwire, deliver: tripwire, observe: tripwire },
    handles: f.handles, evidence: f.evidence, context: f.owner.c, clock: () => now,
    generation: () => f.owner.host.current().generation });
  const delivery = { launch: handle.launch, intake: handle.input, digest: handle.inputDigest,
    incarnation: handle.incarnation, operation: 'operation:delivery-replay' };
  expect(f.handles.beginAttempt({ kind: 'delivery', operation: delivery.operation, launch: delivery.launch,
    incarnation: delivery.incarnation, subjectDigest: value(canonical(delivery)).hash, attemptedAt: 20 }))
    .toMatchObject({ disposition: 'started' });
  now = 21;
  expect(value(packageView.adapter.deliver(delivery))).toMatchObject({ phase: 'uncertain', observedAt: 20 });
  expect(f.handles.finishAttempt(delivery.operation, 'absent-from-owner-history', 20))
    .toMatchObject({ disposition: 'observed' });
  expect(value(f.owner.c.history!.lookup('absent-from-owner-history'))).toBeNull();
  expect(value(packageView.adapter.deliver(delivery))).toMatchObject({ phase: 'uncertain', observedAt: 20,
    boundaryEvidence: 'absent-from-owner-history' });
  expect(driverCalls).toBe(0);
});

it('A2-INTEGRATION R3-F03 P13-NF-24 P13-NF-39 delivery replay preserves owner receipt clocks and rejects future or expired evidence', () => {
  for (const age of [0, 1, 200, -10]) {
    const f = a2Fixture();
    const spec = value(f.owner.runtime.record('HarnessLaunchSpec', {
      ...assemblyInput('HarnessLaunchSpec'), id: `launch:r3-replay:${age}`, run: `run:r3-replay:${age}`,
      step: `step:r3-replay:${age}`, artifactDigest: f.handle.artifactDigest,
      inputDigest: f.handle.inputDigest,
    }));
    const handle = signedHandle(f, { id: `handle:r3-replay:${age}`, launch: spec.id,
      run: spec.run, step: spec.step });
    expect(f.handles.put(handle)).toMatchObject({ disposition: 'stored' });
    const contract = value(f.owner.runtime.record('AdapterEvidenceContract', {
      ...assemblyInput('AdapterEvidenceContract'), id: `contract:r3-replay:${age}`,
      adapter: 'native', artifact: f.handle.artifactDigest,
    }));
    const conformance = value(f.owner.runtime.record('AdapterConformance', {
      ...assemblyInput('AdapterConformance'), id: `conformance:r3-replay:${age}`, contract: contract.id,
      adapter: 'native', artifact: f.handle.artifactDigest, platform: f.handle.platform, mode: 'advisory',
    }));
    const delivery = { launch: handle.launch, intake: handle.input, digest: handle.inputDigest,
      incarnation: handle.incarnation, operation: `operation:r3-replay:${age}` };
    expect(f.handles.beginAttempt({ kind: 'delivery', operation: delivery.operation, launch: delivery.launch,
      incarnation: delivery.incarnation, subjectDigest: value(canonical(delivery)).hash, attemptedAt: 20 }))
      .toMatchObject({ disposition: 'started' });
    const receipt = value(f.owner.runtime.record('HarnessObservation', {
      ...assemblyInput('HarnessObservation'), id: `observation:r3-replay:${age}`, launch: spec.id,
      run: spec.run, step: spec.step, input: spec.input, incarnation: spec.incarnation,
      phase: 'input-accepted', observedAt: age < 0 ? 30 : 20, freshFor: 1,
    }));
    expect(f.handles.finishAttempt(delivery.operation, receipt.id, 20)).toMatchObject({ disposition: 'observed' });
    const now = age < 0 ? 20 : 20 + age;
    f.owner.time(now);
    let driverCalls = 0;
    const tripwire = () => { driverCalls++; throw new Error('replay must not invoke the driver'); };
    const packageView = createFutureHarnessAdapter({ id: 'native', stallCoverage: stallCoverageFixture('native'), artifact: f.handle.artifactDigest,
      platform: handle.platform, conformance: conformance.id, machine: handle.machine,
      driver: { owner: 'part-eight', launch: tripwire, deliver: tripwire, observe: tripwire },
      handles: f.handles, evidence: f.evidence, context: f.owner.c, clock: () => now,
      generation: () => f.owner.host.current().generation });
    const replay = value(packageView.adapter.deliver(delivery));
    if (age === 0 || age === 1) {
      expect(replay).toMatchObject({ id: receipt.id, phase: 'input-accepted',
        observedAt: receipt.observedAt, freshFor: receipt.freshFor });
    } else {
      expect(replay).toMatchObject({ phase: 'uncertain' });
    }
    expect(driverCalls).toBe(0);
  }
});

it('session driver recovers a pending Part Thirteen attempt only through its durable recovery port', () => {
  const f = a2Fixture();
  const spec = value(f.owner.runtime.record('HarnessLaunchSpec', {
    ...assemblyInput('HarnessLaunchSpec'), id: 'launch:session-recovery', run: 'run:session-recovery',
    step: 'step:session-recovery', artifactDigest: f.handle.artifactDigest, inputDigest: f.handle.inputDigest,
  }));
  const handle = signedHandle(f, { id: 'handle:session-recovery', launch: spec.id,
    run: spec.run, step: spec.step });
  expect(f.handles.put(handle)).toMatchObject({ disposition: 'stored' });
  const contract = value(f.owner.runtime.record('AdapterEvidenceContract', {
    ...assemblyInput('AdapterEvidenceContract'), id: 'contract:session-recovery',
    adapter: 'native', artifact: f.handle.artifactDigest,
  }));
  const conformance = value(f.owner.runtime.record('AdapterConformance', {
    ...assemblyInput('AdapterConformance'), id: 'conformance:session-recovery', contract: contract.id,
    adapter: 'native', artifact: f.handle.artifactDigest, platform: f.handle.platform, mode: 'advisory',
  }));
  const delivery = { launch: handle.launch, intake: handle.input, digest: handle.inputDigest,
    incarnation: handle.incarnation, operation: 'operation:session-recovery' };
  expect(f.handles.beginAttempt({ kind: 'delivery', operation: delivery.operation, launch: delivery.launch,
    incarnation: delivery.incarnation, subjectDigest: value(canonical(delivery)).hash, attemptedAt: 20 }))
    .toMatchObject({ disposition: 'started' });
  let calls = 0, ambiguity = false;
  const driver = { owner: 'part-eight' as const,
    launch: () => { throw Error('unexpected launch'); },
    deliver: () => { throw Error('unexpected ordinary delivery'); },
    observe: () => { throw Error('unexpected observation'); },
    recoverDelivery: () => { calls++; return ambiguity
      ? assemblyBoundary('SyntheticAmbiguousSession', null, f.owner.c, () => { throw Error('send may have arrived'); })
      : f.owner.success('tmux-input:recovered'); },
  };
  const packageView = createFutureHarnessAdapter({ id: 'native', stallCoverage: stallCoverageFixture('native'), artifact: f.handle.artifactDigest,
    platform: handle.platform, conformance: conformance.id, machine: handle.machine,
    driver, handles: f.handles, evidence: f.evidence, context: f.owner.c,
    clock: () => 20, generation: () => f.owner.host.current().generation });
  expect(value(packageView.bootSweep()).map(row => row.phase)).toEqual(['input-accepted']);
  expect(value(packageView.bootSweep())).toEqual([]);
  expect(calls).toBe(1);
  expect(f.handles.beginAttempt({ kind: 'delivery', operation: delivery.operation, launch: delivery.launch,
    incarnation: delivery.incarnation, subjectDigest: value(canonical(delivery)).hash, attemptedAt: 20 }).attempt?.state)
    .toBe('observed');
  const ambiguous = { ...delivery, operation: 'operation:session-recovery:ambiguous' };
  expect(f.handles.beginAttempt({ kind: 'delivery', operation: ambiguous.operation, launch: ambiguous.launch,
    incarnation: ambiguous.incarnation, subjectDigest: value(canonical(ambiguous)).hash, attemptedAt: 20 }))
    .toMatchObject({ disposition: 'started' });
  ambiguity = true;
  expect(value(packageView.bootSweep()).map(row => row.phase)).toEqual(['uncertain']);
  expect(calls).toBe(2);
});

it('A2-INTEGRATION R2-F09 P13-NF-04 base describe re-resolves real Ten conformance and refuses its expired neighbour without driver execution', () => {
  const f = harnessFixture();
  const contract = value(f.owner.runtime.record('AdapterEvidenceContract', {
    ...assemblyInput('AdapterEvidenceContract'), id: 'contract:a2-native', adapter: 'native',
    artifact: digest('native-artifact'),
  }));
  const conformance = value(f.owner.runtime.record('AdapterConformance', {
    ...assemblyInput('AdapterConformance'), id: 'conformance:a2-native', contract: contract.id,
    adapter: 'native', artifact: digest('native-artifact'), platform: 'darwin-arm64', mode: 'advisory',
  }));
  const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 2,
    maxAttempts: 8, context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:adapter:handles'),
    admission: f.port });
  const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: digest('native-artifact'),
    platform: 'darwin-arm64', machine: 'machine-a', scope: 'conversation:1', maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:adapter:evidence'), admission: f.port,
    owners: { handles, current: f.owner.host } });
  let driverCalls = 0;
  const driver = Object.freeze({ owner: 'part-eight' as const,
    launch: () => { driverCalls++; throw new Error('describe must not invoke launch'); },
    deliver: () => { driverCalls++; throw new Error('describe must not invoke delivery'); },
    observe: () => { driverCalls++; throw new Error('describe must not invoke observation'); },
  });
  let now = 20;
  const packageView = createFutureHarnessAdapter({ id: 'native', stallCoverage: stallCoverageFixture('native'), artifact: digest('native-artifact'),
    platform: 'darwin-arm64', conformance: conformance.id, machine: 'machine-a', driver, handles, evidence,
    context: f.owner.c, clock: () => now, generation: () => 'generation:fixture' });
  expect(packageView).toMatchObject({ owner: 'part-thirteen', family: 'session-harness', handles, evidence });
  expect(packageView.adapter.describe()).toMatchObject({ contextModes: ['advisory'], interruptionModes: [] });
  expect(driverCalls).toBe(0);
  now = 10_001;
  expect(() => packageView.adapter.describe()).toThrow('adapter conformance does not pass');
  expect(driverCalls).toBe(0);
});

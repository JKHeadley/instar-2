import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import { createFutureHarnessAdapter } from '../../src/harness-adapters/adapter.js';
import { correlatedRecoveryProgress } from '../../src/harness-adapters/regression-boundaries.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
import type { HarnessRuntimeEvent } from '../../src/harness-adapters/contracts.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';
import { decodedHandle, digest, harnessFixture, witnessedEvent } from '../harness-adapters/fixture.js';
import { setup as runGraphFixture } from '../rungraph/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';

function exactSubject(event: HarnessRuntimeEvent): string {
  return consumeResult(canonical([event.harness, event.artifactDigest, event.platform, event.machine,
    event.launch, event.run, event.step, event.input, event.incarnation, event.processIdentity]), {
    Success: encoded => encoded.bytes,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

function resumeOwner(event: HarnessRuntimeEvent, holder: 'part-thirteen:resume-compatible' | 'part-thirteen:transcript-poison') {
  const f = verificationRuntimeFixture();
  f.setGeneration('generation:fixture');
  f.time(event.observedAt);
  const plan = { ...verificationInput('VerificationPlan'), id: `plan:${holder.split(':').at(-1)}`,
    subject: { ...verificationInput('VerificationPlan').subject, holder, governed: exactSubject(event),
      generation: 'generation:fixture' } };
  value(f.runtime.record('VerificationPlan', plan));
  const planFact = value(f.runtime.inspect())[0]!.fact.id;
  const rawProbe = { ...verificationInput('ProbeRecord'), id: `probe:${plan.id}`, predecessors: [planFact],
    plan: plan.id, planVersion: plan.bar.version, subject: plan.subject.governed };
  const probe = value(decodeProbeRecord(rawProbe, f.c));
  const witness = f.witnessFor(probe, `evidence:${probe.id}`);
  f.setEvidence([...f.host.current().evidence, witness]);
  value(f.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
  return f.runtime;
}

it('A2-INTEGRATION P13-NF-31 P13-NF-38 P13-NF-46 real Part Five state is required before correlated holder recovery progresses', () => {
  const run = runGraphFixture();
  const ready = value(run.graph.open(run.run));
  const grounding = value(run.graph.ground(run.id, 'w', 'h', 'start', run.lease));
  const running = value(run.graph.transition(run.start(ready, grounding)));
  const assembly = harnessFixture();
  value(assembly.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'launch:work', harness: 'native', artifactDigest: digest('native-artifact'),
    run: run.id, step: running.pending[0]!.id }));
  const process = decodedHandle(assembly, { launch: 'launch:work', run: run.id, step: running.pending[0]!.id });
  const handles = createRuntimeHandleHolder({ adapter: process.harness, machine: process.machine,
    maxHandles: 2, maxAttempts: 4, context: assembly.owner.c,
    state: createMemoryHarnessAdapterStateStore('a2:work:handles'), admission: assembly.port });
  handles.put(process);
  const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: digest('native-artifact'),
    platform: 'darwin-arm64', machine: 'machine-a', maxEvents: 8, maxCaptureBytes: 64,
    context: assembly.owner.c, state: createMemoryHarnessAdapterStateStore('a2:work:evidence'), admission: assembly.port,
    owners: { handles, current: assembly.owner.host, work: run.graph } });
  const transition = witnessedEvent(assembly, 'work-transition', {
    launch: 'launch:work', predecessor: running.pending[0]!.expected, run: run.id, step: running.pending[0]!.id,
    workSubject: running.pending[0]!.id, workPhase: running.state,
    operation: running.pending[0]!.operation.key,
  });
  const admitted = evidence.admit(transition);
  expect(admitted, admitted.reason).toMatchObject({ disposition: 'recorded', progress: true });
  expect(correlatedRecoveryProgress(process.processIdentity,
    [{ worker: process.processIdentity, before: 1, after: 2 }], { holder: evidence, handle: process, now: 20 }))
    .toMatchObject({ state: 'progressed' });
});

it('A2-INTEGRATION REVIEW-F8 P13-NF-51 literal diagnostics grant nothing; a real current Part Nine posture owns resume', () => {
  const f = harnessFixture();
  f.owner.time(20);
  const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 2,
    maxAttempts: 4, context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:resume:handles'), admission: f.port });
  const handle = decodedHandle(f);
  handles.put(handle);
  const diagnostic = witnessedEvent(f, 'diagnostic', { id: 'diagnostic:resume',
    diagnosticCode: 'resume-compatible:plan:resume-compatible' });
  const noOwner = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:resume:none'), admission: f.port,
    owners: { handles, current: f.owner.host } });
  noOwner.admit(diagnostic);
  expect(noOwner.resume(handle, 20).state).toBe('unknown');

  const verification = resumeOwner(diagnostic, 'part-thirteen:resume-compatible');
  const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:resume:owned'), admission: f.port,
    owners: { handles, current: f.owner.host, verification } });
  evidence.admit(diagnostic);
  expect(evidence.resume(handle, 20)).toMatchObject({ state: 'eligible', event: diagnostic.id });

  const poisoned = harnessFixture();
  poisoned.owner.time(20);
  const poisonHandles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 2,
    maxAttempts: 4, context: poisoned.owner.c,
    state: createMemoryHarnessAdapterStateStore('a2:resume:poison-handles'), admission: poisoned.port });
  const poisonHandle = decodedHandle(poisoned);
  poisonHandles.put(poisonHandle);
  const poison = witnessedEvent(poisoned, 'diagnostic', { id: 'diagnostic:poison',
    diagnosticCode: 'transcript-poison:plan:transcript-poison' });
  const poisonEvidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: poisonHandle.artifactDigest,
    platform: poisonHandle.platform, machine: poisonHandle.machine, maxEvents: 8, maxCaptureBytes: 64,
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
  const handle = decodedHandle(f, { launch: 'launch:reconnect', incarnation: fence.incarnation });
  handles.put(handle);
  const diagnostic = witnessedEvent(f, 'diagnostic', { id: 'diagnostic:reconnect', launch: handle.launch,
    incarnation: fence.incarnation,
    diagnosticCode: 'resume-compatible:plan:resume-compatible' });
  const verification = resumeOwner(diagnostic, 'part-thirteen:resume-compatible');
  const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, maxEvents: 8, maxCaptureBytes: 64,
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

it('A2-INTEGRATION P13-NF-03 P13-NF-08 the shared adapter composes real Eight, Ten, admission, handle, and evidence ports', () => {
  const f = harnessFixture();
  const contract = value(f.owner.runtime.record('AdapterEvidenceContract', {
    ...assemblyInput('AdapterEvidenceContract'), id: 'contract:a2-native', adapter: 'native',
    artifact: digest('native-artifact'),
  }));
  const conformance = value(f.owner.runtime.record('AdapterConformance', {
    ...assemblyInput('AdapterConformance'), id: 'conformance:a2-native', contract: contract.id,
    adapter: 'native', artifact: digest('native-artifact'), platform: 'darwin-arm64', mode: 'advisory',
  }));
  const spec = value(f.owner.runtime.record('HarnessLaunchSpec', {
    ...assemblyInput('HarnessLaunchSpec'), id: 'launch:a2-adapter', harness: 'native',
    artifactDigest: digest('native-artifact'), consumptionMode: 'advisory', run: 'run:a2-adapter',
    step: 'step:a2-adapter', incarnation: 'incarnation:a2-adapter',
  }));
  const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 2,
    maxAttempts: 8, context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:adapter:handles'),
    admission: f.port });
  const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: digest('native-artifact'),
    platform: 'darwin-arm64', machine: 'machine-a', maxEvents: 8, maxCaptureBytes: 64,
    context: f.owner.c, state: createMemoryHarnessAdapterStateStore('a2:adapter:evidence'), admission: f.port,
    owners: { handles, current: f.owner.host } });
  let launches = 0;
  const driver = Object.freeze({ owner: 'part-eight' as const,
    launch: () => { launches++; return f.owner.success('pid:a2'); },
    deliver: () => f.owner.success('accepted:a2'),
    observe: () => f.owner.success({ phase: 'uncertain' as const, evidence: 'observation:a2', detail: 'pending' }),
  });
  const packageView = createFutureHarnessAdapter({ id: 'native', artifact: digest('native-artifact'),
    platform: 'darwin-arm64', conformance: conformance.id, machine: 'machine-a', driver, handles, evidence,
    context: f.owner.c, clock: () => 20, generation: () => 'generation:fixture' });
  expect(packageView).toMatchObject({ owner: 'part-thirteen', family: 'session-harness', handles, evidence });
  expect(packageView.adapter.describe()).toMatchObject({ contextModes: ['advisory'], interruptionModes: [] });
  expect(value(packageView.adapter.launch(spec, spec.processOperation, 'claim:a2'))).toMatchObject({ phase: 'launched' });
  expect(launches).toBe(1);
  expect(value(packageView.adapter.launch(spec, spec.processOperation, 'claim:a2'))).toMatchObject({ phase: 'uncertain' });
  expect(launches).toBe(1);
});

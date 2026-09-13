import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createHarnessEvidenceHolder, createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder, sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import type { HarnessRuntimeEvent } from '../../src/harness-adapters/contracts.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { value } from '../facts/fixtures.js';
import { decodedHandle, digest, harnessFixture, witnessedEvent } from '../harness-adapters/fixture.js';
import { transportFixture } from '../transport/fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';

function subject(event: HarnessRuntimeEvent): string {
  return consumeResult(canonical([event.harness, event.artifactDigest, event.platform, event.machine,
    event.launch, event.run, event.step, event.input, event.incarnation, event.processIdentity]), {
    Success: row => row.bytes,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

function confirm(runtime: ReturnType<typeof verificationRuntimeFixture>, event: HarnessRuntimeEvent,
  purpose: 'resume-compatible' | 'transcript-poison', at: number): void {
  runtime.time(at);
  const base = verificationInput('VerificationPlan');
  const plan = { ...base, id: `plan:${purpose}`,
    subject: { ...base.subject, holder: `part-thirteen:${purpose}`, governed: subject(event),
      scope: 'conversation:1', generation: 'generation:fixture' },
    arms: [{ ...base.arms[0]!, id: purpose, executable: `harness.${purpose}`,
      fixture: purpose === 'resume-compatible' ? 'P13-NF-38' : 'P13-NF-51' }],
    bar: { ...base.bar, sources: ['runtime-conversation'] },
    consumers: [{ ...base.consumers[0]!, id: `part-thirteen:${purpose}` }] };
  value(runtime.runtime.record('VerificationPlan', plan));
  const fact = value(runtime.runtime.inspectCurrent()).find(row => row.record.id === plan.id)!.fact.id;
  const probe = value(decodeProbeRecord({ ...verificationInput('ProbeRecord'), id: `probe:${purpose}`,
    predecessors: [fact], plan: plan.id, planVersion: plan.bar.version, arm: purpose,
    subject: plan.subject.governed }, runtime.c));
  const witness = runtime.witnessFor(probe, `evidence:${purpose}`);
  runtime.setEvidence([...runtime.host.current().evidence, witness]);
  value(runtime.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
}

it('A2-INTEGRATION R4-F01 P13-NF-25 P13-NF-29 P13-NF-33 P13-NF-38 omitted current failure or exit refuses same-machine reconnect', () => {
  for (const kind of ['probe-failed', 'process-exited'] as const) {
    for (const custody of ['omitted', 'capacity'] as const) {
      const ten = harnessFixture();
      ten.owner.time(20);
      const six = transportFixture();
      const fence = value(six.api.acquire(`r4:${kind}:${custody}:acquire`, '', 500));
      const spec = value(ten.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
        id: `launch:r4:${kind}:${custody}`, run: `run:r4:${kind}:${custody}`,
        step: `step:r4:${kind}:${custody}`, artifactDigest: digest('native-artifact'),
        incarnation: fence.incarnation }));
      const handle = decodedHandle(ten, { launch: spec.id, run: spec.run, step: spec.step,
        incarnation: fence.incarnation });
      const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 2,
        maxAttempts: 4, context: ten.owner.c,
        state: createMemoryHarnessAdapterStateStore(`r4:${kind}:${custody}:handles`), admission: ten.port });
      handles.put(handle);
      const compatible = witnessedEvent(ten, 'diagnostic', { id: `r4:${kind}:${custody}:compatible`,
        sourceEvidence: [`owner:r4:${kind}:${custody}:compatible`], launch: handle.launch, run: handle.run,
        step: handle.step, incarnation: handle.incarnation,
        diagnosticCode: 'resume-compatible:plan:resume-compatible' });
      const nine = verificationRuntimeFixture();
      nine.setGeneration('generation:fixture');
      confirm(nine, compatible, 'resume-compatible', 20);
      const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
        platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 2,
        maxCaptureBytes: 1024, context: ten.owner.c,
        state: createMemoryHarnessAdapterStateStore(`r4:${kind}:${custody}:events`), admission: ten.port,
        owners: { handles, current: ten.owner.host, verification: nine.runtime } });
      evidence.admit(compatible);
      evidence.admit(witnessedEvent(ten, 'heartbeat', { id: `r4:${kind}:${custody}:live`,
        sourceEvidence: [`owner:r4:${kind}:${custody}:live`], launch: handle.launch, run: handle.run,
        step: handle.step, incarnation: handle.incarnation }));
      const later = witnessedEvent(ten, kind, { id: `r4:${kind}:${custody}:later`,
        sourceEvidence: [`owner:r4:${kind}:${custody}:later`], launch: handle.launch, run: handle.run,
        step: handle.step, incarnation: handle.incarnation, sourceClock: 21, observedAt: 21 });
      if (custody === 'capacity') expect(evidence.admit(later)).toMatchObject({ disposition: 'refused' });
      ten.owner.time(22);
      nine.time(22);
      expect(evidence.resume(handle, 22)).toMatchObject({ state: 'unknown' });
      expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine,
        incarnation: handle.incarnation, fence, now: 22, evidence, authority: six.api }, handles))
        .toMatchObject({ disposition: 'refused', handle: null });
    }
  }
});

it('A2-INTEGRATION R4-F03 P13-NF-28 P13-NF-38 P13-NF-51 omitted owner-confirmed poison outranks retained compatibility', () => {
  for (const custody of ['omitted', 'capacity'] as const) {
    const ten = harnessFixture();
    ten.owner.time(20);
    const six = transportFixture();
    const fence = value(six.api.acquire(`r4:poison:${custody}:acquire`, '', 500));
    const spec = value(ten.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
      id: `launch:r4:poison:${custody}`, artifactDigest: digest('native-artifact'),
      incarnation: fence.incarnation }));
    const handle = decodedHandle(ten, { launch: spec.id, incarnation: fence.incarnation });
    const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 2,
      maxAttempts: 4, context: ten.owner.c,
      state: createMemoryHarnessAdapterStateStore(`r4:poison:${custody}:handles`), admission: ten.port });
    handles.put(handle);
    const nine = verificationRuntimeFixture();
    nine.setGeneration('generation:fixture');
    const compatible = witnessedEvent(ten, 'diagnostic', { id: `r4:poison:${custody}:compatible`,
      sourceEvidence: [`owner:r4:poison:${custody}:compatible`], launch: handle.launch,
      incarnation: handle.incarnation, diagnosticCode: 'resume-compatible:plan:resume-compatible' });
    confirm(nine, compatible, 'resume-compatible', 20);
    const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
      platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 2,
      maxCaptureBytes: 1024, context: ten.owner.c,
      state: createMemoryHarnessAdapterStateStore(`r4:poison:${custody}:events`), admission: ten.port,
      owners: { handles, current: ten.owner.host, verification: nine.runtime } });
    evidence.admit(compatible);
    evidence.admit(witnessedEvent(ten, 'heartbeat', { id: `r4:poison:${custody}:live`,
      sourceEvidence: [`owner:r4:poison:${custody}:live`], launch: handle.launch,
      incarnation: handle.incarnation }));
    ten.owner.time(21);
    const poison = witnessedEvent(ten, 'diagnostic', { id: `r4:poison:${custody}:later`,
      sourceEvidence: [`owner:r4:poison:${custody}:later`], launch: handle.launch,
      incarnation: handle.incarnation, sourceClock: 21, observedAt: 21,
      diagnosticCode: 'transcript-poison:plan:transcript-poison' });
    confirm(nine, poison, 'transcript-poison', 21);
    if (custody === 'capacity') expect(evidence.admit(poison)).toMatchObject({ disposition: 'refused' });
    ten.owner.time(22);
    nine.time(22);
    expect(evidence.resume(handle, 22)).toMatchObject({ state: 'poisoned', event: poison.sourceEvidence[0] });
    expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine,
      incarnation: handle.incarnation, fence, now: 22, evidence, authority: six.api }, handles))
      .toMatchObject({ disposition: 'refused', handle: null });
  }
});

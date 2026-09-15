import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import type { HarnessRuntimeEvent } from '../../src/harness-adapters/contracts.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { value } from '../facts/fixtures.js';
import { digest, harnessFixture, witnessedEvent } from '../harness-adapters/fixture.js';
import { signedHandle } from '../harness-adapters/a2-fixture.js';
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

function confirm(runtime: ReturnType<typeof verificationRuntimeFixture>, event: HarnessRuntimeEvent,
  purpose: 'resume-compatible' | 'transcript-poison', at: number): void {
  runtime.time(at);
  const base = verificationInput('VerificationPlan');
  const plan = { ...base, id: `r5:plan:${purpose}`,
    subject: { ...base.subject, holder: `part-thirteen:${purpose}`, governed: exactSubject(event),
      scope: 'conversation:1', generation: 'generation:fixture' },
    arms: [{ ...base.arms[0]!, id: purpose, executable: `harness.${purpose}`,
      fixture: purpose === 'resume-compatible' ? 'P13-NF-38' : 'P13-NF-51' }],
    bar: { ...base.bar, sources: ['runtime-conversation'] },
    consumers: [{ ...base.consumers[0]!, id: `part-thirteen:${purpose}` }] };
  value(runtime.runtime.record('VerificationPlan', plan));
  const fact = value(runtime.runtime.inspectCurrent()).find(row => row.record.id === plan.id)!.fact.id;
  const probe = value(decodeProbeRecord({ ...verificationInput('ProbeRecord'), id: `r5:probe:${purpose}`,
    predecessors: [fact], plan: plan.id, planVersion: plan.bar.version, arm: purpose,
    subject: plan.subject.governed }, runtime.c));
  const witness = runtime.witnessFor(probe, `r5:evidence:${purpose}`);
  runtime.setEvidence([...runtime.host.current().evidence, witness]);
  value(runtime.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
}

it('A2-INTEGRATION R5-F03 P13-NF-28 P13-NF-38 P13-NF-51 outstanding Nine-confirmed poison outranks newer compatibility', () => {
  for (const custody of ['control', 'recorded', 'omitted'] as const) {
    const ten = harnessFixture();
    ten.owner.time(20);
    const six = transportFixture();
    const fence = value(six.api.acquire(`r5:poison:${custody}:acquire`, '', 500));
    const spec = value(ten.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
      id: `launch:r5:poison:${custody}`, artifactDigest: digest('native-artifact'),
      incarnation: fence.incarnation }));
    const handle = signedHandle(ten, { launch: spec.id, incarnation: fence.incarnation });
    const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
      maxHandles: 4, maxAttempts: 8, context: ten.owner.c,
      state: createMemoryHarnessAdapterStateStore(`r5:poison:${custody}:handles`), admission: ten.port });
    handles.put(handle);
    const nine = verificationRuntimeFixture();
    nine.setGeneration('generation:fixture');
    const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
      platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
      maxCaptureBytes: 100, context: ten.owner.c,
      state: createMemoryHarnessAdapterStateStore(`r5:poison:${custody}:events`), admission: ten.port,
      owners: { handles, current: ten.owner.host, verification: nine.runtime } });
    evidence.admit(witnessedEvent(ten, 'heartbeat', { id: `r5:poison:${custody}:live`,
      sourceEvidence: [`r5:observation:${custody}:live`], launch: handle.launch,
      incarnation: handle.incarnation, streamState: 'closed' }));
    if (custody !== 'control') {
      ten.owner.time(21);
      const poison = witnessedEvent(ten, 'diagnostic', { id: `r5:event:${custody}:poison`,
        sourceEvidence: [`r5:observation:${custody}:poison`], launch: handle.launch,
        incarnation: handle.incarnation, sourceClock: 21, observedAt: 21,
        diagnosticCode: 'transcript-poison:r5:plan:transcript-poison' });
      confirm(nine, poison, 'transcript-poison', 21);
      if (custody === 'recorded') expect(evidence.admit(poison)).toMatchObject({ disposition: 'recorded' });
    }
    ten.owner.time(22);
    const compatible = witnessedEvent(ten, 'diagnostic', { id: `r5:event:${custody}:compatible`,
      sourceEvidence: [`r5:observation:${custody}:compatible`], launch: handle.launch,
      incarnation: handle.incarnation, sourceClock: 22, observedAt: 22,
      diagnosticCode: 'resume-compatible:r5:plan:resume-compatible' });
    confirm(nine, compatible, 'resume-compatible', 22);
    expect(evidence.admit(compatible)).toMatchObject({ disposition: 'recorded' });
    ten.owner.time(23);
    nine.time(23);
    expect(evidence.resume(handle, 23).state, custody)
      .toBe(custody === 'control' ? 'eligible' : 'poisoned');
    expect(sameMachineReconnectCandidate({ launch: handle.launch, machine: handle.machine,
      incarnation: handle.incarnation, fence, now: 23, evidence, authority: six.api }, handles).disposition, custody)
      .toBe(custody === 'control' ? 'reconnect' : 'refused');
  }
}, 15_000);

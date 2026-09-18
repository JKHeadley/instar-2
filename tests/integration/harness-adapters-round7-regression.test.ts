import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { decodeHarnessObservation } from '../../src/assembly/index.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import type { HarnessRuntimeEvent } from '../../src/harness-adapters/contracts.js';
import {
  compareHarnessAdapterRecords,
  decodeHarnessAdapterStateSnapshot,
  harnessAdapterIdentity,
} from '../../src/harness-adapters/index.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState, harnessAdapterFactDirectory } from '../../scripts/slice-p13-state-storage.mjs';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { p13A2Dispositions } from '../../scripts/check-p13-contract-map.mjs';
import { assemblyInput } from '../assembly/fixture.js';
import { value } from '../facts/fixtures.js';
import { signedHandle } from '../harness-adapters/a2-fixture.js';
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

function resumeCase(poisonMode: 'confirmed' | 'diagnostic' | 'plan-only' | 'none') {
  const ten = harnessFixture();
  ten.owner.time(20);
  const six = transportFixture();
  const fence = value(six.api.acquire(`r7:poison:${poisonMode}:acquire`, '', 500));
  const spec = value(ten.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: `r7:launch:poison:${poisonMode}`, artifactDigest: digest('native-artifact'),
    incarnation: fence.incarnation }));
  const handle = signedHandle(ten, { launch: spec.id, incarnation: fence.incarnation });
  const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
    maxHandles: 4, maxAttempts: 8, context: ten.owner.c,
    state: createMemoryHarnessAdapterStateStore(`r7:poison:${poisonMode}:handles`), admission: ten.port });
  handles.put(handle);
  const nine = verificationRuntimeFixture();
  nine.setGeneration('generation:fixture');
  nine.time(20);

  const confirm = (purpose: 'resume-compatible' | 'transcript-poison', at: number, includeProbe = true) => {
    const event = witnessedEvent(ten, 'diagnostic', { id: `r7:event:${purpose}`,
      sourceEvidence: [`r7:observation:${purpose}`], launch: handle.launch,
      incarnation: handle.incarnation, sourceClock: at, observedAt: at,
      diagnosticCode: `${purpose}:r7:plan:${purpose}` });
    const base = verificationInput('VerificationPlan');
    const plan = { ...base, id: `r7:plan:${purpose}`,
      subject: { ...base.subject, holder: `part-thirteen:${purpose}`, governed: exactSubject(event),
        scope: 'conversation:1', generation: 'generation:fixture' },
      arms: [{ ...base.arms[0]!, id: purpose, executable: `harness.${purpose}`,
        fixture: purpose === 'resume-compatible' ? 'P13-NF-38' : 'P13-NF-51' }],
      bar: { ...base.bar, sources: ['runtime-conversation'] },
      consumers: [{ ...base.consumers[0]!, id: `part-thirteen:${purpose}` }] };
    value(nine.runtime.record('VerificationPlan', plan));
    if (!includeProbe) return event;
    const fact = value(nine.runtime.inspectCurrent()).find(row => row.record.id === plan.id)!.fact.id;
    const probe = value(decodeProbeRecord({ ...verificationInput('ProbeRecord'), id: `r7:probe:${purpose}`,
      predecessors: [fact], plan: plan.id, planVersion: plan.bar.version, arm: purpose,
      subject: plan.subject.governed }, nine.c));
    const witness = nine.witnessFor(probe, `r7:evidence:${purpose}`);
    nine.setEvidence([...nine.host.current().evidence, witness]);
    value(nine.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
    return event;
  };

  const eventState = createMemoryHarnessAdapterStateStore(`r7:poison:${poisonMode}:events`);
  const reconstruct = () => createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
    maxCaptureBytes: 1024, context: ten.owner.c, state: eventState, admission: ten.port,
    owners: { handles, current: ten.owner.host, verification: nine.runtime } });
  const evidence = reconstruct();
  evidence.admit(witnessedEvent(ten, 'heartbeat', { id: 'r7:event:live',
    sourceEvidence: ['r7:observation:live'], launch: handle.launch, incarnation: handle.incarnation,
    sourceClock: 19, observedAt: 19, streamState: 'closed' }));
  const poison = poisonMode === 'confirmed' ? confirm('transcript-poison', 20)
    : poisonMode === 'plan-only' ? confirm('transcript-poison', 20, false)
      : poisonMode === 'diagnostic' ? witnessedEvent(ten, 'diagnostic', {
          id: 'r7:event:unconfirmed-poison', sourceEvidence: ['r7:observation:unconfirmed-poison'],
          launch: handle.launch, incarnation: handle.incarnation, sourceClock: 20, observedAt: 20,
          diagnosticCode: 'transcript-poison:r7:plan:never-existed',
        }) : null;
  if (poison) expect(evidence.admit(poison)).toMatchObject({ disposition: 'recorded' });
  const compatible = confirm('resume-compatible', 21);
  expect(evidence.admit(compatible)).toMatchObject({ disposition: 'recorded' });
  ten.owner.time(22);
  nine.time(22);
  return { ten, six, fence, handle, handles, nine, evidence, poison, reconstruct };
}

it('A2-INTEGRATION R7-A2-R5-02 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 poison conflict or Nine witness loss is unknown and never reconnect-eligible', () => {
  for (const loss of ['conflict', 'nine-witness'] as const) {
    const fixture = resumeCase('confirmed');
    expect(fixture.evidence.resume(fixture.handle, 22)).toMatchObject({ state: 'poisoned' });
    if (loss === 'conflict') {
      const row = take(fixture.ten.owner.c.history!.lookup(fixture.poison!.sourceEvidence[0]!))!;
      if (!row.record || row.record.type !== 'HarnessObservation') throw new Error('expected poison observation');
      value(fixture.ten.owner.spine.append(value(decodeHarnessObservation({ ...row.record,
        detail: `${row.record.detail}:conflict` }, { ...fixture.ten.owner.c, validateReferences: false }))));
    } else {
      fixture.nine.setEvidence(fixture.nine.host.current().evidence
        .filter(row => row.id !== 'r7:evidence:transcript-poison'));
    }
    expect(fixture.evidence.resume(fixture.handle, 22), loss).toMatchObject({ state: 'unknown' });
    expect(sameMachineReconnectCandidate({ launch: fixture.handle.launch, machine: fixture.handle.machine,
      incarnation: fixture.handle.incarnation, fence: fixture.fence, now: 22,
      evidence: fixture.evidence, authority: fixture.six.api }, fixture.handles), loss)
      .toMatchObject({ disposition: 'refused', handle: null });
  }

  const compatible = resumeCase('none');
  expect(compatible.evidence.resume(compatible.handle, 22)).toMatchObject({ state: 'eligible' });
  expect(sameMachineReconnectCandidate({ launch: compatible.handle.launch, machine: compatible.handle.machine,
    incarnation: compatible.handle.incarnation, fence: compatible.fence, now: 22,
    evidence: compatible.evidence, authority: compatible.six.api }, compatible.handles))
    .toMatchObject({ disposition: 'reconnect' });
}, 15_000);

it('A2-INTEGRATION A2-R6-03 P13-NF-38 P13-NF-51 an unconfirmed poison candidate yields to later owner-confirmed resume evidence', () => {
  for (const mode of ['diagnostic', 'plan-only'] as const) {
    const fixture = resumeCase(mode);
    for (const evidence of [fixture.evidence, fixture.reconstruct()]) {
      expect(evidence.resume(fixture.handle, 22), mode).toMatchObject({ state: 'eligible' });
      expect(sameMachineReconnectCandidate({ launch: fixture.handle.launch, machine: fixture.handle.machine,
        incarnation: fixture.handle.incarnation, fence: fixture.fence, now: 22,
        evidence, authority: fixture.six.api }, fixture.handles), mode)
        .toMatchObject({ disposition: 'reconnect' });
    }
  }

  const confirmed = resumeCase('confirmed');
  expect(confirmed.reconstruct().resume(confirmed.handle, 22)).toMatchObject({ state: 'poisoned' });
}, 15_000);

it('A2-INTEGRATION A2-R6-04 P13-NF-01 P13-NF-24 P13-NF-28 migrated journal identity remains writable through the Part Two fact store', () => {
  for (const format of ['v1-event', 'migrated-v2-event'] as const) {
    const fixture = harnessFixture();
    const handle = decodedHandle(fixture);
    const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
      maxHandles: 4, maxAttempts: 8, context: fixture.owner.c,
      state: createMemoryHarnessAdapterStateStore(`r8:migration:${format}:handles`), admission: fixture.port });
    expect(handles.put(handle)).toMatchObject({ disposition: 'stored' });
    const old = witnessedEvent(fixture, 'heartbeat', { id: `r8:migration:${format}:old`,
      sourceEvidence: [`r8:migration:${format}:old-owner`], sourceClock: 10, observedAt: 10, freshFor: 0 });
    const { sourceClock, observedAt: _observedAt, freshFor: _freshFor, ...eventV2 } = old;
    const legacy = { ...eventV2, schemaVersion: 1, at: sourceClock };
    const raw = { type: 'HarnessAdapterStateSnapshot', schemaVersion: 1,
      id: `state:r8:migration:${format}`, adapter: handle.harness, machine: handle.machine, revision: 0,
      maxHandles: 0, maxAttempts: 0, maxEvents: 32, maxCaptureBytes: 1024,
      handles: [], attempts: [], events: [format === 'v1-event' ? legacy : old] };
    const migrated = take(decodeHarnessAdapterStateSnapshot(raw, fixture.owner.c));
    expect(take(compareHarnessAdapterRecords('HarnessAdapterStateSnapshot', raw, migrated, fixture.owner.c)))
      .toMatchObject({ equal: true });

    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r8-migration-${format}-`));
    const path = join(directory, 'state.json');
    writeFileSync(path, JSON.stringify(raw));
    const state = createHarnessAdapterFileState(path);
    const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
      platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 32,
      maxCaptureBytes: 1024, context: fixture.owner.c, state, admission: fixture.port,
      owners: { handles, current: fixture.owner.host } });
    const next = witnessedEvent(fixture, 'heartbeat', { id: `r8:migration:${format}:new`,
      sourceEvidence: [`r8:migration:${format}:new-owner`], sourceClock: 20, observedAt: 20 });
    expect(evidence.admit(next)).toMatchObject({ disposition: 'recorded' });
    const retained = state.load();
    expect(retained).toMatchObject({ revision: 1, events: [{ schemaVersion: 2 }, { id: next.id }] });
    const facts = JSON.parse(readFileSync(join(harnessAdapterFactDirectory(path), 'facts.json'), 'utf8'));
    expect(facts).toHaveLength(2);
    expect(facts.at(-1).body.canonicalHash).toBe(harnessAdapterIdentity(retained).canonicalHash);
  }
}, 15_000);

it('A2-INTEGRATION R7-A2-R5-03 P13-NF-31 a later duplicate retains witnessed progress at capacity and after reconstruction', () => {
  let scenarios = 0;
  for (const capacity of [1, 8]) for (const duplicateClock of [20, 22]) {
    const run = runGraphFixture();
    const ready = value(run.graph.open(run.run));
    const grounding = value(run.graph.ground(run.id, 'w', 'h', 'start', run.lease));
    const running = value(run.graph.transition(run.start(ready, grounding)));
    const step = running.pending[0]!;
    const ten = harnessFixture();
    const spec = value(ten.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
      id: `r7:launch:duplicate:${capacity}:${duplicateClock}`, artifactDigest: digest('native-artifact'),
      run: run.id, step: step.id }));
    const handle = decodedHandle(ten, { launch: spec.id, run: run.id, step: step.id,
      inputDigest: spec.inputDigest, contextDigests: spec.contextManifest.map(row => row.digest) });
    const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
      maxHandles: 4, maxAttempts: 8, context: ten.owner.c,
      state: createMemoryHarnessAdapterStateStore(`r7:duplicate:${capacity}:${duplicateClock}:handles`),
      admission: ten.port });
    handles.put(handle);
    const eventState = createMemoryHarnessAdapterStateStore(`r7:duplicate:${capacity}:${duplicateClock}:events`);
    const holder = () => createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
      platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: capacity,
      maxCaptureBytes: 1024, context: ten.owner.c, state: eventState, admission: ten.port,
      owners: { handles, current: ten.owner.host, work: run.graph } });
    const evidence = holder();
    const transition = witnessedEvent(ten, 'work-transition', { id: 'r7:event:work',
      sourceEvidence: [`r7:observation:work:${capacity}:${duplicateClock}`], launch: spec.id,
      run: run.id, step: step.id, workSubject: step.id, predecessor: step.expected,
      workPhase: running.state, operation: step.operation.key });
    expect(evidence.admit(transition)).toMatchObject({ disposition: 'recorded', progress: true });
    ten.owner.time(21);
    expect(evidence.progress(handle, 21)).toMatchObject({ state: 'progressed' });
    const duplicate = witnessedEvent(ten, 'work-transition', { ...transition,
      id: 'r7:event:work-repeat', sourceEvidence: [`r7:observation:work-repeat:${capacity}:${duplicateClock}`],
      sourceClock: duplicateClock, observedAt: duplicateClock });
    expect(evidence.admit(duplicate)).toMatchObject({ disposition: 'duplicate', progress: false });
    ten.owner.time(23);
    expect(evidence.progress(handle, 23)).toMatchObject({ state: 'progressed' });
    expect(holder().progress(handle, 23)).toMatchObject({ state: 'progressed' });
    expect(evidence.events(handle.launch)).toMatchObject({ state: 'available', events: [expect.any(Object)] });
    scenarios++;
  }
  expect(scenarios).toBe(4);
}, 15_000);

it('A2-INTEGRATION R7-A2-R5-04 NF-46 qualifies its local work comparison under real Six admission and row-38/45 grounding dependencies', () => {
  const row = (p13A2Dispositions() as Array<{ number: number; heldArms?: string }>)
    .find(candidate => candidate.number === 46)!;
  expect(row.heldArms).not.toContain('NON-EXECUTABLE-UNTIL-row-83-run-admission-production');
  expect(row.heldArms).toContain('SEAM-LEDGER.md row 38');
  expect(row.heldArms).toContain('SEAM-LEDGER.md row 45');
});

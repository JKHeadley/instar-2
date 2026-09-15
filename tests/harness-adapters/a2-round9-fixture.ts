import { canonical } from '../../src/index.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
} from '../../src/harness-adapters/holder.js';
import type {
  HarnessAdapterStateSnapshot,
  HarnessRuntimeEvent,
} from '../../src/harness-adapters/contracts.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
import { assemblyInput } from '../assembly/fixture.js';
import { value } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { signedHandle } from './a2-fixture.js';
import { digest, harnessFixture, witnessedEvent } from './fixture.js';

export type Round9Nine = ReturnType<typeof verificationRuntimeFixture>;

export function round9PoisonPrefixFixture(input: Readonly<{
  confirmPoison?: boolean;
  eventState?: HarnessEvidenceStateStorePort;
}> = {}) {
  const ten = harnessFixture();
  ten.owner.time(22);
  const six = transportFixture();
  const fence = value(six.api.acquire('r9:poison:acquire', '', 500));
  const spec = value(ten.owner.runtime.record('HarnessLaunchSpec', {
    ...assemblyInput('HarnessLaunchSpec'),
    id: 'r9:launch:poison-prefix',
    artifactDigest: digest('native-artifact'),
    incarnation: fence.incarnation,
  }));
  const handle = signedHandle(ten, { launch: spec.id, incarnation: spec.incarnation });
  const handles = createRuntimeHandleHolder({
    adapter: handle.harness,
    machine: handle.machine,
    maxHandles: 4,
    maxAttempts: 8,
    context: ten.owner.c,
    state: createMemoryHarnessAdapterStateStore('r9:poison-prefix:handles'),
    admission: ten.port,
  });
  if (handles.put(handle).disposition !== 'stored') throw new Error('round-nine handle setup failed');

  let nine = verificationRuntimeFixture();
  nine.time(22);
  nine.setGeneration('generation:fixture');
  const eventState = input.eventState ?? createMemoryHarnessAdapterStateStore('r9:poison-prefix:events');
  const holder = (state: HarnessEvidenceStateStorePort = eventState, runtime: Round9Nine = nine) =>
    createHarnessEvidenceHolder({
      adapter: handle.harness,
      artifact: handle.artifactDigest,
      platform: handle.platform,
      machine: handle.machine,
      scope: 'conversation:1',
      maxEvents: 32,
      maxCaptureBytes: 1024,
      context: ten.owner.c,
      state,
      admission: ten.port,
      owners: { handles, current: ten.owner.host, verification: runtime.runtime },
    });
  const evidence = holder();
  evidence.admit(witnessedEvent(ten, 'heartbeat', {
    id: 'r9:event:live', sourceEvidence: ['r9:observation:live'], launch: handle.launch,
    incarnation: handle.incarnation, sourceClock: 19, observedAt: 19, streamState: 'closed',
  }));

  const record = (purpose: 'resume-compatible' | 'transcript-poison', at: number, probe = true) => {
    const event = witnessedEvent(ten, 'diagnostic', {
      id: `r9:event:${purpose}`,
      sourceEvidence: [`r9:observation:${purpose}`],
      launch: handle.launch,
      incarnation: handle.incarnation,
      sourceClock: at,
      observedAt: at,
      diagnosticCode: `${purpose}:r9:plan:${purpose}`,
    });
    const subject = value(canonical([event.harness, event.artifactDigest, event.platform, event.machine,
      event.launch, event.run, event.step, event.input, event.incarnation, event.processIdentity])).bytes;
    const base = verificationInput('VerificationPlan');
    const plan = {
      ...base,
      id: `r9:plan:${purpose}`,
      subject: { ...base.subject, holder: `part-thirteen:${purpose}`, governed: subject,
        scope: 'conversation:1', generation: 'generation:fixture' },
      arms: [{ ...base.arms[0]!, id: purpose, executable: `harness.${purpose}`,
        fixture: purpose === 'resume-compatible' ? 'P13-NF-38' : 'P13-NF-51' }],
      bar: { ...base.bar, sources: ['runtime-conversation'] },
      consumers: [{ ...base.consumers[0]!, id: `part-thirteen:${purpose}` }],
    };
    value(nine.runtime.record('VerificationPlan', plan));
    if (probe) {
      const fact = value(nine.runtime.inspectCurrent()).find(row => row.record.id === plan.id)!.fact.id;
      const decoded = value(decodeProbeRecord({
        ...verificationInput('ProbeRecord'),
        id: `r9:probe:${purpose}`,
        predecessors: [fact],
        plan: plan.id,
        planVersion: plan.bar.version,
        arm: purpose,
        subject,
      }, nine.c));
      const witness = nine.witnessFor(decoded, `r9:evidence:${purpose}`);
      nine.setEvidence([...nine.host.current().evidence, witness]);
      value(nine.runtime.record('ProbeRecord', { ...decoded, witnesses: [witness.id] }));
    }
    evidence.admit(event);
    return event;
  };

  const compatible = record('resume-compatible', 21);
  const poisonPrefixStart = nine.bytes.length;
  const poison = record('transcript-poison', 20, input.confirmPoison !== false);
  const fullNine = structuredClone(nine.bytes);
  const fullTen = structuredClone(ten.owner.raw);
  const probePrefix = structuredClone(fullNine.slice(0, -1));
  const planPrefix = structuredClone(fullNine.slice(0, poisonPrefixStart));
  const tenPrefix = structuredClone(fullTen.slice(0, -1));
  const nineEvidence = structuredClone(nine.host.current().evidence);

  const freshNine = (rows: readonly unknown[], evidenceRows = nineEvidence) => {
    const fresh = verificationRuntimeFixture();
    fresh.time(22);
    fresh.setGeneration('generation:fixture');
    fresh.setEvidence(evidenceRows as never);
    fresh.bytes.push(...structuredClone(rows));
    return fresh;
  };

  return {
    ten, six, fence, handle, handles, eventState, evidence, compatible, poison,
    fullNine, fullTen, probePrefix, planPrefix, tenPrefix, nineEvidence, holder, freshNine,
    setNine(runtime: Round9Nine) { nine = runtime; },
  };
}

export function withoutPoisonJournal(
  state: HarnessEvidenceStateStorePort,
  poison: HarnessRuntimeEvent,
): HarnessEvidenceStateStorePort {
  return Object.freeze({
    owner: 'part-thirteen' as const,
    id: `${state.id}:missing-poison-event`,
    load() {
      const snapshot = state.load() as HarnessAdapterStateSnapshot | null;
      return snapshot ? { ...snapshot, events: snapshot.events.filter(event => event.id !== poison.id) } : null;
    },
    save: (expected: Parameters<HarnessEvidenceStateStorePort['save']>[0],
      snapshot: Parameters<HarnessEvidenceStateStorePort['save']>[1]) => state.save(expected, snapshot),
    loadValidationFloors: () => state.loadValidationFloors(),
    appendValidationFloor: (floor: Parameters<HarnessEvidenceStateStorePort['appendValidationFloor']>[0]) =>
      state.appendValidationFloor(floor),
    loadPoisonCandidates: () => state.loadPoisonCandidates(),
    appendPoisonCandidate: (event: Parameters<HarnessEvidenceStateStorePort['appendPoisonCandidate']>[0]) =>
      state.appendPoisonCandidate(event),
  });
}

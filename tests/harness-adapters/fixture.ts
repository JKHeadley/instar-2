import type { Hash } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import type { HarnessLaunchSpec, NativeHarnessDriverPort } from '../../src/assembly/index.js';
import {
  createClaudeCodeHarnessAdapter,
  createCodexHarnessAdapter,
  createFutureHarnessAdapter,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
  decodeHarnessRuntimeEvent,
  decodeHarnessRuntimeHandle,
  harnessRuntimeEventWitness,
} from '../../src/harness-adapters/index.js';
import type { HarnessEvidenceOwnerPorts, HarnessRuntimeEvent, SessionHarnessAdapterInput } from '../../src/harness-adapters/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';

export const digest = (character: string): Hash => `sha256:${character.repeat(64)}` as Hash;
type CaptureRow = { hash: Hash; bytes: string; status: 'available'; byteLength: number };
const captures = new WeakMap<object, Record<string, CaptureRow>>();
const capturePorts = new WeakMap<object, NonNullable<HarnessEvidenceOwnerPorts['captures']>>();
const handlePorts = new WeakMap<object, NonNullable<HarnessEvidenceOwnerPorts['handles']>>();

export function evidenceOwners(f: ReturnType<typeof assemblyRuntimeFixture>, work?: HarnessEvidenceOwnerPorts['work'],
  suppliedHandles?: HarnessEvidenceOwnerPorts['handles']): HarnessEvidenceOwnerPorts {
  let retained = captures.get(f);
  if (!retained) { retained = {}; captures.set(f, retained); }
  let port = capturePorts.get(f);
  if (!port) {
    port = Object.freeze({ owner: 'part-two' as const, read: (reference: string) => f.success(retained?.[reference] ?? null) });
    capturePorts.set(f, port);
  }
  let handles = suppliedHandles ?? handlePorts.get(f);
  if (!handles) {
    const stored = createRuntimeHandleHolder({ adapter: 'adapter:claude-code', machine: 'machine-a', maxHandles: 8,
      maxAttempts: 8, context: f.c, state: createMemoryHarnessAdapterStateStore('fixture:evidence-handles') });
    stored.put(decodedHandle(f));
    handles = stored;
    handlePorts.set(f, handles);
  }
  return { captures: port, handles, ...(work ? { work } : {}) };
}

export function removeCapture(f: ReturnType<typeof assemblyRuntimeFixture>, reference: string): void {
  delete captures.get(f)?.[reference];
}

export function setCapture(f: ReturnType<typeof assemblyRuntimeFixture>, reference: string, row: CaptureRow): void {
  let retained = captures.get(f);
  if (!retained) { retained = {}; captures.set(f, retained); }
  retained[reference] = row;
}

export function handleInput(overrides: Record<string, unknown> = {}) {
  return {
    type: 'HarnessRuntimeHandle', schemaVersion: 1, id: 'handle:1', harness: 'adapter:claude-code',
    artifactDigest: digest('4'), platform: 'claude-code', machine: 'machine-a', launch: 'launch:1',
    run: 'run:1', step: 'step:1', input: 'intake:1', inputDigest: digest('a'), incarnation: 'incarnation:1',
    processIdentity: 'process:1', launchOperation: 'operation:launch', launchClaim: 'claim:launch', acquiredAt: 10,
    contextDigests: [digest('9')], dependencyFacts: [], ...overrides,
  };
}

export function eventInput(kind: HarnessRuntimeEvent['kind'], overrides: Record<string, unknown> = {}) {
  const output = kind === 'output-chunk'
    ? { start: 0, end: 4, byteCount: 4, digest: hashBytes('data'), captureReference: 'capture:event:1', truncated: false }
    : null;
  return {
    type: 'HarnessRuntimeEvent', schemaVersion: 2, id: `event:${kind}`, harness: 'adapter:claude-code',
    artifactDigest: digest('4'), platform: 'claude-code', machine: 'machine-a', launch: 'launch:1',
    run: 'run:1', step: 'step:1', input: 'intake:1', incarnation: 'incarnation:1', processIdentity: 'process:1',
    operation: 'operation:1', kind, sourceClock: 10, observedAt: 10, freshFor: 20, sourceEvidence: ['check-run:context'],
    predecessor: kind === 'work-transition' ? 'check:unit' : '', workSubject: kind === 'work-transition' ? 'check:integration' : '',
    workPhase: kind === 'work-transition' ? 'submitted' : '', output, streamState: kind === 'turn-closed' ? 'closed' : 'unknown',
    childrenState: kind === 'turn-closed' ? 'none' : 'unknown', unresolvedOperations: [],
    exitStatus: kind === 'process-exited' ? 0 : null, diagnosticCode: '', ...overrides,
  };
}

export function adapterFixture(platform: 'claude-code' | 'codex' | 'future' = 'claude-code') {
  const f = assemblyRuntimeFixture();
  const id = `adapter:${platform}`;
  const runtimePlatform = platform === 'future' ? 'future-runtime' : platform;
  const conformance = value(f.runtime.record('AdapterConformance', {
    ...assemblyInput('AdapterConformance'), id: `conformance:${platform}`,
    adapter: id, artifact: digest('4'), platform: runtimePlatform, mode: 'advisory',
    limitations: ['governed mode held at named owner seams'],
  }));
  const spec = value(f.runtime.record('HarnessLaunchSpec', {
    ...assemblyInput('HarnessLaunchSpec'), id: 'launch:1', harness: id,
    artifactDigest: digest('4'), machine: 'machine-a', incarnation: 'incarnation:1',
    consumptionMode: 'advisory',
  })) as HarnessLaunchSpec;
  let phase: 'output-observed' | 'context-consumed' = 'output-observed';
  let evidence = 'protocol:output:1';
  const calls = { launch: 0, deliver: 0, observe: 0 };
  const driver: NativeHarnessDriverPort = Object.freeze({
    owner: 'part-eight' as const,
    launch: () => f.success((calls.launch++, 'process:1')),
    deliver: () => f.success((calls.deliver++, 'protocol:input-accepted:1')),
    observe: () => f.success((calls.observe++, { phase, evidence, detail: 'structured runtime event' })),
  });
  const state = createMemoryHarnessAdapterStateStore(`state:${platform}`);
  const handles = createRuntimeHandleHolder({ adapter: id, machine: 'machine-a', maxHandles: 4, maxAttempts: 16, context: f.c, state });
  const shared: SessionHarnessAdapterInput = {
    id, artifact: digest('4'), conformance: conformance.id, machine: 'machine-a',
    platform: runtimePlatform,
    driver, handles, context: f.c, clock: () => 20 + calls.launch + calls.deliver + calls.observe,
    generation: () => 'generation:fixture',
  };
  const packageValue = platform === 'claude-code' ? createClaudeCodeHarnessAdapter(shared)
    : platform === 'codex' ? createCodexHarnessAdapter(shared)
      : createFutureHarnessAdapter(shared);
  return {
    f, id, spec, driver, handles, state, calls, package: packageValue,
    observeAs(nextPhase: typeof phase, nextEvidence: string) { phase = nextPhase; evidence = nextEvidence; },
  };
}

export function decodedHandle(f: ReturnType<typeof assemblyRuntimeFixture>, overrides: Record<string, unknown> = {}) {
  const handle = value(decodeHarnessRuntimeHandle(handleInput(overrides), f.c));
  if (handle.launch === 'launch:1') ensureLaunch(f, handle);
  return handle;
}

export function decodedEvent(f: ReturnType<typeof assemblyRuntimeFixture>, kind: HarnessRuntimeEvent['kind'], overrides: Record<string, unknown> = {}) {
  if (Object.hasOwn(overrides, 'sourceEvidence')) return value(decodeHarnessRuntimeEvent(eventInput(kind, overrides), f.c));
  const preliminary = value(decodeHarnessRuntimeEvent(eventInput(kind, { ...overrides, sourceEvidence: ['witness:pending'] }), f.c));
  ensureLaunch(f, preliminary);
  const witness = harnessRuntimeEventWitness(preliminary);
  const event = value(decodeHarnessRuntimeEvent({ ...preliminary, sourceEvidence: [witness] }, f.c));
  const phases: Readonly<Record<HarnessRuntimeEvent['kind'], 'launched' | 'input-accepted' | 'context-consumed' | 'output-observed' | 'pause-observed' | 'exit-observed' | 'uncertain'>> = {
    'process-started': 'launched', 'probe-live': 'launched', 'probe-failed': 'uncertain',
    'input-accepted': 'input-accepted', 'context-consumed': 'context-consumed', heartbeat: 'launched',
    'work-transition': 'output-observed', 'output-chunk': 'output-observed', 'turn-closed': 'output-observed',
    'process-exited': 'exit-observed', diagnostic: 'pause-observed',
  };
  const prior = value(f.c.history!.lookup(witness));
  if (!prior) value(f.runtime.record('HarnessObservation', {
    ...assemblyInput('HarnessObservation'), id: witness, launch: event.launch, run: event.run,
    step: event.step, input: event.input, incarnation: event.incarnation, phase: phases[event.kind],
    observedAt: event.sourceClock, freshFor: event.freshFor, boundaryEvidence: event.processIdentity, detail: witness,
  }));
  if (event.output) {
    setCapture(f, event.output.captureReference,
      { hash: event.output.digest, bytes: 'data', status: 'available', byteLength: event.output.byteCount });
  }
  return event;
}

function ensureLaunch(f: ReturnType<typeof assemblyRuntimeFixture>, subject: Readonly<{
  launch: string; harness: string; artifactDigest: Hash; machine: string; run: string; step: string; input: string; incarnation: string;
}>): void {
  const existing = value(f.c.history!.lookup(subject.launch));
  if (existing) return;
  value(f.runtime.record('HarnessLaunchSpec', {
    ...assemblyInput('HarnessLaunchSpec'), id: subject.launch, harness: subject.harness,
    artifactDigest: subject.artifactDigest, machine: subject.machine, run: subject.run, step: subject.step,
    input: subject.input, incarnation: subject.incarnation,
  }));
}

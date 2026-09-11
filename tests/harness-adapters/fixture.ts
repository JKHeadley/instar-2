import { consumeResult } from '../../src/index.js';
import type { Hash, Result } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import {
  createHarnessAdmissionPort,
  decodeHarnessRuntimeEvent,
  decodeHarnessRuntimeHandle,
  harnessRuntimeEventWitness,
} from '../../src/harness-adapters/index.js';
import type {
  HarnessOperationAttempt,
  HarnessRuntimeEvent,
  HarnessRuntimeEventKind,
  HarnessRuntimeHandle,
} from '../../src/harness-adapters/index.js';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';

export const digest = (text: string): Hash => hashBytes(text);

export function successful<T>(result: Result<T>): T {
  return consumeResult(result, {
    Success: row => row,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

export function handleInput(overrides: Partial<HarnessRuntimeHandle> = {}): object {
  return {
    type: 'HarnessRuntimeHandle', schemaVersion: 1, id: 'handle:1', harness: 'native',
    artifactDigest: digest('native-artifact'), platform: 'darwin-arm64', machine: 'machine-a',
    launch: 'launch:1', run: 'run:1', step: 'step:1', input: 'intake:1',
    inputDigest: digest('input'), incarnation: 'worker-incarnation:1', processIdentity: 'pid:1',
    launchOperation: 'operation:launch', launchClaim: 'claim:launch', acquiredAt: 10,
    contextDigests: [digest('context')], dependencyFacts: [], ...overrides,
  };
}

export function attemptInput(overrides: Partial<HarnessOperationAttempt> = {}): object {
  return {
    kind: 'launch', operation: 'operation:launch', launch: 'launch:1',
    incarnation: 'worker-incarnation:1', subjectDigest: digest('subject'),
    state: 'pending', evidence: '', attemptedAt: 10, observedAt: null, ...overrides,
  };
}

export function eventInput(kind: HarnessRuntimeEventKind = 'heartbeat',
  overrides: Partial<HarnessRuntimeEvent> = {}): object {
  const output = kind === 'output-chunk' ? {
    start: 0, end: 5, byteCount: 5, digest: digest('hello'),
    captureReference: 'capture:one', truncated: false,
  } : null;
  const work = kind === 'work-transition'
    ? { predecessor: 'work:0', workSubject: 'work:1', workPhase: 'running' }
    : { predecessor: '', workSubject: '', workPhase: '' };
  return {
    type: 'HarnessRuntimeEvent', schemaVersion: 2, id: `event:${kind}`, harness: 'native',
    artifactDigest: digest('native-artifact'), platform: 'darwin-arm64', machine: 'machine-a',
    launch: 'launch:1', run: 'run:1', step: 'step:1', input: 'intake:1',
    incarnation: 'worker-incarnation:1', processIdentity: 'pid:1', operation: `operation:${kind}`,
    kind, sourceClock: 20, observedAt: 20, freshFor: 100,
    sourceEvidence: [`observation:${kind}`], ...work, output,
    streamState: 'open', childrenState: 'none', unresolvedOperations: [],
    exitStatus: kind === 'process-exited' ? 0 : null,
    diagnosticCode: kind === 'diagnostic' ? 'diagnostic:fixture' : '', ...overrides,
  };
}

export function harnessFixture() {
  const owner = assemblyRuntimeFixture();
  value(owner.runtime.record('HarnessLaunchSpec', {
    ...assemblyInput('HarnessLaunchSpec'), id: 'launch:1', artifactDigest: digest('native-artifact'),
  }));
  const port = createHarnessAdmissionPort({
    adapter: 'native', artifact: digest('native-artifact'), platform: 'darwin-arm64',
    machine: 'machine-a', context: owner.c, current: owner.host,
  });
  return { owner, port };
}

export function decodedHandle(f = harnessFixture(), overrides: Partial<HarnessRuntimeHandle> = {}) {
  return value(decodeHarnessRuntimeHandle(handleInput(overrides), f.owner.c));
}

export function witnessedEvent(f: ReturnType<typeof harnessFixture>,
  kind: HarnessRuntimeEventKind = 'heartbeat', overrides: Partial<HarnessRuntimeEvent> = {},
  generation = 'generation:fixture'): HarnessRuntimeEvent {
  const preliminary = value(decodeHarnessRuntimeEvent(eventInput(kind, overrides), f.owner.c));
  const observation = value(decodeAssemblyRecord('HarnessObservation', {
    ...assemblyInput('HarnessObservation'), id: preliminary.sourceEvidence[0], launch: preliminary.launch,
    run: preliminary.run, step: preliminary.step, input: preliminary.input,
    incarnation: preliminary.incarnation, generation, phase: phaseFor(kind),
    observedAt: preliminary.sourceClock, freshFor: preliminary.freshFor,
    boundaryEvidence: preliminary.processIdentity, detail: harnessRuntimeEventWitness(preliminary),
  }, { ...f.owner.c, validateReferences: false }));
  value(f.owner.spine.append(observation));
  return preliminary;
}

function phaseFor(kind: HarnessRuntimeEventKind) {
  if (kind === 'input-accepted') return 'input-accepted' as const;
  if (kind === 'context-consumed') return 'context-consumed' as const;
  if (kind === 'process-exited') return 'exit-observed' as const;
  if (kind === 'probe-failed') return 'uncertain' as const;
  if (kind === 'diagnostic') return 'pause-observed' as const;
  if (kind === 'work-transition' || kind === 'output-chunk' || kind === 'turn-closed')
    return 'output-observed' as const;
  return 'launched' as const;
}

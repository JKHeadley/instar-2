import type { Hash } from '../../src/index.js';
import type { HarnessLaunchSpec, NativeHarnessDriverPort } from '../../src/assembly/index.js';
import {
  createClaudeCodeHarnessAdapter,
  createCodexHarnessAdapter,
  createFutureHarnessAdapter,
  createRuntimeHandleHolder,
  decodeHarnessRuntimeEvent,
  decodeHarnessRuntimeHandle,
} from '../../src/harness-adapters/index.js';
import type { HarnessRuntimeEvent, SessionHarnessAdapterInput } from '../../src/harness-adapters/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { value } from '../facts/fixtures.js';

export const digest = (character: string): Hash => `sha256:${character.repeat(64)}` as Hash;

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
    ? { start: 0, end: 4, byteCount: 4, digest: digest('b'), captureReference: 'capture:event:1', truncated: false }
    : null;
  return {
    type: 'HarnessRuntimeEvent', schemaVersion: 2, id: `event:${kind}`, harness: 'adapter:claude-code',
    artifactDigest: digest('4'), platform: 'claude-code', machine: 'machine-a', launch: 'launch:1',
    run: 'run:1', step: 'step:1', input: 'intake:1', incarnation: 'incarnation:1', processIdentity: 'process:1',
    operation: 'operation:1', kind, sourceClock: 10, observedAt: 10, freshFor: 20, sourceEvidence: ['protocol:event:1'],
    predecessor: kind === 'work-transition' ? 'work:before' : '', workSubject: kind === 'work-transition' ? 'model:attempt:1' : '',
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
  const handles = createRuntimeHandleHolder({ adapter: id, machine: 'machine-a', maxHandles: 4, context: f.c });
  const shared: Omit<SessionHarnessAdapterInput, 'platform'> = {
    id, artifact: digest('4'), conformance: conformance.id, machine: 'machine-a',
    driver, handles, context: f.c, clock: () => 20 + calls.launch + calls.deliver + calls.observe,
    generation: () => 'generation:fixture',
  };
  const packageValue = platform === 'claude-code' ? createClaudeCodeHarnessAdapter(shared)
    : platform === 'codex' ? createCodexHarnessAdapter(shared)
      : createFutureHarnessAdapter({ ...shared, platform: runtimePlatform });
  return {
    f, id, spec, driver, handles, calls, package: packageValue,
    observeAs(nextPhase: typeof phase, nextEvidence: string) { phase = nextPhase; evidence = nextEvidence; },
  };
}

export function decodedHandle(f: ReturnType<typeof assemblyRuntimeFixture>, overrides: Record<string, unknown> = {}) {
  return value(decodeHarnessRuntimeHandle(handleInput(overrides), f.c));
}

export function decodedEvent(f: ReturnType<typeof assemblyRuntimeFixture>, kind: HarnessRuntimeEvent['kind'], overrides: Record<string, unknown> = {}) {
  return value(decodeHarnessRuntimeEvent(eventInput(kind, overrides), f.c));
}

import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
} from '../../src/harness-adapters/holder.js';
import type {
  HarnessAdapterStateStorePort,
  HarnessEvidenceOwnerPorts,
} from '../../src/harness-adapters/holder.js';
import type { HarnessRuntimeHandle } from '../../src/harness-adapters/contracts.js';
import type { HarnessLaunchSpec } from '../../src/assembly/index.js';
import { value } from '../facts/fixtures.js';
import { decodedHandle, digest, harnessFixture } from './fixture.js';

type HarnessFixture = ReturnType<typeof harnessFixture>;

/** A2 decisions require the local handle to reproduce every launch-owned signed field. */
export function signedHandle(fixture: HarnessFixture = harnessFixture(),
  overrides: Partial<HarnessRuntimeHandle> = {}) {
  const reference = overrides.launch ?? 'launch:1';
  const row = value(fixture.owner.c.history!.lookup(reference));
  if (!row?.record || row.record.type !== 'HarnessLaunchSpec')
    throw new Error(`signed A2 handle fixture cannot resolve launch ${reference}`);
  const launch = row.record as HarnessLaunchSpec;
  return decodedHandle(fixture, {
    harness: launch.harness,
    artifactDigest: launch.artifactDigest,
    machine: launch.machine,
    launch: launch.id,
    run: launch.run,
    step: launch.step,
    input: launch.input,
    inputDigest: launch.inputDigest,
    incarnation: launch.incarnation,
    launchOperation: launch.processOperation,
    contextDigests: launch.contextManifest.map(entry => entry.digest),
    dependencyFacts: launch.dependencyFacts,
    ...overrides,
  });
}

export function a2Fixture(input: Readonly<{
  handleState?: HarnessAdapterStateStorePort;
  evidenceState?: HarnessAdapterStateStorePort;
  owners?: Partial<HarnessEvidenceOwnerPorts>;
}> = {}) {
  const base = harnessFixture();
  const handleState = input.handleState ?? createMemoryHarnessAdapterStateStore('a2:handles');
  const handles = createRuntimeHandleHolder({
    adapter: 'native', machine: 'machine-a', maxHandles: 4, maxAttempts: 8,
    context: base.owner.c, state: handleState, admission: base.port,
  });
  const handle = signedHandle(base);
  handles.put(handle);
  const evidenceState = input.evidenceState ?? createMemoryHarnessAdapterStateStore('a2:evidence');
  const evidence = createHarnessEvidenceHolder({
    adapter: 'native', artifact: digest('native-artifact'), platform: 'darwin-arm64',
    machine: 'machine-a', scope: 'conversation:1', maxEvents: 32, maxCaptureBytes: 1024,
    context: base.owner.c, state: evidenceState, admission: base.port,
    owners: { handles, current: base.owner.host, ...input.owners },
  });
  return { ...base, handleState, handles, handle, evidenceState, evidence };
}

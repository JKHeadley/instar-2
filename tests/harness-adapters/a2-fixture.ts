import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
} from '../../src/harness-adapters/holder.js';
import type {
  HarnessAdapterStateStorePort,
  HarnessEvidenceOwnerPorts,
} from '../../src/harness-adapters/holder.js';
import { decodedHandle, digest, harnessFixture } from './fixture.js';

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
  const handle = decodedHandle(base);
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

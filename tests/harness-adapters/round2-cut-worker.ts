import { appendFileSync } from 'node:fs';
import {
  createClaudeCodeHarnessAdapter,
  createHarnessEvidenceHolder,
  createRuntimeHandleHolder,
} from '../../src/harness-adapters/index.js';
import type { HarnessAdapterStateSnapshot, HarnessAdapterStateStorePort } from '../../src/harness-adapters/index.js';
import { value } from '../facts/fixtures.js';
import { adapterFixture, decodedEvent, evidenceOwners } from './fixture.js';
// @ts-expect-error The exact-byte filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';

const [mode, cut, directory] = process.argv.slice(2) as [string, string, string];
const trace = `${directory}/trace.jsonl`;
const note = (entry: object) => appendFileSync(trace, `${JSON.stringify({ mode, ...entry })}\n`);
const die = () => process.kill(process.pid, 'SIGKILL');
const fixture = adapterFixture();

function state(path: string, killRevision = -1): HarnessAdapterStateStorePort {
  const base = createHarnessAdapterFileState(path) as HarnessAdapterStateStorePort;
  return Object.freeze({ ...base,
    save(expected: Parameters<HarnessAdapterStateStorePort['save']>[0], snapshot: HarnessAdapterStateSnapshot) {
      base.save(expected, snapshot);
      if (mode === 'seed' && snapshot.revision === killRevision) die();
    },
  });
}

if (cut === 'after-progress') {
  const evidence = createHarnessEvidenceHolder({ adapter: fixture.id, machine: 'machine-a', maxEvents: 8,
    maxCaptureBytes: 32, context: fixture.f.c, state: state(`${directory}/evidence.json`, 1), owners: evidenceOwners(fixture.f) });
  const result = evidence.admit(decodedEvent(fixture.f, 'output-chunk'));
  note({ progressDisposition: result.disposition, progress: result.progress });
  if (mode === 'seed') die();
  process.exit(0);
}

const killRevision = cut === 'after-journal-before-driver' ? 1
  : cut === 'after-handle-before-finish' ? 2
    : cut === 'after-observed' ? 3 : -1;
const handles = createRuntimeHandleHolder({ adapter: fixture.id, machine: 'machine-a', maxHandles: 4, maxAttempts: 16,
  context: fixture.f.c, state: state(`${directory}/runtime.json`, killRevision) });
const driver = Object.freeze({
  ...fixture.driver,
  launch(input: Parameters<typeof fixture.driver.launch>[0]) {
    note({ driverCall: 'launch' });
    const result = fixture.driver.launch(input);
    if (mode === 'seed' && cut === 'after-driver-before-handle') die();
    return result;
  },
  deliver(input: Parameters<typeof fixture.driver.deliver>[0]) {
    note({ driverCall: 'deliver' });
    const result = fixture.driver.deliver(input);
    if (mode === 'seed' && cut === 'after-delivery') die();
    return result;
  },
});
const adapter = createClaudeCodeHarnessAdapter({ id: fixture.id, artifact: fixture.spec.artifactDigest,
  platform: 'claude-code', conformance: 'conformance:claude-code', machine: 'machine-a', driver, handles,
  context: fixture.f.c, clock: () => 50, generation: () => 'generation:fixture' }).adapter;
const launched = value(adapter.launch(fixture.spec, 'operation:launch', 'claim:launch'));
note({ launchPhase: launched.phase });

if (cut === 'after-delivery') {
  const delivered = value(adapter.deliver({ launch: fixture.spec.id, intake: fixture.spec.input,
    digest: fixture.spec.inputDigest, incarnation: fixture.spec.incarnation, operation: 'operation:deliver' }));
  note({ deliveryPhase: delivered.phase });
}
if (mode === 'seed') die();

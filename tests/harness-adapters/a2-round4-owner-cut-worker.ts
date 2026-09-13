import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHarnessEvidenceHolder, createRuntimeHandleHolder } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { attemptInput, decodedHandle, harnessFixture, witnessedEvent } from './fixture.js';

const [mode, cut, target, directory] = process.argv.slice(2);
const f = harnessFixture();
f.owner.time(20);
if (mode === 'recover') {
  f.owner.raw.splice(0, f.owner.raw.length,
    ...JSON.parse(fs.readFileSync(`${directory}/signed-owner-history.json`, 'utf8')) as unknown[]);
}
const handle = decodedHandle(f);
const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 4,
  maxAttempts: 8, context: f.owner.c, state: createHarnessAdapterFileState(`${directory}/handles.json`),
  admission: f.port });
const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
  platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 32,
  maxCaptureBytes: 1024, context: f.owner.c,
  state: createHarnessAdapterFileState(`${directory}/events.json`), admission: f.port,
  owners: { handles, current: f.owner.host } });

if (mode === 'seed') {
  handles.put(handle);
  const { state: _state, evidence: _evidence, observedAt: _observedAt, ...attempt } = attemptInput({
    kind: 'delivery', operation: 'delivery:r4:pending',
  }) as import('../../src/harness-adapters/contracts.js').HarnessOperationAttempt;
  handles.beginAttempt(attempt);
  evidence.admit(witnessedEvent(f, 'heartbeat', { id: 'r4:prior-live',
    sourceEvidence: ['owner:r4:prior-live'], sourceClock: 9, observedAt: 9,
    streamState: 'closed', childrenState: 'closed' }));
  evidence.admit(witnessedEvent(f, 'turn-closed', { id: 'r4:prior-close',
    sourceEvidence: ['owner:r4:prior-close'], sourceClock: 10, observedAt: 10,
    streamState: 'closed', childrenState: 'closed' }));
  const pending = witnessedEvent(f, target as 'heartbeat' | 'probe-failed' | 'process-exited', {
    id: `r4:pending:${target}`, sourceEvidence: [`owner:r4:pending:${target}`],
    sourceClock: 20, observedAt: 20, streamState: 'open', childrenState: 'pending',
    unresolvedOperations: ['delivery:r4:pending'],
  });
  fs.writeFileSync(`${directory}/signed-owner-history.json`, JSON.stringify(f.owner.raw));
  let sync = 0;
  const die = () => process.kill(process.pid, 'SIGKILL');
  for (const [method, label] of [['symlinkSync', 'lock'], ['writeFileSync', 'write'],
    ['renameSync', 'rename'], ['unlinkSync', 'unlink'], ['fsyncSync', 'fsync']] as const) {
    const original = fs[method] as (...args: never[]) => unknown;
    (fs[method] as unknown as (...args: never[]) => unknown) = (...args: never[]) => {
      const result = original(...args);
      const actual = label === 'fsync' ? `fsync:${++sync}` : label;
      if (actual === cut) die();
      return result;
    };
  }
  syncBuiltinESMExports();
  evidence.admit(pending);
} else {
  process.stdout.write(JSON.stringify({
    liveness: evidence.liveness(handle, 20), completion: evidence.completion(handle, 20),
    events: evidence.events(handle.launch).events.map(event => event.id),
  }));
}

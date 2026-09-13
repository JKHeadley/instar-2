import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHarnessEvidenceHolder, createRuntimeHandleHolder } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { harnessFixture, decodedHandle, witnessedEvent, attemptInput } from './fixture.js';

const [mode, directory] = process.argv.slice(2);
const f = harnessFixture();
f.owner.time(20);
if (mode === 'recover') {
  const frames = JSON.parse(fs.readFileSync(`${directory}/signed-owner-history.json`, 'utf8')) as unknown[];
  f.owner.raw.splice(0, f.owner.raw.length, ...frames);
}
const handle = decodedHandle(f);
const handles = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 4,
  maxAttempts: 8, context: f.owner.c, state: createHarnessAdapterFileState(`${directory}/handles.json`),
  admission: f.port });
const evidence = createHarnessEvidenceHolder({ adapter: 'native', artifact: handle.artifactDigest,
  platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 32,
  maxCaptureBytes: 1024, context: f.owner.c, state: createHarnessAdapterFileState(`${directory}/events.json`),
  admission: f.port, owners: { handles, current: f.owner.host } });

if (mode === 'seed') {
  handles.put(handle);
  const { state: _state, evidence: _receipt, observedAt: _observedAt, ...attempt } = attemptInput({
    kind: 'delivery', operation: 'delivery:pending',
  }) as import('../../src/harness-adapters/contracts.js').HarnessOperationAttempt;
  handles.beginAttempt(attempt as never);
  evidence.admit(witnessedEvent(f, 'turn-closed', { id: 'closure:ten', sourceClock: 10,
    observedAt: 10, streamState: 'closed', childrenState: 'closed' }));
  const pending = witnessedEvent(f, 'input-accepted', { id: 'pending:twenty', sourceClock: 20,
    observedAt: 20, unresolvedOperations: ['delivery:pending'], childrenState: 'pending' });
  fs.writeFileSync(`${directory}/signed-owner-history.json`, JSON.stringify(f.owner.raw));
  const original = fs.symlinkSync;
  fs.symlinkSync = (...args: Parameters<typeof fs.symlinkSync>) => {
    const result = original(...args);
    process.kill(process.pid, 'SIGKILL');
    return result;
  };
  syncBuiltinESMExports();
  evidence.admit(pending);
} else {
  const owner = f.owner.c.history!.lookup('observation:input-accepted');
  const completion = evidence.completion(handle, 20);
  process.stdout.write(JSON.stringify({ owner, completion, events: evidence.events(handle.launch).events.map(row => row.id) }));
}

import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHarnessEvidenceHolder, createRuntimeHandleHolder } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { decodedHandle, harnessFixture, witnessedEvent } from './fixture.js';

const [scenario, mode, cut, target, directory] = process.argv.slice(2);
const f = harnessFixture();
f.owner.time(20);
if (mode === 'recover') {
  f.owner.raw.splice(0, f.owner.raw.length,
    ...JSON.parse(fs.readFileSync(`${directory}/signed-owner-history.json`, 'utf8')) as unknown[]);
}
const handle = decodedHandle(f);
const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
  maxHandles: 4, maxAttempts: 8, context: f.owner.c,
  state: createHarnessAdapterFileState(`${directory}/handles.json`), admission: f.port });
const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
  platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 32,
  maxCaptureBytes: 1024, context: f.owner.c,
  state: createHarnessAdapterFileState(`${directory}/events.json`), admission: f.port,
  owners: { handles, current: f.owner.host } });

if (mode === 'seed') {
  handles.put(handle);
  let pending: ReturnType<typeof witnessedEvent>;
  if (scenario === 'frontier') {
    witnessedEvent(f, 'heartbeat', { id: `r5:frontier:${target}:live`,
      sourceEvidence: [`r5:owner:${target}:live`], sourceClock: 20, observedAt: 20,
      streamState: 'closed', childrenState: 'closed' });
    pending = witnessedEvent(f, target as 'probe-failed' | 'process-exited', {
      id: `r5:frontier:${target}:contrary`, sourceEvidence: [`r5:owner:${target}:contrary`],
      sourceClock: 20, observedAt: 20, streamState: 'closed', childrenState: 'closed' });
  } else {
    evidence.admit(witnessedEvent(f, 'turn-closed', { id: 'r5:unknown:closure',
      sourceEvidence: ['r5:owner:unknown:closure'], sourceClock: 10, observedAt: 10,
      streamState: 'closed', childrenState: 'closed' }));
    pending = witnessedEvent(f, 'heartbeat', { id: 'r5:unknown:later',
      sourceEvidence: ['r5:owner:unknown:later'], sourceClock: 20, observedAt: 20,
      streamState: 'unknown', childrenState: 'closed', unresolvedOperations: [] });
  }
  fs.writeFileSync(`${directory}/signed-owner-history.json`, JSON.stringify(f.owner.raw));
  let sync = 0;
  const die = () => process.kill(process.pid, 'SIGKILL');
  for (const [method, label] of [['mkdirSync', 'lock'], ['writeFileSync', 'write'],
    ['renameSync', 'rename'], ['rmdirSync', 'unlink'], ['fsyncSync', 'fsync']] as const) {
    const original = fs[method] as (...args: never[]) => unknown;
    (fs[method] as unknown as (...args: never[]) => unknown) = (...args: never[]) => {
      const result = original(...args);
      const actual = label === 'fsync' ? `fsync:${++sync}` : label;
      if (label === 'lock' && !String(args[0]).endsWith('append.lock')) return result;
      if (label === 'write' && typeof args[0] !== 'number') return result;
      if (actual === cut) die();
      if (label === 'unlink' && cut === 'fsync:3') die();
      return result;
    };
  }
  syncBuiltinESMExports();
  evidence.admit(pending);
} else {
  process.stdout.write(JSON.stringify({
    liveness: evidence.liveness(handle, 20),
    completion: evidence.completion(handle, 20),
    events: evidence.events(handle.launch).events.map(event => event.id),
  }));
}

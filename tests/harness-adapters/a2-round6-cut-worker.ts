import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { consumeResult } from '../../src/index.js';
import { decodeHarnessRuntimeEvent } from '../../src/harness-adapters/index.js';
import { createHarnessEvidenceHolder, createRuntimeHandleHolder } from '../../src/harness-adapters/holder.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { harnessFixture, witnessedEvent } from './fixture.js';
import { signedHandle } from './a2-fixture.js';

const [mode, scenario, historyKind, directory] = process.argv.slice(2);
const fixture = harnessFixture();
fixture.owner.time(21);
if (mode === 'recover') {
  fixture.owner.raw.splice(0, fixture.owner.raw.length,
    ...JSON.parse(fs.readFileSync(`${directory}/owner-${historyKind}.json`, 'utf8')) as unknown[]);
}
const handle = signedHandle(fixture);
const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
  maxHandles: 4, maxAttempts: 8, context: fixture.owner.c,
  state: createHarnessAdapterFileState(`${directory}/handles.json`), admission: fixture.port });
const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
  platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 32,
  maxCaptureBytes: 1024, context: fixture.owner.c,
  state: createHarnessAdapterFileState(`${directory}/events.json`), admission: fixture.port,
  owners: { handles, current: fixture.owner.host } });

if (mode === 'seed') {
  handles.put(handle);
  let later;
  if (scenario === 'fact-closure') {
    fs.writeFileSync(`${directory}/owner-older.json`, JSON.stringify(fixture.owner.raw));
    const recordAddressed = witnessedEvent(fixture, 'turn-closed', {
      id: 'r6:cut:fact-closure', sourceEvidence: ['r6:cut:owner:fact-closure'],
      sourceClock: 20, observedAt: 20, streamState: 'closed', childrenState: 'closed',
    });
    const row = consumeResult(fixture.owner.c.history!.lookup(recordAddressed.sourceEvidence[0]!), {
      Success: value => value,
      Refused: refusal => { throw new Error(refusal.detail); },
    });
    if (!row) throw new Error('fact-addressed cut requires its signed observation');
    later = consumeResult(decodeHarnessRuntimeEvent({ ...recordAddressed, sourceEvidence: [row.fact.id] }, fixture.owner.c), {
      Success: value => value,
      Refused: refusal => { throw new Error(refusal.detail); },
    });
  } else {
    evidence.admit(witnessedEvent(fixture, 'heartbeat', {
      id: `r6:cut:${scenario}:prior-live`, sourceEvidence: [`r6:cut:${scenario}:owner:prior-live`],
      sourceClock: 9, observedAt: 9, streamState: 'closed', childrenState: 'closed',
    }));
    evidence.admit(witnessedEvent(fixture, 'turn-closed', {
      id: `r6:cut:${scenario}:prior-close`, sourceEvidence: [`r6:cut:${scenario}:owner:prior-close`],
      sourceClock: 10, observedAt: 10, streamState: 'closed', childrenState: 'closed',
    }));
    fs.writeFileSync(`${directory}/owner-older.json`, JSON.stringify(fixture.owner.raw));
    later = witnessedEvent(fixture, scenario as 'input-accepted' | 'probe-failed' | 'process-exited', {
      id: `r6:cut:${scenario}:later`, sourceEvidence: [`r6:cut:${scenario}:owner:later`],
      sourceClock: 20, observedAt: 20, streamState: 'open', childrenState: 'pending',
      unresolvedOperations: ['operation:r6:cut:pending'],
    });
  }
  fs.writeFileSync(`${directory}/owner-full.json`, JSON.stringify(fixture.owner.raw));
  const ownerDescriptor = fs.openSync(`${directory}/owner-full.json`, 'r');
  fs.fsyncSync(ownerDescriptor);
  fs.closeSync(ownerDescriptor);

  let sync = 0;
  for (const [method, label] of [['symlinkSync', 'lock'], ['writeFileSync', 'write'],
    ['renameSync', 'rename'], ['unlinkSync', 'unlink'], ['fsyncSync', 'fsync']] as const) {
    const original = fs[method] as (...args: never[]) => unknown;
    (fs[method] as unknown as (...args: never[]) => unknown) = (...args: never[]) => {
      const result = original(...args);
      const boundary = label === 'fsync' ? `fsync:${++sync}` : label;
      if (boundary === 'fsync:3') process.kill(process.pid, 'SIGKILL');
      return result;
    };
  }
  syncBuiltinESMExports();
  evidence.admit(later);
} else {
  process.stdout.write(JSON.stringify({
    events: evidence.events(handle.launch).events.map(event => event.id),
    completion: evidence.completion(handle, 21),
    liveness: evidence.liveness(handle, 21),
  }));
}

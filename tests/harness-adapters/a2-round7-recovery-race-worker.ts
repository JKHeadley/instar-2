import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import { decodeHarnessAdapterStateSnapshot, harnessAdapterIdentity } from '../../src/harness-adapters/index.js';
import { createRuntimeHandleHolder } from '../../src/harness-adapters/holder.js';
import { value } from '../facts/fixtures.js';
import { attemptInput, harnessFixture } from './fixture.js';

const [role, directory, cut] = process.argv.slice(2);
const path = `${directory}/state.json`;
const fixture = harnessFixture();
const store = createHarnessAdapterFileState(path);

if (role === 'holder') {
  try {
    createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 0,
      maxAttempts: 4, context: fixture.owner.c, state: store, admission: fixture.port });
    process.stdout.write(JSON.stringify({ role, state: 'available' }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ role, state: 'unknown', reason: String(error) }));
  }
} else if (role === 'reader') {
  const observations = [];
  for (let read = 1; read <= 3; read++) {
    try {
      const snapshot = store.load();
      observations.push({ read, state: 'available', revision: snapshot?.revision });
    } catch (error) {
      observations.push({ read, state: 'unknown', reason: String(error) });
    }
  }
  process.stdout.write(JSON.stringify({ role, observations }));
} else {
  const current = value(decodeHarnessAdapterStateSnapshot(store.load(), fixture.owner.c));
  const expected = harnessAdapterIdentity(current).canonicalHash;
  const candidate = value(decodeHarnessAdapterStateSnapshot({ ...current, revision: current.revision + 1,
    attempts: [attemptInput({ operation: 'operation:cut' })] }, fixture.owner.c));

  if (role === 'boundary') {
    let opens = 0;
    let closes = 0;
    for (const [method, label] of [['mkdirSync', 'lock'], ['openSync', 'open'], ['writeFileSync', 'write'],
      ['fsyncSync', 'fsync'], ['closeSync', 'close'], ['renameSync', 'rename']] as const) {
      const original = fs[method] as (...args: never[]) => unknown;
      (fs[method] as unknown as (...args: never[]) => unknown) = (...args: never[]) => {
        const result = original(...args);
        const actual = label === 'open' ? `open:${++opens}` : label === 'close' ? `close:${++closes}`
          : label === 'fsync' ? `fsync:${opens}` : label;
        if (label === 'lock' && !String(args[0]).endsWith('append.lock')) return result;
        if (label === 'write' && typeof args[0] !== 'number') return result;
        if (actual === cut) process.kill(process.pid, 'SIGKILL');
        return result;
      };
    }
    syncBuiltinESMExports();
  } else if (role === 'seed' || role === 'seed-torn') {
    const originalWrite = fs.writeFileSync;
    fs.writeFileSync = ((target: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      if (typeof target === 'number') {
        const result = role === 'seed-torn'
          ? originalWrite(target, '[{"type":"FactEnvelope"')
          : (originalWrite as (...values: unknown[]) => unknown)(target, ...args);
        fs.fsyncSync(target);
        process.kill(process.pid, 'SIGKILL');
        return result;
      }
      return (originalWrite as (...values: unknown[]) => unknown)(target, ...args);
    }) as typeof fs.writeFileSync;
    syncBuiltinESMExports();
  }

  try {
    store.save(expected, candidate);
    let staleWrite = 'not-tested';
    if (role === 'control') {
      try { store.save(expected, candidate); staleWrite = 'saved'; }
      catch { staleWrite = 'refused'; }
    }
    process.stdout.write(JSON.stringify({ role, state: 'saved', staleWrite,
      revision: candidate.revision, operation: candidate.attempts[0]!.operation }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ role, state: 'refused', error: String(error) }));
  }
}

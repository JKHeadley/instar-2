import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';
import {
  decodeHarnessAdapterStateSnapshot,
  harnessAdapterIdentity,
} from '../../src/harness-adapters/index.js';
import { value } from '../facts/fixtures.js';
import { attemptInput, harnessFixture } from './fixture.js';

const [role, directory] = process.argv.slice(2);
const path = `${directory}/state.json`;
const originalWrite = fs.writeFileSync;
const originalRename = fs.renameSync;

function until(marker: string) {
  const limit = Date.now() + 20_000;
  while (!fs.existsSync(marker)) {
    if (Date.now() > limit) throw new Error(`barrier timeout ${marker}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
}

if (role === 'seed') {
  const originalSymlink = fs.symlinkSync;
  fs.symlinkSync = ((...args: Parameters<typeof fs.symlinkSync>) => {
    const result = originalSymlink(...args);
    process.kill(process.pid, 'SIGKILL');
    return result;
  }) as typeof fs.symlinkSync;
} else if (role === 'b') {
  let once = true;
  fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if (from === `${path}.lock` && String(to).includes('.dead-') && once) {
      once = false;
      originalWrite(`${directory}/b-at-claim`, '1');
      until(`${directory}/a-at-write`);
    }
    return originalRename(from, to);
  }) as typeof fs.renameSync;
} else if (role === 'a') {
  fs.writeFileSync = ((target: fs.PathOrFileDescriptor, ...args: unknown[]) => {
    if (typeof target === 'string' && target.startsWith(`${path}.pending-`)) {
      originalWrite(`${directory}/a-at-write`, '1');
      until(`${directory}/b-done`);
    }
    return (originalWrite as (...values: unknown[]) => unknown)(target, ...args);
  }) as typeof fs.writeFileSync;
}
syncBuiltinESMExports();

const fixture = harnessFixture();
const store = createHarnessAdapterFileState(path);
try {
  const current = value(decodeHarnessAdapterStateSnapshot(store.load(), fixture.owner.c));
  const expected = harnessAdapterIdentity(current).canonicalHash;
  const candidate = value(decodeHarnessAdapterStateSnapshot({ ...current, revision: current.revision + 1,
    attempts: [attemptInput({ operation: `operation:${role}` })] }, fixture.owner.c));
  store.save(expected, candidate);
  originalWrite(`${directory}/${role}-done`, '1');
  let staleWrite = 'not-tested';
  if (role === 'control') {
    try { store.save(expected, candidate); staleWrite = 'saved'; }
    catch { staleWrite = 'refused'; }
  }
  process.stdout.write(JSON.stringify({ role, state: 'saved', staleWrite,
    expected, revision: candidate.revision, operation: candidate.attempts[0]!.operation }));
} catch (error) {
  originalWrite(`${directory}/${role}-done`, '1');
  process.stdout.write(JSON.stringify({ role, state: 'refused', error: String(error) }));
}

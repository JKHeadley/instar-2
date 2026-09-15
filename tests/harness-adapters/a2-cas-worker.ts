import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { decodeHarnessAdapterStateSnapshot, harnessAdapterIdentity } from '../../src/harness-adapters/index.js';
import { value } from '../facts/fixtures.js';
import { harnessFixture } from './fixture.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';

const [directory, who] = process.argv.slice(2) as [string, string];
const path = `${directory}/state.json`;
const original = fs.readFileSync;
const store = createHarnessAdapterFileState(path);
const fixture = harnessFixture();
const raw = value(decodeHarnessAdapterStateSnapshot(store.load(), fixture.owner.c));
const expected = harnessAdapterIdentity(raw).canonicalHash;
const next = value(decodeHarnessAdapterStateSnapshot({ ...raw, revision: 1, attempts: [{ kind: 'launch', operation: `operation:${who}`,
  launch: `launch:${who}`, incarnation: `incarnation:${who}`, subjectDigest: `sha256:${who.repeat(64)}`,
  state: 'pending', evidence: '', attemptedAt: 10, observedAt: null }] }, fixture.owner.c));

fs.readFileSync = ((target: fs.PathOrFileDescriptor, ...args: unknown[]) => {
  const bytes = (original as (...input: unknown[]) => unknown)(target, ...args);
  if (String(target) === `${path}.part-two/facts.json`) {
    fs.writeFileSync(`${directory}/read-${who}`, 'ready');
    const peer = `${directory}/read-${who === 'a' ? 'b' : 'a'}`;
    const limit = Date.now() + 10_000;
    while (!fs.existsSync(peer)) {
      if (Date.now() > limit) throw new Error('read barrier timeout');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
  }
  return bytes;
}) as typeof fs.readFileSync;
syncBuiltinESMExports();

try {
  store.save(expected, next);
  process.stdout.write(JSON.stringify({ who, status: 'saved' }));
} catch (error) {
  process.stdout.write(JSON.stringify({ who, status: 'refused', detail: String(error) }));
}

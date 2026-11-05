// Run the real synchronous disk lifecycle outside Vitest's IPC thread. The parent
// awaits this process with a finite deadline; assertions and cleanup finish here.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attachSessionVolume, detachSessionVolume } from './tool-turn.mjs';

// Ordinary disk, as the runner root is: RAM disk test scratch refuses image attachment.
const root = realpathSync(mkdtempSync('/private/tmp/session-volume-'));
const bytes = 16 * 1024 * 1024, mount = join(root, 'session-work');
try {
  const scope = attachSessionVolume(root, { bytes, name: 'session-work' });
  assert.equal(scope, mount);
  assert.notEqual(execFileSync('/bin/df', [scope], { encoding: 'utf8', timeout: 10000 }),
    execFileSync('/bin/df', [root], { encoding: 'utf8', timeout: 10000 }));
  for (let i = 0; i < 8; i++) writeFileSync(join(scope, `part-${i}.bin`), Buffer.alloc(512 * 1024, i));
  assert.equal(readFileSync(join(scope, 'part-7.bin')).length, 512 * 1024);
  let written = 0, refused = null;
  for (let i = 0; i < 64 && refused === null; i++) {
    try { writeFileSync(join(scope, `fill-${i}.bin`), Buffer.alloc(1024 * 1024, 7)); written += 1024 * 1024; }
    catch (error) { refused = error.code ?? 'unknown'; }
  }
  assert.equal(refused, 'ENOSPC');
  assert.ok(written < bytes);
  assert.equal(attachSessionVolume(root, { bytes, name: 'session-work' }), scope);
  rmSync(join(scope, 'fill-0.bin'));
  writeFileSync(join(scope, 'kept.txt'), 'kept');
  detachSessionVolume(scope);
  assert.equal(existsSync(join(scope, 'kept.txt')), false);
  assert.equal(attachSessionVolume(root, { bytes, name: 'session-work' }), scope);
  assert.equal(readFileSync(join(scope, 'kept.txt'), 'utf8'), 'kept');
} finally {
  if (existsSync(mount)) {
    detachSessionVolume(mount);
    // A swallowed hdiutil failure must not make cleanup remove a mounted volume.
    assert.equal(lstatSync(mount).dev, lstatSync(root).dev, `session volume still mounted: ${mount}`);
  }
  rmSync(root, { recursive: true, force: true });
}
console.log('session volume: bounded writes, retained files, remount and cleanup passed');

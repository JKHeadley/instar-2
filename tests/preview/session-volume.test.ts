// Rule 60 and Part fifteen §5 (docs/19-scheduled-work): the delegated session's working scope is a fixed-size volume, so
// the sum of everything a step writes, however many files, is bounded together (a per-file limit bounds none of that).
// The real mechanism runs here: a small sparse disk image mounted at the scope, filled past its size by many files.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error the runner's tool turn stays plain JavaScript
import { attachSessionVolume, detachSessionVolume } from './tool-turn.mjs';

const darwin = process.platform === 'darwin';
const mounts: string[] = [], roots: string[] = [];
afterEach(() => {
  for (const mount of mounts.splice(0)) detachSessionVolume(mount);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it.runIf(darwin)('bounds the sum of a session\'s writes at its volume, keeps ordinary multi-file work, and persists across a remount', () => {
  // On the ordinary disk, as the runner root is (a RAM-disk test temporary refuses disk-image attachment).
  const root = realpathSync(mkdtempSync('/private/tmp/session-volume-')); roots.push(root);
  const bytes = 16 * 1024 * 1024;
  const scope = attachSessionVolume(root, { bytes, name: 'session-work' }); mounts.push(scope);
  expect(scope).toBe(join(root, 'session-work'));
  // The scope is its own device: nothing written there lands on the disk that holds the journal.
  expect(execFileSync('/bin/df', [scope], { encoding: 'utf8' })).not.toBe(execFileSync('/bin/df', [root], { encoding: 'utf8' }));
  // Ordinary multi-file work succeeds.
  for (let i = 0; i < 8; i++) writeFileSync(join(scope, `part-${i}.bin`), Buffer.alloc(512 * 1024, i));
  expect(readFileSync(join(scope, 'part-7.bin')).length).toBe(512 * 1024);
  // Many files, each well under any per-file limit, together past the volume: the writes stop at the allocation.
  let written = 0, refused: string | null = null;
  for (let i = 0; i < 64 && refused === null; i++) {
    try { writeFileSync(join(scope, `fill-${i}.bin`), Buffer.alloc(1024 * 1024, 7)); written += 1024 * 1024; }
    catch (error) { refused = (error as NodeJS.ErrnoException).code ?? 'unknown'; }
  }
  expect(refused).toBe('ENOSPC');
  expect(written).toBeLessThan(bytes);
  // The volume persists: reattaching reuses it, and after a remount the workspace is still there.
  expect(attachSessionVolume(root, { bytes, name: 'session-work' })).toBe(scope);
  rmSync(join(scope, 'fill-0.bin'));
  writeFileSync(join(scope, 'kept.txt'), 'kept');
  detachSessionVolume(scope);
  expect(existsSync(join(scope, 'kept.txt'))).toBe(false);
  expect(attachSessionVolume(root, { bytes, name: 'session-work' })).toBe(scope);
  expect(readFileSync(join(scope, 'kept.txt'), 'utf8')).toBe('kept');
}, 120_000);

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

// Growth (desk decision 2026-11-05, session-volume-parity-1105): an existing image that is full grows by one increment up
// to a bound, with the image detached, only when nothing holds the volume; every refusal leaves it exactly as it was.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, statfsSync } from 'node:fs';
// @ts-expect-error the runner's tool turn stays plain JavaScript
import { SESSION_VOLUME_BYTES, SESSION_VOLUME_FULL_FREE_BYTES, SESSION_VOLUME_MAX_BYTES, sessionImageBytes, sessionVolumeFullFreeBytes } from './tool-turn.mjs';

const MiB = 1024 * 1024;
const digestOf = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
/** Fills the mounted volume with 1 MiB files until the kernel refuses; returns how many it wrote. */
function fill(scope: string, prefix: string): number {
  let n = 0;
  for (; n < 4096; n++) {
    try { writeFileSync(join(scope, `${prefix}-${n}.bin`), Buffer.alloc(MiB, n & 255)); }
    catch (error) { expect((error as NodeJS.ErrnoException).code).toBe('ENOSPC'); return n; }
  }
  throw new Error('the volume never filled');
}
const freeOf = (path: string) => { const s = statfsSync(path); return s.bavail * s.bsize; };
/** The mounted volume's size: exact after a resize (the image file itself carries hdiutil's partition padding). */
const sizeOf = (path: string) => { const s = statfsSync(path); return s.blocks * s.bsize; };

it.runIf(darwin)('grows a full existing image by one increment at the boundary, keeps every byte, bounds at the max, and never grows an explicit-size volume', () => {
  const root = realpathSync(mkdtempSync('/private/tmp/session-volume-grow-')); roots.push(root);
  const image = join(root, 'session-work.sparseimage');
  const bytes = 16 * MiB, maxBytes = 48 * MiB;
  // The old image: created and filled under the explicit-size path exactly as a 2 GiB image was before this change.
  const scope = attachSessionVolume(root, { bytes }); mounts.push(scope);
  writeFileSync(join(scope, 'kept.bin'), Buffer.alloc(3 * MiB, 9));
  const kept = digestOf(join(scope, 'kept.bin'));
  const first = fill(scope, 'a');
  expect(freeOf(scope)).toBeLessThan(sessionVolumeFullFreeBytes(bytes));
  expect(sessionImageBytes(image)).toBe(bytes);
  // Explicit size, no maxBytes: the exact bound holds, nothing grows, no line is written.
  const silent: string[] = [];
  expect(attachSessionVolume(root, { bytes, log: (line: string) => silent.push(line) })).toBe(scope);
  expect(silent).toEqual([]);
  expect(sessionImageBytes(image)).toBe(bytes);
  // The growth path (what the runner's default call is, at test sizes): one increment, bytes kept, the next write lands.
  const lines: string[] = [];
  expect(attachSessionVolume(root, { bytes, maxBytes, log: (line: string) => lines.push(line) })).toBe(scope);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^session volume grown from \d+ to \d+ bytes \(bound \d+\)$/);
  expect(sizeOf(scope)).toBe(2 * bytes);
  expect(digestOf(join(scope, 'kept.bin'))).toBe(kept);
  for (let i = 0; i < first; i++) expect(readFileSync(join(scope, `a-${i}.bin`))[0]).toBe(i & 255);
  writeFileSync(join(scope, 'next.bin'), Buffer.alloc(MiB, 1));
  expect(readFileSync(join(scope, 'next.bin')).length).toBe(MiB);
  // Not full: another boundary grows nothing.
  lines.length = 0;
  expect(attachSessionVolume(root, { bytes, maxBytes, log: (line: string) => lines.push(line) })).toBe(scope);
  expect(lines).toEqual([]);
  expect(sizeOf(scope)).toBe(2 * bytes);
  // Full again: the second increment reaches the bound; full at the bound: no growth, the bound refuses the write.
  fill(scope, 'b');
  expect(attachSessionVolume(root, { bytes, maxBytes, log: (line: string) => lines.push(line) })).toBe(scope);
  expect(sizeOf(scope)).toBe(maxBytes);
  fill(scope, 'c');
  lines.length = 0;
  expect(attachSessionVolume(root, { bytes, maxBytes, log: (line: string) => lines.push(line) })).toBe(scope);
  expect(lines).toEqual([]);
  expect(sizeOf(scope)).toBe(maxBytes);
  expect(() => writeFileSync(join(scope, 'past.bin'), Buffer.alloc(2 * MiB, 2))).toThrow(/ENOSPC/);
  expect(digestOf(join(scope, 'kept.bin'))).toBe(kept);
  // Across a remount the grown image is what mounts.
  detachSessionVolume(scope);
  expect(attachSessionVolume(root, { bytes, maxBytes })).toBe(scope);
  expect(digestOf(join(scope, 'kept.bin'))).toBe(kept);
  expect(sizeOf(scope)).toBe(maxBytes);
}, 180_000);

it.runIf(darwin)('refuses to grow a full volume a process still holds, and grows it once that process is gone', async () => {
  const root = realpathSync(mkdtempSync('/private/tmp/session-volume-held-')); roots.push(root);
  const image = join(root, 'session-work.sparseimage');
  const bytes = 16 * MiB, maxBytes = 32 * MiB;
  const scope = attachSessionVolume(root, { bytes }); mounts.push(scope);
  fill(scope, 'a');
  // A live worker: a child whose working directory is the volume (what a running step's shell or a continuing
  // session's harness holds). Never forced off: the growth is refused and the volume stays mounted and full.
  const holder = spawn('/bin/sleep', ['120'], { cwd: scope, stdio: 'ignore' });
  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    const lines: string[] = [];
    expect(attachSessionVolume(root, { bytes, maxBytes, log: (line: string) => lines.push(line) })).toBe(scope);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/not grown: a process still holds it$/);
    expect(sessionImageBytes(image)).toBe(bytes);
    expect(holder.exitCode).toBeNull();
    expect(execFileSync('/bin/df', [scope], { encoding: 'utf8' })).not.toBe(execFileSync('/bin/df', [root], { encoding: 'utf8' }));
  } finally {
    // Exactly this child, by its own pid.
    holder.kill('SIGTERM');
    await new Promise(resolve => holder.once('exit', resolve));
  }
  const lines: string[] = [];
  expect(attachSessionVolume(root, { bytes, maxBytes, log: (line: string) => lines.push(line) })).toBe(scope);
  expect(lines[0]).toMatch(/^session volume grown/);
  expect(sizeOf(scope)).toBe(maxBytes);
}, 180_000);

it.runIf(darwin)('refuses to grow when the host disk lacks the increment plus reserve, and keeps the image after a refused resize', () => {
  // A host with too little free space: the root sits on a small helper volume of its own.
  const host = realpathSync(mkdtempSync('/private/tmp/session-volume-host-')); roots.push(host);
  const helper = attachSessionVolume(host, { bytes: 96 * MiB, name: 'host' }); mounts.push(helper);
  expect(freeOf(helper)).toBeLessThan(SESSION_VOLUME_BYTES);
  const root = join(helper, 'root'); mkdirSync(root, { mode: 0o700 });
  const image = join(root, 'session-work.sparseimage');
  const bytes = 16 * MiB, maxBytes = 32 * MiB;
  const scope = attachSessionVolume(root, { bytes }); mounts.push(scope);
  fill(scope, 'a');
  const kept = digestOf(join(scope, 'a-0.bin'));
  const lines: string[] = [];
  expect(attachSessionVolume(root, { bytes, maxBytes, log: (line: string) => lines.push(line) })).toBe(scope);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/not grown: the host has \d+ bytes free, under the increment plus reserve$/);
  expect(sessionImageBytes(image)).toBe(bytes);
  expect(digestOf(join(scope, 'a-0.bin'))).toBe(kept);
  // A resize that fails after the detach (an interrupted or refused hdiutil): the image keeps its size and its bytes
  // and is mounted again for the step. The stand-in passes everything else to the real hdiutil.
  const root2 = realpathSync(mkdtempSync('/private/tmp/session-volume-resize-')); roots.push(root2);
  const image2 = join(root2, 'session-work.sparseimage');
  const scope2 = attachSessionVolume(root2, { bytes }); mounts.push(scope2);
  fill(scope2, 'a');
  const kept2 = digestOf(join(scope2, 'a-0.bin'));
  const stub = join(root2, 'hdiutil-refuses-resize.sh');
  writeFileSync(stub, '#!/bin/sh\n[ "$1" = resize ] && exit 1\nexec /usr/bin/hdiutil "$@"\n'); chmodSync(stub, 0o700);
  const lines2: string[] = [];
  expect(attachSessionVolume(root2, { bytes, maxBytes, log: (line: string) => lines2.push(line), tools: { hdiutil: stub } })).toBe(scope2);
  expect(lines2).toEqual([`session volume resize refused; its volume keeps ${String(sizeOf(scope2))} bytes`]);
  expect(sessionImageBytes(image2)).toBe(bytes);
  expect(digestOf(join(scope2, 'a-0.bin'))).toBe(kept2);
  expect(execFileSync('/bin/df', [scope2], { encoding: 'utf8' })).not.toBe(execFileSync('/bin/df', [root2], { encoding: 'utf8' }));
  expect(spawnSync('/usr/bin/hdiutil', ['imageinfo', image2], { encoding: 'utf8' }).status).toBe(0);
}, 180_000);

it.runIf(darwin)('the runner\'s default call: a fresh image is the initial size, the bound is four increments, and an old full default-size image grows in place', () => {
  expect(SESSION_VOLUME_MAX_BYTES).toBe(4 * SESSION_VOLUME_BYTES);
  expect(SESSION_VOLUME_FULL_FREE_BYTES).toBe(SESSION_VOLUME_BYTES / 8);
  const root = realpathSync(mkdtempSync('/private/tmp/session-volume-default-')); roots.push(root);
  const image = join(root, 'session-work.sparseimage');
  const lines: string[] = [];
  const scope = attachSessionVolume(root, { log: (line: string) => lines.push(line) }); mounts.push(scope);
  expect(scope).toBe(join(root, 'session-work'));
  expect(sessionImageBytes(image)).toBe(SESSION_VOLUME_BYTES);
  expect(lines).toEqual([]);
  // The actual wire: the image an earlier build created at 2 GiB, filled to the kernel's refusal (the measured live
  // state), reattached by the runner's own default call at the next boundary. The sparse image takes the written bytes
  // only; the zeros below are freed with the root.
  const zeros = spawnSync('/bin/sh', ['-c', 'i=0; while /bin/dd if=/dev/zero of=z$i bs=16m count=8 2>/dev/null; do i=$((i+1)); done; echo $i'],
    { cwd: scope, encoding: 'utf8', timeout: 170_000 });
  expect(Number(zeros.stdout.trim())).toBeGreaterThan(8);
  expect(freeOf(scope)).toBeLessThan(SESSION_VOLUME_FULL_FREE_BYTES);
  writeFileSync(join(scope, 'mark.txt'), 'measured');
  expect(attachSessionVolume(root, { log: (line: string) => lines.push(line) })).toBe(scope);
  expect(lines).toHaveLength(1);
  // The volume inside an image as created is one increment less hdiutil's partition padding; the grown one is exact.
  expect(lines[0]).toMatch(new RegExp(`^session volume grown from \\d+ to ${String(2 * SESSION_VOLUME_BYTES)} bytes \\(bound ${String(SESSION_VOLUME_MAX_BYTES)}\\)$`));
  expect(sizeOf(scope)).toBe(2 * SESSION_VOLUME_BYTES);
  expect(readFileSync(join(scope, 'mark.txt'), 'utf8')).toBe('measured');
  writeFileSync(join(scope, 'after.bin'), Buffer.alloc(4 * MiB, 4));
  expect(readFileSync(join(scope, 'after.bin')).length).toBe(4 * MiB);
}, 240_000);

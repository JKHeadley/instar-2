// TEST-INFRASTRUCTURE (operator direction, 2026-09-28: "disk should NOT be swamped by
// testing"): vitest globalSetup that points TMPDIR at a per-run directory before the fork
// pool starts, so every Vitest worker and every child it spawns inherits it and the
// thousands of fsync calls the durable-storage tests make into their mkdtemp(tmpdir())
// directories land on RAM-backed storage instead of the real disk. Vitest captures
// process.env for the forks after globalSetup runs, which is why this lives here and not in
// a setupFile. It covers Vitest only: gate steps that run before Vitest (for example
// scripts/run-kill-schedule.mjs) keep their own temp placement, and the pre-redirect temp
// root is published as INSTAR_TEST_OUTER_TMPDIR so a worker still finds what such a step
// wrote (without it every kill-schedule pair re-ran live inside the loaded workers).
// Product durability code is untouched; only where test temp files live changes.
//
// Root choice:
// - INSTAR_TEST_REAL_DISK=1 (`npm run test:durability`): an explicit real-disk scratch root,
//   REAL_DISK_ROOT, never the inherited TMPDIR (which may itself be on RAM). Setup refuses
//   to start if that root is RAM-backed or unwritable.
// - INSTAR_TEST_TMP, if set: used as given. It is called RAM only when its backing is
//   verified; otherwise one warning names the path. An override must carry its own finite
//   size bound; nothing here limits it.
// - else /Volumes/instar-test-ram on macOS (scripts/ensure-test-ramdisk.sh) or /dev/shm on
//   Linux/WSL, when writable AND verified RAM-backed.
// - else the inherited TMPDIR with one loud warning.
// "Verified RAM" means: on macOS the path is on the same device as a mounted `ram://` disk
// image listed by `hdiutil info`; on Linux its filesystem is tmpfs. Nothing else counts.
import { execFileSync } from 'node:child_process';
import { accessSync, constants, mkdtempSync, readdirSync, realpathSync, rmSync, statSync, statfsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const MAC_RAM_ROOT = '/Volumes/instar-test-ram';
export const LINUX_RAM_ROOT = '/dev/shm';
export const REAL_DISK_ROOT = '/var/tmp';
const RUN_PREFIX = 'instar-test-';
const TMPFS_MAGIC = 0x01021994;

export interface TmpRootInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: string;
  readonly writable: (path: string) => boolean;
  readonly ramBacked: (path: string) => boolean;
}

export type TmpRoot =
  | { readonly kind: 'ram'; readonly root: string }
  | { readonly kind: 'unverified'; readonly root: string }
  | { readonly kind: 'real-disk'; readonly root: string }
  | { readonly kind: 'inherited'; readonly reason: 'no-ram-root' };

export function chooseTestTmpRoot({ env, platform, writable, ramBacked }: TmpRootInput): TmpRoot {
  if (env.INSTAR_TEST_REAL_DISK === '1') return { kind: 'real-disk', root: REAL_DISK_ROOT };
  const override = env.INSTAR_TEST_TMP;
  if (override !== undefined && override !== '') {
    return ramBacked(override) ? { kind: 'ram', root: override } : { kind: 'unverified', root: override };
  }
  const candidate = platform === 'darwin' ? MAC_RAM_ROOT : platform === 'linux' ? LINUX_RAM_ROOT : null;
  if (candidate !== null && writable(candidate) && ramBacked(candidate)) return { kind: 'ram', root: candidate };
  return { kind: 'inherited', reason: 'no-ram-root' };
}

// Mount points of attached `ram://` disk images in `hdiutil info` output. Each image is a
// block separated by a line of '='; its device lines are tab-separated with the mount point
// last ("/dev/disk5s1\t<uuid>\t/Volumes/instar-test-ram").
export function parseHdiutilRamMounts(text: string): string[] {
  const mounts: string[] = [];
  for (const block of text.split(/^=+$/m)) {
    if (!/^image-path\s*:\s*ram:\/\//m.test(block)) continue;
    for (const line of block.split('\n')) {
      if (!line.startsWith('/dev/')) continue;
      const mount = line.split('\t').pop()?.trim() ?? '';
      if (mount.startsWith('/')) mounts.push(mount);
    }
  }
  return mounts;
}

function macRamMounts(): string[] {
  try { return parseHdiutilRamMounts(execFileSync('hdiutil', ['info'], { encoding: 'utf8', timeout: 10_000 })); }
  catch { return []; }
}

export function isRamBacked(path: string, platform: string = process.platform): boolean {
  try {
    if (platform === 'linux') return statfsSync(path).type === TMPFS_MAGIC;
    if (platform !== 'darwin') return false;
    const device = statSync(path).dev;
    return macRamMounts().some(mount => { try { return statSync(mount).dev === device; } catch { return false; } });
  } catch { return false; }
}

function isWritable(path: string): boolean {
  try { accessSync(path, constants.W_OK); return true; } catch { return false; }
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
}

// A run killed before teardown (timeout, tmux kill) leaves its directory behind, and on a
// RAM volume leftovers hold memory until the volume fills. Remove only directories whose
// owning vitest process is gone; a live run's directory is never touched.
export function sweepDeadRuns(root: string, alive: (pid: number) => boolean = pidAlive): string[] {
  const removed: string[] = [];
  let names: string[];
  try { names = readdirSync(root); } catch { return removed; }
  for (const name of names) {
    const match = /^instar-test-(\d+)-/.exec(name);
    if (match === null || alive(Number(match[1]))) continue;
    rmSync(join(root, name), { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}

export default function setup(): () => void {
  const choice = chooseTestTmpRoot({ env: process.env, platform: process.platform, writable: isWritable,
    ramBacked: path => isRamBacked(path) });
  if (choice.kind === 'inherited') {
    process.stderr.write(`[instar tests] WARNING: no verified RAM root; test temp files stay in the inherited TMPDIR `
      + `(${process.env.TMPDIR ?? 'unset'}), which may be the REAL DISK. Run scripts/ensure-test-ramdisk.sh on macOS `
      + `or set INSTAR_TEST_TMP.\n`);
    return () => {};
  }
  if (choice.kind === 'real-disk' && (!isWritable(choice.root) || isRamBacked(realpathSync(choice.root)))) {
    throw new Error(`[instar tests] INSTAR_TEST_REAL_DISK=1 needs ${choice.root} to be a writable real-disk directory`);
  }
  if (choice.kind === 'unverified') {
    process.stderr.write(`[instar tests] WARNING: INSTAR_TEST_TMP=${choice.root} is not verified RAM-backed storage; `
      + `test temp files go there anyway and it must have its own finite size bound.\n`);
  }
  sweepDeadRuns(choice.root);
  const previous = process.env.TMPDIR;
  process.env.INSTAR_TEST_OUTER_TMPDIR = tmpdir();
  const runDir = mkdtempSync(join(choice.root, `${RUN_PREFIX}${process.pid}-`));
  process.env.TMPDIR = runDir;
  process.env.INSTAR_TEST_TMP_ROOT = choice.root;
  process.env.INSTAR_TEST_TMP_KIND = choice.kind;
  return () => {
    rmSync(runDir, { recursive: true, force: true });
    if (previous === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previous;
    delete process.env.INSTAR_TEST_TMP_ROOT;
    delete process.env.INSTAR_TEST_TMP_KIND;
    delete process.env.INSTAR_TEST_OUTER_TMPDIR;
  };
}

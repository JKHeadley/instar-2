// TEST-INFRASTRUCTURE (operator direction, 2026-09-28: "disk should NOT be swamped by
// testing"): vitest globalSetup that points TMPDIR at a per-run directory on RAM-backed
// storage before the fork pool starts, so every worker and every child it spawns inherits
// it and the thousands of fsync calls the durable-storage tests make into their
// mkdtemp(tmpdir()) directories never reach the real disk. Vitest captures process.env for
// the forks after globalSetup runs, which is why this lives here and not in a setupFile.
// Product durability code is untouched; only where test temp files live changes. The real-
// disk behaviour of production storage is still proved once per gate by
// `npm run test:durability` (INSTAR_TEST_REAL_DISK=1).
//
// Root choice: INSTAR_TEST_TMP if set; else /Volumes/instar-test-ram on macOS
// (scripts/ensure-test-ramdisk.sh) or /dev/shm on Linux/WSL when writable; else the real
// disk with one loud stderr line. INSTAR_TEST_REAL_DISK=1 disables the redirect.
import { accessSync, constants, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const MAC_RAM_ROOT = '/Volumes/instar-test-ram';
export const LINUX_RAM_ROOT = '/dev/shm';
const RUN_PREFIX = 'instar-test-';

export interface TmpRootInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: string;
  readonly writable: (path: string) => boolean;
}

export type TmpRoot =
  | { readonly kind: 'ram'; readonly root: string }
  | { readonly kind: 'real-disk'; readonly reason: 'opt-out' | 'no-ram-root' };

export function chooseTestTmpRoot({ env, platform, writable }: TmpRootInput): TmpRoot {
  if (env.INSTAR_TEST_REAL_DISK === '1') return { kind: 'real-disk', reason: 'opt-out' };
  const override = env.INSTAR_TEST_TMP;
  if (override !== undefined && override !== '') return { kind: 'ram', root: override };
  const candidate = platform === 'darwin' ? MAC_RAM_ROOT : platform === 'linux' ? LINUX_RAM_ROOT : null;
  if (candidate !== null && writable(candidate)) return { kind: 'ram', root: candidate };
  return { kind: 'real-disk', reason: 'no-ram-root' };
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
  const choice = chooseTestTmpRoot({ env: process.env, platform: process.platform, writable: isWritable });
  if (choice.kind === 'real-disk') {
    if (choice.reason === 'no-ram-root') {
      process.stderr.write(`[instar tests] WARNING: test temp files are on the REAL DISK (no RAM root; run scripts/ensure-test-ramdisk.sh on macOS or set INSTAR_TEST_TMP)\n`);
    }
    return () => {};
  }
  sweepDeadRuns(choice.root);
  const previous = process.env.TMPDIR;
  const runDir = mkdtempSync(join(choice.root, `${RUN_PREFIX}${process.pid}-`));
  process.env.TMPDIR = runDir;
  process.env.INSTAR_TEST_TMP_ROOT = choice.root;
  return () => {
    rmSync(runDir, { recursive: true, force: true });
    if (previous === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previous;
    delete process.env.INSTAR_TEST_TMP_ROOT;
  };
}

// Test temp files go to RAM-backed storage, not the real disk (tests/setup/test-tmp.ts).
// The first case runs in a real fork worker and checks the live run: under the default run
// it must be on the RAM root when one exists; under `npm run test:durability`
// (INSTAR_TEST_REAL_DISK=1, which also runs this file) it must be on the real disk.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import setup, { chooseTestTmpRoot, LINUX_RAM_ROOT, MAC_RAM_ROOT, sweepDeadRuns } from '../setup/test-tmp.js';

const under = (path: string, root: string) => realpathSync(path).startsWith(realpathSync(root) + '/');

describe('test temp redirect', () => {
  it('a forked test worker writes its temp files under the chosen root, or the real disk when opted out', () => {
    const dir = mkdtempSync(join(tmpdir(), 'redirect-probe-'));
    try {
      const ramRoots = [MAC_RAM_ROOT, LINUX_RAM_ROOT].filter(existsSync);
      if (process.env.INSTAR_TEST_REAL_DISK === '1') {
        expect(process.env.INSTAR_TEST_TMP_ROOT).toBeUndefined();
        for (const root of ramRoots) expect(under(dir, root)).toBe(false);
        return;
      }
      const expected = process.env.INSTAR_TEST_TMP
        || (process.platform === 'darwin' && existsSync(MAC_RAM_ROOT) ? MAC_RAM_ROOT
          : process.platform === 'linux' && existsSync(LINUX_RAM_ROOT) ? LINUX_RAM_ROOT : undefined);
      if (expected === undefined) return; // no RAM root on this host: setup warned loudly instead
      expect(process.env.INSTAR_TEST_TMP_ROOT).toBe(expected);
      expect(under(dir, expected)).toBe(true);
      expect(realpathSync(tmpdir())).toMatch(/\/instar-test-\d+-[^/]+$/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('chooses the override, then the platform RAM root, else the real disk; opt-out always wins', () => {
    const yes = () => true, no = () => false;
    expect(chooseTestTmpRoot({ env: { INSTAR_TEST_REAL_DISK: '1', INSTAR_TEST_TMP: '/x' }, platform: 'darwin', writable: yes }))
      .toEqual({ kind: 'real-disk', reason: 'opt-out' });
    expect(chooseTestTmpRoot({ env: { INSTAR_TEST_TMP: '/x' }, platform: 'darwin', writable: no }))
      .toEqual({ kind: 'ram', root: '/x' });
    expect(chooseTestTmpRoot({ env: {}, platform: 'darwin', writable: yes })).toEqual({ kind: 'ram', root: MAC_RAM_ROOT });
    expect(chooseTestTmpRoot({ env: {}, platform: 'linux', writable: yes })).toEqual({ kind: 'ram', root: LINUX_RAM_ROOT });
    expect(chooseTestTmpRoot({ env: {}, platform: 'darwin', writable: no })).toEqual({ kind: 'real-disk', reason: 'no-ram-root' });
    expect(chooseTestTmpRoot({ env: {}, platform: 'linux', writable: no })).toEqual({ kind: 'real-disk', reason: 'no-ram-root' });
    expect(chooseTestTmpRoot({ env: {}, platform: 'win32', writable: yes })).toEqual({ kind: 'real-disk', reason: 'no-ram-root' });
  });

  it('setup creates a per-run directory, points TMPDIR at it, and teardown removes it and restores TMPDIR', () => {
    const root = mkdtempSync(join(tmpdir(), 'redirect-root-'));
    const saved = { TMPDIR: process.env.TMPDIR, TMP: process.env.INSTAR_TEST_TMP, ROOT: process.env.INSTAR_TEST_TMP_ROOT,
      REAL: process.env.INSTAR_TEST_REAL_DISK };
    try {
      delete process.env.INSTAR_TEST_REAL_DISK;
      process.env.INSTAR_TEST_TMP = root;
      process.env.TMPDIR = '/before';
      const teardown = setup();
      const runDir = process.env.TMPDIR;
      expect(runDir).toMatch(new RegExp(`^${root}/instar-test-${process.pid}-`));
      expect(existsSync(runDir)).toBe(true);
      teardown();
      expect(existsSync(runDir)).toBe(false);
      expect(process.env.TMPDIR).toBe('/before');
    } finally {
      for (const [k, v] of [['TMPDIR', saved.TMPDIR], ['INSTAR_TEST_TMP', saved.TMP], ['INSTAR_TEST_TMP_ROOT', saved.ROOT],
        ['INSTAR_TEST_REAL_DISK', saved.REAL]] as const) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sweeps only run directories whose owning process is gone', () => {
    const root = mkdtempSync(join(tmpdir(), 'redirect-sweep-'));
    try {
      for (const name of ['instar-test-111-a', 'instar-test-222-b', 'unrelated']) mkdirSync(join(root, name));
      expect(sweepDeadRuns(root, pid => pid === 222)).toEqual(['instar-test-111-a']);
      expect(readdirSync(root).sort()).toEqual(['instar-test-222-b', 'unrelated']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

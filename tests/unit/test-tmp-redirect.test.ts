// Test temp files go to verified RAM-backed storage, not the real disk (tests/setup/test-tmp.ts).
// The first case runs in a real fork worker and checks the live run: under the default run
// it must be on a verified RAM root when one exists; under `npm run test:durability`
// (INSTAR_TEST_REAL_DISK=1, which also runs this file) it must be on the explicit real-disk
// root even when the inherited TMPDIR points at RAM.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import setup, {
  chooseTestTmpRoot, isRamBacked, LINUX_RAM_ROOT, MAC_RAM_ROOT, parseHdiutilRamMounts, REAL_DISK_ROOT, sweepDeadRuns,
} from '../setup/test-tmp.js';

const under = (path: string, root: string) => realpathSync(path).startsWith(realpathSync(root) + '/');
const platformRamRoot = process.platform === 'darwin' ? MAC_RAM_ROOT : process.platform === 'linux' ? LINUX_RAM_ROOT : null;
const verifiedRamRoot = platformRamRoot !== null && existsSync(platformRamRoot) && isRamBacked(platformRamRoot)
  ? platformRamRoot : null;
const ENV_KEYS = ['TMPDIR', 'INSTAR_TEST_TMP', 'INSTAR_TEST_TMP_ROOT', 'INSTAR_TEST_TMP_KIND', 'INSTAR_TEST_REAL_DISK'] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>, body: () => void): void {
  const saved = ENV_KEYS.map(k => [k, process.env[k]] as const);
  try {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, values);
    body();
  } finally {
    for (const [k, v] of saved) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

afterEach(() => { vi.restoreAllMocks(); });

describe('test temp redirect', () => {
  it('a forked test worker writes its temp files on verified RAM, or on the real disk under test:durability', () => {
    const dir = mkdtempSync(join(tmpdir(), 'redirect-probe-'));
    try {
      if (process.env.INSTAR_TEST_REAL_DISK === '1') {
        expect(process.env.INSTAR_TEST_TMP_KIND).toBe('real-disk');
        expect(under(dir, REAL_DISK_ROOT)).toBe(true);
        expect(isRamBacked(dir)).toBe(false);
        for (const root of [MAC_RAM_ROOT, LINUX_RAM_ROOT].filter(existsSync)) {
          expect(statSync(dir).dev).not.toBe(statSync(root).dev);
        }
        return;
      }
      const kind = process.env.INSTAR_TEST_TMP_KIND;
      if (!process.env.INSTAR_TEST_TMP && verifiedRamRoot !== null) {
        expect(kind).toBe('ram');
        expect(process.env.INSTAR_TEST_TMP_ROOT).toBe(verifiedRamRoot);
      }
      if (kind === undefined) return; // no verified RAM root on this host: setup warned loudly instead
      expect(under(dir, process.env.INSTAR_TEST_TMP_ROOT!)).toBe(true);
      expect(isRamBacked(dir)).toBe(kind === 'ram');
      expect(realpathSync(tmpdir())).toMatch(/\/instar-test-\d+-[^/]+$/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('real-disk opt-out wins; an override is RAM only when verified; a platform root must be writable and verified', () => {
    const yes = () => true, no = () => false;
    expect(chooseTestTmpRoot({ env: { INSTAR_TEST_REAL_DISK: '1', INSTAR_TEST_TMP: '/x', TMPDIR: MAC_RAM_ROOT },
      platform: 'darwin', writable: yes, ramBacked: yes })).toEqual({ kind: 'real-disk', root: REAL_DISK_ROOT });
    expect(chooseTestTmpRoot({ env: { INSTAR_TEST_TMP: '/x' }, platform: 'darwin', writable: no, ramBacked: yes }))
      .toEqual({ kind: 'ram', root: '/x' });
    expect(chooseTestTmpRoot({ env: { INSTAR_TEST_TMP: '/x' }, platform: 'darwin', writable: yes, ramBacked: no }))
      .toEqual({ kind: 'unverified', root: '/x' });
    expect(chooseTestTmpRoot({ env: {}, platform: 'darwin', writable: yes, ramBacked: yes })).toEqual({ kind: 'ram', root: MAC_RAM_ROOT });
    expect(chooseTestTmpRoot({ env: {}, platform: 'linux', writable: yes, ramBacked: yes })).toEqual({ kind: 'ram', root: LINUX_RAM_ROOT });
    for (const [writable, ramBacked] of [[yes, no], [no, yes], [no, no]] as const) {
      for (const platform of ['darwin', 'linux']) {
        expect(chooseTestTmpRoot({ env: {}, platform, writable, ramBacked })).toEqual({ kind: 'inherited', reason: 'no-ram-root' });
      }
    }
    expect(chooseTestTmpRoot({ env: {}, platform: 'win32', writable: yes, ramBacked: yes }))
      .toEqual({ kind: 'inherited', reason: 'no-ram-root' });
  });

  it('reads only ram:// images from hdiutil info', () => {
    const text = [
      'framework       : 683.100.3', '================================================',
      'image-path      : ram://16777216', 'writeable       : TRUE',
      '/dev/disk4\t\t', '/dev/disk5\tEF57347C\t', '/dev/disk5s1\t41504653\t/Volumes/instar-test-ram',
      '================================================',
      'image-path      : /Users/x/disk.dmg', '/dev/disk6s1\t41504653\t/Volumes/not-ram',
    ].join('\n');
    expect(parseHdiutilRamMounts(text)).toEqual(['/Volumes/instar-test-ram']);
    expect(parseHdiutilRamMounts('')).toEqual([]);
  });

  it('verifies the backing medium of real paths, both ways', () => {
    expect(isRamBacked(REAL_DISK_ROOT)).toBe(false);
    expect(isRamBacked(process.cwd())).toBe(false);
    expect(isRamBacked('/definitely/absent/path')).toBe(false);
    if (verifiedRamRoot !== null) expect(isRamBacked(verifiedRamRoot)).toBe(true);
  });

  it('setup creates a per-run directory, points TMPDIR at it, and teardown removes it and restores TMPDIR', () => {
    const root = mkdtempSync(join(tmpdir(), 'redirect-root-'));
    try {
      withEnv({ INSTAR_TEST_TMP: root, TMPDIR: '/before' }, () => {
        const teardown = setup();
        const runDir = process.env.TMPDIR!;
        expect(runDir).toMatch(new RegExp(`^${root}/instar-test-${process.pid}-`));
        expect(existsSync(runDir)).toBe(true);
        teardown();
        expect(existsSync(runDir)).toBe(false);
        expect(process.env.TMPDIR).toBe('/before');
        expect(process.env.INSTAR_TEST_TMP_KIND).toBeUndefined();
      });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('an override that is not verified RAM is used with one warning naming it; a verified one is silent', () => {
    const diskRoot = mkdtempSync(join(REAL_DISK_ROOT, 'redirect-override-'));
    try {
      const writes: string[] = [];
      vi.spyOn(process.stderr, 'write').mockImplementation(chunk => { writes.push(String(chunk)); return true; });
      withEnv({ INSTAR_TEST_TMP: diskRoot }, () => {
        const teardown = setup();
        expect(process.env.INSTAR_TEST_TMP_KIND).toBe('unverified');
        expect(under(process.env.TMPDIR!, diskRoot)).toBe(true);
        teardown();
      });
      expect(writes).toHaveLength(1);
      expect(writes[0]).toContain(`INSTAR_TEST_TMP=${diskRoot} is not verified RAM-backed`);
      expect(writes[0]).toContain('finite size bound');
      if (verifiedRamRoot !== null) {
        writes.length = 0;
        withEnv({ INSTAR_TEST_TMP: verifiedRamRoot }, () => {
          const teardown = setup();
          expect(process.env.INSTAR_TEST_TMP_KIND).toBe('ram');
          teardown();
        });
        expect(writes).toEqual([]);
      }
    } finally { rmSync(diskRoot, { recursive: true, force: true }); }
  });

  it('the real-disk opt-out lands on the real-disk root even when the inherited TMPDIR is RAM', () => {
    const inherited = verifiedRamRoot ?? tmpdir();
    withEnv({ INSTAR_TEST_REAL_DISK: '1', TMPDIR: inherited, INSTAR_TEST_TMP: inherited }, () => {
      const teardown = setup();
      const runDir = process.env.TMPDIR!;
      try {
        expect(process.env.INSTAR_TEST_TMP_KIND).toBe('real-disk');
        expect(under(runDir, REAL_DISK_ROOT)).toBe(true);
        expect(isRamBacked(runDir)).toBe(false);
      } finally { teardown(); }
      expect(existsSync(runDir)).toBe(false);
      expect(process.env.TMPDIR).toBe(inherited);
    });
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

// The Linux/Mac split of a full test run holds only while the checked-in list of macOS-only test
// files is exactly what the detection finds: a macOS-only file missing from the list would fail the
// Linux half, and a listed file that no longer needs a Mac would never run on Linux.
import { afterEach, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
// @ts-expect-error The detection is plain JavaScript so it also runs as a CLI.
import { detectMacosOnly, LIST_PATH, listDrift, macosMechanism, readList } from './macos-only.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function tree(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'macos-only-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

// Built by concatenation so this file never itself reads as spawning a macOS tool.
const spawnOf = (tool: string) => `spawn${'Sync'}('/usr/bin/${tool}', ['-x']);\n`;

it('the checked-in list is exactly the detected macOS-only test files', () => {
  const detected = detectMacosOnly(process.cwd()).map((row: { file: string }) => row.file);
  const listed = readList(readFileSync(LIST_PATH, 'utf8'));
  expect(listDrift(detected, listed)).toEqual({ missing: [], stale: [] });
  expect(listed).toEqual([...listed].sort());
  expect(listed.length).toBeGreaterThan(0);
});

it('detects every macOS-only mechanism, directly or through a local helper, and a missing entry is drift', () => {
  const root = tree({
    'tests/a/sandbox.test.ts': spawnOf('sandbox-exec'),
    'tests/a/launchd.test.ts': `execFile${'Sync'}('launchctl', ['list']);\n`,
    'tests/a/plist.test.ts': `spawnSync('plu${'til'}', ['-lint', path]);\n`,
    'tests/a/stat.test.ts': `spawnSync('/usr/bin/stat', ['-${'f'}', '%Lp', key]);\n`,
    'tests/a/gated.test.ts': `const mac = process.platform === 'dar${'win'}';\nit.runIf(mac)('x', () => {});\n`,
    'tests/a/inline-gate.test.ts': `it.skipIf(process.platform !== 'dar${'win'}')('x', () => {});\n`,
    'tests/a/via-helper.test.ts': "import { run } from '../helpers/confined.js';\n",
    'tests/helpers/confined.ts': spawnOf('sandbox-exec'),
    'tests/a/via-script.test.ts': "import { disk } from '../../scripts/disk.mjs';\n",
    'scripts/disk.mjs': spawnOf('hdiutil'),
  });
  const detected = detectMacosOnly(root);
  expect(detected.map((row: { file: string }) => row.file)).toEqual(['tests/a/gated.test.ts', 'tests/a/inline-gate.test.ts',
    'tests/a/launchd.test.ts', 'tests/a/plist.test.ts', 'tests/a/sandbox.test.ts', 'tests/a/stat.test.ts',
    'tests/a/via-helper.test.ts', 'tests/a/via-script.test.ts']);
  expect(detected.find((row: { file: string }) => row.file === 'tests/a/via-helper.test.ts').reason)
    .toBe('spawns a macOS-only tool (via tests/helpers/confined.ts)');
  const files = detected.map((row: { file: string }) => row.file);
  expect(listDrift(files, files.filter((file: string) => file !== 'tests/a/plist.test.ts')))
    .toEqual({ missing: ['tests/a/plist.test.ts'], stale: [] });
  expect(listDrift(files.slice(1), files)).toEqual({ missing: [], stale: ['tests/a/gated.test.ts'] });
});

it('does not flag portable files that only mention macOS as data, in comments, or through the shared setup harness', () => {
  const root = tree({
    'tests/b/data.test.ts': `const row = { platform: 'dar${'win'}', profile: 'deploy/macos/worker.sb', consequence: 'security' };\n`,
    'tests/b/comment.test.ts': '// the confined runner uses sandbox-exec under launchd on macOS\n',
    'tests/b/choose.test.ts': `const root = process.platform === 'dar${'win'}' ? '/Volumes/r' : '/dev/shm';\nit('x', () => {});\n`,
    'tests/b/portable-stat.test.ts': "spawnSync('/usr/bin/stat', ['-c', '%a', key]);\n",
    'tests/b/setup-user.test.ts': "import { chooseRoot } from '../setup/tmp.ts';\n",
    'tests/setup/tmp.ts': spawnOf('hdiutil'),
    'tests/b/shell.test.ts': "spawnSync('/bin/sh', ['-c', 'ulimit -n']);\n",
  });
  expect(detectMacosOnly(root)).toEqual([]);
  expect(macosMechanism("it('reads only ram:// images from hdiutil info', () => {});")).toBeNull();
});

it('reads the list as one path per line, ignoring blank lines and comments', () => {
  expect(readList('# heading\n\ntests/a.test.ts  # why\n  tests/b.test.ts\n')).toEqual(['tests/a.test.ts', 'tests/b.test.ts']);
});

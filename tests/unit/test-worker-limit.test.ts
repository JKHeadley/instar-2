// The desk's per-run worker cap (tests/setup/worker-limit.ts, applied in vitest.config.ts).
// The resolver may only lower its ceiling. Only the recorded heavy fixtures run serially.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { resolveTestWorkerLimit } from '../setup/worker-limit.js';
import { runChild } from '../e2e/async-child.js';

// The config reads the environment once, when it is evaluated, so each case re-evaluates it
// from a cleared module registry rather than reading one cached copy three times.
async function loadRunnerConfig(): Promise<typeof import('../../vitest.config.js')> {
  vi.resetModules();
  return import('../../vitest.config.js');
}

describe('test worker limit', () => {
  it('keeps the host formula exactly when nothing is requested', () => {
    expect(resolveTestWorkerLimit(undefined, 6)).toEqual({ limit: 6, ignoredValue: null });
    expect(resolveTestWorkerLimit(undefined, 1)).toEqual({ limit: 1, ignoredValue: null });
    // A blank or whitespace value is how a shell passes "unset", so it is not an error.
    expect(resolveTestWorkerLimit('', 6)).toEqual({ limit: 6, ignoredValue: null });
    expect(resolveTestWorkerLimit('  ', 6)).toEqual({ limit: 6, ignoredValue: null });
  });

  it('applies a cap below the host formula, which is the desk case', () => {
    expect(resolveTestWorkerLimit('4', 6)).toEqual({ limit: 4, ignoredValue: null });
    expect(resolveTestWorkerLimit('1', 6)).toEqual({ limit: 1, ignoredValue: null });
    expect(resolveTestWorkerLimit(' 4 ', 6)).toEqual({ limit: 4, ignoredValue: null });
    expect(resolveTestWorkerLimit('04', 6)).toEqual({ limit: 4, ignoredValue: null });
  });

  it('never raises the host formula, however large the request', () => {
    expect(resolveTestWorkerLimit('6', 6)).toEqual({ limit: 6, ignoredValue: null });
    expect(resolveTestWorkerLimit('12', 6)).toEqual({ limit: 6, ignoredValue: null });
    expect(resolveTestWorkerLimit('4', 2)).toEqual({ limit: 2, ignoredValue: null });
    expect(resolveTestWorkerLimit('99999999999999999999', 5)).toEqual({ limit: 5, ignoredValue: null });
  });

  it('keeps the host formula and names an unusable value instead of dropping it in silence', () => {
    for (const bad of ['0', '-1', '-4', '4.5', '0.5', 'four', '4x', 'x4', '1e3', '+4', '4 4', 'NaN', 'Infinity'])
      expect(resolveTestWorkerLimit(bad, 6), bad).toEqual({ limit: 6, ignoredValue: bad });
  });

  it('the runner parallelizes ordinary files, honors lower caps and keeps the explicit serial comparator', async () => {
    const saved = { cap: process.env.INSTAR_TEST_MAX_WORKERS, serial: process.env.VITEST_SERIAL_GATE };
    try {
      for (const serial of [undefined, '0', '1']) {
        if (serial === undefined) delete process.env.VITEST_SERIAL_GATE;
        else process.env.VITEST_SERIAL_GATE = serial;
        for (const cap of [undefined, '1', '4', 'invalid']) {
          if (cap === undefined) delete process.env.INSTAR_TEST_MAX_WORKERS;
          else process.env.INSTAR_TEST_MAX_WORKERS = cap;
          const config = (await loadRunnerConfig()).default;
          const ceiling = Math.max(1, Math.min(6, Math.floor(availableParallelism() / 2)));
          expect(config.test?.maxWorkers).toBe(serial === '1' ? 1 : resolveTestWorkerLimit(cap, ceiling).limit);
          expect(config.test?.minWorkers).toBe(1);
          expect(config.test?.fileParallelism).toBe(serial !== '1');
        }
      }
    } finally {
      if (saved.cap === undefined) delete process.env.INSTAR_TEST_MAX_WORKERS;
      else process.env.INSTAR_TEST_MAX_WORKERS = saved.cap;
      if (saved.serial === undefined) delete process.env.VITEST_SERIAL_GATE;
      else process.env.VITEST_SERIAL_GATE = saved.serial;
    }
  });

  it('discovers every test exactly once and preserves both platform halves', async () => {
    const expected = execFileSync('git', ['ls-files', 'tests'], { encoding: 'utf8' }).trim().split('\n').filter(file => file.endsWith('.test.ts')).sort();
    const macos = readFileSync('tests/platform/macos-only.txt', 'utf8').split('\n')
      .map(line => line.replace(/#.*/, '').trim()).filter(Boolean);
    const { serialFixtureFiles } = await loadRunnerConfig();
    expect(serialFixtureFiles).toHaveLength(14);
    for (const split of ['', 'only-macos', 'exclude-macos']) {
      const result = await runChild(process.execPath, ['node_modules/vitest/vitest.mjs', 'list',
        '--filesOnly', '--json', '--maxWorkers', '1'], { timeout: 20_000,
        env: { ...process.env, INSTAR_TEST_PLATFORM_SPLIT: split } });
      expect(result.status, result.stderr).toBe(0);
      const files = JSON.parse(result.stdout) as { file: string; projectName: string }[];
      const selected = expected.filter(file => split === '' || (split === 'only-macos') === macos.includes(file));
      expect(files.map(row => relative(process.cwd(), row.file)).sort()).toEqual(selected);
      for (const row of files) {
        const file = relative(process.cwd(), row.file);
        expect(row.projectName, file).toBe(serialFixtureFiles.includes(file) ? file : 'parallel');
      }
    }
  });

  it('the shipped projects overlap ordinary files but serialize each heavy fixture in a fresh process', async () => {
    const root = mkdtempSync(join(process.cwd(), '.worker-limit-'));
    try {
      const trace = join(root, 'trace');
      const config = join(root, 'vitest.config.mts');
      writeFileSync(config, `import config from ${JSON.stringify(join(process.cwd(), 'vitest.config.ts'))};
const projects = config.test.projects.slice(0, 3).map((project, index) => ({ ...project,
  test: { ...project.test, include: [${JSON.stringify(root)} + (index === 0 ? '/ordinary*.test.ts' : '/serial' + index + '.test.ts')],
    exclude: [], setupFiles: [] } }));
export default { test: { ...config.test, projects, globalSetup: [], setupFiles: [] } };\n`);
      for (const name of ['ordinary1', 'ordinary2', 'serial1', 'serial2']) {
        const ordinary = name.startsWith('ordinary');
        writeFileSync(join(root, `${name}.test.ts`), `import { expect, it } from 'vitest';
import { appendFileSync, readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
it('scheduling probe', async () => {
  expect(process.env.INSTAR_SCHEDULING_PROBE).toBeUndefined();
  process.env.INSTAR_SCHEDULING_PROBE = 'a fresh fork must not inherit this';
  appendFileSync(${JSON.stringify(trace)}, '${name}:start:' + process.pid + '\\n');
  ${ordinary ? `// A bounded async rendezvous proves overlap without a CPU load generator.
  for (let attempt = 0; attempt < 200; attempt++) {
    if (readFileSync(${JSON.stringify(trace)}, 'utf8').includes('${name === 'ordinary1' ? 'ordinary2' : 'ordinary1'}:start:')) break;
    await setTimeout(10);
  }
  expect(readFileSync(${JSON.stringify(trace)}, 'utf8')).toContain('${name === 'ordinary1' ? 'ordinary2' : 'ordinary1'}:start:');` : 'await setTimeout(50);'}
  appendFileSync(${JSON.stringify(trace)}, '${name}:end:' + process.pid + '\\n');
});\n`);
      }
      const result = await runChild(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
        '--maxWorkers', '2', '--config', config], { timeout: 20_000,
        env: { ...process.env, INSTAR_TEST_MAX_WORKERS: '2', VITEST_SERIAL_GATE: '0' } });
      expect(result.status, result.stderr + result.stdout).toBe(0);
      const rows = readFileSync(trace, 'utf8').trim().split('\n').map(row => row.split(':'));
      expect(rows).toHaveLength(8);
      expect(rows.slice(0, 2).map(row => row[1])).toEqual(['start', 'start']);
      expect(rows.slice(4).map(row => row.slice(0, 2).join(':')))
        .toEqual(['serial1:start', 'serial1:end', 'serial2:start', 'serial2:end']);
      expect(new Set(rows.filter(row => row[1] === 'start').map(row => row[2])).size).toBe(4);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

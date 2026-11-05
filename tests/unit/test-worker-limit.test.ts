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
    expect(serialFixtureFiles).toHaveLength(15);
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

  });

  it('applies CLI exclusions to ordinary and serial projects without losing the Studio half', async () => {
    const list = async (args: string[]) => {
      const result = await runChild(process.execPath, ['node_modules/vitest/vitest.mjs', 'list',
        '--filesOnly', '--json', '--maxWorkers', '1', ...args], { timeout: 20_000,
        env: { ...process.env, INSTAR_TEST_PLATFORM_SPLIT: '' } });
      expect(result.status, result.stderr).toBe(0);
      return (JSON.parse(result.stdout) as { file: string }[]).map(row => relative(process.cwd(), row.file)).sort();
    };
    const studio = [...new Set([...readFileSync('tests/platform/macos-only.txt', 'utf8').split('\n')
      .map(line => line.replace(/#.*/, '').trim()).filter(Boolean),
      'tests/preview/media-understanding.test.ts', 'tests/preview/trust-setup.test.ts',
      'tests/e2e/register.test.ts'])].sort();
    const all = await list([]);
    const remote = await list(studio.flatMap((file, i) => i % 2 ? [`--exclude=${file}`] : ['--exclude', file]));
    expect(remote).toEqual(all.filter(file => !studio.includes(file)));
    expect(await list(studio)).toEqual(studio);
    expect([...remote, ...studio].sort()).toEqual(all);

// The desk's per-run worker cap (tests/setup/worker-limit.ts, applied in vitest.config.ts).
// The resolver may only lower its ceiling. The shipped config now sets that ceiling to one
// and disables file parallelism, including when the desk requests four workers.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

  it('the runner keeps files serial with unset, valid and invalid desk caps and either legacy gate setting', async () => {
    const saved = { cap: process.env.INSTAR_TEST_MAX_WORKERS, serial: process.env.VITEST_SERIAL_GATE };
    try {
      for (const serial of [undefined, '0', '1']) {
        if (serial === undefined) delete process.env.VITEST_SERIAL_GATE;
        else process.env.VITEST_SERIAL_GATE = serial;
        for (const cap of [undefined, '1', '4', 'invalid']) {
          if (cap === undefined) delete process.env.INSTAR_TEST_MAX_WORKERS;
          else process.env.INSTAR_TEST_MAX_WORKERS = cap;
          const config = (await loadRunnerConfig()).default;
          expect(config.test?.maxWorkers).toBe(1);
          expect(config.test?.minWorkers).toBe(1);
          expect(config.test?.fileParallelism).toBe(false);
        }
      }
    } finally {
      if (saved.cap === undefined) delete process.env.INSTAR_TEST_MAX_WORKERS;
      else process.env.INSTAR_TEST_MAX_WORKERS = saved.cap;
      if (saved.serial === undefined) delete process.env.VITEST_SERIAL_GATE;
      else process.env.VITEST_SERIAL_GATE = saved.serial;
    }
  });

  it('the shipped pool finishes an injected slow file before starting the next file', async () => {
    const root = mkdtempSync(join(process.cwd(), '.worker-limit-'));
    try {
      const trace = join(root, 'trace');
      const config = join(root, 'vitest.config.mts');
      writeFileSync(config, `import config from ${JSON.stringify(join(process.cwd(), 'vitest.config.ts'))};
export default { ...config, test: { ...config.test, include: [${JSON.stringify(`${root}/*.test.ts`)}],
  globalSetup: [], setupFiles: [] } };\n`);
      for (const name of ['first', 'second']) {
        writeFileSync(join(root, `${name}.test.ts`), `import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
it('injected slow file', async () => {
  appendFileSync(${JSON.stringify(trace)}, '${name}:start\\n');
  await setTimeout(50);
  appendFileSync(${JSON.stringify(trace)}, '${name}:end\\n');
});\n`);
      }
      const result = await runChild(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
        '--maxWorkers', '1', '--config', config], { timeout: 20_000,
        env: { ...process.env, INSTAR_TEST_MAX_WORKERS: '4', VITEST_SERIAL_GATE: '0' } });
      expect(result.status, result.stderr + result.stdout).toBe(0);
      const rows = readFileSync(trace, 'utf8').trim().split('\n');
      expect(rows).toHaveLength(4);
      const names = rows.filter(row => row.endsWith(':start')).map(row => row.split(':')[0]);
      expect(new Set(names)).toEqual(new Set(['first', 'second']));
      expect(rows).toEqual(names.flatMap(name => [`${name}:start`, `${name}:end`]));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

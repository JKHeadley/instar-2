// The desk's per-run worker cap (tests/setup/worker-limit.ts, applied in vitest.config.ts).
// INSTAR_TEST_MAX_WORKERS may only lower the host formula, an unset value changes nothing, and
// an unusable value keeps the formula and is named back so the config can report it.
import { availableParallelism } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { resolveTestWorkerLimit } from '../setup/worker-limit.js';

const HOST_FORMULA = Math.max(1, Math.min(6, Math.floor(availableParallelism() / 2)));

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

  it('the runner config this host just loaded applies the cap it was launched with', async () => {
    const saved = { cap: process.env.INSTAR_TEST_MAX_WORKERS, serial: process.env.VITEST_SERIAL_GATE };
    try {
      delete process.env.VITEST_SERIAL_GATE;
      process.env.INSTAR_TEST_MAX_WORKERS = '2';
      const capped = (await loadRunnerConfig()).default;
      expect(capped.test?.maxWorkers).toBe(Math.min(2, HOST_FORMULA));
      delete process.env.INSTAR_TEST_MAX_WORKERS;
      const uncapped = (await loadRunnerConfig()).default;
      expect(uncapped.test?.maxWorkers).toBe(HOST_FORMULA);
      process.env.VITEST_SERIAL_GATE = '1';
      process.env.INSTAR_TEST_MAX_WORKERS = '4';
      const serial = (await loadRunnerConfig()).default;
      expect(serial.test?.maxWorkers).toBe(1);
      expect(serial.test?.fileParallelism).toBe(false);
    } finally {
      if (saved.cap === undefined) delete process.env.INSTAR_TEST_MAX_WORKERS;
      else process.env.INSTAR_TEST_MAX_WORKERS = saved.cap;
      if (saved.serial === undefined) delete process.env.VITEST_SERIAL_GATE;
      else process.env.VITEST_SERIAL_GATE = saved.serial;
    }
  });
});

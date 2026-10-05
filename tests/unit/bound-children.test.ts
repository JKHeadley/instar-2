// Both sides of the bound: a call that names no timeout is bounded and a hung child fails its
// own test with a named explanation; a call that names its own timeout (including 0) is
// untouched. The decisive case runs a REAL fresh process through
// tests/unit/bound-children-probe.mjs, so the doorway is proved against the real named
// `spawnSync`/`execFileSync`/`execSync` imports a test writes and real hung children — not a
// stub. The first attempt at this fix patched the child_process exports, passed its stub tests,
// and never fired on those named imports (a 600 s probe child outlived a 4 s case), which is
// why the live shape is the evidence here.
import { describe, it, expect } from 'vitest';
import { getCurrentTest } from '@vitest/runner';
import { spawnSync } from 'node:child_process';
import { constants } from 'node:os';
import { boundMessage, boundOptions, childBound, fallbackBound, patchSpawnBinding, FALLBACK_MS, TIMED_OUT_ERRNO }
  from '../setup/bound-children.mjs';
import type { SpawnBindingOptions } from '../setup/bound-children.mjs';

const thrown = (fn: () => unknown): NodeJS.ErrnoException | null => {
  try { fn(); return null; } catch (error) { return error as NodeJS.ErrnoException; }
};

describe('a hung child in a real process, through the imports a test writes', () => {
  const probe = spawnSync(process.execPath, ['tests/unit/bound-children-probe.mjs'],
    { encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL', env: { ...process.env, INSTAR_TEST_CHILD_BOUND_MS: '1200' } });

  it('kills it and explains, for each of the three synchronous calls', () => {
    expect(probe.status, probe.stderr).toBe(0);
    const report = JSON.parse(probe.stdout);
    for (const name of ['spawnSync', 'execFileSync', 'execSync']) {
      expect(report[name], name).toMatchObject({ threw: true, code: 'ETIMEDOUT' });
      expect(report[name].message, name).toContain('was killed after the 1200 ms bound');
      expect(report[name].message, name).toContain('tests/setup/bound-children.mjs');
      // It died on the bound, not on the 600 s the child asked to sleep.
      expect(report[name].ms, name).toBeLessThan(30_000);
    }
  }, 90_000);

  it('writes the same explanation to stderr, since the runner often reports its own timeout instead', () => {
    expect(probe.stderr).toContain('[instar tests] the child');
    expect(probe.stderr).toContain('was killed after the 1200 ms bound');
  }, 90_000);

  it('leaves a child that finishes inside its bound, and a caller-owned timeout, exactly as they were', () => {
    const report = JSON.parse(probe.stdout);
    expect(report.fast).toMatchObject({ threw: false, error: null });
    // Node reports the caller's own timeout through result.error; the doorway must not adopt it.
    expect(report.ownTimeout).toMatchObject({ threw: false, error: 'ETIMEDOUT' });
  }, 90_000);
});

describe('the bound a vitest case actually gets', () => {
  it('is that case\'s own declared timeout, read through the real runner', () => {
    const seen: SpawnBindingOptions[] = [];
    const binding = { spawn: (options: SpawnBindingOptions) => { seen.push({ ...options }); return {}; } };
    patchSpawnBinding(binding, () => getCurrentTest()?.timeout, () => 300_000, () => {});
    binding.spawn({ file: 'node' });
    expect(getCurrentTest()?.timeout).toBe(37_000);
    expect(seen[0]?.timeout).toBe(37_000);
  }, 37_000);

  it('does not raise the bound for a child whose own SIGKILL is the point of the test', () => {
    const result = spawnSync(process.execPath, ['-e', 'process.kill(process.pid, "SIGKILL")'], { encoding: 'utf8' });
    expect(result.signal).toBe('SIGKILL');
    expect(result.error).toBeUndefined();
  }, 30_000);

  it('reports a missing binary as a spawn failure, not as the bound', () => {
    const result = spawnSync('instar-no-such-binary', [], { encoding: 'utf8' });
    expect((result.error as NodeJS.ErrnoException | undefined)?.code).toBe('ENOENT');
  }, 30_000);
});

describe('bound selection', () => {
  it('prefers the declared test timeout and falls back only when there is none', () => {
    expect(childBound(30_000, 300_000)).toBe(30_000);
    expect(childBound(undefined, 300_000)).toBe(300_000);
    expect(childBound(0, 300_000)).toBe(300_000);
    expect(childBound(Number.NaN, 300_000)).toBe(300_000);
    expect(childBound(Number.POSITIVE_INFINITY, 300_000)).toBe(300_000);
    expect(childBound(-1, 300_000)).toBe(300_000);
  });

  it('reads the fallback from the environment and refuses a nonsense override', () => {
    expect(fallbackBound({})).toBe(FALLBACK_MS);
    expect(fallbackBound({ INSTAR_TEST_CHILD_BOUND_MS: '90000' })).toBe(90_000);
    expect(fallbackBound({ INSTAR_TEST_CHILD_BOUND_MS: 'soon' })).toBe(FALLBACK_MS);
    expect(fallbackBound({ INSTAR_TEST_CHILD_BOUND_MS: '0' })).toBe(FALLBACK_MS);
    expect(fallbackBound({ INSTAR_TEST_CHILD_BOUND_MS: '-5' })).toBe(FALLBACK_MS);
  });
});

describe('bounding the binding options', () => {
  it('injects the bound and a kill signal when the caller named neither', () => {
    const options: SpawnBindingOptions = { file: 'node' };
    expect(boundOptions(options, 7, 9)).toBe(7);
    expect(options).toEqual({ file: 'node', timeout: 7, killSignal: 9 });
  });

  it('keeps a caller timeout, including a deliberate unbounded 0, and its own kill signal', () => {
    const named: SpawnBindingOptions = { file: 'node', timeout: 500 };
    expect(boundOptions(named, 7, 9)).toBeNull();
    expect(named).toEqual({ file: 'node', timeout: 500 });
    const unbounded: SpawnBindingOptions = { file: 'node', timeout: 0 };
    expect(boundOptions(unbounded, 7, 9)).toBeNull();
    expect(unbounded).toEqual({ file: 'node', timeout: 0 });
    const signalled: SpawnBindingOptions = { file: 'node', killSignal: 15 };
    expect(boundOptions(signalled, 7, 9)).toBe(7);
    expect(signalled).toEqual({ file: 'node', killSignal: 15, timeout: 7 });
  });

  it('names the platform errno libuv reports for the timeout kill', () => {
    expect(TIMED_OUT_ERRNO).toBe(-constants.errno.ETIMEDOUT);
  });

  it('names the bound and the child in its message', () => {
    expect(boundMessage('/usr/bin/node', 60_000))
      .toContain('the child `/usr/bin/node` was killed after the 60000 ms bound');
  });
});

describe('patching the doorway', () => {
  it('bounds a fresh binding once, raises on its timeout errno, and is a no-op when applied again', () => {
    const seen: SpawnBindingOptions[] = [];
    const notes: string[] = [];
    const binding = { spawn: (options: SpawnBindingOptions) => { seen.push({ ...options }); return { error: TIMED_OUT_ERRNO }; } };
    const patched = patchSpawnBinding(binding, () => 11, () => 300_000, text => { notes.push(text); }).spawn;
    patchSpawnBinding(binding, () => 99, () => 300_000, () => {});
    expect(binding.spawn).toBe(patched);
    expect(thrown(() => binding.spawn({ file: 'node' }))?.message).toContain('after the 11 ms bound');
    expect(seen).toEqual([{ file: 'node', timeout: 11, killSignal: constants.signals.SIGKILL }]);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.endsWith('\n')).toBe(true);
  });

  it('returns a non-timeout result untouched and never raises for a caller-owned timeout', () => {
    const binding = { spawn: (_options: SpawnBindingOptions) => ({ status: 0, error: undefined }) };
    patchSpawnBinding(binding, () => 11, () => 300_000, () => {});
    expect(binding.spawn({ file: 'node' })).toEqual({ status: 0, error: undefined });
    const owned = { spawn: (_options: SpawnBindingOptions) => ({ error: TIMED_OUT_ERRNO }) };
    const notes: string[] = [];
    patchSpawnBinding(owned, () => 11, () => 300_000, text => { notes.push(text); });
    expect(owned.spawn({ file: 'node', timeout: 5 })).toEqual({ error: TIMED_OUT_ERRNO });
    expect(notes).toEqual([]);
  });

  it('uses the collection-time fallback when no case declares a timeout', () => {
    const seen: SpawnBindingOptions[] = [];
    const binding = { spawn: (options: SpawnBindingOptions) => { seen.push({ ...options }); return {}; } };
    patchSpawnBinding(binding, () => undefined, () => 123, () => {});
    binding.spawn({ file: 'git' });
    expect(seen[0]?.timeout).toBe(123);
  });
});

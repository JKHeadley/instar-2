// Both sides of the bound: a call that names no timeout is bounded and a hung child fails its
// own test with a named explanation; a call that names its own timeout (including 0) is
// untouched. The decisive cases run REAL fresh processes, so the doorway is proved against the
// real named `spawnSync`/`execFileSync`/`execSync` imports a test writes and real hung children
// — not a stub. tests/unit/bound-children-probe.mjs is the doorway as shipped;
// tests/unit/bound-children-unsynced-probe.mjs is the same export replacement with the one
// `syncBuiltinESMExports()` line removed, and shows the named import going unbounded — which is
// what makes that line the load-bearing part of the design rather than decoration.
import { describe, it, expect } from 'vitest';
import { getCurrentTest } from '@vitest/runner';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { constants } from 'node:os';
import { bindSyncCall, boundMessage, boundOptions, childBound, fallbackBound, optionsSlot,
  patchChildProcess, timedOut, BOUNDED, FALLBACK_MS, SYNC_CALLS } from '../setup/bound-children.mjs';
import type { SyncChildCall, SyncChildOptions } from '../setup/bound-children.mjs';

const thrown = (fn: () => unknown): NodeJS.ErrnoException | null => {
  try { fn(); return null; } catch (error) { return error as NodeJS.ErrnoException; }
};

const freshProbe = (script: string, bound?: string): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [script], {
    encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL',
    env: bound === undefined ? { ...process.env } : { ...process.env, INSTAR_TEST_CHILD_BOUND_MS: bound },
  });

describe('a hung child in a real process, through the imports a test writes', () => {
  const probe = freshProbe('tests/unit/bound-children-probe.mjs', '1200');

  it('kills it and explains, for each of the three synchronous calls', () => {
    expect(probe.status, probe.stderr).toBe(0);
    const report = JSON.parse(probe.stdout);
    for (const name of SYNC_CALLS) {
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

  // The arguments array is optional: `spawnSync(file, undefined, options)` and
  // `execFileSync(file, null, options)` are calls Node accepts, with the options still third.
  // Reading that omitted array as the options slot injected the bound into second position and
  // discarded the caller's own options — a real regression on real children, which is why these
  // cases run in the probe process rather than against a stub.
  it('reads the options from third position when the arguments array is omitted', () => {
    const report = JSON.parse(probe.stdout);
    // The caller's input and encoding survive, so the child still does its work and returns it.
    expect(report.omittedArrayFast).toMatchObject({ threw: false, error: null, stdout: 'ok' });
    expect(report.omittedArrayFastExecFile).toMatchObject({ threw: false, stdout: 'ok' });
  }, 90_000);

  it('still bounds an omitted-array call, and still leaves its own timeout to it', () => {
    const report = JSON.parse(probe.stdout);
    // No timeout named: the injected bound reaches the child and kills it.
    expect(report.omittedArrayHang).toMatchObject({ threw: true, code: 'ETIMEDOUT' });
    expect(report.omittedArrayHang.message).toContain('was killed after the 1200 ms bound');
    expect(report.omittedArrayHang.ms).toBeLessThan(30_000);
    // A timeout named in that third position is the caller's own: it is honoured as written and
    // never adopted as the bound. Discarding it would have raised the bound error here instead.
    expect(report.omittedArrayOwnTimeout).toMatchObject({ threw: false, error: 'ETIMEDOUT' });
  }, 90_000);
});

describe('why the export republish is the load-bearing line, in a real process', () => {
  it('without it the module object is bounded and the named import is not', () => {
    const probe = freshProbe('tests/unit/bound-children-unsynced-probe.mjs');
    expect(probe.status, probe.stderr).toBe(0);
    const report = JSON.parse(probe.stdout);
    // The wrapper was installed on the module object and fired there, at its 200 ms bound.
    expect(report.wrapped).toBe(1);
    expect(report.throughModuleObject.error).toBe('ETIMEDOUT');
    // The named import never reached it: the 4 s child ran to completion, unbounded.
    expect(report.throughNamedImport.error).toBeNull();
    expect(report.throughNamedImport.ms).toBeGreaterThan(3_000);
  }, 90_000);
});

describe('the bound a vitest case actually gets', () => {
  it('is that case\'s own declared timeout, read through the real runner', () => {
    const seen: SyncChildOptions[] = [];
    const bounded = bindSyncCall('spawnSync', (...args: readonly unknown[]) => {
      seen.push({ ...(args[2] as SyncChildOptions) }); return {};
    }, () => getCurrentTest()?.timeout, () => 300_000, () => {});
    bounded('node', ['-e', '']);
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

describe('bounding the options object', () => {
  it('injects the bound and a kill signal when the caller named neither', () => {
    const options: SyncChildOptions = { encoding: 'utf8' };
    expect(boundOptions(options, 7, 9)).toBe(7);
    expect(options).toEqual({ encoding: 'utf8', timeout: 7, killSignal: 9 });
  });

  it('keeps a caller timeout, including a deliberate unbounded 0, and its own kill signal', () => {
    const named: SyncChildOptions = { timeout: 500 };
    expect(boundOptions(named, 7, 9)).toBeNull();
    expect(named).toEqual({ timeout: 500 });
    const unbounded: SyncChildOptions = { timeout: 0 };
    expect(boundOptions(unbounded, 7, 9)).toBeNull();
    expect(unbounded).toEqual({ timeout: 0 });
    const signalled: SyncChildOptions = { killSignal: 'SIGTERM' };
    expect(boundOptions(signalled, 7, 9)).toBe(7);
    expect(signalled).toEqual({ killSignal: 'SIGTERM', timeout: 7 });
  });

  it('finds the options slot Node itself would read, with and without an arguments array', () => {
    // spawnSync(file, args, options) and execFileSync(file, args, options)
    expect(optionsSlot(['node', ['-e', ''], { timeout: 1 }])).toBe(2);
    // spawnSync(file, options) and execFileSync(file, options): a non-array object IS the options
    expect(optionsSlot(['node', { timeout: 1 }])).toBe(1);
    // The arguments array omitted as undefined/null, options still third — Node reads them there,
    // so taking the omitted array for the options would discard them.
    expect(optionsSlot(['node', undefined, { timeout: 1 }])).toBe(2);
    expect(optionsSlot(['node', null, { timeout: 1 }])).toBe(2);
    expect(optionsSlot(['node'])).toBe(2);
    // A second argument Node itself rejects is left where it is, so it still raises there.
    expect(optionsSlot(['node', '-e'])).toBe(2);
    // execSync(command[, options]) has no arguments array at all: always second, even when absent
    expect(optionsSlot(['true', { timeout: 1 }], false)).toBe(1);
    expect(optionsSlot(['true'], false)).toBe(1);
  });

  it('names the timeout kill by the code the public API reports, and nothing else', () => {
    expect(timedOut(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe(true);
    expect(timedOut({ code: 'ETIMEDOUT' })).toBe(true);
    expect(timedOut(Object.assign(new Error('x'), { code: 'ENOENT' }))).toBe(false);
    expect(timedOut(undefined)).toBe(false);
    expect(timedOut(null)).toBe(false);
    expect(timedOut('ETIMEDOUT')).toBe(false);
  });

  it('names the bound and the child in its message', () => {
    expect(boundMessage('/usr/bin/node', 60_000))
      .toContain('the child `/usr/bin/node` was killed after the 60000 ms bound');
  });
});

describe('wrapping one synchronous call', () => {
  it('injects the bound, raises on a returned timeout, and explains on stderr once', () => {
    const seen: unknown[][] = [];
    const notes: string[] = [];
    const bounded = bindSyncCall('spawnSync', (...args: readonly unknown[]) => {
      seen.push([...args]); return { error: Object.assign(new Error('t'), { code: 'ETIMEDOUT' }) };
    }, () => 11, () => 300_000, text => { notes.push(text); });
    expect(thrown(() => bounded('node', ['-e', '']))?.message).toContain('after the 11 ms bound');
    expect(seen).toEqual([['node', ['-e', ''], { timeout: 11, killSignal: constants.signals.SIGKILL }]]);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.endsWith('\n')).toBe(true);
  });

  it('raises the same explanation when the call throws its timeout instead of returning it', () => {
    const notes: string[] = [];
    const bounded = bindSyncCall('execSync', () => {
      throw Object.assign(new Error('spawnSync /bin/sh ETIMEDOUT'), { code: 'ETIMEDOUT' });
    }, () => 11, () => 300_000, text => { notes.push(text); });
    const error = thrown(() => bounded('true'));
    expect(error?.code).toBe('ETIMEDOUT');
    expect(error?.message).toContain('after the 11 ms bound');
    expect((error as { cause?: NodeJS.ErrnoException }).cause?.message).toBe('spawnSync /bin/sh ETIMEDOUT');
    expect(notes).toHaveLength(1);
  });

  it('passes any other failure through untouched, raised or returned', () => {
    const enoent = Object.assign(new Error('nope'), { code: 'ENOENT' });
    const raising = bindSyncCall('execSync', () => { throw enoent; }, () => 11, () => 300_000, () => {});
    expect(thrown(() => raising('true'))).toBe(enoent);
    const returning = bindSyncCall('spawnSync', () => ({ status: 0, error: undefined }), () => 11, () => 300_000, () => {});
    expect(returning('node')).toEqual({ status: 0, error: undefined });
  });

  it('leaves a caller-owned timeout alone: its own options object, and no raise on its timeout', () => {
    const seen: unknown[][] = [];
    const notes: string[] = [];
    const owned = { timeout: 5 };
    const bounded = bindSyncCall('spawnSync', (...args: readonly unknown[]) => {
      seen.push([...args]); return { error: Object.assign(new Error('t'), { code: 'ETIMEDOUT' }) };
    }, () => 11, () => 300_000, text => { notes.push(text); });
    const result = bounded('node', ['-e', ''], owned) as { error: NodeJS.ErrnoException };
    expect(result.error.code).toBe('ETIMEDOUT');
    // The very object the caller passed, not a bounded copy of it.
    expect(seen[0]?.[2]).toBe(owned);
    expect(owned).toEqual({ timeout: 5 });
    expect(notes).toEqual([]);
  });

  it('uses the collection-time fallback when no case declares a timeout', () => {
    const seen: unknown[][] = [];
    const bounded = bindSyncCall('spawnSync', (...args: readonly unknown[]) => { seen.push([...args]); return {}; },
      () => undefined, () => 123, () => {});
    bounded('git', ['show']);
    expect((seen[0]?.[2] as SyncChildOptions).timeout).toBe(123);
  });

  it('bounds a call whose options sit where no arguments array was given', () => {
    const seen: unknown[][] = [];
    const bounded = bindSyncCall('execSync', (...args: readonly unknown[]) => { seen.push([...args]); return ''; },
      () => 11, () => 300_000, () => {});
    bounded('true', { encoding: 'utf8' });
    expect(seen[0]?.[1]).toEqual({ encoding: 'utf8', timeout: 11, killSignal: constants.signals.SIGKILL });
  });

  it('bounds the third-position options of an omitted arguments array, keeping what they said', () => {
    for (const name of ['spawnSync', 'execFileSync']) {
      const seen: unknown[][] = [];
      const bounded = bindSyncCall(name, (...args: readonly unknown[]) => { seen.push([...args]); return {}; },
        () => 11, () => 300_000, () => {});
      bounded('node', undefined, { input: 'x', encoding: 'utf8' });
      expect(seen[0]?.[1], name).toBeUndefined();
      expect(seen[0]?.[2], name).toEqual({ input: 'x', encoding: 'utf8', timeout: 11,
        killSignal: constants.signals.SIGKILL });
    }
  });

  it('passes an omitted-array call that owns its timeout through byte-for-byte', () => {
    const seen: unknown[][] = [];
    const owned = { input: 'x', timeout: 5 };
    const bounded = bindSyncCall('spawnSync', (...args: readonly unknown[]) => { seen.push([...args]); return {}; },
      () => 11, () => 300_000, () => {});
    bounded('node', null, owned);
    // The caller's very object, in the position the caller put it.
    expect(seen[0]).toEqual(['node', null, owned]);
    expect(seen[0]?.[2]).toBe(owned);
    expect(owned).toEqual({ input: 'x', timeout: 5 });
  });
});

describe('patching the child_process exports', () => {
  const fake = (): Record<string, SyncChildCall> => Object.fromEntries(
    SYNC_CALLS.map(name => [name, () => name])) as Record<string, SyncChildCall>;

  it('wraps all three synchronous exports and republishes them once', () => {
    const published: number[] = [];
    const exports_ = fake();
    const originals = { ...exports_ };
    patchChildProcess(exports_ as never, () => 11, () => 300_000, () => {}, () => { published.push(1); });
    for (const name of SYNC_CALLS) {
      expect(exports_[name], name).not.toBe(originals[name]);
      expect(Reflect.get(exports_[name] as object, BOUNDED), name).toBe(true);
    }
    expect(published).toHaveLength(1);
  });

  it('is a no-op when applied again, and never republishes a second time', () => {
    const published: number[] = [];
    const exports_ = fake();
    patchChildProcess(exports_ as never, () => 11, () => 300_000, () => {}, () => { published.push(1); });
    const wrapped = { ...exports_ };
    patchChildProcess(exports_ as never, () => 99, () => 300_000, () => {}, () => { published.push(1); });
    for (const name of SYNC_CALLS) expect(exports_[name], name).toBe(wrapped[name]);
    expect(published).toHaveLength(1);
  });

  it('marks the module itself so an unrelated object is still patchable', () => {
    const exports_ = fake();
    patchChildProcess(exports_ as never, () => 11, () => 300_000, () => {}, () => {});
    expect(Reflect.get(exports_, BOUNDED)).toBe(true);
    expect(Reflect.get(fake(), BOUNDED)).toBeUndefined();
  });
});

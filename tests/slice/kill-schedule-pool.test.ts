// The pooled kill-schedule pre-step must be indistinguishable from the serial one in what it
// writes: same plan order, same file per profile+pair, same manifest keys — only the wall
// time changes. These cases pin that contract and the reuse decision's fail-closed edges.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error JavaScript helper outside pure core compilation.
import { defaultConcurrency, planExecutions, reusable, runPool } from '../../scripts/kill-schedule-pool.mjs';
// @ts-expect-error JavaScript helper outside pure core compilation.
import { artifactHash } from '../../scripts/kill-schedule-fingerprint.mjs';

const adjacent = (b: readonly string[]) => b.slice(1).map((x, i) => [b[i], x] as const);

describe('planExecutions', () => {
  it('lists controls before their pairs, in serial order, with file names fixed up front', () => {
    const jobs = planExecutions({ a: ['s0', 's1', 's2'], b: ['t0', 't1'] }, { a: [['s0', 's2']] }, adjacent);
    expect(jobs.map((j: { key: string }) => j.key)).toEqual(['a', 'a:s0+s1', 'a:s1+s2', 'a:s0+s2', 'b', 'b:t0+t1']);
    expect(jobs.map((j: { file: string }) => j.file)).toEqual(['control-a.json', 'pair-0.json', 'pair-1.json', 'pair-2.json', 'control-b.json', 'pair-3.json']);
    expect(jobs[0].cuts).toEqual([]);
    expect(jobs[3].cuts).toEqual(['s0', 's2']);
  });
});

describe('runPool', () => {
  it('returns results in plan order even when later jobs finish first, and never exceeds the bound', async () => {
    const jobs = [30, 5, 20, 1, 10];
    let inFlight = 0, peak = 0;
    const results = await runPool(jobs, async (ms: number, i: number) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, ms));
      inFlight--;
      return `job${i}:${ms}`;
    }, 2);
    expect(results).toEqual(['job0:30', 'job1:5', 'job2:20', 'job3:1', 'job4:10']);
    expect(peak).toBe(2);
  });
  it('concurrency 1 is strictly serial', async () => {
    const order: number[] = [];
    await runPool([3, 2, 1], async (ms: number, i: number) => { order.push(i); await new Promise(r => setTimeout(r, ms)); }, 1);
    expect(order).toEqual([0, 1, 2]);
  });
  it('a failing job stops new starts and rethrows after in-flight jobs settle', async () => {
    const started: number[] = [];
    await expect(runPool([1, 2, 3, 4], async (_: number, i: number) => {
      started.push(i);
      if (i === 1) throw new Error('drill failed');
      await new Promise(r => setTimeout(r, 5));
    }, 2)).rejects.toThrow('drill failed');
    expect(started).toEqual([0, 1]);
  });
});

describe('defaultConcurrency', () => {
  it('stays serial on a 2-core runner and scales to at most 4', () => {
    expect(defaultConcurrency({}, 2)).toBe(1);
    expect(defaultConcurrency({}, 4)).toBe(1);
    expect(defaultConcurrency({}, 8)).toBe(2);
    expect(defaultConcurrency({}, 16)).toBe(4);
    expect(defaultConcurrency({}, 64)).toBe(4);
  });
  it('honours a positive-integer override and refuses anything else', () => {
    expect(defaultConcurrency({ KILL_SCHEDULE_CONCURRENCY: '6' }, 2)).toBe(6);
    expect(() => defaultConcurrency({ KILL_SCHEDULE_CONCURRENCY: '0' }, 16)).toThrow();
    expect(() => defaultConcurrency({ KILL_SCHEDULE_CONCURRENCY: 'many' }, 16)).toThrow();
  });
});

describe('reusable', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const jobs = planExecutions({ a: ['s0', 's1'] }, {}, adjacent);
  const write = (dir: string, fingerprint: string, tamper: (index: any) => void = () => {}) => {
    const index: any = { fingerprint, pairs: {}, controls: {} };
    for (const job of jobs) {
      const bytes = JSON.stringify({ report: {}, firedCuts: [], boots: 1, neverReached: [], key: job.key });
      writeFileSync(join(dir, job.file), bytes);
      (job.kind === 'control' ? index.controls : index.pairs)[job.key] = { file: job.file, sha: artifactHash(bytes) };
    }
    tamper(index);
    writeFileSync(join(dir, 'index.json'), JSON.stringify(index));
  };
  const fresh = () => { const d = mkdtempSync(join(tmpdir(), 'ks-pool-')); dirs.push(d); return d; };

  it('accepts a complete set with the same fingerprint', () => {
    const d = fresh(); write(d, 'fp');
    expect(reusable(d, 'fp', jobs, artifactHash)).toBe(true);
  });
  it('refuses an absent directory, a stale fingerprint, a missing key, a missing file, and a torn file', () => {
    expect(reusable(join(tmpdir(), 'ks-pool-does-not-exist'), 'fp', jobs, artifactHash)).toBe(false);
    let d = fresh(); write(d, 'other'); expect(reusable(d, 'fp', jobs, artifactHash)).toBe(false);
    d = fresh(); write(d, 'fp', ix => { delete ix.pairs['a:s0+s1']; }); expect(reusable(d, 'fp', jobs, artifactHash)).toBe(false);
    d = fresh(); write(d, 'fp'); rmSync(join(d, 'pair-0.json')); expect(reusable(d, 'fp', jobs, artifactHash)).toBe(false);
    d = fresh(); write(d, 'fp'); writeFileSync(join(d, 'pair-0.json'), '{"report":{}'); expect(reusable(d, 'fp', jobs, artifactHash)).toBe(false);
  });
});

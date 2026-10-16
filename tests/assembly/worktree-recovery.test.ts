import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWorktreeRecovery } from '../../src/assembly/worktree-recovery.js';
import { decodeProcessInventory } from '../../src/assembly/process-inventory.js';
import type { WorktreeInventory } from '../../src/assembly/worktree-inventory.js';
import { intakeFixture, route, value, refused } from '../intake/fixtures.js';
// @ts-expect-error Physical adapter is JavaScript.
import { createWorktreeInventory, parseWorktreeList } from '../../scripts/worktree-inventory.mjs';

const captured = readFileSync(new URL('./fixtures/worktree-list-2026-10-15.bin', import.meta.url), 'utf8');
const path = parseWorktreeList(captured)[0].path as string;
const activity = { coveredFrom: 0, coveredThrough: 10000, lastActivity: 1000 };
const snapshot = (): WorktreeInventory => ({ machine: 'm', sourceTime: 10000, freshForMs: 100,
  status: 'complete', worktrees: [{ path, head: 'a'.repeat(40), dirty: true, owner: 'absent', activity }] });
const processes = () => decodeProcessInventory({ type: 'ProcessInventory', schemaVersion: 1, id: 'inventory:1',
  machine: 'm', hardwareProfile: 'h', adapter: 'a', adapterDigest: 'd', sourceTime: 10000, monotonicAt: 10,
  freshForMs: 100, cpuBasis: 'process-cpu-time', status: 'complete', examined: 0, omitted: 0, processes: [] });
const observation = () => ({ quietMs: 5000, worktrees: snapshot(), processes: processes(), ownership: new Map() });
const ports = (intake: ReturnType<ReturnType<typeof intakeFixture>['port']>) => ({ intake, route, machine: 'm',
  now: () => 10000, stopped: () => false, observe: async () => observation() });

describe('owned dirty-worktree recovery', () => {
  it('preserves and assigns one finding through real durable intake, including changed samples and restart', async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'worktree-intake-')));
    try {
      const f = intakeFixture({ directory });
      const first = value((await createWorktreeRecovery(ports(f.port())).tick())[0]!.disposition);
      expect(first).toMatchObject({ kind: 'admitted', owner: 'run-admission:owner', blockedOn: 'run-admission', boundOperator: false });
      const restart = intakeFixture({ directory });
      const next = ports(restart.port());
      next.observe = async () => { const o = observation(); return { ...o,
        worktrees: { ...o.worktrees, sourceTime: 10001, worktrees: o.worktrees.worktrees.map(w => ({ ...w,
          activity: { ...activity, coveredThrough: 10001 } })) }, processes: { ...o.processes, id: 'inventory:2', sourceTime: 10001 } }; };
      next.now = () => 10001;
      expect(value((await createWorktreeRecovery(next).tick())[0]!.disposition).kind).toBe('duplicate');
      expect(restart.facts().filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
      expect(restart.facts().filter(row => row.kind === 'intake-mismatch')).toHaveLength(0);
      const receipt = restart.facts().find(row => row.kind === 'intake-receipt')!;
      const capture = (receipt.body as { capture: { reference: string } }).capture.reference;
      const retained = readFileSync(join(directory, 'captures', encodeURIComponent(capture)), 'utf8');
      expect(JSON.parse(JSON.parse(retained).text).finding).toEqual({ machine: 'm', path, head: 'a'.repeat(40), lastActivity: 1000 });
      // A genuinely new activity episode at the same HEAD is new work.
      next.observe = async () => { const o = observation(); return { ...o, worktrees: { ...o.worktrees,
        worktrees: o.worktrees.worktrees.map(w => ({ ...w, activity: { ...activity, lastActivity: 2000 } })) } }; };
      expect(value((await createWorktreeRecovery(next).tick())[0]!.disposition).kind).toBe('admitted');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it.each(['live', 'unknown', 'recent', 'missing-history', 'partial-worktrees', 'partial-processes', 'unknown-cwd', 'foreign-machine', 'stale'])(
    'never opens recovery work for %s evidence', async neighbor => {
      const f = intakeFixture(), p = ports(f.port()), o = observation();
      if (neighbor === 'live' || neighbor === 'unknown') o.worktrees = { ...o.worktrees, worktrees: [{ ...o.worktrees.worktrees[0]!, owner: neighbor }] };
      if (neighbor === 'recent' || neighbor === 'missing-history') o.worktrees = { ...o.worktrees,
        worktrees: [{ ...o.worktrees.worktrees[0]!, activity: neighbor === 'recent' ? { ...activity, lastActivity: 9000 } : null }] };
      if (neighbor === 'partial-worktrees') o.worktrees = { ...o.worktrees, status: 'partial' };
      if (neighbor === 'partial-processes') o.processes = { ...o.processes, status: 'partial', omitted: 1 };
      if (neighbor === 'unknown-cwd') o.processes = { ...o.processes, examined: 1, processes: [{ pid: 99, ppid: 1, pgid: 99,
        uid: 501, start: 'Thu Oct 15 17:00:00 2026', command: 'worker', zombie: false, cwd: { state: 'unavailable' },
        resource: { state: 'unavailable', sourceSample: 'inventory:1', cumulativeCpuMs: null, rssBytes: null, heap: 'unsupported' } }] };
      if (neighbor === 'foreign-machine') p.machine = 'elsewhere';
      if (neighbor === 'stale') p.now = () => 10101;
      p.observe = async () => o;
      expect(await createWorktreeRecovery(p).tick()).toEqual([]);
      expect(f.frames).toHaveLength(0);
    });

  it('honors stop before observation and after a slow census, without a load test', async () => {
    const f = intakeFixture(), p = ports(f.port()); let stopped = true, observed = 0;
    p.stopped = () => stopped;
    p.observe = async () => { observed++; stopped = true; return observation(); };
    expect(await createWorktreeRecovery(p).tick()).toEqual([]); expect(observed).toBe(0);
    stopped = false;
    expect(await createWorktreeRecovery(p).tick()).toEqual([]); expect(observed).toBe(1);
    p.stopped = () => false;
    let now = 10000;
    p.now = () => now;
    p.observe = async () => { now += 101; return observation(); };
    expect(await createWorktreeRecovery(p).tick()).toEqual([]);
    expect(f.frames).toHaveLength(0);
  });

  it('retains an unresolved adapter refusal and its cause instead of reporting recovery success', async () => {
    const f = intakeFixture();
    f.deps.adapter.authenticate = () => { throw Error('observer identity unavailable'); };
    const rows = await createWorktreeRecovery(ports(f.port())).tick();
    refused(rows[0]!.disposition);
    expect(f.facts().some(row => row.kind === 'intake-held')).toBe(true);
    expect(f.facts().some(row => row.kind === 'intake-admitted')).toBe(false);
  });

  it('censuses a real dirty checkout and a replacement reads preserved recorded outputs without a registered promise', async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'worktree-recorded-')));
    try {
      const repository = join(directory, 'repo'), checkout = join(directory, 'abandoned');
      mkdirSync(repository);
      const git = (...args: string[]) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      git('init', '--quiet'); git('symbolic-ref', 'HEAD', 'refs/heads/recovery-test');
      writeFileSync(join(repository, 'base.txt'), 'base\n'); git('add', 'base.txt');
      git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'fixture base');
      const head = git('rev-parse', 'HEAD').trim();
      git('worktree', 'add', '--quiet', '-b', 'orphan', checkout);
      const recorded = readFileSync(new URL('../preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8');
      const shapes = JSON.parse(readFileSync(new URL('../preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
        import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
      // A real foreground builder exits leaving these uncommitted bytes. Its exact PID
      // and exit status are observed; the quiet interval/process census below are injected.
      const builder = spawnSync(process.execPath, ['--input-type=module', '-e',
        "import {readFileSync,writeFileSync} from 'node:fs'; const data=JSON.parse(readFileSync(0,'utf8')); for(const [name,bytes] of data) writeFileSync(name,bytes);"],
      { cwd: checkout, input: JSON.stringify([['retained-work.json', recorded],
        ...shapes.otherShapes.map(row => [`${row.kind}.txt`, row.raw])]), encoding: 'utf8', timeout: 5000 });
      expect(builder.pid).toBeGreaterThan(0); expect(builder.status).toBe(0);
      const census = createWorktreeInventory({ machine: 'm', now: () => 10000, freshForMs: 100, limit: 4,
        query: async (file: string, args: string[]) => execFileSync(file, args, { encoding: 'utf8', timeout: 5000 }),
        observe: async () => ({ owner: 'absent', activity }) });
      const f = intakeFixture({ directory: join(directory, 'intake') }), p = ports(f.port());
      p.observe = async () => ({ ...observation(), worktrees: await census.census(repository) });
      const report = await createWorktreeRecovery(p).tick();
      expect(report).toHaveLength(1); expect(value(report[0]!.disposition).kind).toBe('admitted');
      expect(report[0]!.finding.path).toBe(checkout);
      expect(value((await createWorktreeRecovery(p).tick())[0]!.disposition).kind).toBe('duplicate');
      const nextWorker = intakeFixture({ directory: join(directory, 'intake') });
      const receipt = nextWorker.facts().find(row => row.kind === 'intake-receipt')!;
      const ref = (receipt.body as { capture: { reference: string } }).capture.reference;
      const request = JSON.parse(JSON.parse(readFileSync(join(directory, 'intake', 'captures', encodeURIComponent(ref)), 'utf8')).text);
      const recovered = readFileSync(join(request.finding.path, 'retained-work.json'), 'utf8');
      expect(recovered).toBe(recorded);
      expect(shapes.otherShapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided',
        'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
      for (const row of shapes.otherShapes) expect(readFileSync(join(request.finding.path, `${row.kind}.txt`), 'utf8'), row.id).toBe(row.raw);
      expect(shapes.otherShapes.at(-1)!.raw).toBe('');
      expect(git('rev-parse', 'HEAD').trim()).toBe(head);
      expect(git('-C', checkout, 'status', '--porcelain')).toContain('?? retained-work.json');
      expect(git('status', '--porcelain')).toBe('');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

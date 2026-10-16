import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { abandonedWorktrees, type WorktreeInventory } from '../../src/assembly/worktree-inventory.js';
import { decodeProcessInventory } from '../../src/assembly/process-inventory.js';
// @ts-expect-error Physical adapter is JavaScript.
import { createWorktreeInventory, parseWorktreeList } from '../../scripts/worktree-inventory.mjs';

const captured = readFileSync(new URL('./fixtures/worktree-list-2026-10-15.bin', import.meta.url), 'utf8');
const worktrees = (): WorktreeInventory => ({ machine: 'm', sourceTime: 10000, freshForMs: 100,
  status: 'complete', worktrees: [{ path: '/work/abandoned', head: 'abc', dirty: true, owner: 'absent',
    activity: { coveredFrom: 0, coveredThrough: 10000, lastActivity: 1000 } }] });
const processes = () => decodeProcessInventory({ type: 'ProcessInventory', schemaVersion: 1, id: 'inventory:1',
  machine: 'm', hardwareProfile: 'h', adapter: 'a', adapterDigest: 'd', sourceTime: 10000, monotonicAt: 10,
  freshForMs: 100, cpuBasis: 'process-cpu-time', status: 'complete', examined: 1, omitted: 0,
  processes: [{ pid: 100, ppid: 1, pgid: 100, uid: 501, start: 'Thu Oct 15 17:00:00 2026', command: 'worker',
    zombie: false, cwd: { state: 'observed', path: '/work/neighbor' },
    resource: { state: 'reported', sourceSample: 'inventory:1', cumulativeCpuMs: 0, rssBytes: 1, heap: 'unsupported' } }] });
const input = () => ({ now: 10000, quietMs: 5000, worktrees: worktrees(), processes: processes(),
  ownership: new Map<number, 'non-owner' | 'owner' | 'unknown'>([[100, 'non-owner']]) });

describe('dirty orphan worktree observation', () => {
  it('finds only a dirty, quiet checkout after complete fresh exclusion of live ownership', () => {
    expect(abandonedWorktrees(input())).toEqual([{ machine: 'm', path: '/work/abandoned', head: 'abc',
      lastActivity: 1000, observedAt: 10000, processSample: 'inventory:1' }]);
  });
  it.each(['live', 'unknown'] as const)('keeps a %s owner', owner => {
    const x = input(); x.worktrees = { ...x.worktrees, worktrees: [{ ...x.worktrees.worktrees[0]!, owner }] };
    expect(abandonedWorktrees(x)).toEqual([]);
  });
  it.each([null, { coveredFrom: 6000, coveredThrough: 10000, lastActivity: 1000 },
    { coveredFrom: 0, coveredThrough: 9999, lastActivity: 1000 },
    { coveredFrom: 0, coveredThrough: 10000, lastActivity: 6000 }])('keeps missing, incomplete, or recent activity %j', activity => {
    const x = input(); x.worktrees = { ...x.worktrees, worktrees: [{ ...x.worktrees.worktrees[0]!, activity }] };
    expect(abandonedWorktrees(x)).toEqual([]);
  });
  it.each(['partial', 'failed'] as const)('never infers absence from a %s enumeration', status => {
    const x = input();
    expect(abandonedWorktrees({ ...x, worktrees: { ...x.worktrees, status } })).toEqual([]);
    expect(abandonedWorktrees({ ...x, processes: { ...x.processes, status } })).toEqual([]);
  });
  it('keeps unknown process directory and missing ownership joins', () => {
    const x = input();
    expect(abandonedWorktrees({ ...x, ownership: new Map() })).toEqual([]);
    expect(abandonedWorktrees({ ...x, processes: { ...x.processes,
      processes: [{ ...x.processes.processes[0]!, cwd: { state: 'unavailable' } }] } })).toEqual([]);
  });
  it('keeps a process working in the checkout or a descendant', () => {
    const x = input();
    for (const path of ['/work/abandoned', '/work/abandoned/sub'])
      expect(abandonedWorktrees({ ...x, processes: { ...x.processes,
        processes: [{ ...x.processes.processes[0]!, cwd: { state: 'observed', path } }] } })).toEqual([]);
  });
  it('rejects stale evidence, cross-machine joins, clean work and noncanonical paths', () => {
    const x = input();
    expect(abandonedWorktrees({ ...x, now: 10101 })).toEqual([]);
    expect(abandonedWorktrees({ ...x, processes: { ...x.processes, machine: 'other' } })).toEqual([]);
    for (const change of [{ dirty: false }, { path: '/work/../work/abandoned' }])
      expect(abandonedWorktrees({ ...x, worktrees: { ...x.worktrees,
        worktrees: [{ ...x.worktrees.worktrees[0]!, ...change }] } })).toEqual([]);
  });
});

describe('physical read-only census', () => {
  it('replays actual git worktree list bytes captured on this builder, and preserves missing activity', async () => {
    const rows = parseWorktreeList(captured);
    expect(rows.length).toBeGreaterThan(0);
    const calls: string[][] = [];
    const observer = createWorktreeInventory({ machine: 'm', now: () => 10000, freshForMs: 100, limit: 100,
      query: async (_file: string, args: string[]) => { calls.push(args); return args.includes('list') ? captured : '?? preserved.txt\0'; },
      observe: async () => null });
    const result = await observer.census(rows[0].path);
    expect(result.status).toBe('complete');
    expect(result.worktrees).toHaveLength(rows.length);
    expect(result.worktrees.every((row: { owner: string; activity: unknown }) => row.owner === 'unknown' && row.activity === null)).toBe(true);
    expect(calls.every(args => args[0] === '--no-optional-locks')).toBe(true);
    expect(calls.every(args => args.includes('list') || args.includes('status'))).toBe(true);
    expect(parseWorktreeList(captured.slice(0, -1))).toBeNull();
  });
  it('reports enumeration failure, failed checkout reads, and bounded truncation distinctly', async () => {
    const ports = { machine: 'm', now: () => 10000, freshForMs: 100, limit: 100,
      query: async (_file: string, args: string[]) => args.includes('list') ? captured : null,
      observe: async () => null };
    expect((await createWorktreeInventory(ports).census('/repo')).status).toBe('partial');
    expect((await createWorktreeInventory({ ...ports, query: async () => null }).census('/repo')).status).toBe('failed');
    expect((await createWorktreeInventory({ ...ports, limit: 0 }).census('/repo')).status).toBe('failed');
  });
});

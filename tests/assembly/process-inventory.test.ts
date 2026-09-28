// Part Ten's read-only process inventory (rows 40/63) and the launch-membership join.
import { spawn } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeProcessInventory, joinWorkingArea, launchMembership, startSeconds } from '../../src/assembly/index.js';
import type { InventoryProcess, LaunchRoot, ProcessInventorySnapshot } from '../../src/assembly/index.js';
// @ts-expect-error The physical adapter remains JavaScript.
import { createProcessInventory } from '../../scripts/process-inventory.mjs';
// @ts-expect-error The physical adapter remains JavaScript.
import { hostQuery, HOST_IDENTITY } from '../../scripts/resource-owner.mjs';

const T0 = 'Mon Sep 28 09:30:00 2026', T1 = 'Mon Sep 28 09:30:05 2026', T_BEFORE = 'Mon Sep 28 09:29:00 2026';
const proc = (pid: number, ppid: number, pgid: number, start = T1, extra: Partial<InventoryProcess> = {}): InventoryProcess => ({
  pid, ppid, pgid, uid: 501, start, command: `cmd-${pid}`, zombie: false, cwd: { state: 'unobserved' },
  resource: { state: 'reported', sourceSample: 'inventory:s', cumulativeCpuMs: 10, rssBytes: 4096, heap: 'unsupported' }, ...extra });
const snapshot = (processes: InventoryProcess[], status: 'complete' | 'partial' = 'complete'): ProcessInventorySnapshot => decodeProcessInventory({
  type: 'ProcessInventory', schemaVersion: 1, id: 'inventory:s', machine: 'machine:m', hardwareProfile: 'hardware:h',
  adapter: 'fixture', adapterDigest: `sha256:${'a'.repeat(64)}`, sourceTime: 1, monotonicAt: 1, freshForMs: 2000, cpuBasis: 'process-cpu-time',
  status, examined: processes.length, omitted: status === 'complete' ? 0 : 3, processes });
const root = (id: string, pid: number, start: string | null, area: string | null = '/work/area'): LaunchRoot =>
  ({ id, pid, known: new Map(start ? [[pid, start]] : []), workingArea: area, start });

describe('Ten process inventory decoder', () => {
  it('a failed census carries no rows and never reads as an empty population; complete counts must agree', () => {
    const base = { type: 'ProcessInventory', schemaVersion: 1, id: 'inventory:f', machine: 'm', hardwareProfile: 'h', adapter: 'a',
      adapterDigest: 'd', sourceTime: 1, monotonicAt: 1, freshForMs: 1, cpuBasis: 'process-cpu-time' };
    expect(decodeProcessInventory({ ...base, status: 'failed', examined: 0, omitted: null, processes: [] }).status).toBe('failed');
    expect(() => decodeProcessInventory({ ...base, status: 'failed', examined: 1, omitted: null,
      processes: [{ ...proc(5, 1, 5), resource: { ...proc(5, 1, 5).resource, sourceSample: 'inventory:f' } }] })).toThrow(/no rows/u);
    expect(() => decodeProcessInventory({ ...base, status: 'complete', examined: 2, omitted: 0, processes: [] })).toThrow(/complete counts/u);
    expect(() => decodeProcessInventory({ ...base, status: 'partial', examined: 0, omitted: 0, processes: [] })).toThrow(/partial counts/u);
  });

  it('a missing reading is an explicit state, never a synthetic zero; a source-reported zero is valid', () => {
    const exited = proc(7, 1, 7, T1, { resource: { state: 'process-exited', sourceSample: 'inventory:s', cumulativeCpuMs: null, rssBytes: null, heap: 'unsupported' } });
    expect(snapshot([exited]).processes[0]!.resource.state).toBe('process-exited');
    const zeroed = proc(7, 1, 7, T1, { resource: { state: 'permission-denied', sourceSample: 'inventory:s', cumulativeCpuMs: 0, rssBytes: 0, heap: 'unsupported' } });
    expect(() => snapshot([zeroed])).toThrow(/missing reading is not zero/u);
    const reportedZero = proc(7, 1, 7, T1, { resource: { state: 'reported', sourceSample: 'inventory:s', cumulativeCpuMs: 0, rssBytes: 0, heap: 'unsupported' } });
    expect(snapshot([reportedZero]).processes[0]!.resource.rssBytes).toBe(0);
    expect(() => snapshot([proc(7, 1, 7), proc(7, 1, 7)])).toThrow(/duplicate pid/u);
    expect(() => snapshot([proc(7, 1, 7, T1, { resource: { ...proc(7, 1, 7).resource, sourceSample: 'other' } })])).toThrow(/resource observation/u);
  });

  it('orders start identities on the civil clock without an ambient date API', () => {
    expect(startSeconds(T1)! - startSeconds(T0)!).toBe(5);
    expect(startSeconds('Sun Mar  1 00:00:00 2026')! - startSeconds('Sat Feb 28 23:59:59 2026')!).toBe(1);
    expect(startSeconds('Thu Jan  1 00:00:00 1970')).toBe(0);
    expect(startSeconds('garbage')).toBeNull();
  });
});

describe('launch membership join', () => {
  it('recorded incarnations join; a reused pid (another start identity) does not', () => {
    const s = snapshot([proc(100, 1, 100, T0), proc(200, 1, 200, T1)]);
    const launch: LaunchRoot = { id: 'L', pid: 100, known: new Map([[100, T0], [200, 'Mon Sep 28 08:00:00 2026']]), workingArea: null, start: T0 };
    const { members } = launchMembership(s, [launch], 999);
    expect(members.get(100)).toEqual({ launch: 'L', reason: 'recorded' });
    expect(members.has(200)).toBe(false);
  });

  it('group members join while the leader is the same incarnation or gone; a reused leader pid breaks the join', () => {
    const live = launchMembership(snapshot([proc(100, 50, 100, T0), proc(101, 1, 100)]), [root('L', 100, T0)], 999).members;
    expect(live.get(101)).toEqual({ launch: 'L', reason: 'group' });
    const gone = launchMembership(snapshot([proc(101, 1, 100)]), [root('L', 100, T0)], 999).members;
    expect(gone.get(101)).toEqual({ launch: 'L', reason: 'group' });
    const reused = launchMembership(snapshot([proc(100, 1, 100, T1), proc(101, 100, 100)]), [root('L', 100, T0)], 999).members;
    expect(reused.size).toBe(0);
  });

  it('ancestry joins descendants that left the group; a process under a live non-owned parent does not', () => {
    const s = snapshot([proc(100, 50, 100, T0), proc(300, 100, 300), proc(301, 300, 301), proc(999, 1, 999, T_BEFORE), proc(400, 999, 400)]);
    const { members } = launchMembership(s, [root('L', 100, T0)], 999);
    expect(members.get(300)).toEqual({ launch: 'L', reason: 'ancestry' });
    expect(members.get(301)).toEqual({ launch: 'L', reason: 'ancestry' });
    expect(members.has(400)).toBe(false);
  });

  it('working area: a detached, reparented escapee started after the launch in its private area joins; each other side does not', () => {
    const rows = [proc(100, 50, 100, T0), proc(500, 1, 500, T1), proc(501, 500, 501, T1), proc(600, 1, 600, T_BEFORE),
      proc(700, 1, 700, T1), proc(800, 999, 800, T1), proc(999, 1, 999, T_BEFORE)];
    const s = snapshot(rows), launches = [root('L', 100, T0)];
    const { members, candidates } = launchMembership(s, launches, 999);
    // 600 started before the launch; 800 hangs under the (live, non-owned) owner: neither is a candidate.
    expect([...candidates].sort()).toEqual([500, 501, 700]);
    expect(members.has(500)).toBe(false);
    const cwds = new Map<number, { state: 'observed'; path: string } | { state: 'unavailable' }>([
      [500, { state: 'observed', path: '/work/area' }], [501, { state: 'observed', path: '/work/area/sub' }],
      [700, { state: 'observed', path: '/elsewhere' }]]);
    const joined = joinWorkingArea(s, launches, candidates, cwds);
    expect(joined.get(500)).toEqual({ launch: 'L', reason: 'working-area' });
    expect(joined.get(501)).toEqual({ launch: 'L', reason: 'working-area' });
    expect(joined.has(700)).toBe(false);
    // A sibling path sharing the prefix is not inside the area; an unreadable directory never joins.
    expect(joinWorkingArea(s, launches, [500], new Map([[500, { state: 'observed', path: '/work/area-2' }]])).size).toBe(0);
    expect(joinWorkingArea(s, launches, [500], new Map([[500, { state: 'unavailable' }]])).size).toBe(0);
    // No working area (not private): no candidates at all.
    expect(launchMembership(s, [root('L', 100, T0, null)], 999).candidates).toEqual([]);
  });

  it('with two launches in one area, an escapee belongs to the newest launch that started no later than it', () => {
    const later = 'Mon Sep 28 09:30:03 2026';
    const s = snapshot([proc(100, 50, 100, T0), proc(110, 50, 110, later), proc(500, 1, 500, T1)]);
    const launches = [root('A', 100, T0), root('B', 110, later)];
    const { candidates } = launchMembership(s, launches, 999);
    expect(joinWorkingArea(s, launches, candidates, new Map([[500, { state: 'observed', path: '/work/area' }]])).get(500))
      .toEqual({ launch: 'B', reason: 'working-area' });
  });
});

describe('physical inventory adapter (real host)', () => {
  it('enumerates the current user completely, with reported readings and real working directories', async () => {
    const area = realpathSync(mkdtempSync(join(tmpdir(), 'inventory-')));
    const child = spawn('/bin/sleep', ['10'], { cwd: area, detached: true, stdio: 'ignore' });
    try {
      await new Promise(done => setTimeout(done, 150));
      const inventory = createProcessInventory({ query: hostQuery, now: () => 1, monotonic: () => 1, identity: HOST_IDENTITY,
        uid: process.getuid!(), limit: 4096, freshForMs: 2000 });
      const census = await inventory.census();
      expect(census.status).toBe('complete');
      const own = census.processes.find((p: InventoryProcess) => p.pid === process.pid);
      expect(own?.resource).toMatchObject({ state: 'reported', sourceSample: census.id });
      expect(own!.resource.rssBytes).toBeGreaterThan(0);
      expect(census.processes.some((p: InventoryProcess) => p.pid === child.pid)).toBe(true);
      const cwd = await inventory.workingDirectories([child.pid!, 99999999]);
      expect(cwd.get(child.pid)).toEqual({ state: 'observed', path: area });
      expect(cwd.get(99999999)).toEqual({ state: 'unavailable' });
      // A census past its bound is partial with the omitted count; a refused read is failed with no rows.
      const bounded = await createProcessInventory({ query: hostQuery, now: () => 1, monotonic: () => 1, identity: HOST_IDENTITY,
        uid: process.getuid!(), limit: 3, freshForMs: 2000 }).census();
      expect(bounded).toMatchObject({ status: 'partial', examined: 3 });
      expect(bounded.omitted).toBeGreaterThan(0);
      const denied = await createProcessInventory({ query: async () => null, now: () => 1, monotonic: () => 1, identity: HOST_IDENTITY,
        uid: process.getuid!(), limit: 4096, freshForMs: 2000 }).census();
      expect(denied).toMatchObject({ status: 'failed', examined: 0, omitted: null, processes: [] });
    } finally { try { process.kill(child.pid!, 'SIGKILL'); } catch { /* ended */ } rmSync(area, { recursive: true, force: true }); }
  });
});

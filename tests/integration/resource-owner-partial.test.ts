// @ts-expect-error Physical host adapter.
import { PROCESS_CENSUS_COLUMNS } from '../../scripts/process-census-query.mjs';
// Rules 26/42/60: partial observation cannot certify absence, but must not prevent
// reclaiming a child whose ownership is already established. No host load is generated.
import { spawn } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error Physical host adapter.
import { createResourceOwner, RESOURCE_CEILINGS, hostQuery } from '../../scripts/resource-owner.mjs';

it.each(['gone', 'unreadable', 'failed', 'partial'] as const)('reclaims known members without turning %s candidate evidence into quiescence', async mode => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'partial-census-')));
  const candidates = Array.from({ length: 80 }, (_, i) => 920000 + i);
  const fakeRows = candidates.map(pid => `${pid} 1 ${pid} 501 4096 0:00.10 S Tue Nov 3 15:00:00 2099 /bin/sleep`).join('\n');
  let censuses = 0, individualCandidateReads = 0, childPid = 0;
  const signals: number[] = [];
  const owner = createResourceOwner({ ...RESOURCE_CEILINGS, sampleMs: 60000 });
  await owner.attach({ query: async (file: string, args: string[]) => {
    if (file === '/bin/ps' && args.includes(PROCESS_CENSUS_COLUMNS)) {
      censuses++;
      if (mode === 'failed') return null;
      const real = await hostQuery(file, args);
      return real === null ? null : real.split('\n').filter((line: string) => Number(line.trim().split(/\s+/u)[0]) === childPid).join('\n') + '\n' + (mode === 'unreadable' || censuses === 1 ? fakeRows + '\n' : mode === 'partial' ? 'unreadable row\n' : '');
    }
    if (args.some(arg => candidates.includes(Number(arg)))) individualCandidateReads++;
    if (file === '/usr/sbin/lsof' || file === '/usr/bin/sudo') return '';
    return hostQuery(file, args);
  }, signal: (pid: number, signal: NodeJS.Signals) => {
    signals.push(pid);
    // Reclaim the exact child; this fixture does not signal a process group.
    if (pid > 0) process.kill(pid, signal);
  } });
  const held = await owner.hold('maintenance', { timeout: 10000, stopped: () => false });
  const child = spawn('/bin/sleep', ['30'], { cwd: root, detached: true, stdio: 'ignore' });
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  try {
    childPid = child.pid!;
    await held.attach({ pid: child.pid!, cwd: root });
    const outcome = await held.release();
    expect(outcome.verified).toBe(mode === 'gone');
    expect(signals.filter(pid => pid > 0)).toEqual(mode === 'failed' ? [] : [child.pid]);
    expect(signals.some(pid => candidates.includes(pid))).toBe(false);
    expect(individualCandidateReads).toBe(0);
    if (mode === 'gone') expect(censuses).toBeLessThanOrEqual(4);
    if (mode !== 'failed') await exited;
    else expect(() => process.kill(child.pid!, 0)).not.toThrow();
  } finally {
    try { process.kill(child.pid!, 'SIGKILL'); } catch { /* already reclaimed */ }
    await exited;
    rmSync(root, { recursive: true, force: true });
  }
});

it('rotates the bounded live window so later detached candidates are observed', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rotating-census-')));
  const candidates = Array.from({ length: 80 }, (_, i) => 920000 + i);
  const rows = candidates.map(pid => `${pid} 1 ${pid} 501 4096 0:00.10 S Tue Nov 3 15:00:00 2099 /bin/sleep`).join('\n');
  const observed = new Set<number>();
  const windows: number[] = [];
  let releasing = false;
  const owner = createResourceOwner({ ...RESOURCE_CEILINGS, sampleMs: 50, candidateLimit: 64 });
  await owner.attach({ query: async (file: string, args: string[]) => {
    if (file === '/bin/ps' && args.includes(PROCESS_CENSUS_COLUMNS)) {
      const real = await hostQuery(file, args);
      return real === null ? null : real + rows + '\n';
    }
    if (file === '/usr/sbin/lsof' || file === '/usr/bin/sudo') {
      const selected = args[args.indexOf('-p') + 1]!.split(',').map(Number);
      if (!releasing) {
        windows.push(selected.length);
        selected.filter(pid => candidates.includes(pid)).forEach(pid => observed.add(pid));
      }
      return selected.map(pid => `p${pid}\nn/\n`).join('');
    }
    return hostQuery(file, args);
  }, signal: (pid: number, signal: NodeJS.Signals) => { if (pid > 0) process.kill(pid, signal); } });
  const held = await owner.hold('maintenance', { timeout: 10000, stopped: () => false });
  const child = spawn('/bin/sleep', ['30'], { cwd: root, detached: true, stdio: 'ignore' });
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  try {
    await held.attach({ pid: child.pid!, cwd: root });
    const until = performance.now() + 5000;
    while (observed.size < candidates.length && performance.now() < until)
      await new Promise(resolve => setTimeout(resolve, 10));
    expect(observed.size).toBe(80);
    expect(windows.every(size => size <= 64)).toBe(true);
    expect(owner.snapshot().counters.partialSamples).toBeGreaterThan(0);
  } finally {
    releasing = true;
    await held.release();
    try { process.kill(child.pid!, 'SIGKILL'); } catch { /* already reclaimed */ }
    await exited;
    rmSync(root, { recursive: true, force: true });
  }
});

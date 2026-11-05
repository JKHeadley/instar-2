import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error physical host boundary is JavaScript
import { createKernelProcessControl, readExactProcessIdentity } from '../../scripts/process-control-kernel.mjs';

const children: ChildProcess[] = [];
const binding = { machine: 'isolated-linux-fixture', incarnation: 'fixture-owner' };
const rootObservation = process.platform === 'linux' ? readExactProcessIdentity(process.pid) : null;
const workerRoot = { pid: process.pid, startIdentity: rootObservation?.identity?.startIdentity ?? 'unsupported' };
const port = createKernelProcessControl({ ...binding, workerRoot });
afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      const ended = once(child, 'exit');
      child.kill('SIGKILL'); // Exact ChildProcess we created, never a pattern/group.
      await ended;
    }
  }
});
async function fixture(ignore = false) {
  const child = spawn(process.execPath, ['-e', `${ignore ? "process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});" : ''}process.stdout.write('ready');setInterval(()=>{},1000)`], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  await once(child.stdout!, 'data');
  const observed = readExactProcessIdentity(child.pid!);
  expect(observed.state).toBe('observed');
  return { child, target: { ...binding, ...observed.identity } };
}

describe.skipIf(process.platform !== 'linux')('kernel-pinned exact process signals (real own fixtures)', () => {
  it('signals one exact child and independently observes exit while its neighbor survives', async () => {
    const { child, target } = await fixture();
    const neighbor = await fixture();
    expect(port.observe(target).state).toBe('running');
    const ended = once(child, 'exit');
    expect(port.signal(target, 'SIGTERM').state).toBe('signalled');
    await ended;
    expect(port.observe(target).state).toBe('exited');
    expect(port.observe(neighbor.target).state).toBe('running');
    expect(port.signal(target, 'SIGKILL').state).toBe('refused');
  });
  it('supports each admitted escalation step without treating a signal receipt as exit', async () => {
    const { child, target } = await fixture(true);
    expect(port.signal(target, 'SIGINT').state).toBe('signalled');
    expect(port.observe(target).state).toBe('running');
    expect(port.signal(target, 'SIGTERM').state).toBe('signalled');
    expect(port.observe(target).state).toBe('running');
    const ended = once(child, 'exit');
    expect(port.signal(target, 'SIGKILL').state).toBe('signalled');
    await ended;
    expect(port.observe(target).state).toBe('exited');
  });
  it.each(['machine', 'incarnation', 'startIdentity', 'parentStartIdentity', 'parentPid', 'executable', 'argv'])(
    'refuses changed %s without touching the live target', async key => {
      const { target } = await fixture();
      const changed = { ...target, [key]: key === 'argv' ? [...target.argv].reverse() : key === 'parentPid' ? target.parentPid + 1 : `${target[key]}-changed` };
      expect(port.signal(changed, 'SIGKILL').state).toBe('refused');
      expect(port.observe(target).state).toBe('running');
    });
  it('refuses a non-descendant and a reused registered root even with an exact target', async () => {
    const { target } = await fixture();
    const other = await fixture();
    const unrelated = createKernelProcessControl({ ...binding, workerRoot: { pid: other.target.pid, startIdentity: other.target.startIdentity } });
    expect(unrelated.signal(target, 'SIGKILL').state).toBe('refused');
    const staleRoot = createKernelProcessControl({ ...binding, workerRoot: { ...workerRoot, startIdentity: 'old-boot:1' } });
    expect(staleRoot.signal(target, 'SIGKILL').state).toBe('refused');
    expect(createKernelProcessControl(binding).signal(target, 'SIGKILL').state).toBe('refused');
    expect(port.observe(target).state).toBe('running');
    expect(port.observe(other.target).state).toBe('running');
  });
  it('does not call an unreadable exact identity dead or accept a different signal', async () => {
    const { target } = await fixture();
    expect(port.observe({ ...target, parentStartIdentity: 'unrelated' }).state).toBe('unknown');
    expect(port.signal(target, 'SIGSTOP').state).toBe('refused');
    expect(port.observe(target).state).toBe('running');
  });
  it('a start-identity mismatch is absence of that incarnation, never authority over the current occupant', async () => {
    const { target } = await fixture();
    const old = { ...target, startIdentity: 'old-boot:1' };
    expect(port.observe(old).state).toBe('exited');
    expect(port.signal(old, 'SIGKILL').state).toBe('refused');
    expect(port.observe(target).state).toBe('running');
  });
});

import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});
const actualProcess = await vi.importActual<typeof import('node:child_process')>('node:child_process');
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionProtocolIO } from '../../scripts/session-protocol-io.mjs';
const roots: string[] = [];
const workers: Array<ReturnType<typeof createSessionProtocolIO>> = [];
afterEach(async () => { vi.mocked(execFileSync).mockImplementation(actualProcess.execFileSync); for (const io of workers.splice(0)) await io.close('claim', 'inc');
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'session-protocol-')); roots.push(root);
  const io = createSessionProtocolIO(root); workers.push(io);
  const launch = { claim: 'claim', incarnation: 'inc', executable: process.execPath,
    args: [fileURLToPath(new URL('./fixtures/protocol-process.mjs', import.meta.url))],
    env: { PATH: '/usr/bin:/bin' }, cwd: root, deadline: Date.now() + 10000, maxProcesses: 1, requestTimeoutMs: 500 };
  return { root, io, launch };
}
it('uses real pipes, correlates RPCs, captures early notifications, and rejects unowned server approval', async () => {
  const f = fixture(), worker = await f.io.open(f.launch);
  const [a, b] = await Promise.all([worker.request('initialize', { owner: 1 }), worker.request('echo', { owner: 2 })]);
  expect(a).toEqual({ echoed: { owner: 1 } }); expect(b).toEqual({ echoed: { owner: 2 } });
  const response = await worker.request('turn/start', {}); expect(response).toMatchObject({ turn: { id: expect.any(String) } });
  expect(worker.drain().some(frame => (frame as { method?: string }).method === 'turn/completed')).toBe(true);
  await worker.request('server-request', {});
  const captures = readdirSync(f.root).filter(name => name.endsWith('.jsonl')).map(name => readFileSync(join(f.root, name), 'utf8')).join('');
  expect(captures).toContain('host does not grant authority through protocol requests');
  expect(captures).toContain('LOCAL_PROTOCOL_OK');
  await expect(f.io.open(f.launch)).rejects.toThrow('capacity');
});
it('a reconstructed physical boundary stops only the recorded exact incarnation', async () => {
  const f = fixture(), worker = await f.io.open(f.launch);
  const next = createSessionProtocolIO(f.root); workers.push(next);
  await next.close('claim', 'other'); expect(worker.alive()).toBe(true);
  await next.close('claim', 'inc', worker.identity);
  await new Promise(resolve => setTimeout(resolve, 20)); expect(worker.alive()).toBe(false);
  const restarted = await next.open(f.launch); expect(restarted.identity).not.toBe(worker.identity);
  await next.close('claim', 'inc', worker.identity); expect(restarted.alive()).toBe(true);
});
it('malformed transport and unanswered requests never become success or retry', async () => {
  const f = fixture(), worker = await f.io.open({ ...f.launch, requestTimeoutMs: 50 });
  await expect(worker.request('hang', {})).rejects.toThrow('deadline');
  expect(worker.alive()).toBe(false); await worker.close();
  const next = await f.io.open(f.launch);
  await expect(next.request('malformed', {})).rejects.toThrow(); expect(next.alive()).toBe(false);
});

it.each(['denied', 'timeout', 'empty'])('unavailable %s inspection retains capacity and refuses reconstructed closure without signaling', async mode => {
  const f = fixture(), worker = await f.io.open(f.launch);
  const row = JSON.parse(readFileSync(join(f.root, 'processes.json'), 'utf8'))[0] as { pid: number };
  const next = createSessionProtocolIO(f.root);
  vi.mocked(execFileSync).mockImplementation(() => {
    if (mode === 'empty') return '';
    throw Object.assign(Error('observer unavailable'), { code: mode === 'denied' ? 'EPERM' : 'ETIMEDOUT' });
  });
  await expect(next.close('claim', 'inc', worker.identity)).rejects.toThrow('identity unavailable');
  await expect(next.open(f.launch)).rejects.toThrow('identity unavailable');
  expect(process.kill(row.pid, 0)).toBe(true);
  expect(await worker.request('echo', { still: 'running' })).toEqual({ echoed: { still: 'running' } });
});
it('positively absent recorded workers close and release capacity even when ps cannot read them', async () => {
  const f = fixture(), worker = await f.io.open(f.launch);
  const row = JSON.parse(readFileSync(join(f.root, 'processes.json'), 'utf8'))[0] as { pid: number };
  await worker.close();
  expect(() => process.kill(row.pid, 0)).toThrow();
  vi.mocked(execFileSync).mockImplementation((...args: Parameters<typeof execFileSync>) => {
    if ((args[1] as string[])[1] === String(row.pid)) throw Error('ps reports no process');
    return actualProcess.execFileSync(...args);
  });
  const next = createSessionProtocolIO(f.root); workers.push(next);
  await expect(next.close('claim', 'inc', worker.identity)).resolves.toBeUndefined();
  const fresh = await next.open(f.launch); expect(fresh.identity).not.toBe(worker.identity);
});
it('a different start stamp closes the old identity without signaling its live PID neighbor or consuming capacity', async () => {
  const f = fixture(), worker = await f.io.open(f.launch);
  const path = join(f.root, 'processes.json'), rows = JSON.parse(readFileSync(path, 'utf8'));
  const original = readFileSync(path, 'utf8');
  rows[0].stamp = 'different earlier start'; writeFileSync(path, JSON.stringify(rows));
  const next = createSessionProtocolIO(f.root);
  try {
    await next.close('claim', 'inc', worker.identity);
    expect(process.kill(rows[0].pid, 0)).toBe(true);
    expect(await worker.request('echo', { neighbor: true })).toEqual({ echoed: { neighbor: true } });
    const fresh = await next.open(f.launch);
    await fresh.close();
  } finally { writeFileSync(path, original); }
});

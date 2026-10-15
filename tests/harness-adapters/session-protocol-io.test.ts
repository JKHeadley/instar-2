import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionProtocolIO } from '../../scripts/session-protocol-io.mjs';
const roots: string[] = [];
const workers: Array<ReturnType<typeof createSessionProtocolIO>> = [];
afterEach(async () => { for (const io of workers.splice(0)) await io.close('claim', 'inc');
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

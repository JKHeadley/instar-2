import { afterEach, expect, it } from 'vitest';
import { createServer, type Server } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error Physical adapter stays outside the pure core.
import { requestSocket } from '../../scripts/custody-platform/linux.mjs';
// @ts-expect-error Existing closed supervisor protocol.
import { CHECKS, SCHEMA, projectSetupChecks } from '../../scripts/setup-supervisor-protocol.mjs';
// @ts-expect-error Installer composition.
import { setupPreparationOwners } from '../../scripts/setup-supervisor-owners.mjs';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const stop of cleanup.splice(0)) await stop(); });
async function socket(reply: (request: unknown) => string | Buffer[]) {
  const root = mkdtempSync(join(tmpdir(), 'setup-wire-')), path = join(root, 'owner.sock');
  const server: Server = createServer({ allowHalfOpen: true }, peer => {
    let bytes = '';
    peer.on('error', () => {});
    peer.on('data', data => { bytes += data; });
    peer.on('end', () => {
      const result = reply(JSON.parse(bytes));
      if (typeof result === 'string') { peer.end(result); return; }
      const send = (index: number) => {
        if (index === result.length) { peer.end(); return; }
        peer.write(result[index]!); setImmediate(() => send(index + 1));
      };
      send(0);
    });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(path, resolve); });
  cleanup.push(async () => { await new Promise<void>(resolve => server.close(() => resolve())); rmSync(root, { recursive: true, force: true }); });
  return path;
}
function record() {
  const checkpoint = { installation: 'i'.repeat(160), session: 's'.repeat(160), subject: 'a'.repeat(64),
    authority: 'g'.repeat(160), operation: 'o'.repeat(160), schema: SCHEMA, step: 'key', phase: 'post' };
  const checks = CHECKS.key.map((name: string, index: number) => ({ name, owner: 'custodian', observed: true, passed: true, receipt: `r${index + 1}` }));
  return { checkpoint: { ...checkpoint, frontier: 'f'.repeat(160) }, checks };
}
it('transports a complete bounded owner record through inspect and authenticate', async () => {
  const observed = record(), { frontier: _frontier, ...checkpoint } = observed.checkpoint;
  expect(projectSetupChecks(observed, checkpoint).checks).toHaveLength(8);
  const operations: string[] = [];
  const path = await socket(request => {
    const value = request as { operation: string; record?: unknown };
    operations.push(value.operation);
    return JSON.stringify(value.operation === 'inspect' ? observed : JSON.stringify(value.record) === JSON.stringify(observed));
  });
  const broker = { install() {}, verify() {}, start() {}, stop() {}, status: async () => ({ state: 'running' }),
    request: (request: unknown) => requestSocket(path, request) };
  const owners = setupPreparationOwners({ broker, facts: { request() { throw Error('not an append'); } } });
  expect(await owners.inspect(checkpoint)).toEqual(observed);
  const requestBytes = Buffer.byteLength(JSON.stringify({ kind: 'setup-owner-request', operation: 'authenticate', checkpoint, record: observed }));
  expect(requestBytes).toBeGreaterThan(2048);
  expect(await owners.authenticate(observed, checkpoint)).toBe(true);
  expect(operations).toEqual(['inspect', 'authenticate']);
});
it('retains finite byte ceilings on requests and responses, including multibyte text', async () => {
  let requests = 0;
  const path = await socket(() => { requests++; return JSON.stringify(true); });
  await expect(requestSocket(path, { payload: 'x'.repeat(16384) })).rejects.toThrow('request bound');
  expect(requests).toBe(0);
  const huge = await socket(() => JSON.stringify({ payload: 'é'.repeat(9000) }));
  await expect(requestSocket(huge, { operation: 'status' })).rejects.toThrow('request unavailable');
});
it('preserves UTF-8 split across socket chunks', async () => {
  const payload = 'é'.repeat(2500);
  const bytes = Buffer.from(JSON.stringify({ payload }));
  const split = bytes.indexOf(Buffer.from('é')) + 1;
  const path = await socket(() => [bytes.subarray(0, split), bytes.subarray(split)]);
  expect(await requestSocket(path, { operation: 'status' })).toEqual({ payload });
});

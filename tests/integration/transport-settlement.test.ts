import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('P6-NF-14 P6-NF-15 P6-NF-19 P6-NF-35 P6-NF-39 actual eight public seam applies once, preserves holds and refuses changed/copy/undurable settlement', async () => {
  // x64 ran this real child for 70.7s. Blocking the Vitest worker with spawnSync
  // starved its onTaskUpdate RPC despite every assertion passing. Keep the worker
  // responsive; do not raise reporting/global timeouts or weaken the fixture.
  let serviced = false; setImmediate(() => { serviced = true; });
  const child = await promisify(execFile)(process.execPath, ['tests/transport/settlement-joint.mjs', 'integration'], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  expect(serviced).toBe(true); // execFile rejects nonzero exit as well as timeout.
  expect(JSON.parse(child.stdout)).toMatchObject({ applications: 3, exposure: 7, released: 13, calls: 1 });
  // Compiled public packages, real P2 admission/replication and several independent
  // compositions; this budget is not a runtime-latency assertion.
}, 125000);

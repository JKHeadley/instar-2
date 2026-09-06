import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('P6-NF-14 P6-NF-15 P6-NF-19 P6-NF-35 P6-NF-39 actual eight public seam applies once, preserves holds and refuses changed/copy/undurable settlement', () => {
  const child = spawnSync(process.execPath, ['tests/transport/settlement-joint.mjs', 'integration'], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  expect(child.status, child.stderr).toBe(0);
  expect(JSON.parse(child.stdout)).toMatchObject({ applications: 3, exposure: 7, released: 13, calls: 1 });
  // Compiled public packages, real P2 admission/replication and several independent
  // compositions; this budget is not a runtime-latency assertion.
}, 125000);

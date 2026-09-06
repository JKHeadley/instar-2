import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

for (const phase of ['first', 'duplicate']) for (const at of [199, 200, 201]) {
  it(`P6-NF-14 P6-NF-19 P6-NF-35 P6-NF-39 N2 ${phase} accounting wait at ${at} precedes eight's final current evidence; no guarded six I/O`, async () => {
    // Actual emitted eight/six/P2 stores and the independent assessor guard, with
    // bounded asynchronous child execution so reporting RPC stays responsive.
    const child = await promisify(execFile)(process.execPath, ['tests/transport/settlement-waits.mjs', phase, String(at)],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    expect(JSON.parse(child.stdout)).toEqual({ phase, at, finalized: at <= 200, applications: 1, calls: 1 });
  }, 125000);
}

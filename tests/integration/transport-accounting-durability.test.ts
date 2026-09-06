import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('P6-NF-11 P6-NF-14 P6-NF-19 R1 peer loss at accounting append cannot fund weaker new work after reopen; exact proof resumes once', async () => {
  // Real compiled eight/six/P2 stores, multiple public boundary and replay calls.
  // Await the child so slow runners cannot starve Vitest reporting (R3).
  const child = await promisify(execFile)(process.execPath, ['tests/transport/settlement-durability.mjs', 'integration'],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  expect(JSON.parse(child.stdout)).toEqual({ applications: 1, exposure: 7, released: 13, calls: 1 });
}, 125000);

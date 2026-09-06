import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('P6-NF-09 P6-NF-13 P6-NF-19 P6-NF-39 a settled operation frees its run and a stranded prepared operation closes on absent-claim proof', async () => {
  // Real compiled six/eight/P2 stores driven only through six's public authority,
  // reproducing the part-eleven slice gap; awaited so Vitest reporting stays live.
  const child = await promisify(execFile)(process.execPath, ['tests/transport/settlement-close.mjs'],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  expect(JSON.parse(child.stdout)).toEqual({ closed: 'closed', released: 50, reserved: 93, applications: 1, calls: 1 });
}, 125000);

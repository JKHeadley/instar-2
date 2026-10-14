// Portable custody proof; native journal initialization remains in the macOS suite.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

it('creates an owner-only receipt key once, and never overwrites it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'receipt-key-'));
  const node = (...args: string[]) => spawnSync(process.execPath, ['scripts/fixed-native-worker-monitor.mjs', ...args], { encoding: 'utf8' });
  try {
    expect(node('keygen', join(dir, 'receipt.key'), join(dir, 'receipt.pub')).status).toBe(0);
    expect(statSync(join(dir, 'receipt.key')).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, 'receipt.pub')).mode & 0o777).toBe(0o644);
    const before = readFileSync(join(dir, 'receipt.key'));
    expect(node('keygen', join(dir, 'receipt.key'), join(dir, 'other.pub')).status).toBe(2);
    expect(readFileSync(join(dir, 'receipt.key'))).toEqual(before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

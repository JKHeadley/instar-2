import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('compiled register build adapter lifecycle', () => {
  it('P3-NF-01 P3-NF-07 P3-NF-09 actual CLI reproduces committed outputs and rejects edited output', () => {
    const root = mkdtempSync(join(tmpdir(), 'instar-register-e2e-'));
    try {
      const run = (...args: string[]) => execFileSync(process.execPath, ['scripts/build-register.mjs', '--out', root, ...args], { encoding: 'utf8' });
      const first = JSON.parse(run()) as { rules: number; entries: number; generation: string; authority: string };
      expect(first.rules).toBe(115); expect(first.entries).toBeGreaterThan(115); expect(first.authority).toBe('shape-only');
      const before = readFileSync(join(root, 'register.json'), 'utf8'); run('--check'); run();
      expect(readFileSync(join(root, 'register.json'), 'utf8')).toBe(before);
      expect(readFileSync(join(root, 'capabilities.md'), 'utf8')).toContain('register-tooling');
      expect(readFileSync(join(root, 'rules.md'), 'utf8').split('\n').some(line => /[ \t]+$/.test(line))).toBe(false);
      writeFileSync(join(root, 'shape.json'), '{}\n');
      const fail = spawnSync(process.execPath, ['scripts/build-register.mjs', '--out', root, '--check'], { encoding: 'utf8' });
      expect(fail.status).not.toBe(0); expect(fail.stderr).toContain('P3-NF-09');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

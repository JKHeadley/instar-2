import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const forbidden = 'P3-NF-21 P3-NF-23 SKIPPED: production spine admission, signed vector verification and replica initialization require the part-two adapter, absent on this lane base';

describe('round-seven strict contract map', () => {
  it('P3-NF-21 P3-NF-23 refuses the exact former pending arm even beside passing rows', () => {
    const root = mkdtempSync(join(tmpdir(), 'register-contract-map-exact-skip-'));
    try {
      for (const path of ['docs/07-the-declarations', 'generated']) mkdirSync(join(root, path), { recursive: true });
      cpSync('docs/07-the-declarations.md', join(root, 'docs/07-the-declarations.md'));
      cpSync('docs/07-the-declarations/part-three-slice-a1-scope.md',
        join(root, 'docs/07-the-declarations/part-three-slice-a1-scope.md'));
      cpSync('generated/register.json', join(root, 'generated/register.json'));
      const design = readFileSync(join(root, 'docs/07-the-declarations.md'), 'utf8');
      const ids = [...design.matchAll(/^\| (P3-NF-\d+) \|/gm)].map(match => match[1]!);
      writeFileSync(join(root, '.test-results.json'), JSON.stringify({ success: true,
        testResults: [{ name: 'tests/register/generator.test.ts', assertionResults:
          ids.map(id => ({ fullName: id, title: `${id} executable`, status: 'passed' })) },
        { name: 'tests/integration/register.test.ts', assertionResults: [
          { fullName: forbidden, title: forbidden, status: 'pending' },
        ] }] }));
      expect(() => execFileSync(process.execPath, [resolve('scripts/check-register-contract-map.mjs')], {
        cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      })).toThrow(/pending test arm has no exact design grant/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

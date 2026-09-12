import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const title = 'P3-NF-21 P3-NF-23 SKIPPED: production spine admission, signed vector verification and replica initialization require the part-two adapter, absent on this lane base';

describe('round-six restored legacy map exemption', () => {
  it('P3-NF-07 excludes only the exact byte-identical main-era skip while new coverage executes every contract', () => {
    const root = mkdtempSync(join(tmpdir(), 'register-contract-map-legacy-'));
    try {
      for (const path of ['docs', 'generated', 'tests/integration']) mkdirSync(join(root, path), { recursive: true });
      cpSync('docs/07-the-declarations.md', join(root, 'docs/07-the-declarations.md'));
      cpSync('generated/register.json', join(root, 'generated/register.json'));
      cpSync('tests/integration/register.test.ts', join(root, 'tests/integration/register.test.ts'));
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture',
        '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      git('init'); git('add', '.'); git('commit', '-qm', 'main baseline'); git('branch', '-M', 'main');
      const design = readFileSync(join(root, 'docs/07-the-declarations.md'), 'utf8');
      const ids = [...design.matchAll(/^\| (P3-NF-\d+) \|/gm)].map(match => match[1]!);
      const assertions = ids.map(id => ({ fullName: id, title: `${id} executable`, status: 'passed' }));
      writeFileSync(join(root, '.test-results.json'), JSON.stringify({ success: true, numPassedTests: ids.length,
        numPendingTests: 1, testResults: [
          { name: 'tests/register/shape-change-round2-review.test.ts', assertionResults: assertions },
          { name: 'tests/integration/register.test.ts', assertionResults: [
            { fullName: 'P3-NF-21 P3-NF-23', title, status: 'skipped' },
          ] },
        ] }));
      const run = () => execFileSync(process.execPath, [resolve('scripts/check-register-contract-map.mjs')], {
        cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      expect(run()).toContain('30 P3 contracts mapped');
      appendFileSync(join(root, 'tests/integration/register.test.ts'), '\n// changed outside main\n');
      expect(run).toThrow(/pending test arm has no exact design grant/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

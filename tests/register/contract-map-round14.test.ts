import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

const hold = 'HELD-BY-SCOPE:SEAM-LEDGER-row-124';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'contract-map-round-fourteen-'));
  mkdirSync(join(root, 'docs/07-the-declarations'), { recursive: true });
  mkdirSync(join(root, 'generated'), { recursive: true });
  cpSync('docs/07-the-declarations.md', join(root, 'docs/07-the-declarations.md'));
  cpSync('docs/07-the-declarations/part-three-slice-a1-scope.md',
    join(root, 'docs/07-the-declarations/part-three-slice-a1-scope.md'));
  cpSync('generated/register.json', join(root, 'generated/register.json'));
  return root;
}

it('map-missing-executable refuses P3-NF-09 without executed A1 evidence despite its exact row-124 hold', () => {
  const root = fixture();
  try {
    const design = readFileSync(join(root, 'docs/07-the-declarations.md'), 'utf8');
    const assertions = [...design.matchAll(/^\| (P3-NF-\d+) \|/gm)]
      .filter(match => match[1] !== 'P3-NF-09')
      .map(match => ({ fullName: `${match[1]} executable`, title: `${match[1]} executable`, status: 'passed' }));
    const held = { fullName: `held SKIPPED: ${hold} P3-NF-01/02/03/07/09/13/15/19/21/22/23/24/26/27/28/29 workflow enrollment`,
      title: 'all held workflow enrollment arms', status: 'pending' };
    writeFileSync(join(root, '.test-results.json'), JSON.stringify({ success: true, testResults: [
      { name: 'tests/register/generator.test.ts', assertionResults: assertions },
      { name: 'tests/integration/register-owner-enrollment-round7.test.ts', assertionResults: [held] },
    ] }));
    expect(() => execFileSync(process.execPath, [resolve('scripts/check-register-contract-map.mjs')], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })).toThrow(/P3-NF-09: executable A1 contract has no passing test result/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

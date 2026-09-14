import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hold = 'HELD-BY-SCOPE:SEAM-LEDGER-row-124';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'contract-map-round-twelve-'));
  mkdirSync(join(root, 'docs/07-the-declarations'), { recursive: true });
  mkdirSync(join(root, 'generated'), { recursive: true });
  cpSync('docs/05-the-types.md', join(root, 'docs/05-the-types.md'));
  cpSync('docs/07-the-declarations.md', join(root, 'docs/07-the-declarations.md'));
  cpSync('docs/07-the-declarations/part-three-slice-a1-scope.md',
    join(root, 'docs/07-the-declarations/part-three-slice-a1-scope.md'));
  cpSync('generated/register.json', join(root, 'generated/register.json'));
  return root;
}

function p3Assertions(root: string) {
  const design = readFileSync(join(root, 'docs/07-the-declarations.md'), 'utf8');
  return [...design.matchAll(/^\| (P3-NF-\d+) \|/gm)].map(match => ({ fullName: `${match[1]} executable`,
    title: `${match[1]} executable`, status: 'passed' }));
}

describe('round-twelve A1 contract-map re-slice', () => {
  it('P3-NF-07 accepts only the exact row-124 scope hold on a held workflow/enrollment file', () => {
    const root = fixture();
    try {
      const assertions = p3Assertions(root);
      assertions.push({ fullName: `held SKIPPED: ${hold} P3-NF-01/02/03/07/09/13/15/19/21/22/23/24/26/27/28/29 workflow enrollment`,
        title: 'all mixed workflow enrollment arms', status: 'pending' });
      writeFileSync(join(root, '.test-results.json'), JSON.stringify({ success: true, testResults: [
        { name: 'tests/register/generator.test.ts', assertionResults: assertions.slice(0, -1) },
        { name: 'tests/integration/register-owner-enrollment-round7.test.ts', assertionResults: assertions.slice(-1) },
      ] }));
      expect(() => execFileSync(process.execPath, [resolve('scripts/check-register-contract-map.mjs')], {
        cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      })).not.toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('P3-NF-07 expands multi-id names and refuses a claimed mixed arm with no actual test binding', () => {
    const root = fixture();
    try {
      const assertions = p3Assertions(root);
      assertions.push({ fullName: `held SKIPPED: ${hold} P3-NF-01/02/03/07/09/13/15/19/21/22/23/24/26/27/28`,
        title: 'mixed arms missing P3-NF-29', status: 'pending' });
      writeFileSync(join(root, '.test-results.json'), JSON.stringify({ success: true, testResults: [
        { name: 'tests/register/generator.test.ts', assertionResults: assertions.slice(0, -1) },
        { name: 'tests/integration/register-owner-enrollment-round7.test.ts', assertionResults: assertions.slice(-1) },
      ] }));
      expect(() => execFileSync(process.execPath, [resolve('scripts/check-register-contract-map.mjs')], {
        cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      })).toThrow(/P3-NF-29: row-124 workflow\/enrollment disposition has no actual test binding/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('P3-NF-07 refuses a passed A2 arm and a made-up grant label', () => {
    const root = fixture();
    try {
      const assertions = p3Assertions(root);
      const report = (held: { fullName: string; title: string; status: string }) => ({ success: true, testResults: [
        { name: 'tests/register/generator.test.ts', assertionResults: assertions },
        { name: 'tests/integration/register-owner-enrollment-round7.test.ts', assertionResults: [held] },
      ] });
      writeFileSync(join(root, '.test-results.json'), JSON.stringify(report({ fullName: 'P3-NF-09 A2 pass',
        title: 'P3-NF-09 A2 pass', status: 'passed' })));
      expect(() => execFileSync(process.execPath, [resolve('scripts/check-register-contract-map.mjs')], {
        cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      })).toThrow(/workflow\/enrollment arm was counted as an A1 pass/);
      writeFileSync(join(root, '.test-results.json'), JSON.stringify(report({
        fullName: 'held SKIPPED: GRANT:NON-EXECUTABLE-UNTIL-invented-slice P3-NF-09',
        title: 'P3-NF-09 invented hold', status: 'pending' })));
      expect(() => execFileSync(process.execPath, [resolve('scripts/check-register-contract-map.mjs')], {
        cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      })).toThrow(/pending test arm has no exact design grant/);
      writeFileSync(join(root, '.test-results.json'), JSON.stringify({ success: true, testResults: [{
        name: 'tests/register/generator.test.ts', assertionResults: [...assertions, {
          fullName: `SKIPPED: ${hold} P3-NF-09 wrong file`, title: 'P3-NF-09 wrong file', status: 'pending',
        }],
      }] }));
      expect(() => execFileSync(process.execPath, [resolve('scripts/check-register-contract-map.mjs')], {
        cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
      })).toThrow(/pending test arm has no exact design grant/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

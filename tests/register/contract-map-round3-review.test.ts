import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cases = [
  { script: resolve('scripts/check-register-contract-map.mjs'), design: 'docs/07-the-declarations.md', expression: /^\| (P3-NF-\d+) \|/gm,
    file: 'tests/register/shape-change-round2-review.test.ts' },
  { script: resolve('scripts/check-contract-map.mjs'), design: 'docs/05-the-types.md', expression: /^\| (NF-\d+) \|/gm,
    file: 'tests/types/compile.test.ts' },
];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'contract-map-round-three-'));
  mkdirSync(join(root, 'docs'), { recursive: true }); mkdirSync(join(root, 'generated'), { recursive: true });
  cpSync('docs/05-the-types.md', join(root, 'docs/05-the-types.md'));
  cpSync('docs/07-the-declarations.md', join(root, 'docs/07-the-declarations.md'));
  cpSync('generated/register.json', join(root, 'generated/register.json'));
  return root;
}
function run(root: string, script: string) {
  return () => execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

describe('round-three contract-map checker regressions', () => {
  it('P3-NF-07 refuses unrelated real grants and invented grant names for every pending arm', () => {
    for (const item of cases) {
      const root = fixture();
      try {
        const ids = [...readFileSync(join(root, item.design), 'utf8').matchAll(item.expression)].map(match => match[1]!);
        for (const grant of ['part-nine:semantic-adequacy-of-held-edges', 'invented-owner:invented-grant']) {
          writeFileSync(join(root, '.test-results.json'), JSON.stringify({ success: true, numPassedTests: 0, numPendingTests: ids.length,
            testResults: [{ name: item.file, assertionResults: ids.map(id => ({ fullName: id,
              title: `${id} SKIPPED: GRANT:${grant}`, status: 'pending' })) }] }));
          expect(run(root, item.script)).toThrow(/pending test arm has no exact design grant/);
        }
      } finally { rmSync(root, { recursive: true, force: true }); }
    }
  });

  it('P3-NF-07 refuses a skipped arm even when another arm for the same ID passed', () => {
    for (const item of cases) {
      const root = fixture();
      try {
        const ids = [...readFileSync(join(root, item.design), 'utf8').matchAll(item.expression)].map(match => match[1]!);
        const assertions = ids.map(id => ({ fullName: id, title: `${id} executable`, status: 'passed' }));
        assertions.push({ fullName: ids[0]!, title: `${ids[0]} unavailable adapter`, status: 'pending' });
        writeFileSync(join(root, '.test-results.json'), JSON.stringify({ success: true, numPassedTests: ids.length, numPendingTests: 1,
          testResults: [{ name: item.file, assertionResults: assertions }] }));
        expect(run(root, item.script)).toThrow(/pending test arm has no exact design grant/);
      } finally { rmSync(root, { recursive: true, force: true }); }
    }
  });
});

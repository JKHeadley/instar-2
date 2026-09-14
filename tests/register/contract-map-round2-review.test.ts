import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('round-two contract-map checker regressions', () => {
  it('P3-NF-07 rejects an all-pending report whose SKIPPED reason invents a design grant', () => {
    const root = mkdtempSync(join(tmpdir(), 'p3-contract-map-round-two-'));
    try {
      mkdirSync(join(root, 'docs/07-the-declarations'), { recursive: true }); mkdirSync(join(root, 'generated'), { recursive: true });
      cpSync('docs/05-the-types.md', join(root, 'docs/05-the-types.md'));
      cpSync('docs/07-the-declarations.md', join(root, 'docs/07-the-declarations.md'));
      cpSync('docs/07-the-declarations/part-three-slice-a1-scope.md',
        join(root, 'docs/07-the-declarations/part-three-slice-a1-scope.md'));
      cpSync('generated/register.json', join(root, 'generated/register.json'));
      const cases = [
        { script: resolve('scripts/check-register-contract-map.mjs'), design: 'docs/07-the-declarations.md', expression: /^\| (P3-NF-\d+) \|/gm,
          file: 'tests/register/shape-change-round2-review.test.ts' },
        { script: resolve('scripts/check-contract-map.mjs'), design: 'docs/05-the-types.md', expression: /^\| (NF-\d+) \|/gm,
          file: 'tests/types/compile.test.ts' },
      ];
      for (const item of cases) {
        const text = readFileSync(join(root, item.design), 'utf8');
        const ids = [...text.matchAll(item.expression)].map(match => match[1]);
        writeFileSync(join(root, '.test-results.json'), JSON.stringify({ success: true, numPassedTests: 0, numPendingTests: ids.length,
          testResults: [{ name: item.file, assertionResults: ids.map(id => ({ fullName: id,
            title: `${id} SKIPPED: non-executable-until-invented-not-in-any-design`, status: 'pending' })) }] }));
        expect(() => execFileSync(process.execPath, [item.script], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
          .toThrow(/pending test arm has no exact design grant|neither passed|test failed/);
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

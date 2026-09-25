import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error The executable repository checker is intentionally plain ESM.
import { checkP13A1Scope, checkP13A2Scope, checkP13DependencyCitations, p13Dispositions } from '../../scripts/check-p13-contract-map.mjs';

interface Disposition { id: string; number: number; status: string; heldArms?: string }

it('P13 A1 and A2 first-landing fixtures permit additions, reject foreign edits, then retain structural gates', () => {
  const root = mkdtempSync(join(tmpdir(), 'p13-first-landing-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (path: string, body: string) => writeFileSync(join(root, path), body);
  try {
    git('init', '-b', 'main');
    git('config', 'user.email', 'p13-fixture@instar.local');
    git('config', 'user.name', 'P13 Fixture');
    mkdirSync(join(root, 'src', 'harness-adapters'), { recursive: true });
    put('src/harness-adapters/index.ts', 'older parent package\n');
    git('add', '.'); git('commit', '-m', 'parent package');
    git('switch', '-c', 'a1');
    put('src/harness-adapters/admission.ts', 'A1 addition\n');
    expect(checkP13A1Scope(root)).toMatchObject({ applicable: true });
    put('src/foreign.ts', 'foreign mutation\n');
    expect(() => checkP13A1Scope(root)).toThrow(/out-of-scope path: src\/foreign\.ts/);
    rmSync(join(root, 'src', 'foreign.ts'));
    rmSync(join(root, 'src', 'harness-adapters', 'admission.ts'));
    git('switch', 'main');
    put('src/harness-adapters/admission.ts', 'landed A1\n');
    git('add', '.'); git('commit', '-m', 'land A1');
    git('switch', '-c', 'a2');
    put('src/harness-adapters/adapter.ts', 'A2 addition\n');
    put('src/harness-adapters/holder.ts', 'A2 addition\n');
    expect(checkP13A2Scope(root)).toMatchObject({ applicable: true });
    put('src/foreign.ts', 'foreign mutation\n');
    expect(() => checkP13A2Scope(root)).toThrow(/out-of-scope paths: src\/foreign\.ts/);
    rmSync(join(root, 'src', 'foreign.ts'));
    rmSync(join(root, 'src', 'harness-adapters', 'adapter.ts'));
    rmSync(join(root, 'src', 'harness-adapters', 'holder.ts'));
    git('switch', 'main');
    put('src/harness-adapters/adapter.ts', 'landed A2\n');
    put('src/harness-adapters/holder.ts', 'landed A2\n');
    git('add', '.'); git('commit', '-m', 'land A2');
    git('switch', '-c', 'later');
    put('src/harness-adapters/adapter.ts', 'later owner edit\n');
    put('src/foreign.ts', 'later cross-owner edit\n');
    expect(checkP13A1Scope(root)).toMatchObject({ applicable: false });
    expect(checkP13A2Scope(root)).toMatchObject({ applicable: false });
    const rows: Disposition[] = p13Dispositions();
    expect(() => checkP13DependencyCitations(rows.map(row => row.number === 31
      ? { ...row, heldArms: 'NON-EXECUTABLE-UNTIL-false-grant' } : row))).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

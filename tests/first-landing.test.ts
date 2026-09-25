import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error The shared baseline checker is intentionally plain ESM.
import { firstLanding } from '../scripts/first-landing.mjs';

it('each unit uses its own baseline implementation evidence, including later seams inside older packages', () => {
  const root = mkdtempSync(join(tmpdir(), 'first-landing-units-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const put = (path: string, body: string) => {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), body);
  };
  const units = [
    'src/conversation/index.ts', 'src/harness-adapters/admission.ts',
    'src/harness-adapters/adapter.ts', 'src/harness-adapters/holder.ts',
    'src/operator/seams.ts', 'src/assembly/grounding-capability.ts',
    'src/scheduled/index.ts', 'src/transport/loop-a1/index.ts',
    'src/measurement/index.ts',
  ];
  try {
    git('init', '-b', 'main');
    git('config', 'user.email', 'first-landing@instar.local');
    git('config', 'user.name', 'First Landing Fixture');
    put('src/harness-adapters/index.ts', 'older parent package\n');
    put('src/assembly/index.ts', 'older parent package\n');
    put('src/transport/index.ts', 'older parent package\n');
    put('src/owner.ts', 'inherited owner\n');
    git('add', '.'); git('commit', '-m', 'older owners and parent packages');
    git('switch', '-c', 'unlanded');
    put('src/new-feature.ts', 'permitted additive file\n');
    git('add', '.'); git('commit', '-m', 'permitted addition');
    for (const unit of units) expect(firstLanding(root, [unit]).applicable, unit).toBe(true);

    git('switch', 'main');
    for (const unit of units) put(unit, `landed ${unit}\n`);
    git('add', '.'); git('commit', '-m', 'land exact units');
    git('switch', '-c', 'later');
    put('src/owner.ts', 'later cross-owner edit\n');
    put('src/harness-adapters/adapter.ts', 'later owner edit\n');
    git('add', '.'); git('commit', '-m', 'later owner and cross-owner edits');
    for (const unit of units) expect(firstLanding(root, [unit]).applicable, unit).toBe(false);
    expect(firstLanding(root, ['src/harness-adapters/adapter.ts', 'src/harness-adapters/holder.ts']).applicable)
      .toBe(false);
    expect(() => firstLanding(root, ['src/scheduled/index.ts'], 'missing-main')).toThrow();
    expect(() => firstLanding(root, ['src/scheduled/index.ts'], 'main', 'unlanded')).toThrow(/stale/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

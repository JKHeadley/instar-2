import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { historicalModule } from './historical-module.js';
// @ts-expect-error The production evidence checker is executable ESM tooling.
import { productionGroundingSourceDigest } from '../../scripts/check-assembly-contracts.mjs';

it('historical imports and exports keep dependency identity without rewriting ordinary text', async () => {
  const sourceRoot = realpathSync(mkdtempSync(join(tmpdir(), 'history-source-')));
  const targetRoot = realpathSync(mkdtempSync(join(tmpdir(), 'history-target-')));
  try {
    const dependency = join(sourceRoot, 'dependency.mjs');
    writeFileSync(dependency, 'export const identity = {};');
    const original = join(sourceRoot, 'original.ts');
    const source = `import { identity } from './dependency.mjs';
import { basename } from 'node:path';
export { identity as exported } from './dependency.mjs';
export const same = identity;
export const text = "from './dependency.mjs'";
export const name = basename('/a/b');
// import { untouched } from './comment.js';
`;
    const destination = join(targetRoot, 'historical.ts');
    const moved = await import(historicalModule(source, original, destination));
    const current = await import(dependency);
    expect(moved.same).toBe(current.identity);
    expect(moved.exported).toBe(current.identity);
    expect(moved.name).toBe('b');
    expect(moved.text).toBe("from './dependency.mjs'");
    expect(readFileSync(destination, 'utf8')).toContain("// import { untouched } from './comment.js';");
    expect(() => historicalModule(source, original, destination)).toThrow();
  } finally {
    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

it('sampling the real gate digest while historical provider and journal modules exist does not change it', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'history-digest-')));
  try {
    const before = productionGroundingSourceDigest();
    for (const [index, [commit, path]] of [
      ['0a61aaf8', 'src/assembly/production-provider.ts'],
      ['08220af9', 'src/assembly/production-provider.ts'],
      ['08220af9', 'tests/preview/journal.ts'],
      ['7d824d64', 'tests/preview/journal.ts'],
    ].entries()) {
      const source = execFileSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8' });
      historicalModule(source, join(process.cwd(), path!), join(root, `historical-${index}.ts`));
      // Deterministic overlap: the old modules remain present during the other
      // worker's exact sampler, without relying on scheduling or adding load.
      expect(productionGroundingSourceDigest()).toBe(before);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('the unchanged checker detects the former sibling scratch file as a source change', () => {
  const checkout = realpathSync(mkdtempSync(join(tmpdir(), 'history-checkout-')));
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'history-outside-')));
  try {
    for (const path of ['src/assembly', 'node_modules/vitest', 'node_modules/@vitest/expect',
      'node_modules/@vitest/runner', 'node_modules/@vitest/snapshot', 'node_modules/@vitest/utils',
      'node_modules/chai', 'node_modules/typescript']) mkdirSync(join(checkout, path), { recursive: true });
    const original = join(checkout, 'src/assembly/provider.ts');
    writeFileSync(original, 'export const current = true;\n');
    const before = productionGroundingSourceDigest(checkout);
    historicalModule('export const prior = true;\n', original, join(scratch, 'prior.ts'));
    expect(productionGroundingSourceDigest(checkout)).toBe(before);
    const sibling = join(checkout, 'src/assembly/.old-policy-provider-123.ts');
    writeFileSync(sibling, 'export const prior = true;\n');
    expect(productionGroundingSourceDigest(checkout)).not.toBe(before);
    rmSync(sibling);
    expect(productionGroundingSourceDigest(checkout)).toBe(before);
    writeFileSync(original, 'export const current = false;\n');
    expect(productionGroundingSourceDigest(checkout)).not.toBe(before);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
  }
});

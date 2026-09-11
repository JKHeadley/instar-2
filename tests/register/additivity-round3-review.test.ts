import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainEraExemptions = new Map([
  ['tests/integration/register.test.ts', 'P3-NF-21/23 implemented by row 77'],
]);

describe('permanent Part Three additivity gate', () => {
  it('P3-NF-09 keeps every other test and fixture that existed on main byte-identical', () => {
    const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', 'main', '--', 'tests'], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    const changed = paths.filter(path => !mainEraExemptions.has(path)
      && !readFileSync(path).equals(execFileSync('git', ['show', `main:${path}`])));
    expect(paths).toHaveLength(189);
    expect([...mainEraExemptions]).toEqual([
      ['tests/integration/register.test.ts', 'P3-NF-21/23 implemented by row 77'],
    ]);
    expect(paths).toEqual(expect.arrayContaining([...mainEraExemptions.keys()]));
    expect(changed, `main-vs-HEAD additivity changed: ${changed.join(', ')}`).toEqual([]);
  });
});

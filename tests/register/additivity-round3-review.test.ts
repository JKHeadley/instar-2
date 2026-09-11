import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('permanent Part Three additivity gate', () => {
  it('P3-NF-09 keeps every test and fixture that existed on main byte-identical', () => {
    const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', 'main', '--', 'tests'], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    const changed = paths.filter(path => !readFileSync(path).equals(execFileSync('git', ['show', `main:${path}`])));
    expect(paths.length).toBeGreaterThan(0);
    expect(changed, `main-vs-HEAD additivity changed: ${changed.join(', ')}`).toEqual([]);
  });
});

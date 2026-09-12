import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainEraExemptions = new Map([
  ['tests/integration/register.test.ts', 'P3-NF-21/23 implemented by row 77'],
]);

describe('permanent Part Three additivity gate', () => {
  it('P3-NF-09 keeps every other test and fixture that existed on main byte-identical', () => {
    const base = execFileSync('git', ['merge-base', 'main', 'HEAD'], { encoding: 'utf8' }).trim();
    const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', base, '--', 'tests'], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    const changed = paths.filter(path => !mainEraExemptions.has(path)
      && !readFileSync(path).equals(execFileSync('git', ['show', `${base}:${path}`])));
    expect(paths).toHaveLength(189);
    expect([...mainEraExemptions]).toEqual([
      ['tests/integration/register.test.ts', 'P3-NF-21/23 implemented by row 77'],
    ]);
    expect(paths).toEqual(expect.arrayContaining([...mainEraExemptions.keys()]));
    expect(changed, `main-vs-HEAD additivity changed: ${changed.join(', ')}`).toEqual([]);
  });

  it('P3-NF-09 confines protected decoder changes to the normal provider seam', () => {
    const base = execFileSync('git', ['merge-base', 'main', 'HEAD'], { encoding: 'utf8' }).trim();
    const differs = (path: string) => !readFileSync(path).equals(execFileSync('git', ['show', `${base}:${path}`]));
    const unchanged = ['src/register/declarations.ts', 'src/terms/resolver.ts', 'src/rulegraph/graph.ts', 'src/decode/canonical.ts'];
    expect(unchanged.filter(differs)).toEqual([]);
    expect(['tests/integration/register.test.ts', 'tests/register/owner-references.test.ts', 'tests/register/workflow.test.ts']
      .filter(differs)).toEqual([]);
    expect(differs('src/register/generator.ts')).toBe(true);

    const diff = execFileSync('git', ['diff', '--unified=0', base, '--', 'src/register/generator.ts'], { encoding: 'utf8' });
    const changedLines = diff.split('\n').filter(line => /^[+-]/.test(line) && !/^(---|\+\+\+)/.test(line));
    expect(changedLines).toEqual([
      "-import { decode, decodeMeasurement } from '../index.js';",
      "+import { consumeResult, decode, decodeMeasurement } from '../index.js';",
      '-const loaded = new WeakSet<object>();',
      '-export const wasVerified = (register: GeneratedRegister): register is VerifiedRegister => loaded.has(register);',
      '+const loaded = new WeakMap<object, (now?: Clock) => boolean>();',
      '+export const wasVerified = (register: GeneratedRegister, now?: Clock): register is VerifiedRegister => loaded.get(register)?.(now) === true;',
      "-  requireThat(['live', 'retired', 'superseded'].includes(String(r.status)), 'invalid version status');",
      "+  requireThat(typeof r.status === 'string' && ['live', 'retired', 'superseded'].includes(r.status), 'invalid version status');",
      '-    loaded.add(result); return result;',
      '+    loaded.set(result, current => {',
      '+      // Legacy shape-only ports are verified once above. The concrete normal',
      '+      // provider exposes revalidateLoaded and must re-read its owner store on',
      '+      // every consequential use, even when the clock value is unchanged.',
      '+      if (!spine.revalidateLoaded) return true;',
      '+      const at = current ?? now;',
      '+      return consumeResult(spine.revalidateLoaded(extract, expected, at), {',
      '+        Success: value => value === true, Refused: () => false,',
      '+      });',
      '+    });',
      '+    return result;',
    ]);
  });
});

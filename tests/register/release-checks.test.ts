import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { decodeDeclaration, requiredReleaseChecks } from '../../src/register/index.js';
import { bootstrapDeclarations } from '../../scripts/register-source.mjs';
import { setup, value, detail } from './fixtures.js';

const read = (path: string) => readFileSync(path, 'utf8');
const declarations = (checks = read('register-source/rule-release-checks.json')) => {
  const paths = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
  const documents = Object.fromEntries(paths.filter(p => p.startsWith('docs/') && p.endsWith('.md')
    || /\.(declarations|parser)\.json$/.test(p)).map(p => [p, read(p)]));
  documents['register-source/rule-release-checks.json'] = checks;
  return bootstrapDeclarations(documents, JSON.parse(read('register-source/bootstrap-shape.json')));
};
const requirement = { id: 'R117-TWO-SESSION-A-D', evidenceLocation: 'release-evidence/{commit}/rule-117-two-session-a-d.json', stage: 'runtime' };

describe('release requirements from rule declarations', () => {
  it('emits the real Rule 117 a-d obligation; omitting it cannot satisfy that expectation', () => {
    const s = setup(); const rules = declarations().filter(s => ['rules', 'terms'].includes(s.declaration.kind)).map(s => s.declaration);
    const result = requiredReleaseChecks(s.build(rules));
    expect(result).toEqual([{ rule: 117, ...requirement }]);
    expect(requiredReleaseChecks(s.build([...rules].reverse()))).toEqual(result);
    const omitted = rules.map(d => { const copy = structuredClone(d); delete copy.requiredFacts.requiredReleaseCheck; return copy; });
    expect(requiredReleaseChecks(s.build(omitted))).toEqual([]);
    expect(() => expect(requiredReleaseChecks(s.build(omitted))).toEqual(result)).toThrow();
    expect(JSON.stringify(result)).not.toContain('passed');
    expect(requiredReleaseChecks(s.build(declarations('{}').filter(s => ['rules', 'terms'].includes(s.declaration.kind)).map(s => s.declaration)))).toEqual([]);
    expect(() => declarations('{"999": {}}')).toThrow('unknown rule 999');
  });
  it('keeps all 308 declarations unchanged except the governed Rule 117 addition', () => {
    const sources = declarations(); const old = JSON.parse(execFileSync('git', ['show', 'd1823a36:generated/conversion.json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
    const baseline = JSON.parse(execFileSync('git', ['show', 'd1823a36:generated/register.json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
    expect(sources).toHaveLength(308);
    expect(sources.map(s => s.declaration.id).sort()).toEqual(baseline.entries.map((e: { declaration: { id: string } }) => e.declaration.id).sort());
    for (const { declaration } of sources) {
      const expected = baseline.entries.find((e: { declaration: { id: string } }) => e.declaration.id === declaration.id).declaration;
      const actual = structuredClone(declaration); delete actual.requiredFacts.requiredReleaseCheck;
      const { declaredBy: _site, ...prior } = expected;
      expect(actual).toEqual(prior);
    }
    expect(old.sources.some((s: { declaration: { id: string } }) => s.declaration.id === 'rule:117')).toBe(true);
  });
  it.each([null, {}, { ...requirement, id: '' }, { ...requirement, evidenceLocation: '' },
    { ...requirement, stage: 'unknown' }, { ...requirement, outcome: 'passed' }])('refuses malformed declaration %j at the register decoder', bad => {
    const s = setup(); const result = decodeDeclaration(s.rule(117, { requiredReleaseCheck: bad }), s.context);
    expect(detail(result)).toMatch(/expected|undeclared|closed list/);
  });
  it('accepts both stages and absent declarations without inventing a requirement', () => {
    const s = setup();
    for (const stage of ['build', 'runtime']) expect(value(decodeDeclaration(s.rule(117, { requiredReleaseCheck: { ...requirement, stage } }), s.context))).toBeDefined();
    expect(requiredReleaseChecks(s.build([s.rule(117)]))).toEqual([]);
  });
});

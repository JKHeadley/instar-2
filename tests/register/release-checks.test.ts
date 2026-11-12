import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { requiredReleaseChecks } from '../../src/register/index.js';
import { bootstrapDeclarations } from '../../scripts/register-source.mjs';
import { setup } from './fixtures.js';

const read = (path: string) => readFileSync(path, 'utf8');
const declarations = () => {
  const paths = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
  const documents = Object.fromEntries(paths.filter(p => p.startsWith('docs/') && p.endsWith('.md')
    || /\.(declarations|parser)\.json$/.test(p)).map(p => [p, read(p)]));
  return bootstrapDeclarations(documents, JSON.parse(read('register-source/bootstrap-shape.json')));
};
const requirement = { id: 'R117-TWO-SESSION-A-D', evidenceLocation: 'release-evidence/{commit}/rule-117-two-session-a-d.json', stage: 'runtime' };

describe('release requirements from registered rules and committed metadata', () => {
  const metadata = JSON.parse(read('register-source/rule-release-checks.json'));
  it('emits Rule 117 a-d; omission fails the expected list; order is deterministic', () => {
    const s = setup(); const rules = declarations().filter(s => ['rules', 'terms'].includes(s.declaration.kind)).map(s => s.declaration);
    const register = s.build(rules); const result = requiredReleaseChecks(register, metadata);
    expect(result).toEqual([{ rule: 117, ...requirement }]);
    expect(requiredReleaseChecks(s.build([...rules].reverse()), metadata)).toEqual(result);
    expect(requiredReleaseChecks(register, {})).toEqual([]);
    expect(() => expect(requiredReleaseChecks(register, {})).toEqual(result)).toThrow();
    expect(JSON.stringify(result)).not.toContain('passed');
    expect(() => requiredReleaseChecks(register, { 999: requirement })).toThrow('unknown rule 999');
    expect(requiredReleaseChecks(register, { 117: requirement, 2: { ...requirement, stage: 'build' } }).map(c => c.rule)).toEqual([2, 117]);
  });
  it('preserves pre-draft payloads with exact reviewed carry additions and native certification', () => {
    const sources = declarations();
    const baseline = JSON.parse(execFileSync('git', ['show', 'd1823a36:generated/register.json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
    // The release-metadata change adds no governing payload. These later carries do;
    // compare their complete declarations to the reviewed input commits, not a count alone.
    const at = (commit: string, path: string) => JSON.parse(execFileSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8' }));
    const threadline = '5f0aac8621bce4ebbf730ddfc37ab0930acf3abd';
    const carried = [
      ...at(threadline, 'scripts/threadline-runtime.declarations.json'),
      ...at(threadline, 'scripts/onboarding-state.declarations.json'),
      ...at('37c274481225dc712afa8c4fad387615841c9257', 'tests/preview/journal.declarations.json')
        .filter((d: { id: string }) => d.id === 'preview-private-reports'),
    ];
    const expected = new Map(baseline.entries.map((e: { declaration: { id: string } }) => [e.declaration.id, e.declaration]));
    for (const declaration of carried) expected.set(declaration.id, declaration);
    expect(baseline.entries).toHaveLength(308);
    expect([...expected.keys()].filter(id => !baseline.entries.some((e: { declaration: { id: string } }) => e.declaration.id === id)).sort())
      .toEqual(['preview-private-reports', 'threadline-default-exchange', 'threadline-runtime.admitThreadline', 'threadline-runtime.createThreadlineRuntime']);
    expect(sources).toHaveLength(312);
    expect(sources.map(s => s.declaration.id).sort()).toEqual([...expected.keys()].sort());
    for (const { declaration } of sources) {
      const { declaredBy: _site, ...prior } = expected.get(declaration.id) as typeof declaration & { declaredBy?: unknown };
      // The native contract and architecture check verify this derived certificate.
      if (declaration.id === 'harness-doorway-parity') {
        const prefix = 'harness.preview-self-host-native.claude-code-subscription.darwin.self-hosting.conformance=';
        prior.requiredFacts.metrics = (prior.requiredFacts.metrics as string[]).map((m: string) => m.startsWith(prefix)
          ? (declaration.requiredFacts.metrics as string[]).find(v => v.startsWith(prefix)) : m);
      }
      expect(declaration).toEqual(prior);
    }
    expect(read('register-source/bootstrap-shape.json')).toBe(execFileSync('git', ['show', 'd1823a36:register-source/bootstrap-shape.json'], { encoding: 'utf8' }));
  });
  it.each([null, {}, { ...requirement, id: '' }, { ...requirement, evidenceLocation: '' },
    { ...requirement, stage: 'unknown' }, { ...requirement, outcome: 'passed' }])('refuses malformed requirement %j', bad => {
    const s = setup();
    expect(() => requiredReleaseChecks(s.build([s.rule(117)]), { 117: bad })).toThrow(/expected|undeclared|closed list/);
  });
  it.each([null, [], 'bad'])('refuses malformed metadata map %j', bad => {
    const s = setup(); expect(() => requiredReleaseChecks(s.build([s.rule(117)]), bad)).toThrow('expected object');
  });
});

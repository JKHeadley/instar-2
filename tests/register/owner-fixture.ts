// Test-only miniature P5 owner, matching the requested public names and gate
// shapes. No P5 implementation is shipped by P3. Merged-owner tests use P5's
// actual committed source/catalog instead of installing these stand-ins.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { hash } from './fixtures.js';

export const ownerDecoders = ['decodeRun', 'decodeRunStep', 'decodeRunTransition', 'decodeRunExit', 'decodeSessionGrounding'];
export function installOwnerFixture(root: string) {
  if (existsSync(join(root, 'src/rungraph/rungraph.declarations.json'))) return;
  const write = (path: string, text: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  write('src/rungraph/records.ts', '// Test-only owner functions, not the P5 implementation.\n' + ownerDecoders.map(id => `export const ${id} = (v: unknown) => v;`).join('\n'));
  write('src/rungraph/index.ts', `export { ${ownerDecoders.join(', ')} } from './records.js';`);
  const gates = ['admit', 'step', 'transition', 'exit', 'grounding'];
  const profile = { type: 'Profile', schemaVersion: 1, consequence: 'control', reversibility: 'costly', reach: 'user', surface: 'chat', repeats: { kind: 'bounded', by: 'rungraph.bound' } };
  const declaration = (id: string, kind: string, requiredFacts: object, extra = {}) => ({ type: 'Declaration', schemaVersion: 1, id, kind, status: 'live', requiredFacts, standards: [], holds: [], ...extra });
  const declarations = [
    declaration('rungraph-core', 'features', { metrics: ['rungraph.fact-count'], gate: { test: 'P5-NF-54', deadline: 4102444800000 } }, { status: 'dark', profile }),
    declaration('rungraph.contract', 'governed documents', { location: 'docs/09-the-run-graph.md', changelog: 'git-history:docs/09-the-run-graph.md' }),
    declaration('rungraph.bound', 'critical outcomes', { probe: 'P5-NF-55', cadence: 1000 }, { profile: { ...profile, consequence: 'none', reversibility: 'reversible', reach: 'internal', surface: 'none', repeats: { kind: 'no' } } }),
    ...gates.map((gate, i) => declaration(`rungraph.${gate}`, 'blocking sites', { authority: 'block', decidesAlone: 'governed-state', criticality: 'Worst-case control loss for bounded user-facing work',
      failDirection: 'closed', preservesInput: 'part-two:run-input', inspectedBy: 'P5-NF-54', enforces: { record: 'rungraph.contract', decoder: ownerDecoders[i] } }, { profile })),
  ];
  write('src/rungraph/rungraph.declarations.json', JSON.stringify(declarations));
  write('src/rungraph/rungraph.ts', `import { constructGoverned, readRegisterEntry } from '../register/index.js';
import { ${ownerDecoders.join(', ')} } from './records.js';
export function registerFixture() {
constructGoverned('features', 'rungraph-core', register, context);
constructGoverned('critical outcomes', 'rungraph.bound', register, context);
constructGoverned('governed documents', 'rungraph.contract', register, context);
}
${gates.map((gate, i) => `export function ${gate}() { constructGoverned('blocking sites', 'rungraph.${gate}', register, context); readRegisterEntry('rungraph.contract', register, context); ${ownerDecoders[i]}(input); }`).join('\n')}`);
  write('tests/rungraph/governance.test.ts', '// P5-NF-54 test-only source-catalog stand-in\n');
  write('tests/rungraph/scope.test.ts', '// P5-NF-55 test-only CI workload stand-in; no production cadence\n');
  const artifact = (path: string) => ({ path, hash: hash(readFileSync(join(root, path), 'utf8')) });
  write('register-source/owner-references.json', JSON.stringify({ schemaVersion: 1, owner: 'part-five',
    fixtures: [{ id: 'P5-NF-54', stage: 'build', artifact: artifact('tests/rungraph/governance.test.ts') }],
    probes: [{ id: 'P5-NF-55', cadence: 1000, execution: 'ci', artifact: artifact('tests/rungraph/scope.test.ts') }],
    decoders: ownerDecoders.map(id => ({ id, module: artifact('src/rungraph/index.ts'), artifact: artifact('src/rungraph/records.ts') })),
    documents: [{ id: 'rungraph.contract', artifact: artifact('docs/09-the-run-graph.md') }] }));
}

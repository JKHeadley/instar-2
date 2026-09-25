import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createRunClosureGraph, createRunGraph } from '../../src/rungraph/index.js';
import { closureGovernanceFixture } from './closure-governance-fixture.js';
import { exhaustionFixture } from './closure-fixtures.js';
import { governanceFixture } from './governance-fixture.js';
import { setup, value, refused } from './fixtures.js';

// Baseline re-pinned to the reviewed installation (hold arrays only) per astra-enforce-contracts-ruling.md.
it('P5-SEAM-RC-R9-F3-ADMISSION-BINDINGS P5-SEAM-RC-R10-F3-ADDITIVE-REGISTRATION keeps the reviewed installation byte-identical and gates only additive operations', () => {
  const original = readFileSync('src/rungraph/rungraph.declarations.json', 'utf8');
  expect(original).toBe(execFileSync('git', ['show', '330097eecca10780d7109146f60732b95556fb35:src/rungraph/rungraph.declarations.json'], { encoding: 'utf8' }));

  const legacy = setup();
  const legacyGraph = value(createRunGraph({ ...legacy.deps, governance: governanceFixture(legacy.c) }));
  expect(value(legacyGraph.open(legacy.run)).state).toBe('ready');

  const closure = exhaustionFixture();
  expect(closure.admissions.has(closure.exhaustionFact.id)).toBe(true);

  const missing = closureGovernanceFixture(closure.c,
    declarations => declarations.filter(declaration => declaration.id !== 'rungraph.exhaustion'));
  const missingGraph = value(createRunClosureGraph({ ...closure.deps, governance: missing }));
  refused(missingGraph.recordExhaustion({ ...closure.exhaustion, id: 'r10:missing-gate' }, closure.lease),
    'missing live blocking sites declaration');

  const wrong = closureGovernanceFixture(closure.c, declarations => declarations.map(declaration =>
    declaration.id === 'rungraph.exhaustion'
      ? { ...declaration, requiredFacts: { ...declaration.requiredFacts, failDirection: 'open' } }
      : declaration));
  const wrongGraph = value(createRunClosureGraph({ ...closure.deps, governance: wrong }));
  refused(wrongGraph.recordExhaustion({ ...closure.exhaustion, id: 'r10:wrong-gate' }, closure.lease),
    'owner-record gate registration differs');
});

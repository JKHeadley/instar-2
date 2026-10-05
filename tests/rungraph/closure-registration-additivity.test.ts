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
  // Byte-identical to the reviewed installation except three lines, each named here.
  // (1) cbuild-1 added Rule 39 to rungraph-core's `standards` (governed-by). No gate, rung, record or
  // holds claim changed. (2) w4-ugaps added `decidesAloneBasis` to the stop's rung: rule 4 names two
  // admissions in one sentence, and a `ruled-three` rung now says which of rule 4's own subjects it
  // claims (here: the operator's emergency stop). (3) a3f5ee3d moved dark rungraph-core's graduation
  // deadline to 2030-01-01, the instant the build's other dark src/ features carry (the Telegram and
  // Slack adapters); the reviewed instant had passed, and a dark feature past its deadline is a
  // deterministic register refusal. Its status, gate test and metrics are unchanged. In all three the
  // gate's authority, category, fail direction, preserved input, inspection reference, enforced record
  // and holds claim are unchanged, and src/rungraph/rungraph.ts's own equality checks on the
  // declaration are unchanged.
  const reviewed = execFileSync('git', ['show', '330097eecca10780d7109146f60732b95556fb35:src/rungraph/rungraph.declarations.json'], { encoding: 'utf8' });
  expect(original).toBe(reviewed
    .replace('"standards": [26, 31, 33, 34, 63, 68, 69, 96],', '"standards": [26, 31, 33, 34, 39, 63, 68, 69, 96],')
    .replace('"deadline": 1791158400000', '"deadline": 1893456000000')
    .replace('"decidesAlone": "ruled-three",', '"decidesAlone": "ruled-three",\n      "decidesAloneBasis": "operator-emergency-stop",'));
  expect(original).not.toBe(reviewed);

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

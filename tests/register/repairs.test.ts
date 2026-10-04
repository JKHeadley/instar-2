import { describe, expect, it } from 'vitest';
import { decodeDeclaration, generateRegister, buildRuleGraph, checkGovernedState } from '../../src/register/index.js';
import { inspectSource, checkWiring, scanSources } from '../../scripts/check-register-wiring.mjs';
import { setup, value, detail, wiringSources } from './fixtures.js';

describe('desk counterexamples', () => {
  it('P3-NF-26 R3 empty or malformed rungs cannot suppress admission', () => {
    const s = setup(); const d = s.holder([]);
    const attempt = (facts: object) => ({ ...d, requiredFacts: facts });
    for (const facts of [
      { ...d.requiredFacts, decidesAlone: 'governed-state', rungs: [] },
      { authority: 'block', inspectedBy: 'check', rungs: [] },
      { authority: 'block', inspectedBy: 'check', rungs: [{}] },
      { authority: 'block', inspectedBy: 'check', rungs: [{ ...d.requiredFacts, decidesAlone: 'invented' }] },
    ]) expect(detail(decodeDeclaration(attempt(facts), s.context))).toMatch(/rung|ambiguous|undeclared/);
    const rung = { decidesAlone: 'ruled-three', decidesAloneBasis: 'operator-emergency-stop', criticality: 'exact test', failDirection: 'closed', preservesInput: 'capture' };
    const multi = attempt({ authority: 'block', inspectedBy: 'check', rungs: [rung, { ...rung, failDirection: 'open' }] });
    expect(value(decodeDeclaration(multi, s.context)).id).toBe('holder');
    const register = s.build([multi]);
    // A live alone-deciding site must also be bound to its checkpoint (P3-NF-19); the binding is supplied here.
    const bound = { ...scanSources({}), bindings: [{ kind: 'blocking sites', id: 'holder', path: 'tests/example.ts', symbol: 'example' }] };
    expect(checkWiring(register, {}, bound).issues).toEqual([]);
    expect(value(checkGovernedState([], register, s.context))).toBe(true);
    const forged = { ...register, entries: register.entries.map(e => ({ ...e, declaration: { ...e.declaration, requiredFacts: { ...d.requiredFacts, rungs: [] } } })) };
    expect(checkWiring(forged, {}, bound).issues.join()).toContain('rung');
    // @ts-expect-error hostile hand-written register also lacks the nominal brand
    expect(detail(checkGovernedState([], forged, s.context))).toContain('rung');
    expect(detail(generateRegister(s.input([attempt({ ...d.requiredFacts, rungs: [] })]), s.context))).toContain('rung');
  });
  it('P3-NF-13 P3-NF-15 R4 retiring a holder reopens its gap while retaining history', () => {
    const s = setup(); const holds = [{ rule: 4, class: 'held', evidence: { kind: 'probe', id: 'probe', stage: 'runtime' }, semanticallyReviewed: 'never' }];
    const catalog = { fixtures: [], probes: [{ id: 'probe', cadence: 10 }], sentinels: [], semanticReviews: [] };
    const live = s.holder(holds);
    expect(value(buildRuleGraph(s.build([s.rule(4), live]), 'main', [], catalog, s.context)).totals['held-unreviewed']).toBe(1);
    for (const status of ['retired', 'dark', 'soaking']) {
      const register = s.build([s.rule(4), { ...live, status }]);
      const graph = value(buildRuleGraph(register, 'main', [], catalog, s.context));
      expect(graph.gaps).toEqual([4]); expect(graph.loops[0]?.owner).toBe('operator-route');
      expect(graph.rules[0]?.enforcedBy).toEqual([]); expect(register.entries.some(e => e.declaration.id === 'holder')).toBe(true);
    }
    const replacement = { ...live, id: 'replacement' };
    const graph = value(buildRuleGraph(s.build([s.rule(4), { ...live, status: 'retired' }, replacement]), 'main', [], catalog, s.context));
    expect(graph.gaps).toEqual([]); expect(graph.rules[0]?.enforcedBy).toEqual(['replacement']);
  });
  it('P3-NF-04 P3-NF-26 R6 public package, namespace, aliases and re-exports are observed', () => {
    const s = setup();
    for (const code of [
      "import { constructGoverned } from '@instar/constitutional-types/register'; constructGoverned('stores', 'missing', register, context);",
      "import * as core from '@instar/constitutional-types/register'; core.constructGoverned('stores', 'missing', register, context);",
      "import { constructGoverned as make } from '@instar/constitutional-types/register'; make('stores', 'missing', register, context);",
    ]) {
      expect(inspectSource('src/client.ts', code, wiringSources()).constructs[0]?.id).toBe('missing');
      expect(checkWiring(s.build(), { ...wiringSources(), 'src/client.ts': code }).issues.join()).toContain('missing');
      expect(checkWiring(s.build(), { ...wiringSources(), 'src/client.ts': code.replace('missing', 'store') }).issues).toEqual([]);
    }
    const sources = { ...wiringSources(), 'src/barrel.ts': "export { constructGoverned as make } from '@instar/constitutional-types/register';",
      'src/client.ts': "import { make } from './barrel.js'; make('stores', 'missing', register, context);" };
    expect(checkWiring(s.build(), sources).issues.join()).toContain('missing');
  }, 30_000);
});

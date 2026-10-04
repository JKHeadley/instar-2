// Rule 4 names two admissions in one sentence: the three irreversible-miss cases (a live
// secret leaving, spend past a cap, the operator's emergency stop) and deterministic
// enforcement of recorded governed state. Before this unit the single word `ruled-three`
// covered both, so a site could claim the first clause by writing the word, and a declared
// `ruled-three` site no module ever read could sit in the register deciding nothing.
// Both sides of every decision added here are exercised.
import { describe, expect, it } from 'vitest';
import { buildRuleGraph, decodeDeclaration } from '../../src/register/index.js';
import { ruledThreeBases } from '../../src/register/rungs.js';
import { checkWiring, scanSources } from '../../scripts/check-register-wiring.mjs';
import type { Construct } from '../../scripts/check-register-wiring.mjs';
import { setup, detail, value, withoutBasis } from './fixtures.js';

/** The real empty scan, with its constructs and bindings replaced: a hand-built object would not carry the scanner's own shape. */
const withScan = (constructs: Construct[], bindings: Construct[] = []) => ({ ...scanSources({}), constructs, bindings, residual: [] });
const boundTo = (id: string) => withScan([], [{ kind: 'blocking sites', id, path: 'tests/preview/journal.ts', symbol: 'bindPreviewBlockingSites' }]);
const basisOf = (d: { requiredFacts: object }, basis: unknown) =>
  ({ ...d, requiredFacts: basis === undefined ? withoutBasis(d.requiredFacts) : { ...withoutBasis(d.requiredFacts), decidesAloneBasis: basis } });

describe('rule 4 admission basis', () => {
  it('a ruled-three rung must name one of rule 4 own admissions, and only those four', () => {
    const s = setup(); const holder = s.holder([]);
    // Closed list, in the rule book's own words; a fifth cannot be written into a declaration.
    expect([...ruledThreeBases]).toEqual(['live-secret-leaving', 'spend-past-a-cap', 'operator-emergency-stop', 'recorded-governed-state']);
    for (const basis of ruledThreeBases)
      expect(value(decodeDeclaration(basisOf(holder, basis), s.context)).requiredFacts.decidesAloneBasis).toBe(basis);
    // Absent, empty, misspelled, or a plausible fifth subject: all refuse.
    for (const basis of [undefined, '', 'spend-cap', 'money-past-a-cap', 'exact-match', 3, null, {}])
      expect(detail(decodeDeclaration(basisOf(holder, basis), s.context))).toMatch(/decidesAloneBasis|P3-NF-05/);
  });
  it('a rung that does not decide alone cannot carry an admission basis', () => {
    const s = setup(); const holder = s.holder([]);
    const asked = { ...holder, requiredFacts: { ...withoutBasis(holder.requiredFacts), decidesAlone: 'no', model: 'doorway' } };
    expect(value(decodeDeclaration(asked, s.context)).requiredFacts.decidesAlone).toBe('no');
    expect(detail(decodeDeclaration(basisOf(asked, 'operator-emergency-stop'), s.context))).toContain('requires a ruled-three rung');
    const governed = { ...holder, requiredFacts: { ...withoutBasis(holder.requiredFacts), decidesAlone: 'governed-state',
      enforces: { record: 'store', decoder: 'decode:Profile' } } };
    expect(value(decodeDeclaration(governed, s.context)).requiredFacts.decidesAlone).toBe('governed-state');
    expect(detail(decodeDeclaration(basisOf(governed, 'recorded-governed-state'), s.context))).toContain('requires a ruled-three rung');
  });
  it('the basis is per rung and cannot be smuggled beside a rung list', () => {
    const s = setup(); const holder = s.holder([]);
    const rung = { decidesAlone: 'ruled-three', decidesAloneBasis: 'spend-past-a-cap', criticality: 'the allowance is reached or it is not',
      failDirection: 'closed', preservesInput: 'capture:input' };
    const multi = { ...holder, requiredFacts: { authority: 'block', inspectedBy: 'check', rungs: [rung, { ...rung, decidesAloneBasis: 'operator-emergency-stop' }] } };
    expect(value(decodeDeclaration(multi, s.context)).requiredFacts.rungs).toHaveLength(2);
    const ambiguous = { ...holder, requiredFacts: { ...multi.requiredFacts, decidesAloneBasis: 'operator-emergency-stop' } };
    expect(detail(decodeDeclaration(ambiguous, s.context))).toContain('ambiguous top-level/rung decidesAloneBasis');
    const bad = { ...holder, requiredFacts: { authority: 'block', inspectedBy: 'check', rungs: [{ ...rung, decidesAloneBasis: 'invented' }] } };
    expect(detail(decodeDeclaration(bad, s.context))).toMatch(/decidesAloneBasis|P3-NF-05/);
  });
  it('P3-NF-26 the wiring check mirrors the decode rule, so a forged register cannot get past it', () => {
    const s = setup(); const register = s.build([s.holder([])]); const bound = boundTo('holder');
    expect(checkWiring(register, {}, bound).issues).toEqual([]);
    const forge = (facts: object) => ({ ...register, entries: register.entries.map(e => ({ ...e,
      declaration: { ...e.declaration, requiredFacts: { ...e.declaration.requiredFacts, ...facts } } })) });
    expect(checkWiring(forge({ decidesAloneBasis: 'invented' }), {}, bound).issues.join()).toContain("misnames rule 4's admission");
    const dropped = { ...register, entries: register.entries.map(e => ({ ...e,
      declaration: { ...e.declaration, requiredFacts: withoutBasis(e.declaration.requiredFacts) } })) };
    expect(checkWiring(dropped, {}, bound).issues.join()).toContain("misnames rule 4's admission");
    expect(checkWiring(forge({ decidesAlone: 'no', model: 'doorway' }), {}, bound).issues.join()).toContain("misnames rule 4's admission");
  });
});

describe('rule 4 enumeration reaches the runtime', () => {
  // A `governed-state` rung has carried a wiring obligation since P3-NF-26. A `ruled-three`
  // or model-asking rung carried none, so three live preview gates sat in the register with a
  // category, a fail direction and a preservation claim that no module read (docs/07: "a cap
  // declared in dead code bounds nothing"). A live site now needs a construct in its declaring
  // module or a literal-id composition binding; neither, or a construct in the WRONG module, fails.
  it('P3-NF-19 a live site with neither a construct nor a binding fails; a paired, a bound and a dark one pass', () => {
    const s = setup(); const holder = s.holder([]);
    expect(checkWiring(s.build([holder]), {}).issues.join()).toContain(`P3-NF-19: live blocking site ${holder.id} has no runtime binding`);
    expect(checkWiring(s.build([holder]), {}).residual.filter(r => r.reason.includes(holder.id))).toHaveLength(0);
    expect(checkWiring(s.build([{ ...holder, status: 'dark' }]), {}).issues).toEqual([]);
    const paired = withScan([{ kind: 'blocking sites', id: holder.id, path: 'src/example.ts', symbol: 'example' }]);
    expect(checkWiring(s.build([holder]), {}, paired).issues).toEqual([]);
    expect(checkWiring(s.build([holder]), {}, boundTo(holder.id)).issues).toEqual([]);
    // A binding for another site does not discharge this one.
    expect(checkWiring(s.build([holder]), {}, boundTo('elsewhere')).issues.join()).toContain(`${holder.id} has no runtime binding`);
  });
  it('P3-NF-19 a site that asks the mind carries the same obligation', () => {
    const s = setup(); const holder = s.holder([]);
    // The fixture context resolves no model doorway, so the built entry is re-pointed at a model rung after
    // generation; checkWiring reads the register as given, exactly as for the forged registers above.
    const built = s.build([holder]);
    const register = { ...built, entries: built.entries.map(e => ({ ...e, declaration: { ...e.declaration,
      requiredFacts: { ...withoutBasis(e.declaration.requiredFacts), decidesAlone: 'no', model: 'doorway' } } })) };
    expect(checkWiring(register, {}).issues.join()).toContain(`${holder.id} has no runtime binding`);
    expect(checkWiring(register, {}, boundTo(holder.id)).issues).toEqual([]);
  });
  it('P3-NF-04 a binding to an undeclared or dark site fails', () => {
    const s = setup(); const holder = s.holder([]);
    expect(checkWiring(s.build([holder]), {}, withScan([], [{ kind: 'blocking sites', id: holder.id, path: 'a.ts', symbol: 'a' },
      { kind: 'blocking sites', id: 'ghost', path: 'a.ts', symbol: 'a' }])).issues.join()).toContain('binds undeclared or non-live blocking site ghost');
    expect(checkWiring(s.build([{ ...holder, status: 'dark' }]), {}, boundTo(holder.id)).issues.join()).toContain(`non-live blocking site ${holder.id}`);
  });
  it('the scanner reads a literal binding through the governance port and keeps a computed one as residual', () => {
    const files = {
      'src/register/governance.ts': 'export function bindBlockingSite(d: unknown, id: string, e: unknown): string { return id; }\n',
      'tests/preview/bound.ts': "import { bindBlockingSite } from '../../src/register/governance.js';\n"
        + "export function bindAll(d: unknown, id: string) { bindBlockingSite(d, 'preview.journal.gate', []); bindBlockingSite(d, id, []); }\n" };
    const scan = scanSources(files);
    expect(scan.bindings).toEqual([{ kind: 'blocking sites', id: 'preview.journal.gate', path: 'tests/preview/bound.ts', symbol: 'bindAll' }]);
    expect(scan.residual.map(r => r.reason)).toContain('computed or missing blocking-site binding id');
  });
  it('P3-NF-19 a construct in another module is a failure, not a residual', () => {
    const s = setup(); const holder = s.holder([]);
    const elsewhere = withScan([{ kind: 'blocking sites', id: holder.id, path: 'src/other.ts', symbol: 'other' }]);
    const result = checkWiring(s.build([holder]), {}, elsewhere);
    expect(result.issues.join()).toContain('P3-NF-19');
    expect(result.issues.join()).toContain('src/other.ts#other');
    expect(result.residual.filter(r => r.reason.includes(holder.id))).toHaveLength(0);
  });
  it('a governed-state site is unaffected: its own obligation still decides it', () => {
    const s = setup(); const holder = s.holder([]);
    const governed = { ...holder, requiredFacts: { ...withoutBasis(holder.requiredFacts), decidesAlone: 'governed-state',
      enforces: { record: 'store', decoder: 'decode:Profile' } } };
    const register = s.build([s.declaration(), governed]);
    const result = checkWiring(register, {});
    expect(result.residual.filter(r => r.reason.includes('ruled-three'))).toHaveLength(0);
    expect(result.issues.join()).toContain('does not read enforced record');
  });
});

describe('rules 60 and 61 may be held, and only by the kind that can refuse', () => {
  // Before this unit `generated/coverage.md` reported `enforcedBy: []` for both rules: the
  // per-kind enforceable-subject table admitted neither, so the funnel that holds the hard
  // ceiling could not say so in the register even though it holds it in code.
  const catalog = { fixtures: [{ id: 'check', stage: 'build' }], probes: [], sentinels: [], semanticReviews: [] };
  const held = (rule: number) => ({ rule, class: 'partial', evidence: { kind: 'fixture', id: 'check', stage: 'build' },
    portion: 'the one funnel refuses past its hard ceiling', remainder: 'sampled ceilings are observed, not hard' });
  it('P3-NF-18 a blocking site may enforce 60 and 61; the rules leave the gap list', () => {
    const s = setup();
    const register = s.build([s.rule(60), s.rule(61), s.holder([held(60), held(61)])]);
    const graph = value(buildRuleGraph(register, 'main', [], catalog, s.context));
    expect(graph.gaps).toEqual([]);
    expect(graph.rules.map(r => r.enforcedBy)).toEqual([['holder'], ['holder']]);
    expect(graph.totals.partial).toBe(2);
  });
  it('P3-NF-18 a kind whose table omits them still cannot, and an unlisted rule still cannot', () => {
    const s = setup();
    const outcome = { ...s.bound, holds: [held(60)] };
    expect(detail(buildRuleGraph(s.build([s.rule(60), outcome]), 'main', [], catalog, s.context))).toContain('P3-NF-18');
    // 59 is a real rule the blocking-site table does not list: the widening is exactly two rows.
    expect(detail(buildRuleGraph(s.build([s.rule(59), s.holder([held(59)])]), 'main', [], catalog, s.context))).toContain('P3-NF-18');
  });
});

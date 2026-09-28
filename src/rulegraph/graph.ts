import { decode, decodeMeasurement } from '../index.js';
import type { Clock, Json } from '../index.js';
import type { CheckRunRecord, GeneratedRegister, RegisterContext, RegisterValue } from '../register/types.js';
import { checked, encoding, exact, list, number, object, requireThat, take, text, validated } from '../register/boundary.js';

export type RuleGraph = RegisterValue<'RuleGraph'> & Readonly<{
  prerequisites: readonly Readonly<{ rule: number; owner: string; required: string }>[];
  rules: readonly Readonly<{ number: number; parent: number | 'root'; children: readonly number[]; siblings: readonly number[];
    enforcedBy: readonly string[]; deadline: number | null }>[];
  edges: readonly Readonly<{ rule: number; holder: string; class: 'held-reviewed' | 'held-unreviewed' | 'declared' | 'partial' | 'deferred';
    portion?: string; remainder?: string }>[];
  gaps: readonly number[];
  loops: readonly Readonly<{ id: string; rule: number; holder: string | null; dueBy: number; part: number | null;
    owner: string; overdueAction: string }>[];
  totals: Readonly<Record<'held-reviewed' | 'held-unreviewed' | 'declared' | 'partial' | 'deferred' | 'gap', number>>;
}>;
export interface CheckCatalog {
  readonly fixtures: readonly Readonly<{ id: string; stage: string }>[];
  readonly probes: readonly Readonly<{ id: string; cadence: number }>[];
  readonly sentinels: readonly Readonly<{ id: string; freshnessProbe: string }>[];
  readonly semanticReviews: readonly Readonly<{ holder: string; rule: number; generation: string; subjectHash: string; record: string }>[];
}
export function semanticReviewSubject(register: GeneratedRegister, holder: string, rule: number, context: RegisterContext) {
  return checked('SemanticReviewSubject', { register, holder, rule }, context, () => {
    const d = register.entries.find(e => e.declaration.id === holder)?.declaration;
    const r = register.entries.find(e => e.declaration.kind === 'rules' && e.declaration.requiredFacts.number === rule)?.declaration;
    requireThat(d && r, 'review subject must name existing holder and rule');
    // Review annotations cannot be inside their own subject hash. All enforceable
    // content, including the rule statement and holder evidence, remains bound.
    const holds = d.holds.map(h => { if (h.class !== 'held') return h; const { semanticallyReviewed: _review, ...content } = h; return content; });
    return encoding({ holder: { ...d, holds }, rule: r }).hash;
  });
}
export function decodeCheckRun(input: unknown, context: RegisterContext) {
  return validated<CheckRunRecord, RegisterContext>('CheckRunRecord', input, context, v => {
    exact(v, ['type', 'schemaVersion', 'id', 'commit', 'branch', 'providerRun', 'outcome', 'fixtures', 'at']);
    const verdict = (v: Json | undefined) => { requireThat(v === 'passed' || v === 'failed' || v === 'incomplete', 'unknown check verdict'); return v; };
    const fixtures = list(v.fixtures, 'fixtures').map(raw => { const f = object(raw); exact(f, ['id', 'stage', 'outcome']);
      return { id: text(f.id, 'fixture.id'), stage: text(f.stage, 'fixture.stage'), outcome: verdict(f.outcome) }; });
    requireThat(new Set(fixtures.map(f => `${f.id}\u0000${f.stage}`)).size === fixtures.length, 'duplicate executed fixture');
    const at = take(decodeMeasurement('clock', v.at, context.types));
    const outcome = verdict(v.outcome);
    requireThat(outcome !== 'passed' || fixtures.every(f => f.outcome === 'passed'), 'passing run cannot hide failed/incomplete fixtures');
    return { type: 'CheckRunRecord', schemaVersion: 1, id: text(v.id, 'run.id'), commit: text(v.commit, 'commit'), branch: text(v.branch, 'branch'),
      providerRun: text(v.providerRun, 'providerRun'), outcome, fixtures, at } as unknown as CheckRunRecord;
  });
}
export function buildRuleGraph(register: GeneratedRegister, branch: string, runs: readonly CheckRunRecord[], catalog: CheckCatalog,
  context: RegisterContext, bootstrapRules: readonly Readonly<{ number: number; declarationHash: string; owner: string }>[] = []) {
  return checked<RuleGraph, RegisterContext>('RuleGraph', { register, branch, runs, catalog }, context, () => {
    const rules = register.entries.filter(e => e.declaration.kind === 'rules' && e.declaration.status === 'live').map(e => {
      const facts = e.declaration.requiredFacts; const n = number(facts.number, 'rule.number');
      requireThat(Number.isSafeInteger(n) && n > 0, 'rule number must be positive integer');
      const parent: number | 'root' = facts.parent === 'root' ? 'root' : number(facts.parent, 'parent');
      if (parent === 'root') text(facts.rootReason, 'rootReason');
      return { number: n, parent, deadline: facts.deadline === undefined ? null : number(facts.deadline, 'deadline'),
        mergedInto: facts.mergedInto === undefined ? null : number(facts.mergedInto, 'mergedInto'),
        owner: facts.owner, overdueAction: facts.overdueAction };
    });
    const byNumber = new Map(rules.map(r => [r.number, r]));
    requireThat(byNumber.size === rules.length, 'duplicate rule number');
    for (const rule of rules) {
      const walk = (n: number, visited: Set<number>): void => {
        requireThat(!visited.has(n), 'rule parent/mergedInto cycle'); const r = byNumber.get(n);
        requireThat(r, `P3-NF-13: missing rule ${n}`); const next = new Set(visited).add(n);
        if (r.parent !== 'root') walk(r.parent, next); if (r.mergedInto !== null) walk(r.mergedInto, next);
      }; walk(rule.number, new Set());
    }
    const edges: { rule: number; holder: string; class: RuleGraph['edges'][number]['class']; portion?: string; remainder?: string }[] = [];
    const loops: { id: string; rule: number; holder: string | null; dueBy: number; part: number | null; owner: string; overdueAction: string }[] = [];
    // Rule 69: an inactive entry's governing references still resolve, against every
    // rule version the register retains (retired rules stay as history).
    const known = new Set(register.entries.filter(e => e.declaration.kind === 'rules').map(e => number(e.declaration.requiredFacts.number, 'rule.number')));
    for (const { declaration: d } of register.entries) {
      // History stays in the register. Retired holders have no current power.
      // Dark/soaking holders likewise cannot establish live enforcement.
      if (d.status !== 'live') {
        for (const n of [...d.standards, ...d.holds.map(h => h.rule)]) requireThat(known.has(n), `P3-NF-13: ${d.status} ${d.id} names missing rule ${n}`);
        // A dark or soaking entry's declared debt stays owned and deadline-checked: its deferred
        // hold becomes a loop, never an edge (it holds nothing while inactive). Retired history does not.
        if (d.status !== 'retired') for (const h of d.holds) if (h.class === 'deferred') {
          const shape = register.shape.kinds.find(k => k.name === d.kind);
          requireThat(shape?.holder && shape.enforceable.includes(h.rule), `P3-NF-18: ${d.kind} may not enforce ${h.rule}`);
          requireThat(register.shape.parts.includes(h.part), `P3-NF-24: unknown deferred part ${h.part}`);
          loops.push({ id: `deferred:${d.id}:${h.rule}`, rule: h.rule, holder: d.id, dueBy: h.ceiling, part: h.part, owner: h.owner, overdueAction: h.overdueAction });
        }
        continue;
      }
      for (const standard of d.standards) requireThat(byNumber.has(standard), `P3-NF-13: standard ${standard} missing for ${d.id}`);
      for (const h of d.holds) {
        requireThat(byNumber.has(h.rule), `P3-NF-13: holder ${d.id} names missing rule ${h.rule}`);
        const shape = register.shape.kinds.find(k => k.name === d.kind);
        requireThat(shape?.holder && shape.enforceable.includes(h.rule), `P3-NF-18: ${d.kind} may not enforce ${h.rule}`);
        if (h.class === 'deferred') {
          requireThat(register.shape.parts.includes(h.part), `P3-NF-24: unknown deferred part ${h.part}`);
          edges.push({ rule: h.rule, holder: d.id, class: 'deferred' });
          loops.push({ id: `deferred:${d.id}:${h.rule}`, rule: h.rule, holder: d.id, dueBy: h.ceiling, part: h.part, owner: h.owner, overdueAction: h.overdueAction });
          continue;
        }
        const e = h.evidence;
        if (e.kind === 'fixture') requireThat(catalog.fixtures.some(f => f.id === e.id && f.stage === e.stage), `P3-NF-14: fixture ${e.id} absent at ${e.stage}`);
        if (e.kind === 'probe') requireThat(catalog.probes.some(p => p.id === e.id && Number.isFinite(p.cadence) && p.cadence > 0), `P3-NF-14: probe ${e.id} needs cadence`);
        if (e.kind === 'sentinel') {
          const sentinel = catalog.sentinels.find(s => s.id === e.id);
          requireThat(sentinel && catalog.probes.some(p => p.id === sentinel.freshnessProbe && p.cadence > 0), `P3-NF-25: ${e.id} has no declared freshness probe`);
        }
        if (d.kind === 'sentinels') requireThat(catalog.probes.some(p => p.id === d.requiredFacts.freshnessProbe && p.cadence > 0), `P3-NF-25: ${d.id} has no freshness probe`);
        if (h.class === 'partial') { edges.push({ rule: h.rule, holder: d.id, class: 'partial', portion: h.portion, remainder: h.remainder }); continue; }
        const wired = e.kind !== 'fixture' || runs.some(run => run.branch === branch && run.commit === register.commit
          && run.fixtures.some(f => f.id === e.id && f.stage === e.stage && f.outcome !== 'incomplete'));
        const reviewed = h.semanticallyReviewed !== 'never' && catalog.semanticReviews.some(r => r.holder === d.id && r.rule === h.rule
          && r.generation === h.semanticallyReviewed && r.subjectHash === take(semanticReviewSubject(register, d.id, h.rule, context)) && r.record.length > 0);
        edges.push({ rule: h.rule, holder: d.id, class: !wired ? 'declared' : reviewed ? 'held-reviewed' : 'held-unreviewed' });
      }
    }
    const gaps = rules.filter(r => !edges.some(e => e.rule === r.number)).map(r => r.number);
    const prerequisites: { rule: number; owner: string; required: string }[] = [];
    for (const n of gaps) {
      const rule = byNumber.get(n)!;
      const declared = register.entries.find(e => e.declaration.kind === 'rules' && e.declaration.requiredFacts.number === n)!.declaration;
      const { declaredBy: _site, ...authored } = declared;
      const bootstrap = bootstrapRules.find(r => r.number === n && r.declarationHash === encoding(authored).hash);
      if (rule.deadline === null && bootstrap) {
        prerequisites.push({ rule: n, owner: text(bootstrap.owner, 'bootstrap prerequisite owner'), required: 'operator-approved gap deadline and standing route before entering force' });
        continue;
      }
      requireThat(rule.deadline !== null, `P3-NF-15: uncovered rule ${n} needs deadline`);
      loops.push({ id: `gap:${n}`, rule: n, holder: null, dueBy: rule.deadline, part: null,
        owner: text(rule.owner, `rule ${n} gap owner`), overdueAction: text(rule.overdueAction, `rule ${n} overdue action`) });
    }
    const totals = { 'held-reviewed': 0, 'held-unreviewed': 0, declared: 0, partial: 0, deferred: 0, gap: gaps.length };
    for (const edge of edges) totals[edge.class]++;
    return { type: 'RuleGraph', schemaVersion: 1, prerequisites, rules: rules.map(r => ({ number: r.number, parent: r.parent, deadline: r.deadline,
      children: rules.filter(c => c.parent === r.number).map(c => c.number), siblings: rules.filter(s => s.number !== r.number && s.parent === r.parent).map(s => s.number),
      enforcedBy: edges.filter(e => e.rule === r.number).map(e => e.holder) })), edges, gaps, loops, totals } as unknown as RuleGraph;
  });
}
export function checkGraphLoops(graph: RuleGraph, context: RegisterContext) {
  return checked('GraphLoopCheck', graph, context, raw => {
    const v = object(raw); const loops = list(v.loops, 'loops').map(object);
    const prerequisites = list(v.prerequisites, 'prerequisites').map(object);
    for (const p of prerequisites) { text(p.owner, 'prerequisite.owner'); text(p.required, 'prerequisite.required'); }
    for (const gap of list(v.gaps, 'gaps')) requireThat(loops.some(l => l.rule === gap && l.holder === null) || prerequisites.some(p => p.rule === gap), `P3-NF-15: missing loop for gap ${gap}`);
    for (const raw of list(v.edges, 'edges')) { const e = object(raw); if (e.class === 'deferred')
      requireThat(loops.some(l => l.rule === e.rule && l.holder === e.holder), 'P3-NF-15: missing deferred loop'); }
    for (const l of loops) { text(l.owner, 'loop.owner'); text(l.overdueAction, 'overdueAction'); number(l.dueBy, 'dueBy'); }
    return true;
  });
}
export function checkDeadlines(graph: RuleGraph, register: GeneratedRegister, landedParts: readonly number[], now: Clock, context: RegisterContext) {
  return checked('DeadlineCheck', { graph, register, landedParts, now }, context, () => {
    const clock = take(decodeMeasurement('clock', now, context.types));
    take(checkGraphLoops(graph, context));
    for (const loop of graph.loops) {
      requireThat(loop.part === null || (register.shape.parts.includes(loop.part) && !landedParts.includes(loop.part)), `P3-NF-24: deferred part ${loop.part} unknown or landed`);
      requireThat(loop.dueBy > now.value, `P3-NF-24: deadline passed for ${loop.id}; owner ${loop.owner}; ${loop.overdueAction}`);
    }
    for (const { declaration: d } of register.entries) {
      if (d.kind === 'features' && (d.status === 'dark' || d.status === 'soaking')) {
        const gate = object(d.requiredFacts.gate!); requireThat(number(gate.deadline, 'deadline') > now.value, `feature ${d.id} graduation overdue`);
      }
      if (d.kind === 'model doorways') for (const raw of list(d.requiredFacts.models, 'models')) {
        const model = object(raw); const at = number(model.verifiedAt, 'model verifiedAt'); const window = number(model.freshFor, 'model freshness');
        requireThat(window > 0 && at <= now.value && now.value - at <= window, `model map stale for ${d.id}`);
      }
      if (d.kind === 'model doorways' && d.status === 'live') {
        const subsidy = object(d.requiredFacts.subsidy!); const at = number(subsidy.updatedAt, 'subsidy.updatedAt');
        requireThat(at <= now.value && now.value - at <= number(subsidy.freshFor, 'subsidy.freshFor'), `stale subsidy for ${d.id}; not trusted`);
      }
    }
    return true;
  });
}

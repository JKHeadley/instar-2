import { expect, it } from 'vitest';
import { causalCone } from '../../src/facts/admission.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { factsFixture } from './fixtures.js';

// The previous recursive traversal is the oracle for order and refusal boundaries.
function oracle(fact: FactEnvelope, facts: readonly FactEnvelope[]): readonly string[] {
  const byId = new Map(facts.map(f => [f.id, f]));
  const found = new Map<string, FactEnvelope>(), visiting = new Set<string>();
  const parents = (f: FactEnvelope, visit: (p: FactEnvelope) => void) => {
    for (const id of [f.predecessors.inSegment, ...f.predecessors.required]) if (id !== null) {
      const p = byId.get(id); if (!p) throw new Error(`dangling causal reference: ${id}`); visit(p);
    }
    for (const [machine, head] of Object.entries(f.predecessors.frontier)) {
      const p = facts.find(p => p.machine === machine && p.segment.epoch === head.epoch && p.segment.position === head.position);
      if (!p) throw new Error(`dangling frontier: ${machine}`); visit(p);
    }
  };
  const visit = (f: FactEnvelope) => {
    if (visiting.has(f.id) || f.id === fact.id) throw new Error('causal cycle');
    if (found.has(f.id)) return;
    visiting.add(f.id); parents(f, visit); visiting.delete(f.id); found.set(f.id, f);
  };
  parents(fact, visit); return [...found.keys()];
}
const outcome = (run: () => readonly string[]) => { try { return run(); } catch (e) { return (e as Error).message; } };
function chain(n: number) {
  const seed = factsFixture().fact();
  return Array.from({ length: n }, (_, i): FactEnvelope => ({ ...seed, id: `a:${i}`, machine: 'a',
    segment: { machine: 'a', epoch: 0, position: i },
    predecessors: { inSegment: i ? `a:${i - 1}` : null, required: [], frontier: {} } }));
}
it('preserves the recursive oracle order on varied shared ancestors and shuffled inputs', () => {
  for (let trial = 0; trial < 40; trial++) {
    const rows = chain(30);
    for (let i = 1; i < rows.length; i++) rows[i] = { ...rows[i]!, predecessors: {
      ...rows[i]!.predecessors, required: [`a:${(trial * 7 + i) % i}`], frontier: { a: { epoch: 0, position: (trial + i) % i } } } };
    const input = trial % 2 ? [...rows].reverse() : rows;
    expect(causalCone(rows.at(-1)!, input).map(f => f.id)).toEqual(oracle(rows.at(-1)!, input));
  }
});
it('preserves cycle and dangling-edge refusals, including the first failed edge', () => {
  const rows = chain(5), last = rows.at(-1)!;
  for (const predecessors of [
    { ...last.predecessors, inSegment: last.id },
    { ...last.predecessors, inSegment: 'missing', required: ['also-missing'] },
    { ...last.predecessors, required: ['missing'], frontier: { absent: { epoch: 0, position: 0 } } },
    { ...last.predecessors, frontier: { absent: { epoch: 0, position: 0 } } },
  ]) {
    const target = { ...last, predecessors };
    expect(outcome(() => causalCone(target, rows).map(f => f.id))).toEqual(outcome(() => oracle(target, rows)));
  }
  const cyclic = rows.map((f, i) => i ? f : { ...f, predecessors: { ...f.predecessors, inSegment: 'a:2' } });
  expect(outcome(() => causalCone(last, cyclic).map(f => f.id))).toBe('causal cycle');
});
it('walks a 20000-fact lineage without consuming the host call stack', () => {
  const rows = chain(20_000);
  expect(causalCone(rows.at(-1)!, rows).map(f => f.id)).toEqual(rows.slice(0, -1).map(f => f.id));
});

import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { prepareSnapshot } from '../../src/facts/index.js';
import { foldProjection } from '../../src/projections/index.js';
import type { MergeClass } from '../../src/projections/index.js';
import { factsFixture, value, point } from '../facts/fixtures.js';
const permutations = <T>(items: readonly T[]): T[][] => items.length === 0 ? [[]] : items.flatMap((v, i) => permutations(items.filter((_, j) => i !== j)).map(rest => [v, ...rest]));
it('P2-NF-51 every declared merge class satisfies all bounded permutations and duplication across eight seeded causal sets', () => {
  let seed = 0x51f2;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const merges: MergeClass[] = ['additive', 'set-union', 'max', 'min', 'exclusive-singleton', 'cap-checked aggregate'];
  for (let set = 0; set < 8; set++) {
    const f = factsFixture(), amount = () => String(BigInt(random()) * 1000000000000n - 700000000000000000n);
    const a = f.fact({ body: { identity: 'same', amount: amount() } });
    const b = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, body: { identity: 'same', amount: amount() } });
    const c = f.next(a, { body: { identity: 'same', amount: amount() }, at: f.clock(90 + random() % 20) });
    const d = f.next(b, { body: { identity: 'same', amount: amount() }, at: f.clock(90 + random() % 20) });
    const generation = { reference: f.ctx.decode.register.generation, kinds: ['note'], lineages: { 'machine-a': { head: point(c), observedAt: 100, closed: false }, 'machine-b': { head: point(d), observedAt: 100, closed: false } } };
    const expected = new Map<MergeClass, string>();
    for (const order of permutations([a, b, c, d])) for (const repeated of [false, true]) {
      const snapshot = value(prepareSnapshot(repeated ? [...order, order[random() % order.length]!] : order, f.ctx));
      for (const merge of merges) {
        const definition = { id: 'laws', class: 'informational' as const, stalenessBound: 100, retention: 'all-identities' as const, decisions: { note: { kind: 'folds' as const, merge, identity: 'identity', value: 'amount', ...(merge === 'cap-checked aggregate' ? { cap: '100' } : {}) } } };
        const bytes = value(canonical(value(foldProjection(definition, snapshot, generation, f.c)))).bytes;
        if (!expected.has(merge)) expected.set(merge, bytes); else expect(bytes).toBe(expected.get(merge));
      }
    }
  }
}, 30000);

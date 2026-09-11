import { expect, it } from 'vitest';
import { createRunClosureGraph } from '../../src/rungraph/index.js';
import { pressureFixture } from './closure-fixtures.js';
import { value } from './fixtures.js';

it.each(['queue-full', 'quota-wall', 'safety-ceiling', 'open-breaker'] as const)(
  'P5-SEAM-RC-A-PRIME-PRESSURE-STATES P5-NF-16 P5-NF-17 %s preserves the inhibited assignment without an exit',
  basis => {
    const f = pressureFixture(basis);
    const changed = value(f.graph.transition(f.transition));
    const expected = basis === 'safety-ceiling' ? 'halted' : 'waiting';
    expect(changed.state).toBe(expected);
    const rebuilt = value(createRunClosureGraph(f.deps));
    expect(value(rebuilt.read(f.id)).state).toBe(expected);
    expect(rebuilt.readExit({ owner: 'part-five', name: 'Run', id: f.id }))
      .toMatchObject({ kind: 'Refused', detail: 'terminal run exit absent' });
    expect(value(f.store.read()).filter(fact => fact.kind === 'run-unreachable-exit')).toHaveLength(0);
  },
);

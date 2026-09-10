import { expect, it } from 'vitest';
import { createRunClosureGraph } from '../../src/rungraph/index.js';
import { continuityFixture, pressureFixture } from '../rungraph/closure-fixtures.js';
import { refused, value } from '../rungraph/fixtures.js';

it('P5-SEAM-RC-F8-CONTINUITY-INTEGRATION admits witnessed continuity through the public owner and replays its immutable duplicate', () => {
  const f = continuityFixture();
  const first = value(f.graph.recordContinuity(f.accounting, f.lease));
  expect(first.kind).toBe('continuity-accounting');
  const restarted = value(createRunClosureGraph(f.deps));
  expect(value(restarted.recordContinuity(f.accounting, f.lease))).toEqual(first);
  expect(f.admissions.has(first.id)).toBe(true);
});

it.each(['queue-full', 'quota-wall', 'safety-ceiling', 'open-breaker'] as const)
('P5-SEAM-RC-F8-PRESSURE-INTEGRATION P5-SEAM-RC-R12-V03 replays %s as waiting or halted, never terminal', basis => {
  const f = pressureFixture(basis);
  value(f.graph.transition(f.transition));
  const restarted = value(createRunClosureGraph(f.deps)), view = value(restarted.read(f.id));
  expect(view.state).toBe(basis === 'safety-ceiling' ? 'halted' : 'waiting');
  refused(restarted.readExit({ owner: 'part-five', name: 'Run', id: f.id }), 'terminal run exit absent');
});

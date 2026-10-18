import type { Json } from '../index.js';
import { exact, list, object, requireThat, text } from './boundary.js';

export const rungFields = ['decidesAlone', 'decidesAloneBasis', 'criticality', 'failDirection', 'preservesInput', 'enforces', 'model'] as const;
// Rule 4 names two admissions in one sentence: the three irreversible-miss cases, and
// deterministic enforcement of recorded governed state. The category word alone cannot
// tell them apart, so a `ruled-three` rung also names WHICH admission it claims, from a
// closed list that is Rule 4's own subjects — a new site cannot add a fourth by writing one.
export const ruledThreeBases = ['live-secret-leaving', 'spend-past-a-cap', 'operator-emergency-stop', 'recorded-governed-state'] as const;
// One representation, shared by decode and runtime wiring. Empty rungs cannot
// turn an admission boundary into an empty iteration.
export function boundaryRungs(facts: Readonly<Record<string, Json>>) {
  const multi = facts.rungs !== undefined;
  if (multi) for (const field of rungFields) requireThat(facts[field] === undefined, `ambiguous top-level/rung ${field}`);
  const rungs = multi ? list(facts.rungs, 'rungs').map(object) : [facts];
  requireThat(rungs.length > 0, 'rungs must be nonempty');
  for (const rung of rungs) {
    if (multi) exact(rung, [...rungFields]);
    requireThat(['no', 'ruled-three', 'governed-state'].includes(text(rung.decidesAlone, 'rung.decidesAlone')), 'unknown rung decision category');
    text(rung.criticality, 'rung.criticality'); text(rung.preservesInput, 'rung.preservesInput');
    requireThat(rung.failDirection === 'open' || rung.failDirection === 'closed', 'unknown rung fail direction');
    if (rung.decidesAlone === 'ruled-three')
      requireThat((ruledThreeBases as readonly string[]).includes(text(rung.decidesAloneBasis, 'rung.decidesAloneBasis')),
        'P3-NF-26: ruled-three rung must name one of rule 4\'s own admissions');
    else requireThat(rung.decidesAloneBasis === undefined, 'decidesAloneBasis requires a ruled-three rung');
    if (rung.decidesAlone === 'no') text(rung.model, 'rung.model');
    if (rung.decidesAlone === 'governed-state') {
      const e = object(rung.enforces!); exact(e, ['record', 'decoder']);
      text(e.record, 'P3-NF-26: enforces.record'); text(e.decoder, 'P3-NF-26: enforces.decoder');
    } else requireThat(rung.enforces === undefined, 'enforces requires governed-state rung');
  }
  return rungs;
}

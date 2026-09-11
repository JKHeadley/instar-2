import { decode } from '../../src/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { exhaustionFixture } from './closure-fixtures.js';
import { json, ref, value } from './fixtures.js';

export function unknownDependencyExhaustion(storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort) {
  const f = exhaustionFixture(storageFactory);
  const dependency = f.append('run-dependency-observation',
    json({ ...f.dependency.body as object, status: 'unknown' }), [f.dependency.id]).fact;
  const decision = value(decode('Decision', f.decisionInput({ id: 'review15:partial-conclusion',
    conclusion: { subject: f.id, predicate: 'exhaustion-conclusion', value: false, evidence: ['e1'] },
    reason: { subject: f.id, predicate: 'partial-support', value: true, evidence: ['e1', 'e2'] },
  }), f.ctx.decode));
  const decisionFact = f.append('decision-record', json({ decision }), f.evidenceFacts.map(fact => fact.id)).fact;
  const partial = { ...f.exhaustion, id: 'review15:partial-exhaustion', dependencies: [ref(dependency)],
    conclusion: { type: 'Decision' as const, id: decision.id, fact: ref(decisionFact), field: 'decision' as const } };
  const exhaustive = { ...f.exhaustion, id: 'review15:exhaustive-with-unknown', dependencies: [ref(dependency)] };
  return { ...f, currentUnknownDependency: dependency, partialDecision: decision,
    partialDecisionFact: decisionFact, partial, exhaustive };
}

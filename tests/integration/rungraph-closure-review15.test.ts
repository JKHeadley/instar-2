import { expect, it } from 'vitest';
import { createRunClosureGraph } from '../../src/rungraph/index.js';
import { exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { transitionedContinuity, unknownDependencyExhaustion } from '../rungraph/review15-fixtures.js';
import { ref, refused, value } from '../rungraph/fixtures.js';

it('P5-SEAM-RC-R15-F1-CLOCK-INTEGRATION P5-NF-17 closes through the public owner with a later current clock', () => {
  const f = exhaustionFixture();
  const proposalFact = value(f.graph.recordUnreachableExit(f.exit, f.lease));
  f.setClock(f.now.value + 51);
  const close = { ...f.exit, id: 'review15:integration-close', expected: f.exit.id, phase: 'close' as const,
    at: f.deps.clock(), frontier: value(f.graph.read(f.id)).source.foldedThrough,
    proposal: { owner: 'part-five' as const, name: 'UnreachableRunExit' as const,
      id: f.exit.id, fact: ref(proposalFact) } };
  const closeFact = value(f.graph.recordUnreachableExit(close, f.lease));
  expect(value(value(createRunClosureGraph(f.deps)).readExit({ owner: 'part-five', name: 'Run', id: f.id })))
    .toEqual({ fact: ref(closeFact), exit: close });
});

it('P5-SEAM-RC-R15-F2-CAPTURE-INTEGRATION P5-NF-46 records transitioned pending accounting while unavailable context keeps execution inhibited', () => {
  const available = transitionedContinuity(true);
  expect(value(available.graph.recordContinuity(available.accounting, available.lease)).kind)
    .toBe('continuity-accounting');

  const unavailable = transitionedContinuity(false);
  const accountingFact = value(unavailable.graph.recordContinuity(unavailable.accounting, unavailable.lease));
  expect(accountingFact.kind).toBe('continuity-accounting');
  refused(unavailable.graph.read(unavailable.id), 'conflicted or tainted authority');
});

it('P5-SEAM-RC-R15-F3-PARTIAL-INTEGRATION P5-NF-23 P5-NF-24 admits the exact unknown observation only for a false conclusion', () => {
  const f = unknownDependencyExhaustion();
  const partialFact = value(f.graph.recordExhaustion(f.partial, f.lease));
  expect(value(f.graph.recordExhaustion(f.partial, f.lease))).toEqual(partialFact);
  refused(f.graph.recordExhaustion(f.exhaustive, f.lease));
});

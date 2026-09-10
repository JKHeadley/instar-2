import { expect, it } from 'vitest';
import { exhaustionFixture, impossibleHistoryContinuityFixture } from './closure-fixtures.js';
import { transitionedContinuity, unknownDependencyExhaustion } from './review15-fixtures.js';
import { ref, refused, value } from './fixtures.js';

function closeInput(f: ReturnType<typeof exhaustionFixture>, proposalFact: ReturnType<typeof value>, id: string) {
  return { ...f.exit, id, expected: f.exit.id, phase: 'close' as const, at: f.deps.clock(),
    frontier: value(f.graph.read(f.id)).source.foldedThrough,
    proposal: { owner: 'part-five' as const, name: 'UnreachableRunExit' as const,
      id: f.exit.id, fact: ref(proposalFact as never) } };
}

it('P5-SEAM-RC-R15-F1-CLOCK-UNIT P5-NF-17 accepts an independently current close clock and still refuses stale or future clocks', () => {
  const fresh = exhaustionFixture();
  const freshProposal = value(fresh.graph.recordUnreachableExit(fresh.exit, fresh.lease));
  fresh.setClock(fresh.now.value + 51);
  expect(value(fresh.graph.recordUnreachableExit(closeInput(fresh, freshProposal, 'review15:fresh-close'), fresh.lease)).kind)
    .toBe('run-unreachable-exit');

  const stale = exhaustionFixture();
  const staleProposal = value(stale.graph.recordUnreachableExit(stale.exit, stale.lease));
  stale.setClock(stale.now.value + stale.deps.groundingPolicy.maxAge + 1);
  refused(stale.graph.recordUnreachableExit({ ...closeInput(stale, staleProposal, 'review15:stale-close'), at: stale.now }, stale.lease),
    'unreachable exit clock stale or uncertain');

  const future = exhaustionFixture();
  const futureProposal = value(future.graph.recordUnreachableExit(future.exit, future.lease));
  refused(future.graph.recordUnreachableExit({ ...closeInput(future, futureProposal, 'review15:future-close'),
    at: future.clock(future.now.value + 1) }, future.lease), 'unreachable exit clock stale or uncertain');
});

it('P5-SEAM-RC-R15-F2-CAPTURE-UNIT P5-NF-46 retains available and unavailable pending accounting after valid work, but not impossible history', () => {
  for (const available of [true, false]) {
    const f = transitionedContinuity(available);
    expect(value(f.graph.recordContinuity(f.accounting, f.lease)).kind).toBe('continuity-accounting');
  }
  const impossible = impossibleHistoryContinuityFixture();
  refused(impossible.graph.recordContinuity(impossible.invalidAccounting, impossible.lease),
    'conflicted or tainted authority');
});

it('P5-SEAM-RC-R15-F3-PARTIAL-UNIT P5-NF-23 P5-NF-24 retains a current unknown dependency only as partial exhaustion', () => {
  const f = unknownDependencyExhaustion();
  const partialFact = value(f.graph.recordExhaustion(f.partial, f.lease));
  expect(partialFact.kind).toBe('run-exhaustion');
  refused(f.graph.recordUnreachableExit({ ...f.exit,
    exhaustion: { ...f.exit.exhaustion, id: f.partial.id, fact: ref(partialFact) },
    frontier: value(f.graph.read(f.id)).source.foldedThrough }, f.lease),
  'partial exhaustion cannot authorize unreachable closure');
  refused(f.graph.recordExhaustion(f.exhaustive, f.lease),
    'dependency observation has the wrong run or blocker subject');
});

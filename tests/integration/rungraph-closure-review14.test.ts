import { expect, it } from 'vitest';
import { createRunClosureGraph } from '../../src/rungraph/index.js';
import { closeUnreachable, continuityFixture, exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { digest, json, ref, value } from '../rungraph/fixtures.js';

function continuitySend(pending: boolean) {
  const f = continuityFixture();
  const work = pending
    ? f.append('continuity-pending-work', json({ run: f.id, inbound: f.opening.id, status: 'open' })).fact
    : f.addressedWork;
  const record = pending
    ? { ...f.accounting, disposition: { kind: 'pending' as const, work: ref(work), reason: 'owned work remains open' } }
    : f.accounting;
  const accounting = value(f.graph.recordContinuity(record, f.lease));
  const send = () => {
    const fact = f.append('continuity-first-reply-send', json({ run: f.id, accounting: accounting.id,
      ...record.firstReply, disclosure: f.disclosure.id, dispositionKind: record.disposition.kind,
      disposition: work.id, status: 'admitted' }), [accounting.id, f.disclosure.id, work.id]).fact;
    f.sendWitnesses.add(fact.id);
    return f.graph.verifyContinuitySend({ owner: 'part-five', name: 'ContinuityAccounting',
      id: record.id, fact: ref(accounting) }, ref(fact));
  };
  return { ...f, work, send };
}

it('P5-SEAM-RC-R14-INTEGRATION-V08-V09 re-resolves addressed and pending work at first-reply send', () => {
  const addressed = continuitySend(false);
  addressed.append('continuity-addressed-work',
    json({ ...addressed.work.body as object, status: 'invalid' }), [addressed.work.id]);
  expect(addressed.send().kind).toBe('Refused');

  const pending = continuitySend(true);
  pending.append('continuity-pending-work',
    json({ ...pending.work.body as object, status: 'closed' }), [pending.work.id]);
  expect(pending.send().kind).toBe('Refused');
});

function longRecheck(f: ReturnType<typeof exhaustionFixture>, id: string) {
  const at = f.clock(10_000);
  const obligation = f.append('run-observation-obligation',
    json({ ...f.obligation.body as object, due: digest(at) }), [f.obligation.id]).fact;
  const recheck = { ...f.exhaustion.recheck, at, obligation: ref(obligation) };
  const record = { ...f.exhaustion, id, recheck };
  const fact = value(f.graph.recordExhaustion(record, f.lease));
  return { recheck, record, fact };
}

it('P5-SEAM-RC-R14-INTEGRATION-V11-V20 enforces freshness independently at proposal and close', () => {
  const expiredProposal = exhaustionFixture();
  const old = longRecheck(expiredProposal, 'review14:expired-proposal');
  expiredProposal.setClock(expiredProposal.now.value + expiredProposal.run.exitTest.freshFor + 1);
  expect(expiredProposal.graph.recordUnreachableExit({ ...expiredProposal.exit,
    at: expiredProposal.deps.clock(), recheck: old.recheck,
    exhaustion: { ...expiredProposal.exit.exhaustion, id: old.record.id, fact: ref(old.fact) },
    frontier: value(expiredProposal.graph.read(expiredProposal.id)).source.foldedThrough }, expiredProposal.lease).kind)
    .toBe('Refused');

  const expiredClose = exhaustionFixture();
  const fresh = longRecheck(expiredClose, 'review14:expired-close');
  expiredClose.setClock(expiredClose.now.value + expiredClose.run.exitTest.freshFor);
  const proposal = { ...expiredClose.exit, at: expiredClose.deps.clock(), recheck: fresh.recheck,
    exhaustion: { ...expiredClose.exit.exhaustion, id: fresh.record.id, fact: ref(fresh.fact) },
    frontier: value(expiredClose.graph.read(expiredClose.id)).source.foldedThrough };
  const proposalFact = value(expiredClose.graph.recordUnreachableExit(proposal, expiredClose.lease));
  expiredClose.setClock(expiredClose.now.value + expiredClose.run.exitTest.freshFor + 1);
  const close = { ...proposal, id: 'review14:expired-close', expected: proposal.id, phase: 'close' as const,
    at: expiredClose.deps.clock(), frontier: value(expiredClose.graph.read(expiredClose.id)).source.foldedThrough,
    proposal: { owner: 'part-five' as const, name: 'UnreachableRunExit' as const,
      id: proposal.id, fact: ref(proposalFact) } };
  expect(expiredClose.graph.recordUnreachableExit(close, expiredClose.lease).kind).toBe('Refused');
  expect(value(expiredClose.graph.read(expiredClose.id)).state).toBe('closing');
});

it('P5-SEAM-RC-R14-INTEGRATION-V13-V14 retries exact unreachable records but refuses changed content', () => {
  const proposal = exhaustionFixture();
  const proposalFact = value(proposal.graph.recordUnreachableExit(proposal.exit, proposal.lease));
  expect(value(proposal.graph.recordUnreachableExit(proposal.exit, proposal.lease))).toEqual(proposalFact);
  expect(proposal.graph.recordUnreachableExit({ ...proposal.exit, settledOperations: ['changed'] }, proposal.lease).kind)
    .toBe('Refused');

  const closed = closeUnreachable();
  const rebuilt = value(createRunClosureGraph(closed.deps));
  expect(value(rebuilt.recordUnreachableExit(closed.terminalExit, closed.lease))).toEqual(closed.closeFact);
  expect(rebuilt.recordUnreachableExit({ ...closed.terminalExit, id: 'review14:different-close' }, closed.lease).kind)
    .toBe('Refused');
});

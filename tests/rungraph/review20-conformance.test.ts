import { expect, it } from 'vitest';
import { closureRecordWire, createRunClosureGraph, recordWire } from '../../src/rungraph/index.js';
import { alteredGroundingContinuityFixture, closeUnreachable, continuityWithLaterInbound,
  exhaustionFixture } from './closure-fixtures.js';
import { digest, json, ref, value } from './fixtures.js';
import { signedNext } from './review20-fixtures.js';

function mismatchedGroundingAccounting() {
  const f = alteredGroundingContinuityFixture('valid');
  const groundingFact = f.append('session-grounding', json({ run: 'other-run',
    record: recordWire(f.alteredGrounding as never) })).fact;
  f.admissions.add(groundingFact.id);
  const firstReply = { operation: 'review20:envelope-reply', digest: digest('review20:envelope-reply') };
  const proposal = f.append('continuity-reply-proposal', json({ run: f.id, expected: f.ready.head,
    grounding: groundingFact.id, inbound: f.opening.id, ...firstReply,
    status: 'proposed', permission: 'none' })).fact;
  const disclosure = f.append('continuity-disclosure', json({ run: f.id, grounding: groundingFact.id,
    inbound: f.opening.id, ...firstReply }), [proposal.id]).fact;
  const accounting = { ...f.alteredAccounting, id: 'review20:envelope-accounting',
    grounding: { ...f.alteredAccounting.grounding, fact: ref(groundingFact) }, firstReply,
    disclosure: ref(disclosure) };
  return { ...f, mismatchedGroundingFact: groundingFact, mismatchedDisclosure: disclosure, accounting };
}

it('P5-SEAM-RC-R20-F1-ENVELOPE-UNIT P5-NF-45 P5-NF-46 refuses a grounding whose signed envelope names another run', () => {
  const f = mismatchedGroundingAccounting();
  expect(f.graph.recordContinuity(f.accounting, f.lease)).toMatchObject({ kind: 'Refused' });
  expect(value(f.store.read()).filter(fact => fact.kind === 'continuity-accounting')).toHaveLength(0);
});

it('P5-SEAM-RC-R20-F1-SEND-UNIT P5-NF-46 refuses send verification for accounting whose grounding envelope names another run', () => {
  const f = mismatchedGroundingAccounting();
  const history = value(f.store.read());
  const accountingFact = signedNext(f, history.at(-1)!, 'continuity-accounting', json({ run: f.id,
    record: closureRecordWire(f.accounting as never) }));
  f.admissions.add(accountingFact.id);
  const send = signedNext(f, accountingFact, 'continuity-first-reply-send', json({ run: f.id, accounting: accountingFact.id,
    operation: f.accounting.firstReply.operation, digest: f.accounting.firstReply.digest,
    disclosure: f.mismatchedDisclosure.id, dispositionKind: 'pending', disposition: f.opening.id,
    status: 'admitted' }), [accountingFact.id, f.mismatchedDisclosure.id, f.opening.id]);
  f.sendWitnesses.add(send.id);
  const graph = value(createRunClosureGraph({ ...f.deps, store: { ...f.store,
    read: () => f.success([...history, accountingFact, send]) } }));

  expect(graph.verifyContinuitySend({ owner: 'part-five', name: 'ContinuityAccounting',
    id: f.accounting.id, fact: ref(accountingFact) }, ref(send))).toMatchObject({ kind: 'Refused' });
});

it('P5-SEAM-RC-R20-F2-ANCESTOR-UNIT P5-NF-45 P5-NF-46 requires an owner witness for the ancestral pre-pause grounding', () => {
  const unwitnessed = continuityWithLaterInbound();
  unwitnessed.admissions.delete(unwitnessed.groundingFact.id);
  expect(unwitnessed.graph.recordContinuity(unwitnessed.currentAccounting, unwitnessed.lease))
    .toMatchObject({ kind: 'Refused' });

  const witnessed = continuityWithLaterInbound();
  expect(witnessed.graph.recordContinuity(witnessed.currentAccounting, witnessed.lease))
    .toMatchObject({ kind: 'Success' });
});

it('P5-SEAM-RC-R20-F2-EQUAL-COPY-UNIT P5-NF-45 P5-NF-46 accepts an equal witnessed ancestral grounding copy', () => {
  const f = continuityWithLaterInbound(undefined, true);
  expect(f.priorGroundingCopy).toBeDefined();
  f.admissions.delete(f.groundingFact.id);
  expect(f.graph.recordContinuity(f.currentAccounting, f.lease)).toMatchObject({ kind: 'Success' });
});

it('P5-SEAM-RC-R20-F3-PROPOSAL-UNIT P5-NF-17 re-resolves exhaustion evidence before replaying an unreachable proposal', () => {
  const unsupported = exhaustionFixture();
  value(unsupported.graph.recordUnreachableExit(unsupported.exit, unsupported.lease));
  unsupported.admissions.delete(unsupported.exhaustionFact.id);
  expect(unsupported.graph.recordUnreachableExit(unsupported.exit, unsupported.lease))
    .toMatchObject({ kind: 'Refused' });

  const supported = exhaustionFixture();
  const original = value(supported.graph.recordUnreachableExit(supported.exit, supported.lease));
  expect(value(supported.graph.recordUnreachableExit(supported.exit, supported.lease))).toEqual(original);
});

it('P5-SEAM-RC-R20-F3-CLOSE-UNIT P5-NF-17 re-resolves proposal evidence before replaying an unreachable close', () => {
  const unsupported = closeUnreachable();
  const proposal = value(unsupported.store.read()).find(fact => fact.kind === 'run-unreachable-exit'
    && fact.id !== unsupported.closeFact.id)!;
  unsupported.admissions.delete(proposal.id);
  expect(unsupported.graph.recordUnreachableExit(unsupported.terminalExit, unsupported.lease))
    .toMatchObject({ kind: 'Refused' });

  const supported = closeUnreachable();
  expect(value(supported.graph.recordUnreachableExit(supported.terminalExit, supported.lease)))
    .toEqual(supported.closeFact);
});

import { expect, it } from 'vitest';
import { closureRecordWire, createRunClosureGraph, recordWire } from '../../src/rungraph/index.js';
import { alteredGroundingContinuityFixture, closeUnreachable, continuityWithLaterInbound,
  exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { digest, json, ref, value } from '../rungraph/fixtures.js';
import { signedNext } from '../rungraph/review20-fixtures.js';

function persistedMismatchedGrounding() {
  const f = alteredGroundingContinuityFixture('valid');
  const grounding = f.append('session-grounding', json({ run: 'other-run',
    record: recordWire(f.alteredGrounding as never) })).fact;
  f.admissions.add(grounding.id);
  const firstReply = { operation: 'review20:integration-reply', digest: digest('review20:integration-reply') };
  const proposal = f.append('continuity-reply-proposal', json({ run: f.id, expected: f.ready.head,
    grounding: grounding.id, inbound: f.opening.id, ...firstReply,
    status: 'proposed', permission: 'none' })).fact;
  const disclosure = f.append('continuity-disclosure', json({ run: f.id, grounding: grounding.id,
    inbound: f.opening.id, ...firstReply }), [proposal.id]).fact;
  const accounting = { ...f.alteredAccounting, id: 'review20:integration-accounting',
    grounding: { ...f.alteredAccounting.grounding, fact: ref(grounding) }, firstReply,
    disclosure: ref(disclosure) };
  const history = value(f.store.read());
  const accountingFact = signedNext(f, history.at(-1)!, 'continuity-accounting', json({ run: f.id,
    record: closureRecordWire(accounting as never) }));
  f.admissions.add(accountingFact.id);
  return { ...f, accounting, accountingFact, disclosure, history };
}

it('P5-SEAM-RC-R20-F1-INTEGRATION P5-NF-45 P5-NF-46 revalidates grounding envelope run binding through the rebuilt owner and send boundary', () => {
  const f = persistedMismatchedGrounding();
  const send = signedNext(f, f.accountingFact, 'continuity-first-reply-send', json({ run: f.id, accounting: f.accountingFact.id,
    operation: f.accounting.firstReply.operation, digest: f.accounting.firstReply.digest,
    disclosure: f.disclosure.id, dispositionKind: 'pending', disposition: f.opening.id,
    status: 'admitted' }), [f.accountingFact.id, f.disclosure.id, f.opening.id]);
  f.sendWitnesses.add(send.id);
  const rebuilt = value(createRunClosureGraph({ ...f.deps, store: { ...f.store,
    read: () => f.success([...f.history, f.accountingFact, send]) } }));

  expect(rebuilt.recordContinuity(f.accounting, f.lease)).toMatchObject({ kind: 'Refused' });
  expect(rebuilt.verifyContinuitySend({ owner: 'part-five', name: 'ContinuityAccounting',
    id: f.accounting.id, fact: ref(f.accountingFact) }, ref(send))).toMatchObject({ kind: 'Refused' });
});

it('P5-SEAM-RC-R20-F2-INTEGRATION P5-NF-45 P5-NF-46 revalidates ancestral admission while retaining an equal witnessed copy', () => {
  const unsupported = continuityWithLaterInbound();
  const unsupportedFact = unsupported.append('continuity-accounting', json({ run: unsupported.id,
    record: closureRecordWire(unsupported.currentAccounting as never) })).fact;
  unsupported.admissions.add(unsupportedFact.id);
  unsupported.admissions.delete(unsupported.groundingFact.id);
  expect(value(createRunClosureGraph(unsupported.deps))
    .recordContinuity(unsupported.currentAccounting, unsupported.lease)).toMatchObject({ kind: 'Refused' });

  const supported = continuityWithLaterInbound(undefined, true);
  const supportedFact = supported.append('continuity-accounting', json({ run: supported.id,
    record: closureRecordWire(supported.currentAccounting as never) })).fact;
  supported.admissions.add(supportedFact.id);
  supported.admissions.delete(supported.groundingFact.id);
  expect(value(value(createRunClosureGraph(supported.deps))
    .recordContinuity(supported.currentAccounting, supported.lease))).toEqual(supportedFact);
});

it('P5-SEAM-RC-R20-F3-PROPOSAL-INTEGRATION P5-NF-17 refuses rebuilt proposal replay when its exhaustion owner witness is unavailable', () => {
  const unsupported = exhaustionFixture();
  value(unsupported.graph.recordUnreachableExit(unsupported.exit, unsupported.lease));
  unsupported.admissions.delete(unsupported.exhaustionFact.id);
  expect(value(createRunClosureGraph(unsupported.deps))
    .recordUnreachableExit(unsupported.exit, unsupported.lease)).toMatchObject({ kind: 'Refused' });

  const supported = exhaustionFixture();
  const proposal = value(supported.graph.recordUnreachableExit(supported.exit, supported.lease));
  expect(value(value(createRunClosureGraph(supported.deps))
    .recordUnreachableExit(supported.exit, supported.lease))).toEqual(proposal);
});

it('P5-SEAM-RC-R20-F3-CLOSE-INTEGRATION P5-NF-17 refuses rebuilt close replay when its proposal owner witness is unavailable', () => {
  const unsupported = closeUnreachable();
  const proposal = value(unsupported.store.read()).find(fact => fact.kind === 'run-unreachable-exit'
    && fact.id !== unsupported.closeFact.id)!;
  unsupported.admissions.delete(proposal.id);
  expect(value(createRunClosureGraph(unsupported.deps))
    .recordUnreachableExit(unsupported.terminalExit, unsupported.lease)).toMatchObject({ kind: 'Refused' });

  const supported = closeUnreachable();
  expect(value(value(createRunClosureGraph(supported.deps))
    .recordUnreachableExit(supported.terminalExit, supported.lease))).toEqual(supported.closeFact);
});

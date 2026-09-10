import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { closureRecordWire, createRunClosureGraph } from '../../src/rungraph/index.js';
import { closeUnreachable, continuityFixture, exhaustionFixture } from './closure-fixtures.js';
import { digest, json, ref, value } from './fixtures.js';

type SendRecord = Readonly<{ id: string; firstReply: Readonly<{ operation: string; digest: string }>;
  disclosure: Readonly<{ id: string }>; disposition: Readonly<{ kind: string;
    work?: Readonly<{ id: string }>; input?: Readonly<{ id: string }> }> }>;

function continuitySend(f: ReturnType<typeof continuityFixture>, record: SendRecord,
  accountingFact: FactEnvelope) {
  const disposition = record.disposition.kind === 'superseded'
    ? record.disposition.input! : record.disposition.work!;
  const fact = f.append('continuity-first-reply-send', json({ run: f.id, accounting: accountingFact.id,
    ...record.firstReply, disclosure: record.disclosure.id, dispositionKind: record.disposition.kind,
    disposition: disposition.id, status: 'admitted' }),
  [accountingFact.id, record.disclosure.id, disposition.id]).fact;
  f.sendWitnesses.add(fact.id);
  return { fact, verify: () => f.graph.verifyContinuitySend({ owner: 'part-five',
    name: 'ContinuityAccounting', id: record.id, fact: ref(accountingFact) }, ref(fact)) };
}

it('P5-SEAM-RC-R16-F1-SCOPE-UNIT keeps the branch diff inside the granted owner scope', () => {
  const merge = spawnSync('git', ['merge-base', 'main', 'HEAD'], { encoding: 'utf8' });
  expect(merge.status, merge.stderr).toBe(0);
  const diff = spawnSync('git', ['diff', '--name-only', merge.stdout.trim(), 'HEAD'], { encoding: 'utf8' });
  expect(diff.status, diff.stderr).toBe(0);
  const allowed = (path: string) => path.startsWith('src/rungraph/') || path.startsWith('tests/rungraph/')
    || path.startsWith('tests/integration/rungraph') || path.startsWith('tests/e2e/rungraph')
    || path.startsWith('generated/') || ['scripts/check-p5-contract-map.mjs',
      'scripts/register-owner-references.mjs', 'register-source/owner-references.json'].includes(path);
  expect(diff.stdout.trim().split('\n').filter(path => path && !allowed(path))).toEqual([]);
});

it('P5-SEAM-RC-R16-F2-RESULT-BINDING-UNIT P5-NF-46 accepts the exact work result and refuses another successful ancestor', () => {
  const f = continuityFixture();
  const unrelatedResult = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success',
    value: { operation: 'unrelated', answer: 'other assignment' }, capacity: { kind: 'none' } }, f.ctx.decode));
  const unrelatedFact = f.append('result-record', json({ result: unrelatedResult })).fact;
  const work = f.append('continuity-addressed-work', json({ ...f.addressedWork.body as object }),
    [f.disclosure.id, f.addressedResultFact.id]).fact;
  const exact = { ...f.accounting, disposition: { ...f.accounting.disposition, work: ref(work) } };
  expect(f.graph.recordContinuity(exact, f.lease).kind).toBe('Success');
  const substituted = { ...exact, id: 'review16:substituted-result', disposition: { ...exact.disposition,
    result: { ...f.addressedResultReference, id: 'review16:unrelated-result', fact: ref(unrelatedFact) } } };
  expect(f.graph.recordContinuity(substituted, f.lease).kind).toBe('Refused');
});

it('P5-SEAM-RC-R16-F3-CURRENT-WORK-UNIT P5-NF-46 re-resolves the addressed work disposition at current send verification', () => {
  const obsolete = continuityFixture();
  const accountingFact = value(obsolete.graph.recordContinuity(obsolete.accounting, obsolete.lease));
  const sent = continuitySend(obsolete, obsolete.accounting, accountingFact);
  expect(sent.verify().kind).toBe('Success');
  obsolete.append('continuity-addressed-work', json({ ...obsolete.addressedWork.body as object, status: 'invalid' }),
    [obsolete.addressedWork.id]);
  expect(sent.verify().kind).toBe('Refused');

  const unrelated = continuityFixture();
  const unrelatedAccounting = value(unrelated.graph.recordContinuity(unrelated.accounting, unrelated.lease));
  const unrelatedSend = continuitySend(unrelated, unrelated.accounting, unrelatedAccounting);
  unrelated.append('continuity-addressed-work', json({ ...unrelated.addressedWork.body as object,
    run: 'another-run', status: 'invalid' }), [unrelated.addressedWork.id]);
  expect(unrelatedSend.verify().kind).toBe('Success');
});

it('P5-SEAM-RC-R16-F4-CONFLICT-UNIT P5-NF-17 P5-NF-46 refuses conflicting witnessed immutable references', () => {
  const continuity = continuityFixture();
  const pending = { ...continuity.accounting, disposition: { kind: 'pending' as const,
    work: ref(continuity.opening), reason: 'original pending' } };
  const accountingFact = value(continuity.graph.recordContinuity(pending, continuity.lease));
  const changed = { ...pending, disposition: { ...pending.disposition, reason: 'different contents' } };
  const conflictingAccounting = continuity.append('continuity-accounting', json({ run: continuity.id,
    record: closureRecordWire(changed as never) })).fact;
  continuity.admissions.add(conflictingAccounting.id);
  expect(continuitySend(continuity, pending, accountingFact).verify().kind)
    .toBe('Refused');

  const exhaustion = exhaustionFixture();
  const proposal = value(exhaustion.graph.recordUnreachableExit(exhaustion.exit, exhaustion.lease));
  const changedExhaustion = { ...exhaustion.exhaustion, outsideAction: {
    ...exhaustion.exhaustion.outsideAction, action: 'different outside action' } };
  const conflictingExhaustion = exhaustion.append('run-exhaustion', json({ run: exhaustion.id,
    record: closureRecordWire(changedExhaustion as never) })).fact;
  exhaustion.admissions.add(conflictingExhaustion.id);
  const close = { ...exhaustion.exit, id: 'review16:conflicted-close', phase: 'close' as const,
    expected: exhaustion.exit.id, proposal: { owner: 'part-five' as const, name: 'UnreachableRunExit' as const,
      id: exhaustion.exit.id, fact: ref(proposal) }, frontier: value(exhaustion.graph.read(exhaustion.id)).source.foldedThrough };
  expect(exhaustion.graph.recordUnreachableExit(close, exhaustion.lease).kind).toBe('Refused');
});

it('P5-SEAM-RC-R16-F5-ENVELOPE-RUN-UNIT P5-NF-17 P5-NF-46 refuses owner records carried by a different run envelope', () => {
  const exhaustion = exhaustionFixture();
  const changed = { ...exhaustion.exhaustion, id: 'review16:mismatched-exhaustion' };
  const exhaustionFact = exhaustion.append('run-exhaustion', json({ run: 'different-run',
    record: closureRecordWire(changed as never) })).fact;
  exhaustion.admissions.add(exhaustionFact.id);
  expect(exhaustion.graph.recordUnreachableExit({ ...exhaustion.exit,
    exhaustion: { ...exhaustion.exit.exhaustion, id: changed.id, fact: ref(exhaustionFact) },
    frontier: value(exhaustion.graph.read(exhaustion.id)).source.foldedThrough }, exhaustion.lease).kind)
    .toBe('Refused');

  const continuity = continuityFixture();
  const accountingFact = continuity.append('continuity-accounting', json({ run: 'different-run',
    record: closureRecordWire(continuity.accounting as never) })).fact;
  continuity.admissions.add(accountingFact.id);
  expect(continuitySend(continuity, continuity.accounting, accountingFact).verify().kind).toBe('Refused');
});

it('P5-SEAM-RC-R16-F6-EQUAL-COPIES-UNIT P5-NF-17 P5-NF-46 coalesces equal owner-witnessed copies and retains the first fact', () => {
  for (const kind of ['exhaustion', 'proposal'] as const) {
    const f = exhaustionFixture();
    const record = kind === 'exhaustion' ? f.exhaustion : f.exit;
    const submit = () => kind === 'exhaustion'
      ? f.graph.recordExhaustion(record, f.lease) : f.graph.recordUnreachableExit(record, f.lease);
    const original = value(submit());
    const duplicate = f.append(original.kind, json({ run: f.id, record: closureRecordWire(record as never) })).fact;
    f.admissions.add(duplicate.id);
    expect(value(submit())).toEqual(original);
  }
  const continuity = continuityFixture();
  const originalAccounting = value(continuity.graph.recordContinuity(continuity.accounting, continuity.lease));
  const duplicateAccounting = continuity.append(originalAccounting.kind, json({ run: continuity.id,
    record: closureRecordWire(continuity.accounting as never) })).fact;
  continuity.admissions.add(duplicateAccounting.id);
  expect(value(continuity.graph.recordContinuity(continuity.accounting, continuity.lease))).toEqual(originalAccounting);

  const closed = closeUnreachable();
  const originalExit = value(closed.graph.readExit({ owner: 'part-five', name: 'Run', id: closed.id }));
  const duplicateClose = closed.append('run-unreachable-exit', json({ run: closed.id,
    record: closureRecordWire(closed.terminalExit as never) })).fact;
  closed.admissions.add(duplicateClose.id);
  expect(value(value(createRunClosureGraph(closed.deps)).readExit({ owner: 'part-five', name: 'Run', id: closed.id })))
    .toEqual(originalExit);
});

it('P5-SEAM-RC-R16-F6-EQUAL-COPIES-NEAR-MISS-UNIT accepts an equal copy while still refusing genuinely different contents', () => {
  const equal = exhaustionFixture();
  const equalCopy = equal.append('run-exhaustion', json({ run: equal.id,
    record: closureRecordWire(equal.exhaustion as never) })).fact;
  equal.admissions.add(equalCopy.id);
  expect(equal.graph.recordUnreachableExit({ ...equal.exit,
    frontier: value(equal.graph.read(equal.id)).source.foldedThrough }, equal.lease).kind).toBe('Success');

  const conflict = exhaustionFixture();
  const changed = { ...conflict.exhaustion, outsideAction: { ...conflict.exhaustion.outsideAction,
    action: `different:${digest('different')}` } };
  const changedFact = conflict.append('run-exhaustion', json({ run: conflict.id,
    record: closureRecordWire(changed as never) })).fact;
  conflict.admissions.add(changedFact.id);
  expect(conflict.graph.recordUnreachableExit({ ...conflict.exit,
    frontier: value(conflict.graph.read(conflict.id)).source.foldedThrough }, conflict.lease).kind).toBe('Refused');
});

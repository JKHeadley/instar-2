import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { closureRecordWire, createRunClosureGraph } from '../../src/rungraph/index.js';
import { closeUnreachable, continuityFixture, exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, value } from '../rungraph/fixtures.js';

type SendRecord = Readonly<{ id: string; firstReply: Readonly<{ operation: string; digest: string }>;
  disclosure: Readonly<{ id: string }>; disposition: Readonly<{ kind: string;
    work?: Readonly<{ id: string }>; input?: Readonly<{ id: string }> }> }>;

function send(f: ReturnType<typeof continuityFixture>, record: SendRecord, accounting: FactEnvelope) {
  const disposition = record.disposition.kind === 'superseded'
    ? record.disposition.input! : record.disposition.work!;
  const fact = f.append('continuity-first-reply-send', json({ run: f.id, accounting: accounting.id,
    ...record.firstReply, disclosure: record.disclosure.id, dispositionKind: record.disposition.kind,
    disposition: disposition.id, status: 'admitted' }), [accounting.id, record.disclosure.id, disposition.id]).fact;
  f.sendWitnesses.add(fact.id);
  return f.graph.verifyContinuitySend({ owner: 'part-five', name: 'ContinuityAccounting',
    id: record.id, fact: ref(accounting) }, ref(fact));
}

it('P5-SEAM-RC-R16-F2-RESULT-BINDING-INTEGRATION P5-NF-46 refuses a signed replay whose work does not witness its selected result', () => {
  const f = continuityFixture();
  const unrelated = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success',
    value: 'unrelated older success', capacity: { kind: 'none' } }, f.ctx.decode));
  const unrelatedFact = f.append('result-record', json({ result: unrelated })).fact;
  const work = f.append('continuity-addressed-work', json({ ...f.addressedWork.body as object }),
    [f.disclosure.id, f.addressedResultFact.id]).fact;
  const replayed = { ...f.accounting, id: 'review16:integration:unbound-result',
    disposition: { kind: 'addressed' as const, work: ref(work),
      result: { ...f.addressedResultReference, id: 'review16:unrelated', fact: ref(unrelatedFact) } } };
  expect(() => f.append('continuity-accounting', json({ run: f.id,
    record: closureRecordWire(replayed as never) }))).toThrow(
    'addressed work does not explicitly witness this durable answer or work result');
});

it('P5-SEAM-RC-R16-F3-CURRENT-WORK-INTEGRATION P5-NF-46 refuses a formerly valid send after its exact work is superseded', () => {
  const f = continuityFixture();
  const accounting = value(f.graph.recordContinuity(f.accounting, f.lease));
  expect(send(f, f.accounting, accounting).kind).toBe('Success');
  f.append('continuity-addressed-work', json({ ...f.addressedWork.body as object, status: 'invalid' }),
    [f.addressedWork.id]);
  expect(send(f, f.accounting, accounting).kind).toBe('Refused');
});

it('P5-SEAM-RC-R16-F4-CONFLICT-INTEGRATION P5-NF-46 refuses an exact accounting reference with different witnessed contents', () => {
  const f = continuityFixture();
  const pending = { ...f.accounting, disposition: { kind: 'pending' as const,
    work: ref(f.opening), reason: 'original pending' } };
  const accounting = value(f.graph.recordContinuity(pending, f.lease));
  const conflict = { ...pending, disposition: { ...pending.disposition, reason: 'conflicting pending' } };
  const conflictFact = f.append('continuity-accounting', json({ run: f.id,
    record: closureRecordWire(conflict as never) })).fact;
  f.admissions.add(conflictFact.id);
  expect(send(f, pending, accounting).kind).toBe('Refused');
});

it('P5-SEAM-RC-R16-F5-ENVELOPE-RUN-INTEGRATION P5-NF-17 refuses an exact exhaustion reference carried under another run', () => {
  const f = exhaustionFixture();
  const record = { ...f.exhaustion, id: 'review16:integration:mismatched-run' };
  const fact = f.append('run-exhaustion', json({ run: 'another-run',
    record: closureRecordWire(record as never) })).fact;
  f.admissions.add(fact.id);
  expect(f.graph.recordUnreachableExit({ ...f.exit,
    exhaustion: { ...f.exit.exhaustion, id: record.id, fact: ref(fact) },
    frontier: value(f.graph.read(f.id)).source.foldedThrough }, f.lease).kind).toBe('Refused');
});

it('P5-SEAM-RC-R16-F6-EQUAL-COPIES-INTEGRATION P5-NF-17 coalesces equal signed close copies through a rebuilt public owner', () => {
  const f = closeUnreachable();
  const original = value(f.graph.readExit({ owner: 'part-five', name: 'Run', id: f.id }));
  const copy = f.append('run-unreachable-exit', json({ run: f.id,
    record: closureRecordWire(f.terminalExit as never) })).fact;
  f.admissions.add(copy.id);
  const rebuilt = value(createRunClosureGraph(f.deps));
  expect(value(rebuilt.readExit({ owner: 'part-five', name: 'Run', id: f.id }))).toEqual(original);
});

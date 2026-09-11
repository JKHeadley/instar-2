import { expect, it } from 'vitest';
import { closureRecordWire, createRunClosureGraph, recordFromWire, recordWire } from '../../src/rungraph/index.js';
import { alteredGroundingContinuityFixture, continuityFixture, exhaustionFixture } from './closure-fixtures.js';
import { json, ref, value } from './fixtures.js';

it.each([
  ['P5-SEAM-RC-R19-V37-UNIT', 'coverage'],
  ['P5-SEAM-RC-R19-V38-UNIT', 'binding'],
  ['P5-SEAM-RC-R19-V39-UNIT', 'pending'],
  ['P5-SEAM-RC-R19-V40-UNIT', 'receipt'],
] as const)('%s P5-NF-45 P5-NF-46 refuses available continuity backed by inconsistent signed grounding: %s',
  (_fixtureId, mode) => {
    const f = alteredGroundingContinuityFixture(mode);
    expect(f.graph.recordContinuity(f.alteredAccounting, f.lease)).toMatchObject({ kind: 'Refused' });
    expect(value(f.store.read()).filter(fact => fact.kind === 'continuity-accounting')).toHaveLength(0);
  });

it('P5-SEAM-RC-R19-V41-UNIT P5-NF-45 P5-NF-46 accepts a second valid witnessed grounding identity', () => {
  const f = alteredGroundingContinuityFixture('valid');
  expect(f.graph.recordContinuity(f.alteredAccounting, f.lease)).toMatchObject({ kind: 'Success' });
});

it('P5-SEAM-RC-R19-V42-UNIT P5-NF-45 P5-NF-46 refuses a witnessed send backed by inconsistent grounding', () => {
  const f = alteredGroundingContinuityFixture('coverage');
  const accountingFact = f.append('continuity-accounting', json({ run: f.id,
    record: closureRecordWire(f.alteredAccounting as never) })).fact;
  f.admissions.add(accountingFact.id);
  const send = f.append('continuity-first-reply-send', json({ run: f.id, accounting: accountingFact.id,
    operation: f.alteredAccounting.firstReply.operation, digest: f.alteredAccounting.firstReply.digest,
    disclosure: f.alteredDisclosure.id, dispositionKind: 'pending', disposition: f.opening.id,
    status: 'admitted' }), [accountingFact.id, f.alteredDisclosure.id, f.opening.id]).fact;
  f.sendWitnesses.add(send.id);

  expect(f.graph.verifyContinuitySend({ owner: 'part-five', name: 'ContinuityAccounting',
    id: f.alteredAccounting.id, fact: ref(accountingFact) }, ref(send))).toMatchObject({ kind: 'Refused' });
});

it.each([
  ['P5-SEAM-RC-R19-V59-UNIT', 'coverage'],
  ['P5-SEAM-RC-R19-V60-UNIT', 'binding'],
  ['P5-SEAM-RC-R19-V61-UNIT', 'pending'],
  ['P5-SEAM-RC-R19-V62-UNIT', 'receipt'],
  ['P5-SEAM-RC-R19-V63-UNIT', 'valid'],
] as const)('%s P5-NF-45 P5-NF-46 preserves only honest unavailable-capture pending accounting: %s',
  (_fixtureId, mode) => {
    const f = alteredGroundingContinuityFixture(mode);
    Object.assign(f.ctx.captures['message:1']!, { status: 'missing', bytes: null });
    const accounting = { ...f.alteredAccounting,
      prePauseCapture: { ...f.alteredAccounting.prePauseCapture, status: 'unavailable' as const } };
    expect(f.graph.recordContinuity(accounting, f.lease)).toMatchObject({
      kind: mode === 'valid' ? 'Success' : 'Refused',
    });
  });

it('P5-SEAM-RC-R19-V64-UNIT P5-NF-45 P5-NF-46 refuses a grounding policy substitution', () => {
  const f = alteredGroundingContinuityFixture('policy');
  expect(f.alteredGrounding.threshold).not.toBe(f.deps.groundingPolicy.threshold);
  expect(f.graph.recordContinuity(f.alteredAccounting, f.lease)).toMatchObject({ kind: 'Refused' });
});

function conditionalContinuityCopy(changed: boolean) {
  const f = continuityFixture();
  const original = recordFromWire((f.groundingFact.body as { record: never }).record) as Record<string, unknown>;
  const graph = value(createRunClosureGraph({ ...f.deps, admission: { ...f.deps.admission,
    commit: (request, write) => {
      const contender = changed ? { ...original, reason: 'recovery' } : original;
      const copy = f.append('session-grounding', json({ run: f.id, record: recordWire(contender as never) })).fact;
      f.admissions.add(copy.id);
      expect(value(f.graph.read(f.id)).conflicts.length > 0).toBe(changed);
      return f.deps.admission.commit(request, write);
    },
  } }));
  return { f, result: graph.recordContinuity(f.accounting, f.lease) };
}

function conditionalExhaustionCopy(changed: boolean) {
  const f = exhaustionFixture();
  const groundingFact = value(f.graph.ground(f.id, 'w', 'h', 'resume', f.lease));
  const original = recordFromWire((groundingFact.body as { record: never }).record) as Record<string, unknown>;
  const graph = value(createRunClosureGraph({ ...f.deps, admission: { ...f.deps.admission,
    commit: (request, write) => {
      const contender = changed ? { ...original, reason: 'recovery' } : original;
      const copy = f.append('session-grounding', json({ run: f.id, record: recordWire(contender as never) })).fact;
      f.admissions.add(copy.id);
      expect(value(f.graph.read(f.id)).conflicts.length > 0).toBe(changed);
      return f.deps.admission.commit(request, write);
    },
  } }));
  return { f, result: graph.recordExhaustion({ ...f.exhaustion,
    id: 'review19:conditional-exhaustion' }, f.lease) };
}

it.each([
  ['P5-SEAM-RC-R19-V68-UNIT', 'continuity', true],
  ['P5-SEAM-RC-R19-V69-UNIT', 'exhaustion', true],
  ['P5-SEAM-RC-R19-V70-UNIT', 'continuity', false],
  ['P5-SEAM-RC-R19-V71-UNIT', 'exhaustion', false],
] as const)('%s P5-NF-09 P5-NF-46 rechecks conditional admission for %s with changed=%s',
  (_fixtureId, kind, changed) => {
    const { f, result } = kind === 'continuity'
      ? conditionalContinuityCopy(changed) : conditionalExhaustionCopy(changed);
    expect(result).toMatchObject({ kind: changed ? 'Refused' : 'Success' });
    const recordKind = kind === 'continuity' ? 'continuity-accounting' : 'run-exhaustion';
    const expectedCount = kind === 'continuity' ? (changed ? 0 : 1) : (changed ? 1 : 2);
    expect(value(f.store.read()).filter(fact => fact.kind === recordKind)).toHaveLength(expectedCount);
  });

import { expect, it } from 'vitest';
import { closureRecordWire, createRunClosureGraph, recordFromWire,
  recordWire } from '../../src/rungraph/index.js';
import { alteredGroundingContinuityFixture, continuityFixture,
  exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, value } from '../rungraph/fixtures.js';

function persistAlteredAccounting(f: ReturnType<typeof alteredGroundingContinuityFixture>, unavailable = false) {
  if (unavailable) Object.assign(f.ctx.captures['message:1']!, { status: 'missing', bytes: null });
  const accounting = unavailable ? { ...f.alteredAccounting,
    prePauseCapture: { ...f.alteredAccounting.prePauseCapture, status: 'unavailable' as const } }
    : f.alteredAccounting;
  const fact = f.append('continuity-accounting', json({ run: f.id,
    record: closureRecordWire(accounting as never) })).fact;
  f.admissions.add(fact.id);
  return { accounting, fact };
}

it.each([
  ['P5-SEAM-RC-R19-V37-INTEGRATION', 'coverage'],
  ['P5-SEAM-RC-R19-V38-INTEGRATION', 'binding'],
  ['P5-SEAM-RC-R19-V39-INTEGRATION', 'pending'],
  ['P5-SEAM-RC-R19-V40-INTEGRATION', 'receipt'],
  ['P5-SEAM-RC-R19-V64-INTEGRATION', 'policy'],
] as const)('%s P5-NF-45 P5-NF-46 revalidates inconsistent signed grounding through a rebuilt owner: %s',
  (_fixtureId, mode) => {
    const f = alteredGroundingContinuityFixture(mode);
    const { accounting, fact } = persistAlteredAccounting(f);
    const rebuilt = value(createRunClosureGraph(f.deps));
    expect(rebuilt.recordContinuity(accounting, f.lease)).toMatchObject({ kind: 'Refused' });
    expect(value(f.store.read()).filter(candidate => candidate.kind === 'continuity-accounting')).toEqual([fact]);
  });

it('P5-SEAM-RC-R19-V41-INTEGRATION P5-NF-45 P5-NF-46 replays a valid witnessed grounding identity', () => {
  const f = alteredGroundingContinuityFixture('valid');
  const { accounting, fact } = persistAlteredAccounting(f);
  const rebuilt = value(createRunClosureGraph(f.deps));
  expect(value(rebuilt.recordContinuity(accounting, f.lease))).toEqual(fact);
});

it('P5-SEAM-RC-R19-V42-INTEGRATION P5-NF-45 P5-NF-46 revalidates grounding before send verification', () => {
  const f = alteredGroundingContinuityFixture('coverage');
  const { accounting, fact } = persistAlteredAccounting(f);
  const send = f.append('continuity-first-reply-send', json({ run: f.id, accounting: fact.id,
    operation: accounting.firstReply.operation, digest: accounting.firstReply.digest,
    disclosure: f.alteredDisclosure.id, dispositionKind: 'pending', disposition: f.opening.id,
    status: 'admitted' }), [fact.id, f.alteredDisclosure.id, f.opening.id]).fact;
  f.sendWitnesses.add(send.id);
  const rebuilt = value(createRunClosureGraph(f.deps));
  expect(rebuilt.verifyContinuitySend({ owner: 'part-five', name: 'ContinuityAccounting',
    id: accounting.id, fact: ref(fact) }, ref(send))).toMatchObject({ kind: 'Refused' });
});

it.each([
  ['P5-SEAM-RC-R19-V59-INTEGRATION', 'coverage'],
  ['P5-SEAM-RC-R19-V60-INTEGRATION', 'binding'],
  ['P5-SEAM-RC-R19-V61-INTEGRATION', 'pending'],
  ['P5-SEAM-RC-R19-V62-INTEGRATION', 'receipt'],
  ['P5-SEAM-RC-R19-V63-INTEGRATION', 'valid'],
] as const)('%s P5-NF-45 P5-NF-46 revalidates unavailable-capture accounting through a rebuilt owner: %s',
  (_fixtureId, mode) => {
    const f = alteredGroundingContinuityFixture(mode);
    const { accounting, fact } = persistAlteredAccounting(f, true);
    const rebuilt = value(createRunClosureGraph(f.deps));
    const result = rebuilt.recordContinuity(accounting, f.lease);
    if (mode === 'valid') expect(value(result)).toEqual(fact);
    else expect(result).toMatchObject({ kind: 'Refused' });
  });

function conditionalContinuityCopy(changed: boolean) {
  const f = continuityFixture();
  const original = recordFromWire((f.groundingFact.body as { record: never }).record) as Record<string, unknown>;
  const graph = value(createRunClosureGraph({ ...f.deps, admission: { ...f.deps.admission,
    commit: (request, write) => {
      const contender = changed ? { ...original, reason: 'recovery' } : original;
      const copy = f.append('session-grounding', json({ run: f.id, record: recordWire(contender as never) })).fact;
      f.admissions.add(copy.id);
      return f.deps.admission.commit(request, write);
    },
  } }));
  return graph.recordContinuity(f.accounting, f.lease);
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
      return f.deps.admission.commit(request, write);
    },
  } }));
  return graph.recordExhaustion({ ...f.exhaustion, id: 'review19:integration-exhaustion' }, f.lease);
}

it.each([
  ['P5-SEAM-RC-R19-V68-INTEGRATION', 'continuity', true],
  ['P5-SEAM-RC-R19-V69-INTEGRATION', 'exhaustion', true],
  ['P5-SEAM-RC-R19-V70-INTEGRATION', 'continuity', false],
  ['P5-SEAM-RC-R19-V71-INTEGRATION', 'exhaustion', false],
] as const)('%s P5-NF-09 P5-NF-46 re-resolves conditional %s admission after a signed copy arrives, changed=%s',
  (_fixtureId, kind, changed) => {
    const result = kind === 'continuity'
      ? conditionalContinuityCopy(changed) : conditionalExhaustionCopy(changed);
    expect(result).toMatchObject({ kind: changed ? 'Refused' : 'Success' });
  });

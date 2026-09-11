import { expect, it } from 'vitest';
import { closureRecordWire } from '../../src/rungraph/index.js';
import { exhaustionFixture } from './closure-fixtures.js';
import { json, ref, value } from './fixtures.js';

function appendWitnessedExhaustion(
  f: ReturnType<typeof exhaustionFixture>,
  record: Readonly<Record<string, unknown>>,
) {
  const fact = f.append('run-exhaustion', json({
    run: f.id,
    record: closureRecordWire(record as never),
  })).fact;
  f.admissions.add(fact.id);
  return fact;
}

function stop(f: ReturnType<typeof exhaustionFixture>, id: string) {
  return value(f.graph.transition({
    type: 'RunTransition', schemaVersion: 1, id, run: f.id, expected: f.ready.head,
    trigger: ref(f.opening), kind: 'stop', from: 'ready', to: 'halted',
    responsible: f.owner, standing: ref(f.opening), ownership: f.lease,
    generation: f.run.generation, at: f.now,
    blockedOn: { kind: 'stop', reference: 'operator-stop', owner: f.owner,
      nextObservation: f.clock(1000) },
    nextWake: f.run.nextWake,
  }));
}

it.each(['later-predecessor', 'later-clock'] as const)(
  'P5-SEAM-RC-A-PRIME-R23-F1-UNIT P5-NF-17 P5-NF-23 refuses an invalid original exhaustion retry after %s makes its fields look current',
  mode => {
    const f = exhaustionFixture();
    const bad = {
      ...f.exhaustion,
      id: `review23:unit:invalid:${mode}`,
      ...(mode === 'later-predecessor' ? { expected: 'review23:unit:later-stop' } : { at: f.clock(200) }),
    };
    expect(f.graph.recordExhaustion(bad, f.lease)).toMatchObject({ kind: 'Refused' });
    appendWitnessedExhaustion(f, bad);
    if (mode === 'later-predecessor') stop(f, bad.expected);
    else f.setClock(200);

    expect(f.graph.recordExhaustion(bad, f.lease)).toMatchObject({ kind: 'Refused' });
  },
);

it('P5-SEAM-RC-A-PRIME-R23-F2-UNIT P5-NF-17 P5-NF-23 returns a valid original exhaustion after an unrelated head change without appending', () => {
  const f = exhaustionFixture();
  stop(f, 'review23:unit:later-stop');
  const before = value(f.store.read()).length;

  expect(value(f.graph.recordExhaustion(f.exhaustion, f.lease))).toEqual(f.exhaustionFact);
  expect(value(f.store.read())).toHaveLength(before);
});

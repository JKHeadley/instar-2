import { expect, it } from 'vitest';
import { closureRecordWire } from '../../src/rungraph/index.js';
import { exhaustionFixture } from './closure-fixtures.js';
import { json, value } from './fixtures.js';

it('P5-SEAM-RC-R17-V41 P5-NF-17 accepts exhaustion after equal Run openings and refuses a different opening', () => {
  const equal = exhaustionFixture();
  const opening = value(equal.store.read()).find(fact => fact.kind === 'run-opening')!;
  const duplicate = equal.append('run-opening', json(opening.body)).fact;
  equal.admissions.add(duplicate.id);
  expect(value(equal.graph.read(equal.id)).state).toBe('ready');
  expect(equal.graph.recordExhaustion({ ...equal.exhaustion, id: 'review17:equal-opening' }, equal.lease).kind)
    .toBe('Success');

  const conflict = exhaustionFixture();
  const changed = { ...conflict.run, nextWake: { ...conflict.run.nextWake, reason: 'different opening' } };
  const changedFact = conflict.append('run-opening', json({ run: conflict.id,
    record: closureRecordWire(changed as never) })).fact;
  conflict.admissions.add(changedFact.id);
  expect(conflict.graph.recordExhaustion({ ...conflict.exhaustion,
    id: 'review17:different-opening' }, conflict.lease)).toMatchObject({
    kind: 'Refused', detail: 'owner run is missing or conflicted',
  });
});

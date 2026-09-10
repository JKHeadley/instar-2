import { expect, it } from 'vitest';
import { createRunClosureGraph } from '../../src/rungraph/index.js';
import { continuityFixture } from '../rungraph/closure-fixtures.js';
import { json, value } from '../rungraph/fixtures.js';

it('P5-SEAM-RC-R17-V42 P5-NF-46 accepts continuity after equal Run openings through a rebuilt public owner', () => {
  const f = continuityFixture();
  const opening = value(f.store.read()).find(fact => fact.kind === 'run-opening')!;
  const duplicate = f.append('run-opening', json(opening.body)).fact;
  f.admissions.add(duplicate.id);
  const rebuilt = value(createRunClosureGraph(f.deps));
  expect(value(rebuilt.read(f.id)).state).toBe('ready');
  expect(rebuilt.recordContinuity(f.accounting, f.lease).kind).toBe('Success');
});

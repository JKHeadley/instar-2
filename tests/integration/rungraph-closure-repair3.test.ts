import { expect, it } from 'vitest';
import { recordWire } from '../../src/rungraph/index.js';
import { exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json } from '../rungraph/fixtures.js';

it('P5-SEAM-RC-R3-REPLICATION applies current-reference validation to signed Part Two replication as well as live owner append', () => {
  const f = exhaustionFixture();
  f.append('run-capability-read', json({ ...f.capabilityRead.body as object, status: 'unavailable' }), [f.capabilityRead.id]);
  expect(() => f.replicate('run-exhaustion', json({ run: f.id, record: recordWire({ ...f.exhaustion,
    id: 'repair3:signed-stale-exhaustion' } as never) }))).toThrow('stale, superseded, or conflicted');
});

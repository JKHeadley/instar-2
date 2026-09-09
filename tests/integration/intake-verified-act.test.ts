import { expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { intakeFixture, refused, value } from '../intake/fixtures.js';

it('P4-VA-INTEGRATION the full intake port re-resolves Part Two history before admitting verified authority', () => {
  const f = intakeFixture(), accepted = f.verifiedAct();
  expect(value(f.port().admitVerifiedAct(accepted.input))).toMatchObject({ kind: 'approved', fact: { owner: 'part-two' } });
  const recorded = f.facts().at(-1)!;
  expect(recorded.kind).toBe('intake-verified-act');
  expect(recorded.predecessors.required).toContain(accepted.request.id);

  const closed = intakeFixture(), stale = closed.verifiedAct({ submittedDigest: hashBytes('not-the-request') });
  refused(closed.port().admitVerifiedAct(stale.input), 'digest');
  expect(closed.facts().some(row => row.kind === 'intake-verified-act')).toBe(false);
});

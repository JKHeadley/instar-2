import { expect, it } from 'vitest';
import { intakeFixture, refused, value } from './fixtures.js';
import { round20RevocationAdmission, useDifferentLiveRegisterGeneration } from './round20-fixtures.js';

it('round20 V16 refuses when the live Part Two decoder generation moves after port construction', () => {
  const f = intakeFixture(), v = f.verifiedAct(), port = f.port();
  Object.assign(f.context, { decode: { ...f.context.decode, register: { ...f.context.decode.register,
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'generation:new' } } } });
  refused(port.admitVerifiedAct(v.input), 'generations differ');
  expect(f.facts().filter(row => row.kind === 'intake-verified-act')).toHaveLength(0);
});

it('round20 V61/V62 accepts equal current generations and refuses two different real generated generations', () => {
  const accepted = intakeFixture();
  Object.assign(accepted.context, { decode: { ...accepted.context.decode, register: { ...accepted.context.decode.register,
    generation: accepted.generation } } });
  expect(value(accepted.port().admitVerifiedAct(accepted.verifiedAct().input)).kind).toBe('approved');

  const refusedFixture = intakeFixture();
  Object.assign(refusedFixture.context, { decode: { ...refusedFixture.context.decode, register: {
    ...refusedFixture.context.decode.register, generation: refusedFixture.generation } } });
  const verified = refusedFixture.verifiedAct(), port = refusedFixture.port();
  useDifferentLiveRegisterGeneration(refusedFixture);
  refused(port.admitVerifiedAct(verified.input), 'generations differ');
  expect(refusedFixture.facts().filter(row => row.kind === 'intake-verified-act')).toHaveLength(0);
});

it.each([
  ['V67 accepts exact target', 'intended', true],
  ['V68 refuses other same-scope target', 'other', false],
] as const)('P4-VA-10 round20 %s: revocation request artifact binds the canonical target grant',
  (_case, target, accepted) => {
    const row = round20RevocationAdmission(target);
    const result = row.fixture.port().admitVerifiedAct(row.input);
    if (accepted) expect(value(result).kind).toBe('approved');
    else refused(result, 'exact target');
    expect(row.fixture.facts().filter(fact => fact.kind === 'intake-verified-act')).toHaveLength(accepted ? 1 : 0);
  });

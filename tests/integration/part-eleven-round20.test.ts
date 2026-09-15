import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { intakeFixture, value } from '../intake/fixtures.js';
import { round20RevocationAdmission, useDifferentLiveRegisterGeneration } from '../intake/round20-fixtures.js';

type Outcome = Readonly<{ accepted: true; value: unknown }> | Readonly<{ accepted: false; detail: string }>;
const outcome = (result: unknown): Outcome => consumeResult<unknown, Outcome>(result as never, {
  Success: value => ({ accepted: true, value }),
  Refused: refusal => ({ accepted: false, detail: refusal.detail }),
});

it('round20 V16/V61/V62 integration: admission compares act, loaded register, and live decoder generations', () => {
  const matching = intakeFixture();
  Object.assign(matching.context, { decode: { ...matching.context.decode, register: { ...matching.context.decode.register,
    generation: matching.generation } } });
  expect(outcome(matching.port().admitVerifiedAct(matching.verifiedAct().input))).toMatchObject({ accepted: true });

  const changed = intakeFixture();
  Object.assign(changed.context, { decode: { ...changed.context.decode, register: { ...changed.context.decode.register,
    generation: changed.generation } } });
  const verified = changed.verifiedAct(), port = changed.port(), generations = useDifferentLiveRegisterGeneration(changed);
  expect(generations.live).not.toBe(generations.loaded);
  expect(outcome(port.admitVerifiedAct(verified.input))).toMatchObject({ accepted: false,
    detail: expect.stringContaining('generations differ') });
  expect(changed.facts().filter(row => row.kind === 'intake-verified-act')).toHaveLength(0);
});

it('round20 V67/V68 integration: the same durable revocation request accepts only its exact canonical grant target', () => {
  const intended = round20RevocationAdmission('intended'), other = round20RevocationAdmission('other');
  expect(intended.request).toEqual(other.request);
  expect(outcome(intended.fixture.port().admitVerifiedAct(intended.input))).toMatchObject({ accepted: true });
  expect(outcome(other.fixture.port().admitVerifiedAct(other.input))).toMatchObject({ accepted: false,
    detail: expect.stringContaining('exact target') });
  expect(other.fixture.facts().filter(row => row.kind === 'intake-verified-act')).toHaveLength(0);
});

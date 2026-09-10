import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { decodeLoopPolicy } from '../../src/transport/index.js';
import { transportFixture } from './fixture.js';
import { value } from './loop-fixture.js';

const refusedBytes = (result: unknown) => value(canonical(consumeResult(result as never, {
  Success: () => { throw new Error('expected refusal'); },
  Refused: refusal => refusal,
}))).bytes;

it('SLB-LEGACY-MUTATION-72 F3 preserves main refusal bytes for extra-field public decode and legacy scheduling', () => {
  const fixture = transportFixture();
  const malformed = { ...fixture.policy, extra: true };
  const expected = value(canonical({ type: 'Result', schemaVersion: 1, kind: 'Refused', reason: 'decode',
    detail: 'undeclared or missing field', site: 'facts.admit', failDirection: 'closed',
    preserved: 'refusal:metadata' })).bytes;
  expect(refusedBytes(decodeLoopPolicy(malformed, fixture.c))).toBe(expected);
  const token = value(fixture.api.acquire('repair9-legacy-lease', '', 500));
  expect(refusedBytes(fixture.api.schedule('repair9-legacy-malformed', token, fixture.run, malformed as never))).toBe(expected);
});

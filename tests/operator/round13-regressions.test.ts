import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { operatorSeams, resolveFailureTrace, validateSeamInventory } from '../../src/operator/index.js';
import { operatorFixture } from './fixture.js';

const accepted = (result: unknown) => consumeResult(result as never, {
  Success: () => true,
  Refused: () => false,
});
const trace = () => ({ trace: 'crash-after-effect' as const, semanticIdentity: 'message:1',
  digests: [hashBytes('payload')], applications: 1, stopCausallyPrior: false,
  owner: 'repair:1', outcome: 'uncertain' as const, authorityCurrent: true });

it('V81 P11-NF-41 P11-NF-42 P11-NF-50 a fractional application count is refused', () => {
  const f = operatorFixture();
  expect(accepted(resolveFailureTrace({ ...trace(), applications: 0.5 }, f.f.c))).toBe(false);
});

it('V82 P11-NF-41 P11-NF-42 P11-NF-48 decisive non-occurrence contradicting an observed application is refused', () => {
  const f = operatorFixture();
  expect(accepted(resolveFailureTrace({ ...trace(), outcome: 'did-not-happen' }, f.f.c))).toBe(false);
});

it('V84 P11-NF-01 P11-NF-40 P11-NF-41 four unrecognized seam names cannot satisfy the complete inventory', () => {
  const f = operatorFixture();
  expect(accepted(validateSeamInventory(operatorSeams.map((row, index) => ({ ...row, seam: `unknown:${index}` })), f.f.c))).toBe(false);
});

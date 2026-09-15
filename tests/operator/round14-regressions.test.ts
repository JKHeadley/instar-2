import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { operatorSeams, resolveFailureTrace, validateSeamInventory } from '../../src/operator/index.js';
import { operatorFixture } from './fixture.js';

type Outcome<T> = Readonly<{ accepted: true; value: T }> | Readonly<{ accepted: false; detail: string }>;
const outcome = <T>(result: Result<T>): Outcome<T> => consumeResult<T, Outcome<T>>(result, {
  Success: value => ({ accepted: true as const, value }),
  Refused: refusal => ({ accepted: false as const, detail: refusal.detail }),
});
const trace = () => ({ trace: 'crash-after-effect' as const, semanticIdentity: 'message:1',
  digests: [hashBytes('payload')], applications: 1, stopCausallyPrior: false,
  owner: 'repair:1', outcome: 'happened' as const, authorityCurrent: true });

it('V59 P11-NF-09 P11-NF-14 P11-NF-15 a nonterminal disposition retains the valid pending request', () => {
  const f = operatorFixture();
  f.addTerminal('still-pending');
  expect(outcome(f.surface().pending(10))).toMatchObject({ accepted: true, value: { total: 1 } });
});

it('V60 P11-NF-09 P11-NF-14 a still-pending observation does not refuse the exact verified approval', () => {
  const f = operatorFixture(), surface = f.surface();
  const challenge = outcome(surface.challenge(f.request.id));
  expect(challenge.accepted).toBe(true);
  if (!challenge.accepted) return;
  f.addTerminal('still-pending');
  expect(outcome(surface.confirm({ challenge: challenge.value, proof: 'verified', decision: 'approve' }))).toMatchObject({ accepted: true });
});

it('V61 P11-NF-14 a clean explicit terminal disposition drains its request', () => {
  const f = operatorFixture();
  f.addTerminal('declined');
  expect(outcome(f.surface().pending(10))).toMatchObject({ accepted: true, value: { total: 0 } });
});

it('V62 P11-NF-41 P11-NF-42 a complete, consistent applied shared trace settles', () => {
  const f = operatorFixture();
  expect(outcome(resolveFailureTrace(trace(), f.f.c))).toMatchObject({ accepted: true, value: { state: 'settled' } });
});

it('V63 P11-NF-41 P11-NF-42 P11-NF-48 P11-NF-50 a happened outcome with zero applications is refused', () => {
  const f = operatorFixture();
  expect(outcome(resolveFailureTrace({ ...trace(), applications: 0 }, f.f.c))).toMatchObject({ accepted: false });
});

it('V64 P11-NF-41 P11-NF-42 P11-NF-48 P11-NF-50 a shared trace without payload identity is refused', () => {
  const f = operatorFixture();
  expect(outcome(resolveFailureTrace({ ...trace(), digests: [] }, f.f.c))).toMatchObject({ accepted: false });
});

it('V65 P11-NF-40 P11-NF-41 the canonical seam inventory remains accepted', () => {
  const f = operatorFixture();
  expect(outcome(validateSeamInventory(operatorSeams, f.f.c))).toMatchObject({ accepted: true, value: 'complete' });
});

it('V66 P11-NF-40 P11-NF-41 a reversed authorization transition order is refused', () => {
  const f = operatorFixture();
  const reversed = operatorSeams.map((row, index) => index === 0 ? { ...row, order: [...row.order].reverse() } : row);
  expect(outcome(validateSeamInventory(reversed, f.f.c))).toMatchObject({ accepted: false });
});

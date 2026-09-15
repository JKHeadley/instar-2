import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { evaluateGenesisReplay } from '../../src/operator/index.js';
// @ts-expect-error The executable contract-map checker is ESM without declarations.
import { checkP11HeldCases, p11HeldCases } from '../../scripts/check-p11-contract-map.mjs';
import { operatorFixture } from './fixture.js';

const samples = (failures: unknown) => ['cold', 'warm'].map(cache => ({
  deployment: 'qa', cache, facts: 10, bytes: 1_000, lineages: 1, generation: 'generation:qa',
  started: 0, ended: 10, peakMemory: 1_000, resultDigest: hashBytes('same'), failures,
}));

function replay(failures: unknown) {
  const fixture = operatorFixture();
  type ReplayOutcome = Readonly<{ kind: 'Success'; eligible: boolean }> | Readonly<{ kind: 'Refused'; detail: string }>;
  return consumeResult<Readonly<{ eligible: boolean }>, ReplayOutcome>(evaluateGenesisReplay(samples(failures) as never,
    { qa: ['cold', 'warm'] }, 20, 1, 1, fixture.f.c, 2_000) as never, {
    Success: value => ({ kind: 'Success' as const, eligible: value.eligible }),
    Refused: refusal => ({ kind: 'Refused' as const, detail: refusal.detail }),
    });
}

it('V88 P11-NF-30 replay samples accept an empty failure array, block timeout, and type-refuse malformed or unknown failures', () => {
  expect(replay([])).toEqual({ kind: 'Success', eligible: true });
  expect(replay(['timeout'])).toEqual({ kind: 'Success', eligible: false });
  expect(replay({ timeout: true })).toMatchObject({ kind: 'Refused', detail: expect.stringContaining('known failure names') });
  expect(replay(['unknown-failure'])).toMatchObject({ kind: 'Refused', detail: expect.stringContaining('known failure names') });
});

it('V89 P11-NF-30 replay sample failures must be an array, never an empty string', () => {
  expect(replay('')).toMatchObject({ kind: 'Refused', detail: expect.stringContaining('known failure names') });
});

it('round21 split contract maps V90 to the exact held slice-A2 reason', () => {
  const held = p11HeldCases[0];
  const title = `V90 P11-NF-09 out of slice scope: ${held.reason}`;
  const report = { testResults: [{ assertionResults: [{ fullName: title, title, status: 'skipped' }] }] };
  expect(checkP11HeldCases(report)).toEqual(p11HeldCases);
  expect(() => checkP11HeldCases({ testResults: [{ assertionResults: [{ fullName: title, title, status: 'passed' }] }] }))
    .toThrow('must remain skipped until slice A2');
});

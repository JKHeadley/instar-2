import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { intakeFixture, value } from './fixtures.js';
import { useDifferentLiveRegisterGeneration } from './round20-fixtures.js';

function run(drift: boolean) {
  const fixture = intakeFixture(), verified = fixture.verifiedAct(), original = fixture.context.decode;
  useDifferentLiveRegisterGeneration(fixture);
  const next = fixture.context.decode.register.generation;
  Object.assign(fixture.context, { decode: original });
  let active = false, reads = 0;
  const generations: string[] = [];
  const port = value(createIntakePort({ ...fixture.deps, context: () => {
    const context = fixture.deps.context();
    if (!active) return context;
    reads++;
    const generation = drift && reads >= 3 ? next : original.register.generation;
    generations.push(generation.id);
    return { ...context, decode: { ...context.decode, register: { ...context.decode.register, generation } } };
  } }));
  active = true;
  type Outcome = Readonly<{ accepted: true; disposition: unknown }> | Readonly<{ accepted: false; detail: string }>;
  const result = consumeResult<unknown, Outcome>(port.admitVerifiedAct(verified.input) as never, {
    Success: disposition => ({ accepted: true as const, disposition }),
    Refused: refusal => ({ accepted: false as const, detail: refusal.detail }),
  });
  return { result, reads, generations,
    dispositions: fixture.facts().filter(fact => fact.kind === 'intake-verified-act').length };
}

it.skip('V90 P11-NF-09 out of slice scope: NON-EXECUTABLE-UNTIL-slice-A2-final-append-generation', () => {
  const result = run(true);
  expect(result.reads).toBeGreaterThanOrEqual(3);
  expect(result.generations[0]).toBe(result.generations[1]);
  expect(result.generations[2]).not.toBe(result.generations[1]);
  expect(result.result.accepted).toBe(false);
  expect(result.dispositions).toBe(0);
});

it('V91 P11-NF-09 unchanged generation across the same final-append context rereads accepts exactly once', () => {
  const result = run(false);
  expect(result.reads).toBeGreaterThanOrEqual(3);
  expect(new Set(result.generations).size).toBe(1);
  expect(result.result.accepted).toBe(true);
  expect(result.dispositions).toBe(1);
});

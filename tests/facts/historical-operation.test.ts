import { expect, it } from 'vitest';
import { decodeHistoricalBody, historicalScope } from '../../src/facts/historical.js';
import { causalStanding } from '../../src/facts/admission.js';
import type { FactContext, FactEnvelope } from '../../src/facts/index.js';
import { factsFixture, value } from './fixtures.js';
import type { HistoricalBody } from '../../src/facts/historical.js';
import { consumeResult } from '../../src/index.js';

function source(badAt = -1) {
  const f = factsFixture(), facts: FactEnvelope[] = [];
  for (let i = 0; i < 12; i++) {
    const body = { identity: `row-${i}`, amount: i === badAt ? 'not-an-integer' : String(i) };
    facts.push(i ? f.next(facts.at(-1)!, { body }) : f.fact({ body }));
  }
  const context: FactContext = { ...f.ctx, facts, ownedBodies: [] };
  return { f, facts, context };
}
const result = (r: ReturnType<typeof decodeHistoricalBody>) => consumeResult<HistoricalBody, { body: HistoricalBody } | { refused: string }>(r, {
  Success: body => ({ body }), Refused: refusal => ({ refused: refusal.detail }),
});
it('operation reuse equals independent historical reads and a new policy revalidates', () => {
  const { facts, context } = source(), operation = historicalScope(context);
  for (const fact of facts) {
    const cached = result(decodeHistoricalBody(fact, context, causalStanding(fact, context, false).decode, operation));
    // Fresh owner table defeats the cross-operation body memo for the independent oracle.
    const reference = { ...context, ownedBodies: [] };
    expect(cached).toEqual(result(decodeHistoricalBody(fact, reference, causalStanding(fact, reference, false).decode)));
  }
  const changed = { ...context, schemas: context.schemas.map(s => ({ ...s, fields: { ...s.fields, requiredNew: { kind: 'boolean' as const } } })) };
  const actual = result(decodeHistoricalBody(facts.at(-1)!, changed, changed.decode, historicalScope(changed)));
  expect(actual).toEqual(result(decodeHistoricalBody(facts.at(-1)!, { ...changed, ownedBodies: [] }, changed.decode)));
  expect(actual).toHaveProperty('refused');
});
it('a malformed ancestor still refuses after earlier ancestors were cached', () => {
  for (const badAt of [1, 5, 10]) {
    const { facts, context } = source(badAt), operation = historicalScope(context);
    value(decodeHistoricalBody(facts[0]!, context, context.decode, operation));
    const actual = result(decodeHistoricalBody(facts.at(-1)!, context, context.decode, operation));
    const reference = { ...context, ownedBodies: [] };
    expect(actual).toEqual(result(decodeHistoricalBody(facts.at(-1)!, reference, reference.decode)));
    expect(actual).toHaveProperty('refused');
  }
});

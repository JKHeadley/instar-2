import { beforeAll, afterAll, expect, it } from 'vitest';
import { signEnvelope } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope } from '../../src/facts/index.js';
import type { EffectSettlement } from '../../src/effects/index.js';
import type { SettlementApplication, TransportFact } from '../../src/transport/index.js';
import { settlementMatches, checkApplicationEvidence, accounting } from '../../src/transport/settlement.js';
import { providerSettlementWire } from '../../src/transport/provider-settlement.js';
import { privateKey } from '../facts/fixtures.js';
import { providerFixture, value } from '../model-provider/fixture.js';
import { localProvider } from '../model-provider/http-provider.js';

let http: Awaited<ReturnType<typeof localProvider>>;
let fact: FactEnvelope, context: FactContext, settlement: EffectSettlement;
let application: SettlementApplication, rows: readonly TransportFact[];
beforeAll(async () => {
  http = await localProvider();
  const f = providerFixture(http);
  const { request } = f.prepare();
  const observation = value(await f.api.dispatch(request, f.fence));
  f.evidence(observation.operation, request.digest, 'operation-occurred');
  f.evidence(observation.operation, request.digest, 'charge-settled', 3);
  f.evidence(observation.operation, request.digest, 'old-executor-quiescent');
  settlement = value(f.api.settle(observation.operation, value(f.api.assess(observation.operation))));
  const facts = f.all();
  fact = facts.find(f => f.kind === 'effect-provider-ProviderEffectSettlement')!;
  context = { ...f.context, facts };
  rows = value(f.six.inspect());
  const op = rows.find(v => v.fact.id === settlement.reservation)!;
  if (op.record.type !== 'AdmissionReservation') throw new Error('consumed reservation missing');
  application = { ...op.record, type: 'SettlementApplication', settlement: settlement.id,
    reservation: settlement.reservation, claim: settlement.claim, settlementFact: fact.id,
    settlementHash: fact.contentHash, ...accounting(settlement, op.record) } as SettlementApplication;
  expect(http.requests).toHaveLength(1);
}, 120000);
afterAll(async () => { await http?.close(); });

it('Six provider matching and historical application use the Eight-decoded exact signed record', () => {
  expect(settlementMatches(settlement, fact, context)).toBe(true);
  expect(providerSettlementWire(fact, context).finalCharge).toBe('3');
  expect(() => checkApplicationEvidence(application, context.facts, rows, context)).not.toThrow();
});
it('Six provider decoding refuses a missing or ambiguous Eight registration at both boundaries', () => {
  const owner = context.ownedBodies!.find(r => r.name === 'ProviderEffectSettlement')!;
  for (const ownedBodies of [context.ownedBodies!.filter(r => r !== owner), [...context.ownedBodies!, owner]]) {
    const changed = { ...context, ownedBodies };
    expect(() => settlementMatches(settlement, fact, changed)).toThrow(/registration missing or ambiguous/);
    expect(() => checkApplicationEvidence(application, context.facts, rows, changed)).toThrow(/registration missing or ambiguous/);
  }
});
it('Six provider decoding refuses absent context and a relabeled owner schema', () => {
  expect(() => settlementMatches(settlement, fact)).toThrow(/context absent/);
  const schemas = context.schemas.map(s => s.kind !== fact.kind ? s : { ...s,
    fields: { ...s.fields, record: { kind: 'owned' as const, owner: 'part-eight', name: 'EffectSettlement' } } });
  expect(() => settlementMatches(settlement, fact, { ...context, schemas })).toThrow(/must name Eight/);
});
it('Six keeps unknown settlement kinds refused at both boundaries', () => {
  const unknown = { ...fact, kind: 'effect-provider-UnknownSettlement' };
  expect(settlementMatches(settlement, unknown, context)).toBe(false);
  expect(() => checkApplicationEvidence(application, [unknown], rows, context)).toThrow(/absent from causal closure/);
});
it.each(['id', 'request', 'operation', 'claim', 'reservation', 'digest'] as const)(
  'Six provider matching compares exact live %s binding', field => {
    expect(settlementMatches({ ...settlement, [field]: 'different' }, fact, context)).toBe(false);
  });
it.each(['settlement', 'request', 'operation', 'claim', 'reservation', 'digest', 'settlementHash'] as const)(
  'Six historical provider application rejects changed %s binding', field => {
    expect(() => checkApplicationEvidence({ ...application, [field]: 'different' }, context.facts, rows, context)).toThrow(/identity or bytes changed/);
  });
it.each(['03', '+3', '3.0', '3e0', '9007199254740992'])(
  'Six refuses signed noncanonical or unsafe provider charge %s at both boundaries', charge => {
    const body = fact.body as { record: Record<string, unknown> };
    const changed = signEnvelope({ ...fact, body: { ...body, record: { ...body.record, finalCharge: charge } } }, privateKey) as FactEnvelope;
    const changedContext = { ...context, facts: context.facts.map(f => f.id === fact.id ? changed : f) };
    expect(() => settlementMatches(settlement, changed, changedContext)).toThrow();
    expect(() => checkApplicationEvidence({ ...application, settlementHash: changed.contentHash }, changedContext.facts, rows, changedContext)).toThrow();
  });
it('Six historical provider accounting is still derived from the owner settlement', () => {
  expect(() => checkApplicationEvidence({ ...application, released: 20 }, context.facts, rows, context)).toThrow(/accounting differs/);
});
it.each([
  ['acceptance', 'missing-assessment'], ['observations', []], ['retryEligible', true],
  ['schemaVersion', 2], ['request', 'foreign-request'],
] as const)('Six delegates signed malformed provider %s to the Eight decoder at both boundaries', (field, changedValue) => {
  const body = fact.body as { record: Record<string, unknown> };
  const changed = signEnvelope({ ...fact, body: { ...body, record: { ...body.record, [field]: changedValue } } }, privateKey) as FactEnvelope;
  const changedContext = { ...context, facts: context.facts.map(f => f.id === fact.id ? changed : f) };
  expect(() => settlementMatches(settlement, changed, changedContext)).toThrow();
  expect(() => checkApplicationEvidence({ ...application, settlementHash: changed.contentHash }, changedContext.facts, rows, changedContext)).toThrow();
});

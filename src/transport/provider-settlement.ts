import { decodeOwnedBody } from '../facts/owned.js';
import type { Json } from '../index.js';
import type { FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';
import type { SettlementAccountingInput } from './contracts.js';
import { encoded, ensure } from './boundary.js';

// The spine retains its existing P2 decoder configuration. This is only a reader
// binding, never settlement issuance, accounting qualification or stored state.
const contexts = new WeakMap<FactStorePort, FactContext>();
export function bindProviderSettlementContext(store: FactStorePort, context: FactContext): void {
  contexts.set(store, context);
}
export function providerSettlementContext(store: FactStorePort, facts: readonly FactEnvelope[]): FactContext | undefined {
  const context = contexts.get(store);
  return context && { ...context, facts };
}

type ProviderSettlementWire = Omit<SettlementAccountingInput, 'type' | 'finalCharge'> & {
  readonly type: 'ProviderEffectSettlement'; readonly schemaVersion: 1; readonly finalCharge: string;
};
// Both callers already operate inside P2's verified fact-prefix boundary. Route
// this one record through P2's registered EIGHT owner decoder, without recursively
// rebuilding the same prefix from within its own SettlementApplication decoder.
// Historical decoding establishes record identity, not current permission: Six's
// existing two-pass live consumer remains the only accounting qualification path.
export function providerSettlementWire(fact: FactEnvelope, context: FactContext | undefined): ProviderSettlementWire {
  ensure(fact.kind === 'effect-provider-ProviderEffectSettlement' && fact.schemaVersion === 1,
    'unsupported provider settlement fact');
  ensure(context, 'provider settlement owner decoder context absent');
  const schema = context.schemas.find(s => s.kind === fact.kind && s.version === fact.schemaVersion);
  const field = schema?.fields.record;
  ensure(field?.kind === 'owned' && field.owner === 'part-eight' && field.name === 'ProviderEffectSettlement',
    'provider settlement schema must name Eight owner decoder');
  const source = (fact.body as { record: Json }).record;
  const decoded = decodeOwnedBody('part-eight', 'ProviderEffectSettlement', source, fact, 'historical', context);
  const record = decoded.value as unknown as ProviderSettlementWire;
  ensure(record.type === 'ProviderEffectSettlement' && record.schemaVersion === 1,
    'provider settlement owner record differs');
  ensure(encoded(record).bytes === encoded((fact.body as { record: unknown }).record).bytes,
    'provider settlement owner decoding changed signed bytes');
  ensure(record.finalCharge === 'unknown' || /^(0|[1-9][0-9]*)$/.test(record.finalCharge)
    && Number.isSafeInteger(Number(record.finalCharge)), 'invalid referenced charge encoding');
  return record;
}

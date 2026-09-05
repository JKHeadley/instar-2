import { decodeMeasurement } from '../index.js';
import type { Json, Result } from '../index.js';
import { boundary, encoding, fields, object, requireFact, take } from './boundary.js';
import { contextBoundary } from './contracts.js';
import type { FactContext, FactEnvelope } from './contracts.js';
import { openCache, signCache } from './cache.js';
import type { CacheKey } from './cache.js';
import type { VerifiedWatermark } from './verification.js';
class PrefixIdentity { private readonly product!: void }
export interface VerifiedPrefix extends PrefixIdentity { readonly facts: readonly FactEnvelope[]; readonly contextHash: string; readonly watermarks: Readonly<Record<string, VerifiedWatermark>> }
const issued = new WeakSet<object>();
export function prefixContext(context: FactContext): string { return encoding({ genesis: context.genesis, keys: context.keys, register: context.decode.register, dependencies: context.facts.map(f => ({ id: f.id, hash: f.contentHash })) }).hash; }
// Internal issuer: the store calls only after verifying every new frame and chain link.
export function issuePrefix(facts: readonly FactEnvelope[], context: FactContext): VerifiedPrefix {
  const watermarks: Record<string, VerifiedWatermark> = {};
  for (const f of facts) watermarks[f.machine] = { through: { epoch: f.segment.epoch, position: f.segment.position }, factId: f.id, hash: f.contentHash };
  const prefix = Object.freeze({ facts: Object.freeze([...facts]), contextHash: prefixContext(context), watermarks: Object.freeze(watermarks) }) as unknown as VerifiedPrefix; issued.add(prefix); return prefix;
}
export function prefixValid(prefix: VerifiedPrefix, context: FactContext): boolean { return issued.has(prefix) && prefix.contextHash === prefixContext(context); }
export function signVerifiedPrefix(prefix: VerifiedPrefix, keyId: string, privateKey: string): Json {
  requireFact(issued.has(prefix), 'only verified prefixes can be checkpointed'); return signCache('P2VerifiedPrefix:1', prefix, keyId, privateKey);
}
export function restoreVerifiedPrefix(input: unknown, context: FactContext, independentlyTrustedKeys: readonly CacheKey[]): Result<VerifiedPrefix> {
  return boundary('RestoreVerifiedPrefix', input, contextBoundary(context), raw => {
    const saved = object(openCache('P2VerifiedPrefix:1', raw, independentlyTrustedKeys)); fields(saved, ['facts', 'contextHash', 'watermarks']);
    requireFact(saved.contextHash === prefixContext(context), 'prefix verification context changed; genesis sweep required');
    requireFact(Array.isArray(saved.facts), 'prefix facts missing');
    // The local verification certificate authenticates the already-verified full records.
    // Reconstruct only P2 wire views and the explicit clock; never mint P1 live identities.
    const facts = saved.facts.map(v => { const f = object(v); return { ...f, at: take(decodeMeasurement('clock', f.at, context.decode)) } as unknown as FactEnvelope; });
    const prefix = issuePrefix(facts, context); requireFact(encoding(prefix.watermarks).bytes === encoding(saved.watermarks).bytes, 'prefix watermarks disagree with certified history'); return prefix;
  });
}

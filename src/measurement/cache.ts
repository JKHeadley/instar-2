import { compareMeasurements, decodeMeasurement } from '../index.js';
import type { Clock, Result } from '../index.js';
import { boundary, encoding, ensure, freeze, take } from './boundary.js';
import type { BoundedReadCache, ReadCacheEntry, ReadCachePolicy } from './contracts.js';
import type { MeasurementDecodeContext } from './decode.js';
import { isDecodedReadCachePolicy } from './decode.js';

const fields = ['key', 'createdAt', 'bytes', 'byteLength'];

export function createBoundedReadCache(policy: ReadCachePolicy, context: MeasurementDecodeContext): Result<BoundedReadCache> {
  return boundary('MeasurementReadCacheConstruction', policy, context, () => {
    ensure(isDecodedReadCachePolicy(policy), 'cache policy must come from its decoder');
    const entries = new Map<string, ReadCacheEntry>();
    const inspect = () => freeze([...entries.values()].sort((a, b) => a.key.localeCompare(b.key)));
    const totalBytes = () => [...entries.values()].reduce((sum, row) => sum + row.byteLength, 0);
    return Object.freeze({ owner: 'part-sixteen' as const,
    put(entry: ReadCacheEntry): Result<void> {
      return boundary('MeasurementReadCachePut', entry, context, () => {
        ensure(entry && typeof entry === 'object' && Object.keys(entry).length === fields.length && fields.every(field => Object.hasOwn(entry, field)), 'cache entry has undeclared or missing field');
        ensure(entry.key.trim().length > 0 && Number.isSafeInteger(entry.byteLength) && entry.byteLength === Buffer.byteLength(entry.bytes), 'cache entry identity or byte count invalid');
        const createdAt = take(decodeMeasurement('clock', entry.createdAt, context.types));
        ensure(encoding(createdAt).bytes === encoding(entry.createdAt).bytes, 'cache creation clock must be admitted');
        const existing = entries.get(entry.key);
        if (existing) ensure(existing.bytes === entry.bytes && existing.byteLength === entry.byteLength
          && take(compareMeasurements(existing.createdAt, entry.createdAt, context.preserved)) === 0, 'cache identity replayed with different bytes');
        if (!existing) {
          ensure(entries.size + 1 <= policy.maxRows && totalBytes() + entry.byteLength <= policy.maxBytes, 'cache bound requires off-path eviction');
          entries.set(entry.key, freeze({ ...entry }));
        }
      });
    },
    get(key: string): Result<ReadCacheEntry | null> {
      return boundary('MeasurementReadCacheGet', key, context, () => {
        ensure(typeof key === 'string' && key.trim().length > 0 && key.length <= 4096, 'cache lookup key must be bounded substantive text');
        return entries.get(key) ?? null;
      });
    },
    planEviction(evaluationClock: Clock): Result<readonly string[]> {
      return boundary('MeasurementReadCacheEvictionPlan', evaluationClock, context, () => {
        const admittedEvaluation = take(decodeMeasurement('clock', evaluationClock, context.types));
        ensure(encoding(admittedEvaluation).bytes === encoding(evaluationClock).bytes, 'cache evaluation clock must be admitted');
        for (const row of entries.values()) {
          ensure(row.createdAt.subject.instance === admittedEvaluation.subject.instance
            && row.createdAt.unit === admittedEvaluation.unit && row.createdAt.by === admittedEvaluation.by,
          'cache evaluation clock identity differs from entry clock');
        }
        const ordered = [...entries.values()].sort((a, b) => take(compareMeasurements(a.createdAt, b.createdAt, context.preserved)) || a.key.localeCompare(b.key));
        const selected: string[] = [];
        let projectedRows = entries.size; let projectedBytes = totalBytes();
        for (const row of ordered) {
          const age = evaluationClock.value - row.createdAt.value;
          ensure(age >= 0, 'cache evaluation clock precedes entry');
          if (age > policy.maxAgeMs || projectedRows > policy.maxRows || projectedBytes > policy.maxBytes) {
            selected.push(row.key); projectedRows--; projectedBytes -= row.byteLength;
          }
          if (selected.length === policy.evictionBatch) break;
        }
        return freeze(selected);
      });
    },
    applyEviction(keys: readonly string[]): Result<number> {
      return boundary('MeasurementReadCacheEvictionApply', keys, context, () => {
        ensure(Array.isArray(keys) && keys.every(key => typeof key === 'string' && key.trim().length > 0 && key.length <= 4096),
          'eviction keys must be bounded substantive text');
        ensure(keys.length <= policy.evictionBatch && new Set(keys).size === keys.length, 'eviction application exceeds bounded plan');
        let removed = 0;
        for (const key of keys) if (entries.delete(key)) removed++;
        return removed;
      });
    },
    inspect(): Result<readonly ReadCacheEntry[]> {
      return boundary('MeasurementReadCacheInspect', null, context, inspect);
    },
    });
  });
}

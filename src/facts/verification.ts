// P2-NF-16: persisted watermarks bound boot verification; genesis sweeps detect watermark rot.
import type { Hash, Json, Result } from '../index.js';
import { boundary, encoding, object, requireFact, take } from './boundary.js';
import { decodeEnvelope, comparePosition } from './envelope.js';
import { extendsChain } from './admission.js';
import type { FactContext, FactEnvelope, LineagePosition, ConflictClass } from './contracts.js';
import { contextBoundary } from './contracts.js';
export interface VerifiedWatermark { readonly through: LineagePosition; readonly factId: string; readonly hash: Hash }
export function verifyHistory(input: readonly unknown[], context: FactContext, mode: 'boot' | 'sweep',
  watermarks: Readonly<Record<string, VerifiedWatermark>> = {}): Result<{ checked: number; watermarks: Readonly<Record<string, VerifiedWatermark>> }> {
  return boundary('SegmentHistoryVerification', input, contextBoundary(context), raw => {
    requireFact(Array.isArray(raw), 'history must be a sequence');
    const encoded = raw.map(item => object(item));
    let checked = 0;
    const marks: Record<string, VerifiedWatermark> = {};
    for (const machine of new Set(encoded.map(v => v.machine))) {
      requireFact(typeof machine === 'string', 'history machine missing');
      const records = encoded.filter(v => v.machine === machine);
      const watermark = mode === 'boot' ? watermarks[machine] : undefined;
      let start = 0;
      if (watermark) {
        const index = records.findIndex(v => v.id === watermark.factId && v.contentHash === watermark.hash);
        requireFact(index >= 0, 'verified watermark anchor missing or changed', 'integrity');
        const segment = object(records[index]!.segment!);
        requireFact(segment.epoch === watermark.through.epoch && segment.position === watermark.through.position, 'watermark position mismatch', 'integrity');
        start = index + 1; marks[machine] = watermark;
      }
      for (let i = start; i < records.length; i++) {
        const fact = take(decodeEnvelope(records[i], context));
        const previous = records[i - 1];
        if (previous) {
          const position = object(previous.segment!);
          requireFact(fact.prevInSegment === previous.contentHash, 'history hash-chain break', 'integrity');
          if (fact.segment.epoch === position.epoch) requireFact(fact.segment.position === Number(position.position) + 1 && fact.predecessors.inSegment === previous.id, 'history gap or fork', 'integrity');
          else requireFact(fact.segment.epoch === Number(position.epoch) + 1 && fact.segment.position === 0, 'history epoch gap', 'integrity');
        } else requireFact(fact.segment.epoch === 0 && fact.segment.position === 0 && fact.prevInSegment === context.genesis.hash, 'history genesis mismatch', 'integrity');
        checked++; marks[machine] = { through: { epoch: fact.segment.epoch, position: fact.segment.position }, factId: fact.id, hash: fact.contentHash };
      }
    }
    return { checked, watermarks: marks };
  });
}
export function compromisedKeyConflicts(facts: readonly FactEnvelope[], context: FactContext): readonly ConflictClass[] {
  const conflicts: ConflictClass[] = [];
  for (const key of context.keys) if (key.compromisedAt) for (const fact of facts) {
    if (fact.machine === key.machine && comparePosition(fact.segment, key.compromisedAt) >= 0 && (!key.through || comparePosition(fact.segment, key.through) <= 0))
      conflicts.push({ key: `compromise:${key.id}:${fact.id}`, kind: 'compromised-key', facts: [fact.id], detail: 'operator-attested compromise position; quarantine pending review' });
  }
  return conflicts;
}

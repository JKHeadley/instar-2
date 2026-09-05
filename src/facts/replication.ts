// One intake policy over the shared decoder: ordering accidents hold; corruption refuses.
import type { Result } from '../index.js';
import { boundary, requireFact, take } from './boundary.js';
import { decodeFrame, decodeEnvelope } from './envelope.js';
import { causalCone } from './admission.js';
import { verifyAndAdmit } from './store.js';
import { PendingSet } from './stores.js';
import type { FactContext, FactEnvelope } from './contracts.js';
import { contextBoundary } from './contracts.js';
export type ReplicationReceipt = Readonly<{ kind: 'held'; dependency: string } | { kind: 'verified'; fact: FactEnvelope }>;
export function receiveReplication(input: unknown, peer: string, context: FactContext, pending: PendingSet, now: number): Result<ReplicationReceipt> {
  return boundary('ReplicationReceive', input, contextBoundary(context), raw => {
    const checked = take(decodeFrame(raw, context)), frame = checked.frame;
    requireFact(frame.machine === peer, 'peer delivered segment it does not own', 'integrity');
    const supported = context.schemas.filter(s => s.kind === frame.kind);
    requireFact(supported.length > 0, 'unregistered fact kind');
    if (frame.schemaVersion > Math.max(...supported.map(s => s.version))) {
      const dependency = `schema:${frame.kind}:${frame.schemaVersion}`;
      take(pending.hold(raw, peer, dependency, now, contextBoundary(context))); return { kind: 'held', dependency };
    }
    // Identity decoding precedes causal-reference holds, matching the documented ladder.
    const fact = take(decodeEnvelope(raw, context, 'replication'));
    try { causalCone(fact, context.facts); }
    catch (error) {
      const reason = error instanceof Error ? error.message : '';
      if (!reason.startsWith('dangling ')) throw error;
      const dependency = reason.slice(reason.indexOf(':') + 1).trim();
      take(pending.hold(raw, peer, dependency, now, contextBoundary(context))); return { kind: 'held', dependency };
    }
    return { kind: 'verified', fact: take(verifyAndAdmit(raw, peer, context)) };
  });
}

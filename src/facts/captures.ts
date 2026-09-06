// P2-NF-37/64..68: capture bytes alone may be removed, after a permanent, authorized tombstone.
import type { Clock, Result } from '../index.js';
import { boundary, object, requireFact, string } from './boundary.js';
import { causalStanding } from './admission.js';
import { schemaFor, hashBytes } from './envelope.js';
import type { CapturedContent, FactContext, FactEnvelope } from './contracts.js';
import { contextBoundary } from './contracts.js';

export interface ProtectedCaptureReference { readonly reference: string; readonly factId: string; readonly kind: 'authorization' | 'open-conflict' | 'unresolved-judgment' }
export const redactionReasons = ['erasure-obligation', 'mis-routed private content', 'mis-attributed sensitive claim'] as const;
export function redactCapture(fact: FactEnvelope, context: FactContext, now: Clock, delay: number,
  protectedReferences: readonly ProtectedCaptureReference[]): Result<CapturedContent> {
  return boundary('CaptureRedaction', fact.body, contextBoundary(context), raw => {
    const body = object(raw), reference = string(body.reference, 'reference');
    requireFact(fact.kind === 'redaction' && redactionReasons.includes(string(body.reason, 'reason') as typeof redactionReasons[number]), 'redaction reason outside closed list');
    requireFact(context.facts.some(f => f.id === fact.id && f.contentHash === fact.contentHash), 'redaction requires permanent tombstone fact');
    requireFact(schemaFor(context, fact.kind, fact.schemaVersion).standing === 'operator', 'redaction requires operator standing', 'standing');
    causalStanding(fact, context, false);
    requireFact(Number.isFinite(delay) && delay > 0 && now.value >= fact.at.value + delay, 'redaction delay window has not elapsed', 'policy');
    requireFact(!protectedReferences.some(p => p.reference === reference), 'capture protected by unresolved evidence or authorization', 'policy');
    const capture = context.captures[reference];
    requireFact(capture && capture.status === 'available' && capture.bytes !== null && hashBytes(capture.bytes) === capture.hash, 'capture missing or hash mismatch', 'integrity');
    return { hash: capture.hash, bytes: null, status: 'tombstoned', byteLength: capture.byteLength };
  });
}

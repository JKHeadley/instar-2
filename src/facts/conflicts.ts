// P2 owns obligation -> signed fact composition. Providers own keys and durable bytes.
import type { Clock, Json, Provenance, Result, Scope, VerifiedPrincipal } from '../index.js';
import type { ConflictClass, FactContext, FactEnvelope, FactSchema } from './contracts.js';
import { contextBoundary } from './contracts.js';
import { boundary, encoding, fields, object, requireFact, same, string, take } from './boundary.js';
import { causalCone } from './admission.js';
import { prepareSnapshot } from './snapshot.js';
import { factId, comparePosition } from './envelope.js';
import type { AppendReceipt, FactStorePort } from './store.js';

export const conflictFactKind = 'conflict-record';
export function conflictFactSchema(scope: Scope): FactSchema {
  return { kind: conflictFactKind, version: 1, fields: { record: { kind: 'text', maxLength: 65536 } },
    machineScope: 'shared', standing: 'requester', action: 'record-conflict', scope,
    causallyBound: true, requiredReferences: [], authority: 'none' };
}
export interface ConflictAppenderPort {
  readonly owner: 'part-ten'; readonly machine: string;
  readonly principal: VerifiedPrincipal; readonly provenance: Provenance;
  clock(): Clock;
  sign(envelope: Json): Result<unknown>;
}
const wireRecord = (conflict: ConflictClass) => encoding(conflict).bytes;
// A signed assertion is not a license to fabricate conflicts. Recompute its exact
// pair from origin-verified predecessors. No serialized P1 brand is reconstructed.
export function validateConflictFact(fact: FactEnvelope, context: FactContext): ConflictClass | undefined {
  if (fact.kind !== conflictFactKind) return undefined;
  requireFact(fact.principal.kind === 'system' && fact.provenance.class === 'verified', 'conflict fact requires verified system principal', 'standing');
  const body = object(fact.body); fields(body, ['record']);
  const bytes = string(body.record, 'conflict record'); requireFact(bytes.length <= 65536, 'conflict record exceeds bound');
  const record = object(JSON.parse(bytes) as Json);
  const cone = causalCone(fact, context.facts);
  const source = cone.filter(f => f.kind !== conflictFactKind);
  const snapshot = take(prepareSnapshot(source, { ...context, facts: cone }));
  const expected = snapshot.entries.flatMap(e => e.conflicts).find(c => c.key === record.key && wireRecord(c) === bytes);
  requireFact(expected, 'conflict record differs from independently derived causal pair', 'integrity');
  requireFact(expected.facts.every(id => fact.predecessors.required.includes(id)), 'conflict fact must name every pair member');
  return expected;
}
export function drainConflictFacts(context: FactContext, store: FactStorePort, appender: ConflictAppenderPort): Result<readonly AppendReceipt[]> {
  return boundary('ConflictFactDrain', null, contextBoundary(context), () => {
    requireFact(appender.owner === 'part-ten' && appender.principal.kind === 'system', 'conflict signing provider requires system principal', 'standing');
    const initial = take(store.read());
    const snapshot = take(prepareSnapshot(initial, context));
    const pending = [...new Map(snapshot.entries.flatMap(e => e.conflicts).map(c => [c.key, c])).values()].sort((a, b) => a.key < b.key ? -1 : 1);
    const receipts: AppendReceipt[] = [];
    for (const conflict of pending) {
      const facts = take(store.read());
      // Restart/retry dedupe comes from admitted spine bytes, never an outbox ACK.
      const prior = facts.find(f => f.machine === appender.machine && f.kind === conflictFactKind
        && object(JSON.parse(string(object(f.body).record, 'conflict record')) as Json).key === conflict.key);
      if (prior) { validateConflictFact(prior, { ...context, facts: [...context.facts, ...facts] }); continue; }
      const head = facts.filter(f => f.machine === appender.machine).sort((a, b) => comparePosition(a.segment, b.segment)).at(-1);
      const segment = { machine: appender.machine, epoch: head?.segment.epoch ?? 0, position: head ? head.segment.position + 1 : 0 };
      const frontier = { ...context.folded };
      for (const f of facts) if (!frontier[f.machine] || comparePosition(f.segment, frontier[f.machine]!) > 0) frontier[f.machine] = { epoch: f.segment.epoch, position: f.segment.position };
      const unsigned = JSON.parse(encoding({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind: conflictFactKind, schemaVersion: 1,
        machine: appender.machine, principal: appender.principal, provenance: appender.provenance, at: appender.clock(), segment,
        prevInSegment: head?.contentHash ?? context.genesis.hash,
        predecessors: { inSegment: head?.id ?? null, frontier, required: [...conflict.facts].sort() }, body: { record: wireRecord(conflict) } }).bytes) as Json;
      const signed = take(appender.sign(unsigned)), wire = object(JSON.parse(encoding(signed).bytes) as Json);
      requireFact(Object.entries(object(unsigned)).every(([key, value]) => same(wire[key], value)), 'signing provider changed conflict envelope', 'integrity');
      receipts.push(take(store.append(signed)));
    }
    return receipts;
  });
}

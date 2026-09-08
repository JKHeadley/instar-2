import type { ConflictClass, FactEnvelope, FactSnapshot } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { assemblyIdentity, assemblyRecordFrom, assemblyReferences, assemblyRowForReference, assemblyRows,
  factReferenceAliases, referenceHasExpectedKind } from './records.js';
import type { AssemblyDecodeContext, AssemblyHistoryVerdict, AssemblyRecord, AssemblySpine, CurrentAssemblyFact } from './contracts.js';

function sameIdentity(left: AssemblyRecord, right: AssemblyRecord): boolean {
  return left.type === right.type && (left.id === right.id || assemblyIdentity(left).logicalKey === assemblyIdentity(right).logicalKey);
}

export function currentAssemblyRows(snapshot: FactSnapshot, context: AssemblyDecodeContext): readonly CurrentAssemblyFact[] {
  const records = assemblyRows(snapshot.entries.map(entry => entry.fact), context);
  const byFact = new Map(snapshot.entries.map(entry => [entry.fact.id, entry]));
  return freeze(records.map(row => {
    const status = byFact.get(row.fact.id)!; const conflicts = [...status.conflicts];
    for (const other of records) {
      if (other === row || !sameIdentity(row.record, other.record)) continue;
      const left = assemblyIdentity(row.record), right = assemblyIdentity(other.record);
      if (left.canonicalHash !== right.canonicalHash) conflicts.push({ key: left.logicalKey, kind: 'immutable-disagreement',
        facts: [row.fact.id, other.fact.id].sort(), detail: `assembly identity ${left.logicalKey} has conflicting signed facts` });
    }
    const unique = [...new Map(conflicts.map(conflict => [`${conflict.key}:${conflict.facts.join(',')}`, conflict])).values()];
    return { fact: row.fact, record: row.record, taint: status.taint, conflicts: unique };
  }));
}

export function resolveAssemblyHistory(record: AssemblyRecord, spine: AssemblySpine, context: AssemblyDecodeContext): ReturnType<AssemblySpine['store']['readForProjection']> extends infer _ ? import('../index.js').Result<AssemblyHistoryVerdict> : never {
  return boundary('AssemblyHistoryResolution', record, context, () => {
    const snapshot = take(spine.store.readForProjection());
    const rows = currentAssemblyRows(snapshot, context); const all = snapshot.entries;
    const seed = rows.find(row => row.record.type === record.type && assemblyIdentity(row.record).canonicalHash === assemblyIdentity(record).canonicalHash);
    ensure(seed, 'assembly record absent from signed history');
    const byId = new Map(all.map(row => [row.fact.id, row])); const assemblyById = new Map(rows.map(row => [row.fact.id, row]));
    const statusForReference = (reference: string) => byId.get(reference)
      ?? all.find(row => factReferenceAliases(row.fact).includes(reference));
    const queue = [seed.fact.id]; const visited = new Set<string>(); const missing = new Set<string>(); const conflicts: ConflictClass[] = [];
    let completeness: AssemblyHistoryVerdict['completeness'] = 'complete';
    while (queue.length) {
      const id = queue.shift()!; if (visited.has(id)) continue; visited.add(id);
      const status = byId.get(id); if (!status) { missing.add(id); continue; }
      conflicts.push(...status.conflicts);
      if (status.taint.length) conflicts.push({ key: `taint:${id}`, kind: 'poison-fact', facts: [id], detail: `referenced fact is ${status.taint.join(',')}` });
      const owned = assemblyById.get(id); if (owned) {
        conflicts.push(...owned.conflicts);
        if (owned.record.type === 'GrowthObservation' && owned.record.completion === 'incomplete') completeness = 'partial';
        for (const reference of assemblyReferences(owned.record)) {
          const resolved = assemblyRowForReference(reference.id, rows);
          const referenced = resolved ? byId.get(resolved.fact.id) : statusForReference(reference.id);
          if (referenced) {
            if (!referenceHasExpectedKind(reference, referenced.fact, resolved?.record)) {
              conflicts.push({ key: `wrong-kind:${id}:${reference.field}:${reference.id}`, kind: 'poison-fact', facts: [id, referenced.fact.id],
                detail: `${reference.field} reference ${reference.id} has the wrong signed semantic kind; expected ${reference.expected ?? 'signed fact'}` });
            } else queue.push(referenced.fact.id);
          } else if (reference.requiredWhenSigned || reference.id === owned.record.id || /^[^:]+:\d+:\d+$/.test(reference.id)) missing.add(reference.id);
        }
      }
      for (const dependency of status.fact.predecessors.required) queue.push(dependency);
    }
    const unique = [...new Map(conflicts.map(item => [`${item.key}:${item.facts.join(',')}`, item])).values()];
    return freeze({ admitted: missing.size === 0 && unique.length === 0 && completeness === 'complete', completeness,
      facts: [...visited].sort(), conflicts: unique, missing: [...missing].sort() });
  });
}

export function exactFactForRecord(record: AssemblyRecord, facts: readonly FactEnvelope[], context: AssemblyDecodeContext): FactEnvelope | undefined {
  const hash = assemblyIdentity(record).canonicalHash;
  return facts.find(fact => fact.kind === `assembly-${record.type}` && assemblyIdentity(assemblyRecordFrom(fact, context)).canonicalHash === hash);
}

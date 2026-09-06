import type { Json } from '../index.js';
import type { FactEnvelope } from '../facts/index.js';
import { encoded, object, need } from './boundary.js';
import { recordFromWire, runKinds } from './records.js';
import type { RunView } from './types.js';
const owned = new Set(['Run', 'RunBudget', 'RunStep', 'RunTransition', 'RunExit', 'SessionGrounding']);
export function commitments(record: Json): RunView['identities'] {
  const found: RunView['identities'][number][] = [];
  const visit = (v: Json): void => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      const o = object(v);
      if (typeof o.type === 'string' && owned.has(o.type) && typeof o.id === 'string') found.push({ type: o.type, id: o.id, hash: encoded(v).hash, facts: [] });
      Object.values(o).forEach(visit);
    }
  }; visit(record); return found;
}
export function identityIndex(facts: readonly FactEnvelope[]): RunView['identities'] {
  const index = new Map<string, RunView['identities'][number]>();
  for (const fact of facts) if (Object.values(runKinds).some(kind => kind === fact.kind)) {
    for (const row of commitments(recordFromWire(object(fact.body).record!))) {
      const key = `${row.type}:${row.id}:${row.hash}`, old = index.get(key);
      index.set(key, { ...row, facts: [...new Set([...(old?.facts ?? []), fact.id])].sort() });
    }
  }
  return [...index.values()].sort((a, b) => `${a.type}:${a.id}:${a.hash}`.localeCompare(`${b.type}:${b.id}:${b.hash}`));
}
export function checkIdentities(record: Json, index: RunView['identities']): void {
  const candidate = commitments(record);
  for (const row of candidate) need([...index, ...candidate].every(old => old.type !== row.type || old.id !== row.id || old.hash === row.hash),
    `immutable ${row.type} identity disagreement: ${row.id}`);
}

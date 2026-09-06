import { consumeResult } from '../dist/index.js';
import { createTransportFileStorage } from './transport-file-storage.mjs';

const take = r => consumeResult(r, { Success: v => v, Refused: r => { throw new Error(r.detail); } });

// REFERENCE FIXTURE: peer is a second local DIRECTORY, not an independent failure
// domain. P10's authenticated peer connection is represented by this pinned store
// object. It uses the REAL P2 replication append, never an invented quorum label.
export function createEffectReplicaStorage(directory, peer, result) {
  const local = createTransportFileStorage(directory, result);
  let enabled = true;
  const replicate = facts => {
    if (!enabled) return false;
    if (!peer || peer.id === facts.at(-1)?.machine) throw new Error('distinct peer required');
    for (const fact of facts) take(peer.store.append(fact, { peer: fact.machine }));
    return true;
  };
  const storage = { owner: 'part-ten', read: local.read,
    append(bytes, expected) {
      return result(() => {
        take(local.append(bytes, expected));
        const copied = replicate(local.read());
        return copied ? { kind: 'replicated', n: 1, peers: [peer.id] } : { kind: 'local-durable' };
      });
    },
  };
  const durability = { owner: 'part-ten', ensure(facts) {
    return result(() => {
      const localFacts = local.read();
      const copied = replicate(localFacts);
      return facts.map(fact => {
        if (!localFacts.some(f => f.id === fact.id && f.contentHash === fact.contentHash)) throw new Error('local fact absent');
        if (copied && !take(peer.store.read()).some(f => f.id === fact.id && f.contentHash === fact.contentHash)) throw new Error('peer exact fact absent');
        return { fact, taint: [], durability: copied ? { kind: 'replicated', n: 1, peers: [peer.id] } : { kind: 'local-durable' } };
      });
    });
  } };
  return { storage, durability, enable: value => { enabled = value; } };
}

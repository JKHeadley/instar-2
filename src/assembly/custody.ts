import { boundary, ensure, freeze, take } from './boundary.js';
import { decodeStorageAccessObservation } from './records.js';
import type { AssemblyDecodeContext, MediatedStoreReadPort, PersistenceAdapterPort, StorageAccessObservation, StoreCustodyPolicy, StoreReadAuthorityPort } from './contracts.js';

export function createMediatedStoreReader(input: Readonly<{ persistence: PersistenceAdapterPort; policy: StoreCustodyPolicy;
  authority: StoreReadAuthorityPort; context: AssemblyDecodeContext; generation: () => string; clock: () => number }>): MediatedStoreReadPort {
  ensure(input.persistence.owner === 'part-ten' && input.persistence.describe().encrypted, 'encrypted persistence adapter required');
  ensure(input.authority.owner === 'part-one', 'standing must be resolved by Part One'); let ordinal = 0;
  const port: MediatedStoreReadPort = { owner: 'part-ten' as const, read(request) {
    return boundary('MediatedStoreRead', request, input.context, () => {
      ensure(request.policy === input.policy.id && input.policy.disclosureScopes.includes(request.scope), 'read outside custody policy scope');
      let remaining = request.maxBytes; const bytes: string[] = [], observations: StorageAccessObservation[] = [];
      for (const position of request.positions) {
        const generation = input.generation();
        take(input.authority.verify({ requester: request.requester, operation: request.operation, scope: request.scope,
          grant: request.grant, policy: request.policy, generation }));
        const chunk = take(input.persistence.readExact({ store: input.policy.store, positions: [position], maxBytes: remaining, access: request.operation }))[0]!;
        remaining -= new TextEncoder().encode(chunk).length; ensure(remaining >= 0, 'bounded disclosure exceeded'); bytes.push(chunk);
        observations.push(take(decodeStorageAccessObservation({ type: 'StorageAccessObservation', schemaVersion: 1,
          id: `storage-access:${request.operation}:${++ordinal}`, predecessors: [], dependencyFacts: [], store: input.policy.store,
          objectClass: 'encrypted-chunk', requester: request.requester, service: input.policy.custodians[0]!, grant: request.grant,
          policy: input.policy.id, generation, operation: request.operation, observedAt: input.clock(),
          byteCount: new TextEncoder().encode(chunk).length, result: 'allowed', refusalReference: '' }, input.context)));
      }
      return freeze({ bytes, observations });
    });
  } };
  return Object.freeze(port);
}

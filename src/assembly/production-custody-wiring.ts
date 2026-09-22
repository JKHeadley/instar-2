import { compareMeasurements, decode, grantLiveness, scopeIncludes } from '../index.js';
import type { Clock, DecodeContext, Result, Scope, SecretRef } from '../index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { createMediatedStoreReader } from './custody.js';
import { decodeStoreCustodyPolicy } from './records.js';
import type { AssemblyDecodeContext, AssemblyRuntimePort, MediatedStoreReadPort, StoreCustodyPolicy } from './contracts.js';
import { openProductionStorage } from './production-storage.js';
import type { ProductionStorage, ProductionStorageIO } from './production-storage.js';
import { createProductionTelegramCustodian } from './production-telegram.js';
import { createProviderCredentialCustodian } from './provider-credential-custodian.js';

/** Host configuration only. Neither this resolver nor its factory result's host
 * branch may be exported by the worker's authenticated port server. */
export interface ProductionCustodyInput {
  readonly context: AssemblyDecodeContext & DecodeContext;
  readonly policy: StoreCustodyPolicy;
  readonly storage: Readonly<{ root: string; machine: string; key: SecretRef; keyReference: string; io: ProductionStorageIO }>;
  readonly recovery: Readonly<{ custodian: string; handle: SecretRef }>;
  readonly provider: Omit<Parameters<typeof createProviderCredentialCustodian>[0], 'context' | 'resolve'>;
  readonly telegram: Omit<Parameters<typeof createProductionTelegramCustodian>[0], 'context' | 'resolveSecret' | 'captures'>;
  resolveSecret(reference: SecretRef): string;
}

/** No key generation, recovery, network request or activation occurs here. The
 * recovery handle is prepared metadata; this factory does not certify recovery. */
export function openProductionCustody(input: ProductionCustodyInput) {
  return boundary('ProductionCustody', null, input.context, () => {
    const policy = take(decodeStoreCustodyPolicy(input.policy, input.context));
    const keyRef = take(decode('SecretRef', input.storage.key, input.context));
    const recovery = take(decode('SecretRef', input.recovery.handle, input.context));
    ensure(input.storage.keyReference === policy.wrappingKey
      && input.recovery.custodian === policy.recoveryCustody
      && encoded(recovery).bytes !== encoded(keyRef).bytes, 'custody key/recovery binding differs');
    let keyText: string;
    try { keyText = input.resolveSecret(keyRef); }
    catch { throw Error('storage-key: SecretRef unresolvable'); }
    ensure(typeof keyText === 'string' && /^[a-f0-9]{64}$/.test(keyText), 'storage-key: SecretRef unresolvable');
    const key = Buffer.from(keyText, 'hex'); keyText = '';
    let storage: ProductionStorage;
    try { storage = take(openProductionStorage({ root: input.storage.root, machine: input.storage.machine,
      key, policy: policy.id, store: policy.store, context: input.context, io: input.storage.io })); }
    finally { key.fill(0); }
    try {
      const provider = take(createProviderCredentialCustodian({ ...input.provider, context: input.context, resolve: input.resolveSecret }));
      const telegram = take(createProductionTelegramCustodian({ ...input.telegram, context: input.context,
        captures: storage.captures, resolveSecret: input.resolveSecret }));
      return Object.freeze({ storage, provider, telegram, recovery: freeze({ custodian: input.recovery.custodian,
        handle: recovery, status: 'prepared' as const }), close: storage.close });
    } catch (error) { storage.close(); throw error; }
  });
}

export interface ProductionCustodyReadInput {
  readonly storage: ProductionStorage;
  readonly policy: StoreCustodyPolicy;
  readonly context: AssemblyDecodeContext;
  readonly observations: Pick<AssemblyRuntimePort, 'owner' | 'record'>;
  readonly binding: Readonly<{ requester: string; incarnation: string; grant: string; scope: string;
    disclosure: Scope; generation: string; validUntil: number; positions: readonly string[] }>;
  /** Identity comes from the authenticated receiving channel, never request data. */
  authenticatedPeer(): Readonly<{ requester: string; incarnation: string }>;
  current(): Readonly<{ decode: DecodeContext; clock: Clock; generation: string; stopped: boolean }>;
}

/** The worker gets this port only. It cannot select a credential, query a raw
 * segment/capture, or broaden its bound disclosure by copying a handle. */
export function createProductionCustodyReader(configured: ProductionCustodyReadInput): MediatedStoreReadPort {
  const input = Object.freeze({ ...configured, binding: freeze({ ...configured.binding,
    positions: [...configured.binding.positions] }) });
  const binding = input.binding;
  const policy = take(decodeStoreCustodyPolicy(input.policy, input.context));
  const authority = Object.freeze({ owner: 'part-one' as const,
    verify: (request: Parameters<import('./contracts.js').StoreReadAuthorityPort['verify']>[0]): Result<void> =>
      boundary('ProductionCustodyStanding', null, input.context, () => {
        const current = input.current(), peer = input.authenticatedPeer();
        ensure(!current.stopped && current.generation === binding.generation
          && current.clock.value < binding.validUntil && current.clock.value >= 0,
        'custody stopped, expired or stale generation');
        ensure(peer.requester === binding.requester && peer.incarnation === binding.incarnation,
          'custody authenticated worker differs');
        ensure(request.requester === peer.requester && request.grant === binding.grant
          && request.scope === binding.scope && request.policy === policy.id
          && request.generation === current.generation, 'custody request differs from bound handle');
        const candidate = current.decode.grants?.find(row => row.id === request.grant);
        ensure(candidate, 'custody grant missing');
        const grant = take(decode('StandingGrant', candidate, { ...current.decode, provenance: candidate.source }));
        ensure(take(compareMeasurements(current.clock, grant.issuedAt, input.context.preserved)) >= 0,
          'custody clock incomparable or before grant');
        ensure(grant.grantee.id === peer.requester
          && grantLiveness(grant, current.decode.revocations ?? [], current.clock) === 'live'
          && scopeIncludes(grant.scope, binding.disclosure)
          && (grant.standing === 'operator' || grant.actions.includes(policy.readOperation)),
        'custody requires current One standing for the read operation');
      }) });
  const reader = createMediatedStoreReader({ persistence: input.storage.persistence, policy, authority,
    context: input.context, generation: () => input.current().generation, clock: () => input.current().clock.value });
  return Object.freeze({ owner: 'part-ten' as const, read: (request: Parameters<MediatedStoreReadPort['read']>[0]) =>
    boundary('ProductionCustodyRead', null, input.context, () => {
      ensure(Object.keys(request).sort().join(',') === 'grant,maxBytes,operation,policy,positions,requester,scope',
        'custody exposes bounded read only');
      ensure(Array.isArray(request.positions) && request.positions.every(position => binding.positions.includes(position)),
        'custody position outside bound disclosure');
      const result = take(reader.read(request));
      ensure(input.observations.owner === 'part-ten', 'custody observation owner missing');
      for (const observation of result.observations) take(input.observations.record('StorageAccessObservation', observation));
      // A failed durable owner append never releases bytes to the caller.
      return result;
    }) });
}

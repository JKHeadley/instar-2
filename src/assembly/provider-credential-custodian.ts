import { decode } from '../index.js';
import type { BoundaryContext, DecodeContext, Result, SecretRef } from '../index.js';
import { boundary, ensure, take } from './boundary.js';
import { registerProductionProviderCustody } from './provider-invocation.js';
import type { ConfinedProviderRoute, ProviderCustodyProof } from './provider-invocation.js';

/** Owner-internal construction dependencies. Neither the resolver nor the
 * credential-bearing transport is returned to the worker or exported publicly.
 * The production boot supplies these from its concrete confined custody host. */
export interface ProviderCredentialCustodianInput {
  readonly provider: string;
  readonly model: string;
  readonly route: string;
  readonly disclosure: string;
  readonly credential: SecretRef;
  readonly context: DecodeContext & BoundaryContext;
  readonly resolve: (reference: SecretRef) => string;
  readonly submit: (credential: string, bytes: string,
    bounds: Parameters<ConfinedProviderRoute['invoke']>[1]) => ReturnType<ConfinedProviderRoute['invoke']>;
}

/** Part Ten's private composition factory, not a worker credential API. */
export function createProviderCredentialCustodian(input: ProviderCredentialCustodianInput): Result<ConfinedProviderRoute> {
  return boundary('ProviderCredentialCustodian', null, input.context, () => {
    const reference = take(decode('SecretRef', input.credential, input.context));
    for (const [name, value] of Object.entries({ provider: input.provider, model: input.model,
      route: input.route, disclosure: input.disclosure })) {
      ensure(typeof value === 'string' && value.trim().length > 0 && value.length <= 512,
        `provider credential custody binding missing: ${name}`);
    }
    let credential: string;
    try { credential = input.resolve(reference); }
    catch { throw new Error('provider-credential: SecretRef unresolvable'); }
    ensure(typeof credential === 'string' && credential.length > 0 && credential.length <= 8192,
      'provider-credential: SecretRef unresolvable');
    const submit = input.submit;
    ensure(typeof submit === 'function', 'provider transport missing');
    const custodyProof = Object.freeze(Object.create(null)) as ProviderCustodyProof;
    const route: ConfinedProviderRoute = Object.freeze({
      provider: input.provider, model: input.model, route: input.route, disclosure: input.disclosure,
      automaticRetries: 0 as const, environment: 'production' as const, custodyProof,
      invoke: (bytes: string, bounds: Parameters<ConfinedProviderRoute['invoke']>[1]) => submit(credential, bytes, bounds),
    });
    registerProductionProviderCustody(route);
    return route;
  });
}

/** Non-secret, host-owned subscription binding. Credential bytes remain in CLI custody. */
export interface ProviderSubscriptionProfile {
  readonly type: 'ProviderSubscriptionProfile'; readonly schemaVersion: 1;
  readonly reference: string; readonly home: string; readonly configDirectory: string; readonly workingDirectory: string;
  readonly expectedAccount: string; readonly organization: string; readonly plan: 'pro' | 'max' | 'team' | 'enterprise';
  readonly loginProfileIdentity: string; readonly executable: string; readonly artifact: string; readonly version: string;
  readonly activationReference: string; readonly managedConfigurationDigest: string;
}
export interface ProviderSubscriptionCustodianInput {
  readonly provider: string; readonly model: string; readonly route: string; readonly disclosure: string;
  readonly credential: SecretRef; readonly context: DecodeContext & BoundaryContext;
  readonly profile: ProviderSubscriptionProfile;
  readonly resolveProfile: (reference: SecretRef) => ProviderSubscriptionProfile;
  readonly submit: (profile: ProviderSubscriptionProfile, bytes: string,
    bounds: Parameters<ConfinedProviderRoute['invoke']>[1]) => ReturnType<ConfinedProviderRoute['invoke']>;
}

export function createProviderSubscriptionCustodian(input: ProviderSubscriptionCustodianInput): Result<ConfinedProviderRoute> {
  return boundary('ProviderSubscriptionCustodian', null, input.context, () => {
    const reference = take(decode('SecretRef', input.credential, input.context));
    ensure(reference.vault === 'preview' && reference.name === input.profile.reference,
      'subscription custody reference differs');
    const fields = ['type', 'schemaVersion', 'reference', 'home', 'configDirectory', 'workingDirectory',
      'expectedAccount', 'organization', 'plan', 'loginProfileIdentity', 'executable', 'artifact', 'version',
      'activationReference', 'managedConfigurationDigest'];
    let profile: ProviderSubscriptionProfile;
    try { profile = input.resolveProfile(reference); } catch { throw new Error('subscription profile unavailable'); }
    ensure(profile === input.profile && Object.isFrozen(profile) && profile.type === 'ProviderSubscriptionProfile'
      && profile.schemaVersion === 1 && Object.keys(profile).sort().join() === fields.sort().join(),
    'host-owned frozen subscription descriptor required');
    for (const field of fields.filter(key => key !== 'schemaVersion')) {
      const value = (profile as unknown as Record<string, unknown>)[field];
      ensure(typeof value === 'string' && value.length > 0 && value.length <= 1024, 'subscription descriptor field invalid');
    }
    for (const value of [input.provider, input.model, input.route, input.disclosure])
      ensure(typeof value === 'string' && value.trim().length > 0 && value.length <= 512, 'subscription binding absent');
    ensure(typeof input.submit === 'function', 'subscription transport absent');
    const submit = input.submit;
    const custodyProof = Object.freeze(Object.create(null)) as ProviderCustodyProof;
    const route: ConfinedProviderRoute = Object.freeze({ provider: input.provider, model: input.model,
      route: input.route, disclosure: input.disclosure, automaticRetries: 0 as const,
      environment: 'production' as const, custodyProof,
      invoke: (bytes: string, bounds: Parameters<ConfinedProviderRoute['invoke']>[1]) => submit(profile, bytes, bounds) });
    registerProductionProviderCustody(route);
    return route;
  });
}

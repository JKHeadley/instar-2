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

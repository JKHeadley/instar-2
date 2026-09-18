import { describe, expect, it } from 'vitest';
import { consumeResult, decode } from '../../src/index.js';
import * as assembly from '../../src/assembly/index.js';
import { createConfinedProviderInvocation } from '../../src/assembly/index.js';
import type { ConfinedProviderRoute } from '../../src/assembly/index.js';
import { createProviderCredentialCustodian } from '../../src/assembly/provider-credential-custodian.js';
import { fixture, value } from '../fixtures.js';

// This is a prerequisite diagnostic, not the production lifecycle positive.
// Construction must refuse a production route before consulting any downstream
// capability. The local-test neighbor establishes that the refusal is the
// explicit environment hold, rather than malformed decoder context.
describe('unit 4 production boot: landed provider prerequisite', () => {
  function construct(environment: string, supplied?: ConfinedProviderRoute) {
    const f = fixture();
    let calls = 0;
    const route = supplied ?? {
      provider: 'provider:boot-precondition', model: 'model:boot-precondition',
      route: 'route:boot-precondition', disclosure: 'disclosure:boot-precondition',
      automaticRetries: 0,
      environment,
      invoke: async () => { calls++; throw new Error('construction must not invoke a provider'); },
    } as unknown as ConfinedProviderRoute;
    const unavailable = new Proxy({}, {
      get() { throw new Error('construction consulted a downstream capability'); },
    });
    type Arguments = Parameters<typeof createConfinedProviderInvocation>;
    const result = createConfinedProviderInvocation(route,
      unavailable as Arguments[1], unavailable as Arguments[2], unavailable as Arguments[3],
      { ...f.ctx, site: 'types.decode' }, unavailable as Arguments[5]);
    return { result, calls: () => calls };
  }

  function custodied() {
    const f = fixture();
    const credential = value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1,
      vault: 'vault', name: 'provider-test-only' }, f.ctx));
    return { f, input: { provider: 'provider:boot-precondition', model: 'model:boot-precondition',
      route: 'route:boot-precondition', disclosure: 'disclosure:boot-precondition', credential,
      context: { ...f.ctx, site: 'types.decode' },
      resolve: () => 'unit-test-credential',
      submit: async () => { throw new Error('constructor proof must make zero provider calls'); } } };
  }

  it('refuses a bare production provider before any credential, storage, or network access', () => {
    const attempt = construct('production');
    const detail = consumeResult(attempt.result, {
      Success: () => { throw new Error('production hold unexpectedly absent; re-evaluate unit 4 prerequisites'); },
      Refused: refusal => refusal.detail,
    });
    expect(detail).toBe('NON-EXECUTABLE-UNTIL-production-boot-credential-custody');
    expect(attempt.calls()).toBe(0);
  });

  it('admits a custodian-proven production route after SecretRef resolution; constructor proof only', () => {
    const { input } = custodied();
    let resolutions = 0;
    const route = value(createProviderCredentialCustodian({ ...input, resolve: reference => {
      expect(reference).toEqual(input.credential); resolutions++; return 'unit-test-credential';
    } }));
    expect(value(construct('production', route).result).owner).toBe('part-ten');
    expect(resolutions).toBe(1);
    expect(Object.isFrozen(route)).toBe(true);
    expect(JSON.stringify(route)).not.toContain('unit-test-credential');
    expect(assembly).not.toHaveProperty('registerProductionProviderCustody');
    expect(assembly).not.toHaveProperty('createProviderCredentialCustodian');
  });

  it('refuses copied proofs and wrapper routes instead of treating possession of the proof as authority', () => {
    const { input } = custodied();
    const route = value(createProviderCredentialCustodian(input));
    for (const forged of [Object.freeze({ ...route }), new Proxy(route, {}),
      Object.freeze({ ...route, custodyProof: Object.freeze({}) as typeof route.custodyProof })]) {
      const detail = consumeResult(construct('production', forged as ConfinedProviderRoute).result, {
        Success: () => { throw new Error('forged provider custody admitted'); }, Refused: refusal => refusal.detail,
      });
      expect(detail).toBe('NON-EXECUTABLE-UNTIL-production-boot-credential-custody');
    }
  });

  it('refuses an unresolvable SecretRef without disclosing resolver diagnostics or invoking a transport', () => {
    const { input } = custodied();
    const detail = consumeResult(createProviderCredentialCustodian({ ...input,
      resolve: () => { throw new Error('sensitive resolver diagnostic'); } }), {
      Success: () => { throw new Error('missing credential admitted'); }, Refused: refusal => refusal.detail,
    });
    expect(detail).toBe('provider-credential: SecretRef unresolvable');
  });

  it('constructs the landed local-test neighbor without invoking it or claiming live proof', () => {
    const attempt = construct('local-test');
    const owner = consumeResult(attempt.result, {
      Success: port => port.owner,
      Refused: refusal => { throw new Error(refusal.detail); },
    });
    expect(owner).toBe('part-ten');
    expect(attempt.calls()).toBe(0);
  });
});

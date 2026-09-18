import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createConfinedProviderInvocation } from '../../src/assembly/index.js';
import type { ConfinedProviderRoute } from '../../src/assembly/index.js';
import { fixture } from '../fixtures.js';

// This is a prerequisite diagnostic, not the production lifecycle positive.
// Construction must refuse a production route before consulting any downstream
// capability. The local-test neighbor establishes that the refusal is the
// explicit environment hold, rather than malformed decoder context.
describe('unit 4 production boot: landed provider prerequisite', () => {
  function construct(environment: string) {
    const f = fixture();
    let calls = 0;
    const route = {
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

  it('refuses a production provider before any credential, storage, or network access', () => {
    const attempt = construct('production');
    const detail = consumeResult(attempt.result, {
      Success: () => { throw new Error('production hold unexpectedly absent; re-evaluate unit 4 prerequisites'); },
      Refused: refusal => refusal.detail,
    });
    expect(detail).toBe('NON-EXECUTABLE-UNTIL-production-boot-credential-custody');
    expect(attempt.calls()).toBe(0);
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

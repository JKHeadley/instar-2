import type { Result } from '../index.js';
import { createProviderJudgmentPort } from '../judgment/index.js';
import type { ProviderJudgmentDependencies } from '../judgment/index.js';
import { createProviderEffectDoorway } from '../effects/index.js';
import type { ProviderEffectDependencies } from '../effects/index.js';
import { createEffectSettlementAssessmentPort, createVerificationRuntime, createVerificationSpine } from '../verification/index.js';
import type { VerificationHost } from '../verification/index.js';
import { createConfinedProviderInvocation } from './provider-invocation.js';
import type { ConfinedProviderRoute } from './provider-invocation.js';
import { boundary, ensure, take } from './boundary.js';

export interface ProductionProviderOwnersInput {
  readonly judgment: ProviderJudgmentDependencies;
  readonly effect: Omit<ProviderEffectDependencies, 'context' | 'store' | 'privateKey' | 'transport' | 'judgment' | 'invocation' | 'assessment'>;
  readonly verification: VerificationHost;
  readonly route: ConfinedProviderRoute;
}

/** Ten assembles Seven, Eight, and Nine over one store and one Six authority.
 * The worker receives owner doorways, never the route's credential closure. */
export function createProductionProviderOwners(input: ProductionProviderOwnersInput): Result<Readonly<{
  seven: ReturnType<typeof createProviderJudgmentPort>;
  eight: ReturnType<typeof createProviderEffectDoorway>;
  nine: ReturnType<typeof createVerificationRuntime>;
}>> {
  return boundary('ProductionProviderOwners', null, input.judgment.boundary, () => {
    const p = input.judgment, e = input.effect;
    ensure(e.host.machine === p.host.transport.machine && e.host.incarnation === p.host.transport.incarnation,
      'provider owners: machine or incarnation differs');
    ensure(p.host.description.route === input.route.route && p.host.description.provider === input.route.provider
      && p.host.description.model === input.route.model && p.disclosure === input.route.disclosure,
      'provider owners: route differs');
    const seven = createProviderJudgmentPort(p);
    const nine = createVerificationRuntime(input.verification,
      createVerificationSpine(input.verification, { context: p.context, privateKey: p.privateKey }, p.store));
    const invocation = take(createConfinedProviderInvocation(input.route, p.authority,
      p.host.transport, p.captures, p.boundary, p.store));
    const eight = createProviderEffectDoorway({ ...e, context: p.context, store: p.store,
      privateKey: p.privateKey, transport: p.authority, judgment: seven, invocation,
      assessment: createEffectSettlementAssessmentPort(input.verification, nine, p.store) });
    return Object.freeze({ seven, eight, nine });
  });
}

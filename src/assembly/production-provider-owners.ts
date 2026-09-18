import type { Result } from '../index.js';
import { createProviderJudgmentPort, createJudgmentDoorway, createJudgmentSpine, createModelAdapter } from '../judgment/index.js';
import type { ProviderJudgmentDependencies, ProviderObservation, ModelAdapterPort, JudgmentDoorway } from '../judgment/index.js';
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

const issued = new WeakSet<object>();
export const isProductionProviderOwners = (value: object): boolean => issued.has(value);
export interface ProductionProviderOwners {
  readonly seven: ReturnType<typeof createProviderJudgmentPort>;
  readonly eight: ReturnType<typeof createProviderEffectDoorway>;
  readonly nine: ReturnType<typeof createVerificationRuntime>;
  readonly model: ModelAdapterPort;
  readonly legacyJudgment: JudgmentDoorway;
}

/** Ten assembles Seven, Eight, and Nine over one store and one Six authority.
 * The worker receives owner doorways, never the route's credential closure. */
export function createProductionProviderOwners(input: ProductionProviderOwnersInput): Result<ProductionProviderOwners> {
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
    // Preserve the original public production roster with the real legacy Seven
    // factory, alongside the separately typed provider-call owner path. Neither
    // port is a no-op facade or a renamed provider record.
    const model = take(createModelAdapter(p.host.description, { automaticRetries: 0,
      execute: async send => { await send(); } }, async (bytes, operation) =>
      await input.route.invoke(bytes, { operation, deadline: p.host.transport.monotonic() + p.timeout,
        automaticRetries: 0, maxTokens: p.maxTokens,
        maxOutputBytes: p.host.description.maxOutputBytes, maxCharge: p.host.description.maxCharge,
        timeout: p.timeout }) as ProviderObservation, p.authority, p.host.transport, p.boundary));
    const legacyJudgment = createJudgmentDoorway({ host: p.host, authority: p.authority,
      spine: createJudgmentSpine(p.host, { context: p.context, privateKey: p.privateKey }, p.store),
      captures: p.captures, model, boundary: p.boundary });
    const result = Object.freeze({ seven, eight, nine, model, legacyJudgment });
    issued.add(result); return result;
  });
}

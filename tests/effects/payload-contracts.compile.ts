import type { EffectPayload, OrderedEffectAggregate, OutboundMessage, TypedEffectPayload } from '../../src/effects/index.js';

declare const message: OutboundMessage;
declare const payload: TypedEffectPayload;
declare const aggregate: OrderedEffectAggregate;
const closedPayload: EffectPayload = payload;
// @ts-expect-error The aggregate is durable state, never a dispatchable payload.
const aggregatePayload: EffectPayload = aggregate;
// @ts-expect-error Legacy messages cannot acquire a new discriminator without a new immutable record.
const changedLegacy: TypedEffectPayload = message;
void [message, payload, closedPayload, aggregate, aggregatePayload, changedLegacy];

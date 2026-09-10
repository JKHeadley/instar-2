import type { EffectPayload, OutboundMessage, TypedEffectPayload } from '../../src/effects/index.js';

declare const message: OutboundMessage;
declare const payload: TypedEffectPayload;
const closedPayload: EffectPayload = payload;
// @ts-expect-error Legacy messages cannot acquire a new discriminator without a new immutable record.
const changedLegacy: TypedEffectPayload = message;
void [message, payload, closedPayload, changedLegacy];

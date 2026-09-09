import type { EffectAssessmentPort, EffectPayload, EffectRequest, EffectSettlement, OperationDefinition, OrderedEffectAggregate, OutboundMessage, TypedEffectPayload } from '../../src/effects/index.js';
import type { DispatchClaim } from '../../src/transport/index.js';
import type { OwnedReference } from '../../src/index.js';
declare const request: EffectRequest;
declare const definition: OperationDefinition;
declare const message: OutboundMessage;
declare const settlement: EffectSettlement;
declare const payload: TypedEffectPayload;
declare const aggregate: OrderedEffectAggregate;
const closedPayload: EffectPayload = payload;
// @ts-expect-error Public records are not callable six-owned claims.
const claim: DispatchClaim = request;
// @ts-expect-error Missing private owner identity, not a public constructor.
const fake: EffectRequest = { type: 'EffectRequest', schemaVersion: 1, id: 'fake' };
// @ts-expect-error Policy is not a message.
const wrong: OutboundMessage = definition;
// @ts-expect-error Settlement does not confer a new request or live authority.
const replay: EffectRequest = settlement;
// @ts-expect-error Nine's approved name is VerificationAssessment, not a consumer-invented alias.
const invented: OwnedReference<'part-nine', 'VerificationAssessment'> = { owner: 'part-nine', name: 'EvidenceAcceptance', id: 'fake' };
declare const assessmentWithoutGuard: Omit<EffectAssessmentPort, 'consumeCurrent'>;
// @ts-expect-error A potentially waiting read cannot substitute for the owner guard.
const unguarded: EffectAssessmentPort = assessmentWithoutGuard;
// @ts-expect-error The aggregate is durable state, never a dispatchable payload.
const aggregatePayload: EffectPayload = aggregate;
// @ts-expect-error Legacy messages cannot acquire a new discriminator without a new immutable record.
const changedLegacy: TypedEffectPayload = message;
void [message, payload, closedPayload, aggregate, aggregatePayload, changedLegacy, claim, fake, wrong, replay, invented, unguarded];

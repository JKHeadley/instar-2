import type { IntakeDependencies, VerifiedActAdmission } from '../../src/intake/index.js';
import type { Authorization, CaptureInput, FactEnvelopeReference, Hash, RegisterGenerationReference } from '../../src/index.js';
import type { GeneratedRegister, RegisterContext } from '../../src/register/index.js';
declare const shape: GeneratedRegister;
declare const context: RegisterContext;
// @ts-expect-error Offline generated data is not verified runtime authority.
const unverified: IntakeDependencies['governance'] = { register: shape, context };
declare const request: FactEnvelopeReference;
declare const digest: Hash;
declare const act: Authorization;
declare const proof: CaptureInput;
declare const generation: RegisterGenerationReference;
const admitted: VerifiedActAdmission = { request, requestDigest: digest, decision: 'approve', act, proof, surface: 'host', generation };
// @ts-expect-error A digest string is not a durable Part Two fact reference.
const missingReference: VerifiedActAdmission = { ...admitted, request: 'request:1' };
// @ts-expect-error A nominal pre-resolved principal is outside the closed operation input.
const principal: VerifiedActAdmission = { ...admitted, principal: act.approver };
// @ts-expect-error Caller-authored validity can never complete authority.
const valid: VerifiedActAdmission = { ...admitted, valid: true };
// @ts-expect-error Free-form grant fields can never complete authority.
const grant: VerifiedActAdmission = { ...admitted, grant: { actions: ['work'] } };
// @ts-expect-error Provenance is not the required durable proof-bundle capture.
const provenance: VerifiedActAdmission = { ...admitted, proof: act.explicitYes };
void [unverified, admitted, missingReference, principal, valid, grant, provenance];

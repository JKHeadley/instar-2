import { canonical, consumeResult, decode } from '../../src/index.js';
import type { Json, ProvenanceInput, Result } from '../../src/index.js';
import { prepareSnapshot } from '../../src/facts/index.js';
import { snapshotCurrent } from '../../src/facts/snapshot.js';
import type { FactEnvelope, FactSchema, FactSnapshot } from '../../src/facts/index.js';
import { createOperatorSurface } from '../../src/operator/index.js';
import type { IndependentSurfaceVerifierPort, OperatorAuthorityAct, OperatorSurfaceComposition,
  OperatorVerificationPort, SurfaceChallenge, VerifiedSurfaceProof } from '../../src/operator/index.js';
import type { ExternalProtectionBrokerPort } from '../../src/verification/index.js';
import type { VerifiedActAdmission } from '../../src/intake/index.js';
import { intakeFixture } from '../intake/fixtures.js';
import { json, value } from '../facts/fixtures.js';

export function operatorFixture(options: { directory?: string } = {}) {
  const intake = intakeFixture(options);
  const prepared = intake.verifiedAct({ surface: 'phone-surface', request: { requestId: 'request:1',
    requesterProse: '<button>trust me</button> please widen this request' } });
  const { f, request, requestBody, root: dependency } = { ...prepared, f: intake.f };
  let factsOverride: FactEnvelope[] | null = null;
  let revision = 0;
  let proofMode: 'valid' | 'attested' | 'wrong-operator' | 'replay' = 'valid';
  let authorityAct: OperatorAuthorityAct | null | unknown = prepared.act;
  const used = new Set<string>(), admitted: VerifiedActAdmission[] = [], stopped: unknown[] = [];
  const success = <T>(input: T): Result<T> => f.success(input);
  const refuse = <T>(): Result<T> => decode('Scope', { type: 'Scope', schemaVersion: 1,
    kind: 'project', members: ['missing-register-entry'] }, f.ctx.decode) as Result<T>;
  const facts = () => factsOverride ?? intake.facts();
  const surfaceDecode = () => ({ ...intake.context.decode, register: { ...intake.context.decode.register,
    generation: intake.generation, entries: [...new Set([...intake.context.decode.register.entries, 'phone-surface', 'chat:1', 'chat:2'])] },
    principals: [f.alice, f.bob, f.carol], grants: f.grants });
  const current = (): FactSnapshot => {
    const at = revision;
    const rows = facts();
    return value(prepareSnapshot(rows, { ...intake.context, decode: surfaceDecode(), facts: rows }, () => revision === at));
  };
  const history = { owner: 'part-two' as const, current: () => success(current()),
    isCurrent: (input: FactSnapshot) => success(snapshotCurrent(input)), decode: surfaceDecode,
    clock: () => f.clock(intake.deps.clock().value), generation: () => intake.generation,
    expectedKind: (reference: string) => facts().find(row => row.id === reference)?.kind ?? null };
  let challengeOrdinal = 0;

  const proofFor = (challenge: SurfaceChallenge, decision: 'approve' | 'decline', act: unknown = authorityAct,
    mode: typeof proofMode = proofMode): Result<VerifiedSurfaceProof> => {
    if (mode === 'replay' || used.has(challenge.id)) return refuse();
    used.add(challenge.id);
    const principal = mode === 'wrong-operator' ? f.carol : f.alice;
    const selectedAct = challenge.audience === 'independent-emergency-stop' || decision === 'decline' ? null : act;
    const actDigest = selectedAct === null ? 'none' : value(canonical(selectedAct)).hash;
    const challengePayload = { type: 'VerifiedOperatorChallenge', schemaVersion: 1, challenge: challenge.id,
      request: challenge.request, requestDigest: challenge.requestDigest, renderingDigest: challenge.renderingDigest,
      action: challenge.action, scope: json(challenge.scope), audience: challenge.audience, operator: challenge.operator,
      requestedBy: challenge.requestedBy, artifact: challenge.artifact, base: challenge.base,
      issuedAt: challenge.issuedAt, expiresAt: challenge.expiresAt, singleUse: true, decision, actDigest,
      surface: challenge.surface, generation: challenge.generation };
    const challengeProof = f.proof(challengePayload, { id: principal.id, kind: 'person' },
      'verified-operator-challenge', mode === 'attested', 'phone-surface');
    let actProof: ProvenanceInput | null = null;
    if (selectedAct !== null) {
      if (selectedAct === prepared.act) actProof = prepared.actProof;
      else {
        const fields = selectedAct && typeof selectedAct === 'object'
          ? Object.fromEntries(Object.entries(selectedAct as Record<string, unknown>)
            .filter(([key]) => !['type', 'schemaVersion', 'explicitYes', 'source'].includes(key))) : { value: selectedAct };
        actProof = f.proof(fields, { id: f.alice.id, kind: 'person' }, 'approval', false, 'phone-surface').input as ProvenanceInput;
      }
    }
    const bundle = JSON.stringify({ type: 'VerifiedActProofBundle', schemaVersion: 1,
      challenge: challengeProof.input, act: actProof });
    const capture = value(intake.deps.capture.preserve(bundle, history.clock()));
    intake.syncCaptures();
    return success({ challenge: challenge.id, principal, provenance: challengeProof.p,
      act: selectedAct as OperatorAuthorityAct | null, capture });
  };

  const verifier: IndependentSurfaceVerifierPort = { owner: 'part-nine', administration: 'independent',
    issue(subject) { challengeOrdinal++; return success({ id: `challenge:${challengeOrdinal}`, ...subject }); },
    verify(challenge, _proof, decision) { return proofFor(challenge, decision); } };
  const broker: ExternalProtectionBrokerPort = { owner: 'part-nine', install: () => refuse(),
    query: () => success(null), posture: () => success('unprotected') };
  const verification: OperatorVerificationPort = { owner: 'part-nine', record: () => refuse() as never,
    inspect: () => success([]), inspectCurrent: () => success([]), due: () => success([]),
    posture: () => success({ plan: 'none', generation: 'generation:1', evaluatedAt: history.clock().value,
      arms: [], posture: 'unknown' }), probeBound: () => success(false) };
  const composition: OperatorSurfaceComposition = { id: 'phone-surface', boundary: f.c, history, verifier,
    intake: { owner: 'part-four', operation: 'admitVerifiedAct', port: { admitVerifiedAct(input) {
      admitted.push(input); const result = intake.port().admitVerifiedAct(input); revision++; return result;
    } } },
    emergencyStop: { owner: 'part-four', stop(input) {
      stopped.push(input); return success({ owner: 'part-two', name: 'FactEnvelope', id: `stop:${stopped.length}` });
    } },
    broker, verification, requestKind: 'authorization-request', terminalKinds: ['intake-verified-act', 'authorization-disposition'],
    bindingKind: 'conversation-binding', maxPending: 2, challengeLifetime: 30, witnessFreshness: 20,
    isolation: { owner: 'part-ten', live: () => success(false) } };
  const surface = () => value(createOperatorSurface(composition));
  const detail = <T>(result: Result<T>) => consumeResult(result, { Success: () => '', Refused: refusal => refusal.detail });
  const bind = (overrides: Record<string, Json> = {}) => {
    const fact = intake.bind({ adapter: 'telegram', channel: 'chat:1', sender: 'platform:alice', identityEpoch: 'epoch:1',
      principalId: 'alice', ...overrides }); revision++; return fact;
  };
  const terminalSchema: FactSchema = { kind: 'authorization-disposition', version: 1, machineScope: 'shared',
    standing: 'requester', action: 'work', scope: f.scope, causallyBound: true, requiredReferences: [], authority: 'none',
    fields: { request: { kind: 'reference' }, disposition: { kind: 'text', maxLength: 100 } } };
  return { ...intake, f, context: intake.context, dependency, request, requestBody, history, verifier, composition, surface,
    admitted, stopped, detail, current, proofFor, facts,
    setAct: (value: unknown) => { authorityAct = value; },
    setFacts: (rows: FactEnvelope[]) => { factsOverride = rows; revision++; },
    conflictRequest: () => { const fact = intake.conflictRequest(prepared); revision++; return fact; },
    setClock: (clock: number) => intake.setTime(clock), setProofMode: (mode: typeof proofMode) => { proofMode = mode; }, bind,
    addTerminal: (disposition = 'declined') => {
      if (!intake.context.schemas.some(schema => schema.kind === terminalSchema.kind))
        Object.assign(intake.context, { schemas: [...intake.context.schemas, terminalSchema] });
      const rows = facts(), prior = rows.at(-1)!;
      factsOverride = [...rows, f.next(prior, { kind: 'authorization-disposition', body: { request: request.id, disposition },
        principal: f.alice, provenance: f.alice.provenance,
        predecessors: { inSegment: prior.id, frontier: {}, required: [request.id] } }, intake.context)];
      revision++;
    } };
}

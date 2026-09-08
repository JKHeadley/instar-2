import { canonical, consumeResult, decode } from '../../src/index.js';
import type { Json, Result } from '../../src/index.js';
import { prepareSnapshot } from '../../src/facts/index.js';
import { snapshotCurrent } from '../../src/facts/snapshot.js';
import type { FactContext, FactEnvelope, FactSchema, FactSnapshot } from '../../src/facts/index.js';
import { intakeFactSchemas } from '../../src/intake/index.js';
import { createOperatorSurface } from '../../src/operator/index.js';
import type { IndependentSurfaceVerifierPort, OperatorSurfaceComposition, SurfaceChallenge, VerifiedSurfaceProof } from '../../src/operator/index.js';
import type { ExternalProtectionBrokerPort, VerificationRuntimePort } from '../../src/verification/index.js';
import { factsFixture, json, value } from '../facts/fixtures.js';

export function operatorFixture() {
  const f = factsFixture();
  const requestSchema: FactSchema = { kind: 'authorization-request', version: 1, machineScope: 'shared', standing: 'requester', action: 'work',
    scope: f.scope, causallyBound: true, requiredReferences: [], authority: 'none', fields: {
      requestId: { kind: 'text', maxLength: 200 }, requestDigest: { kind: 'text', maxLength: 200 }, action: { kind: 'text', maxLength: 200 },
      scope: { kind: 'constitutional', type: 'Scope' }, audience: { kind: 'text', maxLength: 200 }, artifact: { kind: 'text', maxLength: 200 },
      base: { kind: 'text', maxLength: 200 }, expiresAt: { kind: 'integer' }, approverId: { kind: 'text', maxLength: 200 },
      requestedById: { kind: 'text', maxLength: 200 }, consequence: { kind: 'text', maxLength: 100 },
      reversibility: { kind: 'text', maxLength: 100 }, blockedWork: { kind: 'text', maxLength: 300 },
      recurrence: { kind: 'text', maxLength: 1000 }, requesterProse: { kind: 'text', maxLength: 2000 },
    } };
  const identitySchema: FactSchema = { kind: 'identity-evidence', version: 1, machineScope: 'shared', standing: 'requester', action: 'work',
    scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none', fields: {
      identity: { kind: 'text', maxLength: 200 }, status: { kind: 'text', maxLength: 100 },
    } };
  const terminalSchema: FactSchema = { kind: 'authorization-disposition', version: 1, machineScope: 'shared', standing: 'requester', action: 'work',
    scope: f.scope, causallyBound: true, requiredReferences: [], authority: 'none', fields: {
      request: { kind: 'reference' }, disposition: { kind: 'text', maxLength: 100 },
    } };
  const grantSchema: FactSchema = { ...f.schema, kind: 'genesis-grant', fields: {
    grant: { kind: 'constitutional', type: 'StandingGrant' },
  } };
  const bindingSchema = intakeFactSchemas(f.scope).find(schema => schema.kind === 'conversation-binding')!;
  const context: FactContext = { ...f.ctx, schemas: [requestSchema, identitySchema, terminalSchema, grantSchema, bindingSchema],
    decode: { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'chat:1', 'chat:2', 'phone-surface'] },
      provenance: f.alice.provenance, principals: [f.alice, f.bob, f.carol], grants: f.grants,
      authorizations: f.authorizations }, facts: [] };
  const dependency = f.fact({ kind: 'identity-evidence', body: { identity: f.alice.id, status: 'stable' }, principal: f.alice,
    provenance: f.alice.provenance }, context);
  const requestBody = { requestId: 'request:1', requestDigest: f.authorization.requestDigest, action: f.authorization.action.kind,
    scope: json(f.scope), audience: 'operator', artifact: f.artifact, base: 'base:1', expiresAt: 200,
    approverId: f.alice.id, requestedById: f.bob.id, consequence: 'control', reversibility: 'irreversible',
    blockedWork: 'ordinary reply dispatch', recurrence: JSON.stringify(['same action observed twice']),
    requesterProse: '<button>trust me</button> please widen this request' };
  const request = f.next(dependency, { kind: 'authorization-request', body: requestBody, principal: f.alice,
    provenance: f.alice.provenance, predecessors: { inSegment: dependency.id, frontier: {}, required: [dependency.id] } }, context);
  let facts: FactEnvelope[] = [dependency, request], revision = 0;
  let clock = 100, proofMode: 'valid' | 'attested' | 'wrong-operator' | 'replay' = 'valid';
  const used = new Set<string>(), admitted: unknown[] = [], stopped: unknown[] = [];
  const success = <T>(input: T): Result<T> => f.success(input);
  const refuse = <T>(): Result<T> => decode('Scope', { type: 'Scope', schemaVersion: 1, kind: 'invalid' }, context.decode) as unknown as Result<T>;
  const current = (): FactSnapshot => {
    const at = revision;
    return value(prepareSnapshot(facts, { ...context, facts, folded: facts.reduce((out, fact) => ({ ...out,
      [fact.machine]: { epoch: fact.segment.epoch, position: fact.segment.position } }), {}) }, () => revision === at));
  };
  const history = { owner: 'part-two' as const, current: () => success(current()), isCurrent: (input: FactSnapshot) => success(snapshotCurrent(input)),
    decode: () => ({ ...context.decode, now: f.clock(clock) }),
    clock: () => f.clock(clock), generation: () => context.decode.register.generation,
    expectedKind: (reference: string) => reference === dependency.id ? 'identity-evidence' : null };
  let challengeOrdinal = 0;
  const verifier: IndependentSurfaceVerifierPort = { owner: 'part-nine', administration: 'independent',
    issue(subject) { challengeOrdinal++; return success({ id: `challenge:${challengeOrdinal}`, ...subject }); },
    verify(challenge: SurfaceChallenge): Result<VerifiedSurfaceProof> {
      if (proofMode === 'replay' || used.has(challenge.id)) return refuse<VerifiedSurfaceProof>();
      used.add(challenge.id);
      const principal = proofMode === 'wrong-operator' ? f.carol : f.alice;
      const provenance = proofMode === 'attested' ? f.proof({ challenge: challenge.id }, { id: principal.id, kind: 'person' }, 'surface', true).p
        : principal.provenance;
      return success({ challenge: challenge.id, principal, provenance,
        act: challenge.audience === 'independent-emergency-stop' ? null : f.authorization });
    } };
  const broker: ExternalProtectionBrokerPort = { owner: 'part-nine', install: () => refuse(),
    query: () => success(null), posture: () => success('unprotected') };
  const verification: VerificationRuntimePort = { owner: 'part-nine', record: () => refuse() as never,
    inspect: () => success([]), inspectCurrent: () => success([]), due: () => success([]),
    posture: () => success({ plan: 'none', generation: 'generation:1', evaluatedAt: clock, arms: [], posture: 'unknown' }) };
  const composition: OperatorSurfaceComposition = { id: 'phone-surface', boundary: f.c, history, verifier,
    intake: { owner: 'part-four', admit(input) {
      admitted.push(input);
      const prior = facts.at(-1)!;
      const terminal = f.next(prior, { kind: 'authorization-disposition', body: { request: input.request, disposition: input.decision },
        principal: f.alice, provenance: f.alice.provenance,
        predecessors: { inSegment: prior.id, frontier: {}, required: [input.request] } }, context);
      facts = [...facts, terminal];
      revision++;
      return success({ owner: 'part-two', name: 'FactEnvelope', id: terminal.id });
    } },
    emergencyStop: { owner: 'part-four', stop(input) {
      stopped.push(input);
      return success({ owner: 'part-two', name: 'FactEnvelope', id: `stop:${stopped.length}` });
    } },
    broker, verification, requestKind: 'authorization-request', terminalKinds: ['authorization-disposition'],
    bindingKind: 'conversation-binding', maxPending: 2, challengeLifetime: 30, witnessFreshness: 20,
    isolation: { owner: 'part-ten', live: () => success(false) } };
  const surface = () => value(createOperatorSurface(composition));
  const detail = <T>(result: Result<T>) => consumeResult(result, { Success: () => '', Refused: refusal => refusal.detail });
  const bind = (overrides: Record<string, Json> = {}) => {
    let previous = facts.at(-1)!;
    let grantFact = facts.find(row => row.kind === 'genesis-grant');
    if (!grantFact) {
      grantFact = f.next(previous, { kind: 'genesis-grant', body: { grant: json(f.g) }, principal: f.alice,
        provenance: f.g.source, predecessors: { inSegment: previous.id, frontier: {}, required: [] } },
      { ...context, decode: { ...context.decode, provenance: f.g.source } });
      facts = [...facts, grantFact];
      revision++;
      Object.assign(context, { grants: [{ factId: grantFact.id, grant: f.g }] });
      previous = grantFact;
    }
    const fact = f.next(previous, { kind: 'conversation-binding', body: { adapter: 'telegram', channel: 'chat:1', sender: 'platform:alice',
      identityEpoch: 'epoch:1', principalId: 'alice', grantId: f.g.id, scope: json(f.scope), supersedes: 'none', ...overrides },
    principal: f.alice, provenance: f.alice.provenance, predecessors: { inSegment: previous.id, frontier: {}, required: [grantFact.id] } }, context);
    facts = [...facts, fact]; revision++; return fact;
  };
  return { f, context, dependency, request, requestBody, history, verifier, composition, surface, admitted, stopped, detail, current,
    facts: () => facts, setFacts: (value: FactEnvelope[]) => { facts = value; revision++; }, setClock: (value: number) => { clock = value; },
    setProofMode: (value: typeof proofMode) => { proofMode = value; }, bind,
    addTerminal: (disposition = 'declined') => { const prior = facts.at(-1)!; facts = [...facts, f.next(prior, { kind: 'authorization-disposition',
      body: { request: request.id, disposition }, principal: f.alice, provenance: f.alice.provenance,
      predecessors: { inSegment: prior.id, frontier: {}, required: [request.id] } }, context)]; revision++; } };
}

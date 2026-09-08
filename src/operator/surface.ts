import { authorizationRequestDigest, canonical, consumeResult, decode } from '../index.js';
import type { Authorization, FactEnvelopeReference, Hash, Json, Result, Revocation, Scope, StandingGrant, VerifiedPrincipal } from '../index.js';
import type { FactSnapshot, FactStatus } from '../facts/index.js';
import type { ProbeRecord } from '../verification/index.js';
import { operatorBoundary, requireOperator, take } from './boundary.js';
import type { AuthorityQueueView, AuthorityRequestView, BindingSurfaceAction, BindingView, OperatorAuthorityAct,
  OperatorHistoryPort, OperatorSurfaceComposition, OperatorSurfacePort, ProtectionReceiptView, SurfaceChallenge } from './contracts.js';

const BINDING_ACTIONS: readonly BindingSurfaceAction[] = Object.freeze(['pair', 'pre-bind', 'transfer', 'narrow', 'widen', 'revoke', 'inspect']);
const CONSEQUENCE: Readonly<Record<string, number>> = Object.freeze({ security: 8, control: 7, identity: 6, external: 5, money: 4, data: 3, attention: 2, none: 1 });

function object(input: Json): Record<string, Json> {
  requireOperator(input !== null && typeof input === 'object' && !Array.isArray(input), 'P11-NF-03: expected a signed owner record body');
  return input as Record<string, Json>;
}
function text(input: Json | undefined, name: string): string {
  requireOperator(typeof input === 'string' && input.trim().length > 0, `P11-NF-18: ${name} is missing`);
  return input;
}
function integer(input: Json | undefined, name: string): number {
  requireOperator(Number.isSafeInteger(input), `P11-NF-18: ${name} must be a safe integer`);
  return input as number;
}
function strings(input: Json | undefined, name: string): readonly string[] {
  let value = input;
  if (typeof value === 'string') {
    try { value = JSON.parse(value) as Json; } catch { value = null; }
  }
  requireOperator(Array.isArray(value) && value.length <= 100 && value.every(item => typeof item === 'string' && item.length > 0),
    `P11-NF-18: ${name} must be a bounded text list`);
  return value as readonly string[];
}

interface ResolvedReference {
  readonly status: FactStatus; readonly completeness: 'complete' | 'partial'; readonly missing: readonly string[];
}

function snapshot(history: OperatorHistoryPort): FactSnapshot {
  requireOperator(history.owner === 'part-two', 'P11-NF-03: operator history must be supplied by Part Two');
  return take(history.current());
}

function resolveReference(history: OperatorHistoryPort, reference: string, expectedKind: string): ResolvedReference {
  const current = snapshot(history);
  const matches = current.entries.filter(row => row.fact.id === reference);
  requireOperator(matches.length === 1, `P11-NF-08: signed history contains ${matches.length} records for ${reference}`, 'standing');
  const status = matches[0]!;
  requireOperator(status.fact.kind === expectedKind, `P11-NF-03/08: ${reference} is ${status.fact.kind}, expected ${expectedKind}`, 'standing');
  requireOperator(status.conflicts.length === 0 && status.taint.length === 0,
    `P11-NF-08: ${reference} is conflicted or unavailable in signed history`, 'standing');
  const missing: string[] = [];
  for (const dependency of status.fact.predecessors.required) {
    const row = current.entries.find(candidate => candidate.fact.id === dependency);
    if (!row) { missing.push(`${dependency}:missing`); continue; }
    const kind = history.expectedKind(dependency);
    if (kind && row.fact.kind !== kind) missing.push(`${dependency}:wrong-kind:${row.fact.kind}:expected:${kind}`);
    if (row.taint.length || row.conflicts.length) missing.push(`${dependency}:unavailable`);
  }
  return Object.freeze({ status, completeness: missing.length ? 'partial' : 'complete', missing: Object.freeze(missing.sort()) });
}

function constitutional<N extends 'Scope' | 'VerifiedPrincipal'>(status: FactStatus, field: string, type: N): N extends 'Scope' ? Scope : VerifiedPrincipal {
  const value = status.constitutional.find(row => row.field === field && row.value.type === type)?.value;
  requireOperator(value?.type === type, `P11-NF-08/18: signed request lacks decoded ${field}:${type}`, 'standing');
  return value as N extends 'Scope' ? Scope : VerifiedPrincipal;
}

function effectLanguage(action: string, scope: Scope, audience: string, consequence: string, reversibility: string): string {
  const subject = scope.kind === 'organization' ? 'the organization' : `${scope.kind} ${scope.members.join(', ')}`;
  return `Approving will allow ${action} for ${subject}, visible to ${audience}. Consequence: ${consequence}. Reversibility: ${reversibility}.`;
}

function requestView(composition: OperatorSurfaceComposition, reference: string): AuthorityRequestView {
  const resolved = resolveReference(composition.history, reference, composition.requestKind);
  const body = object(resolved.status.body);
  const livePrincipals = composition.history.decode().principals ?? [];
  const approverId = text(body.approverId, 'approverId'), requestedById = text(body.requestedById, 'requestedById');
  const approver = livePrincipals.find(principal => principal.id === approverId && principal.kind === 'person' && principal.provenance.class === 'verified');
  const requestedBy = livePrincipals.find(principal => principal.id === requestedById && principal.provenance.class === 'verified');
  requireOperator(approver && requestedBy, 'P11-NF-08: request principal references do not resolve to verified principals', 'standing');
  const scope = constitutional(resolved.status, 'scope', 'Scope');
  const artifact = text(body.artifact, 'artifact') as Hash;
  requireOperator(/^sha256:[a-f0-9]{64}$/.test(artifact), 'P11-NF-08: malformed request artifact', 'standing');
  const requestDigest = text(body.requestDigest, 'requestDigest') as Hash;
  const calculated = authorizationRequestDigest({ approver, action: { kind: text(body.action, 'action'), scope }, artifact, base: text(body.base, 'base') });
  requireOperator(calculated === requestDigest, 'P11-NF-08: durable request digest differs from its signed subject', 'standing');
  const expiresAt = integer(body.expiresAt, 'expiresAt');
  const action = text(body.action, 'action'), audience = text(body.audience, 'audience');
  const consequence = text(body.consequence, 'consequence'), reversibility = text(body.reversibility, 'reversibility');
  return Object.freeze({ fact: resolved.status.fact.id, requestId: text(body.requestId, 'requestId'), requestDigest,
    action, scope, audience, artifact, base: text(body.base, 'base'), expiresAt, approver, requestedBy,
    consequence, reversibility, blockedWork: text(body.blockedWork, 'blockedWork'), recurrence: strings(body.recurrence, 'recurrence'),
    currentGeneration: composition.history.generation(), completeness: resolved.completeness, missing: resolved.missing,
    primaryActions: Object.freeze(['approve', 'decline'] as const), plainLanguageEffect: effectLanguage(action, scope, audience, consequence, reversibility),
    requesterText: Object.freeze({ label: 'UNTRUSTED REQUESTER TEXT' as const, text: text(body.requesterProse, 'requesterProse') }),
    fieldsEditable: false as const, phoneCapable: true as const });
}

function validateAct(view: AuthorityRequestView, act: OperatorAuthorityAct | null, decision: 'approve' | 'decline', history: OperatorHistoryPort): void {
  if (decision === 'decline') { requireOperator(act === null, 'P11-NF-07: decline cannot smuggle an authority act', 'standing'); return; }
  requireOperator(act, 'P11-NF-07: explicit approval requires an owner-decoded act', 'standing');
  const context = history.decode(), now = history.clock();
  switch (act.type) {
    case 'Authorization': {
      const authorization = take(decode('Authorization', act, { ...context, preserved: view.fact, provenance: act.explicitYes,
        principals: [...context.principals ?? [], view.approver, view.requestedBy], currentBase: view.base, artifact: view.artifact, now, actAt: now }));
      requireOperator(authorization.requestDigest === view.requestDigest && authorization.approver.id === view.approver.id
        && authorization.requestedBy.id === view.requestedBy.id && authorization.action.kind === view.action,
      'P11-NF-08: authorization does not bind the exact durable request', 'standing');
      break;
    }
    case 'StandingGrant': take(decode('StandingGrant', act, { ...context, preserved: view.fact, provenance: act.source, now })); break;
    case 'Revocation': take(decode('Revocation', act, { ...context, preserved: view.fact, provenance: act.source, now })); break;
  }
}

function bindingView(composition: OperatorSurfaceComposition, input: Readonly<{ adapter: string; conversation: string; platformIdentity: string; identityEpoch: string }>): BindingView {
  const current = snapshot(composition.history);
  const candidates = current.entries.filter(row => row.fact.kind === composition.bindingKind && object(row.body).adapter === input.adapter
    && object(row.body).channel === input.conversation);
  const superseded = new Set(candidates.map(row => object(row.body).supersedes).filter(value => typeof value === 'string' && value !== 'none'));
  const heads = candidates.filter(row => !superseded.has(row.fact.id));
  const conflicted = heads.length > 1 || heads.some(row => row.conflicts.length || row.taint.length);
  const selected = !conflicted && heads.length === 1 ? heads[0]! : null;
  const selectedBody = selected ? object(selected.body) : null;
  const stale = !!selectedBody && (selectedBody.sender !== input.platformIdentity || selectedBody.identityEpoch !== input.identityEpoch);
  const related = current.entries.filter(row => row.fact.kind === composition.bindingKind && object(row.body).adapter === input.adapter
    && object(row.body).sender === input.platformIdentity);
  const scope = selected ? constitutional(selected, 'scope', 'Scope') : take(decode('Scope',
    { type: 'Scope', schemaVersion: 1, kind: 'conversation', members: [input.conversation] }, composition.history.decode()));
  return Object.freeze({ platform: input.adapter, conversation: input.conversation, platformIdentity: input.platformIdentity,
    operatorIdentity: selectedBody ? text(selectedBody.principalId, 'principalId') : 'unbound', scope,
    state: conflicted ? 'conflict' as const : stale ? 'stale' as const : selected ? 'bound' as const : 'unbound' as const,
    provenanceClass: selected ? selected.fact.provenance.class : 'missing' as const, bindingFact: selected?.fact.id ?? null,
    grantOrRevocation: selectedBody ? text(selectedBody.grantId, 'grantId') : 'none', actions: BINDING_ACTIONS,
    competingClaims: Object.freeze(heads.map(row => Object.freeze({ fact: row.fact.id, operator: text(object(row.body).principalId, 'principalId'),
      provenance: row.fact.provenance.class }))), credentialBindingCount: new Set(related.map(row => object(row.body).channel)).size,
    exposesOtherConversations: false as const });
}

function protectionView(composition: OperatorSurfaceComposition, operation: string, path: string): ProtectionReceiptView {
  const receipt = take(composition.broker.query(operation));
  const posture = take(composition.broker.posture(path));
  const rows = take(composition.verification.inspectCurrent());
  const probes = rows.filter((row): row is typeof row & { record: ProbeRecord } => row.record.type === 'ProbeRecord'
    && row.record.operation === operation && row.record.subject === path && row.taint.length === 0 && row.conflicts.length === 0);
  const probe = [...probes].sort((a, b) => b.record.completedAt - a.record.completedAt)[0];
  const now = composition.history.clock().value;
  const witnessFresh = !!probe && probe.record.disposition === 'passed' && probe.record.completedAt <= now
    && now - probe.record.completedAt <= composition.witnessFreshness;
  const isolationLive = take(composition.isolation.live(path));
  const uncertainty: string[] = [];
  if (!receipt || receipt.disposition !== 'committed') uncertainty.push('broker-receipt-missing');
  if (!probe) uncertainty.push('independent-probe-missing');
  else if (!witnessFresh) uncertainty.push('independent-probe-stale-or-failed');
  if (!isolationLive) uncertainty.push('isolation-proof-missing');
  if (posture !== 'protected') uncertainty.push('broker-posture-unprotected');
  const protectedNow = posture === 'protected' && receipt?.disposition === 'committed' && witnessFresh && isolationLive;
  return Object.freeze({ operation, posture: protectedNow ? 'protected' as const : 'unprotected' as const,
    brokerReceipt: receipt?.attestation ?? null, effectiveDigest: receipt?.effectiveHash ?? null, effectiveBase: receipt?.base ?? null,
    latestProbe: probe?.fact.id ?? null, witnessFresh, isolationLive, uncertainty: Object.freeze(uncertainty) });
}

export function createOperatorSurface(composition: OperatorSurfaceComposition): Result<OperatorSurfacePort> {
  return operatorBoundary('OperatorSurfaceFactory', composition.boundary, () => {
    requireOperator(composition.id.trim().length > 0 && composition.maxPending > 0 && composition.challengeLifetime > 0,
      'P11-NF-04/15: registered surface requires identity and finite bounds');
    requireOperator(composition.verifier.owner === 'part-nine' && composition.verifier.administration === 'independent',
      'P11-NF-07/12: surface verifier must be independently administered', 'standing');
    requireOperator(composition.broker.owner === 'part-nine' && composition.verification.owner === 'part-nine'
      && composition.isolation.owner === 'part-ten', 'P11-NF-10/12: surface cannot certify itself', 'standing');
    const render = (request: string): Result<AuthorityRequestView> => operatorBoundary('OperatorSurfaceRender', composition.boundary,
      () => requestView(composition, request));
    return Object.freeze({ owner: 'part-eleven' as const, id: composition.id, render,
      pending(maxRows: number): Result<AuthorityQueueView> {
        return operatorBoundary('OperatorAuthorityQueue', composition.boundary, () => {
          requireOperator(Number.isSafeInteger(maxRows) && maxRows > 0, 'P11-NF-15: pending queue requires a finite positive page');
          const current = snapshot(composition.history), terminal = new Set(current.entries.filter(row => composition.terminalKinds.includes(row.fact.kind))
            .map(row => object(row.body).request).filter((value): value is string => typeof value === 'string'));
          const rows = current.entries.filter(row => row.fact.kind === composition.requestKind && !terminal.has(row.fact.id))
            .map(row => requestView(composition, row.fact.id)).sort((a, b) => (CONSEQUENCE[b.consequence] ?? 0) - (CONSEQUENCE[a.consequence] ?? 0)
              || current.entries.find(row => row.fact.id === a.fact)!.fact.at.value - current.entries.find(row => row.fact.id === b.fact)!.fact.at.value);
          const boundedAt = Math.min(maxRows, composition.maxPending);
          return Object.freeze({ rows: Object.freeze(rows.slice(0, boundedAt)), total: rows.length,
            coalescedNotifications: rows.length ? 1 : 0, boundedAt, pullFirst: true as const });
        });
      },
      challenge(request: string): Result<SurfaceChallenge> {
        return operatorBoundary('OperatorSurfaceChallenge', composition.boundary, () => {
          const view = requestView(composition, request), now = composition.history.clock();
          requireOperator(view.completeness === 'complete' && now.value <= view.expiresAt, 'P11-NF-09: incomplete or expired request cannot be challenged', 'stale-base');
          const renderingDigest = take(canonical(view)).hash;
          return take(composition.verifier.issue({ request: view.fact, requestDigest: view.requestDigest, renderingDigest,
            audience: view.audience, operator: view.approver.id, expiresAt: Math.min(view.expiresAt, now.value + composition.challengeLifetime), singleUse: true }));
        });
      },
      confirm(input: Readonly<{ challenge: SurfaceChallenge; proof: string; decision: 'approve' | 'decline' }>): Result<FactEnvelopeReference> {
        return operatorBoundary('OperatorSurfaceConfirmation', composition.boundary, () => {
          requireOperator(composition.intake?.owner === 'part-four', 'P11-NF-04: Part Four verified-act intake seam is unavailable', 'standing');
          const view = requestView(composition, input.challenge.request), now = composition.history.clock();
          requireOperator(view.completeness === 'complete', 'P11-NF-08: referenced request is incomplete', 'standing');
          requireOperator(input.challenge.requestDigest === view.requestDigest && input.challenge.renderingDigest === take(canonical(view)).hash
            && input.challenge.audience === view.audience && input.challenge.operator === view.approver.id,
          'P11-NF-08/09: challenge subject or rendering moved', 'standing');
          requireOperator(now.value <= input.challenge.expiresAt && input.challenge.singleUse, 'P11-NF-09: challenge expired', 'stale-base');
          const proof = take(composition.verifier.verify(input.challenge, input.proof));
          requireOperator(proof.challenge === input.challenge.id && proof.principal.id === view.approver.id
            && proof.provenance.class === 'verified', 'P11-NF-07/08: explicit yes lacks the exact independently verified operator', 'standing');
          validateAct(view, proof.act, input.decision, composition.history);
          return take(composition.intake.admit({ request: view.fact, requestDigest: view.requestDigest, decision: input.decision,
            act: proof.act, proof: proof.provenance, challenge: input.challenge.id, surface: composition.id,
            generation: composition.history.generation() }));
        });
      },
      binding(input: Readonly<{ adapter: string; conversation: string; platformIdentity: string; identityEpoch: string }>): Result<BindingView> {
        return operatorBoundary('ConversationBindingSurface', composition.boundary, () => bindingView(composition, input));
      },
      protection(operation: string, path: string): Result<ProtectionReceiptView> {
        return operatorBoundary('OperatorProtectionReceipt', composition.boundary, () => protectionView(composition, operation, path));
      },
    });
  });
}

export function consumeSurfaceResult<T>(result: Result<T>, success: (value: T) => void, refused: (detail: string) => void): void {
  consumeResult(result, { Success: value => success(value), Refused: failure => refused(failure.detail) });
}

import { authorizationRequestDigest, canonical, consumeResult, decode, grantLiveness, scopeIncludes } from '../index.js';
import type { FactEnvelopeReference, Hash, Json, Result, Scope, VerifiedPrincipal } from '../index.js';
import { causalCone, hashBytes } from '../facts/index.js';
import type { FactSnapshot, FactStatus } from '../facts/index.js';
import type { ProbeRecord, ProtectionJournalEntry } from '../verification/index.js';
import { resolveAuthorizationRequestRecurrence } from '../intake/index.js';
import { constructGoverned } from '../register/index.js';
import type { GeneratedRegister, RegisterContext } from '../register/index.js';
import { operatorBoundary, requireOperator, take } from './boundary.js';
import type { AuthorityQueueView, AuthorityRequestView, BindingSurfaceAction, BindingView,
  NonApprovableAuthorityRequestView, OperatorHistoryPort, OperatorSurfaceComposition, OperatorSurfacePort,
  ProtectionReceiptView, SurfaceChallenge } from './contracts.js';

const BINDING_ACTIONS: readonly BindingSurfaceAction[] = Object.freeze(['pair', 'pre-bind', 'transfer', 'narrow', 'widen', 'revoke', 'inspect']);
const CONSEQUENCE: Readonly<Record<string, number>> = Object.freeze({ security: 8, control: 7, identity: 6, external: 5, money: 4, data: 3, attention: 2, none: 1 });

export function registerPhoneSurface(register: GeneratedRegister, context: RegisterContext) {
  return constructGoverned('operator actions', 'phone-surface', register, context);
}

function object(input: Json): Record<string, Json> {
  requireOperator(input !== null && typeof input === 'object' && !Array.isArray(input), 'P11-NF-03: expected a signed owner record body');
  return input as Record<string, Json>;
}
function text(input: Json | undefined, name: string): string {
  requireOperator(typeof input === 'string' && input.trim().length > 0, `P11-NF-18: ${name} is missing`);
  return input;
}
function presentText(input: Json | undefined, name: string): string {
  requireOperator(typeof input === 'string', `P11-NF-18: ${name} is missing`);
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
  const current = take(history.current());
  const currentStatus = take(history.isCurrent(current));
  requireOperator(typeof currentStatus === 'boolean', 'P11-NF-08: history currency must be a boolean', 'stale-base');
  requireOperator(currentStatus === true, 'P11-NF-08: operator history must be a current Part Two-issued snapshot', 'stale-base');
  return current;
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

function effectLanguage(action: string, scope: Scope, audience: string, consequence: string, reversibility: string,
  revocationTarget: AuthorityRequestView['revocationTarget']): string {
  const subject = scope.kind === 'organization' ? 'the organization' : `${scope.kind} ${scope.members.join(', ')}`;
  const target = revocationTarget ? ` The owner-resolved target is standing grant ${revocationTarget.id}.` : '';
  return `Approving will allow ${action} for ${subject}, visible to ${audience}.${target} Consequence: ${consequence}. Reversibility: ${reversibility}.`;
}

function resolveRevocationTarget(current: FactSnapshot, action: string, artifact: Hash): AuthorityRequestView['revocationTarget'] {
  if (action !== 'revoke-standing') return null;
  const matches = current.entries.filter(row => row.taint.length === 0 && row.conflicts.length === 0)
    .flatMap(row => row.historical.map(record => ({ record, status: row })))
    .filter(({ record }) => record.view.type === 'StandingGrant' && take(canonical(record.view)).hash === artifact)
    .sort((left, right) => left.status.fact.id.localeCompare(right.status.fact.id));
  const distinct = [...new Map(matches.map(({ record, status }) => {
    const grant = record.view as { readonly id: string };
    return [`${grant.id}:${artifact}`, { id: grant.id, digest: artifact, fact: status.fact.id }];
  })).values()];
  requireOperator(distinct.length === 1,
    'P11-NF-08/17/18/21: revocation artifact does not resolve one exact signed-history grant target', 'standing');
  return Object.freeze(distinct[0]!);
}

function requestView(composition: OperatorSurfaceComposition, reference: string): AuthorityRequestView {
  const resolved = resolveReference(composition.history, reference, composition.requestKind);
  const body = object(resolved.status.body);
  const current = snapshot(composition.history);
  const siblings = current.entries.filter(row => row.fact.kind === composition.requestKind && row.fact.id !== reference
    && object(row.body).requestId === body.requestId);
  const superseding = siblings.some(row => causalCone(row.fact, current.entries.map(entry => entry.fact))
    .some(ancestor => ancestor.id === reference));
  const concurrent = siblings.some(row => !causalCone(row.fact, current.entries.map(entry => entry.fact)).some(ancestor => ancestor.id === reference)
    && !causalCone(resolved.status.fact, current.entries.map(entry => entry.fact)).some(ancestor => ancestor.id === row.fact.id));
  requireOperator(!superseding && !concurrent,
    'P11-NF-08/09: authorization request is superseded or concurrently conflicted in signed history', 'standing');
  const livePrincipals = composition.history.decode().principals ?? [];
  const approverId = text(body.approverId, 'approverId'), requestedById = text(body.requestedById, 'requestedById');
  const approverCandidate = livePrincipals.find(principal => principal.id === approverId && principal.kind === 'person' && principal.provenance.class === 'verified');
  const requesterCandidate = livePrincipals.find(principal => principal.id === requestedById);
  requireOperator(approverCandidate && requesterCandidate,
    'P11-NF-08: request principal references do not resolve to an independently verified approver and authentic requester', 'standing');
  const decoded = composition.history.decode();
  for (const principal of [approverCandidate, requesterCandidate]) {
    const bytes = decoded.captures[principal.provenance.record.reference];
    requireOperator(typeof bytes === 'string' && hashBytes(bytes) === principal.provenance.record.hash,
      'P11-NF-08: request principal provenance capture is unavailable or changed', 'standing');
  }
  const approver = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1,
    id: approverCandidate.id, kind: approverCandidate.kind }, { ...decoded, provenance: approverCandidate.provenance }));
  const requestedBy = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1,
    id: requesterCandidate.id, kind: requesterCandidate.kind }, { ...decoded, provenance: requesterCandidate.provenance }));
  const scope = constitutional(resolved.status, 'scope', 'Scope');
  const artifact = text(body.artifact, 'artifact') as Hash;
  requireOperator(/^sha256:[a-f0-9]{64}$/.test(artifact), 'P11-NF-08: malformed request artifact', 'standing');
  const requestDigest = text(body.requestDigest, 'requestDigest') as Hash;
  const calculated = authorizationRequestDigest({ approver, action: { kind: text(body.action, 'action'), scope }, artifact, base: text(body.base, 'base') });
  requireOperator(calculated === requestDigest, 'P11-NF-08: durable request digest differs from its signed subject', 'standing');
  const expiresAt = integer(body.expiresAt, 'expiresAt');
  const action = text(body.action, 'action'), audience = text(body.audience, 'audience');
  const revocationTarget = resolveRevocationTarget(current, action, artifact);
  const consequence = text(body.consequence, 'consequence'), reversibility = text(body.reversibility, 'reversibility');
  const assertedRecurrence = strings(body.recurrence, 'recurrence');
  const recurrenceResolution = resolveAuthorizationRequestRecurrence(current, resolved.status);
  requireOperator(typeof recurrenceResolution.valid === 'boolean',
    'P11-NF-06/08: recurrence validity must be a boolean', 'standing');
  const recurrence = recurrenceResolution.valid === true ? recurrenceResolution.references : Object.freeze([] as string[]);
  const grantExpiresAt = integer(body.grantExpiresAt, 'grantExpiresAt');
  return Object.freeze({ fact: resolved.status.fact.id, requestId: text(body.requestId, 'requestId'), requestDigest,
    action, scope, audience, artifact, base: text(body.base, 'base'), expiresAt, approver, requestedBy,
    consequence, reversibility, blockedWork: presentText(body.blockedWork, 'blockedWork'), recurrence,
    standingGrantCandidate: assertedRecurrence.length && recurrence.length
      ? Object.freeze({ actions: Object.freeze([action]), scope, expiresAt: grantExpiresAt }) : null,
    revocationTarget,
    currentGeneration: composition.history.generation(), completeness: resolved.completeness, missing: resolved.missing,
    primaryActions: Object.freeze(['approve', 'decline'] as const),
    plainLanguageEffect: effectLanguage(action, scope, audience, consequence, reversibility, revocationTarget),
    requesterText: Object.freeze({ label: 'UNTRUSTED REQUESTER TEXT' as const, text: presentText(body.requesterProse, 'requesterProse') }),
    fieldsEditable: false as const, phoneCapable: true as const });
}

function requestRenderingDigest(composition: OperatorSurfaceComposition, reference: string): Hash {
  const resolved = resolveReference(composition.history, reference, composition.requestKind);
  return take(canonical(resolved.status.body)).hash;
}

function nonApprovableRequestView(status: FactStatus, candidates: readonly FactStatus[], reason: string): NonApprovableAuthorityRequestView {
  const body = status.body !== null && typeof status.body === 'object' && !Array.isArray(status.body)
    ? status.body as Record<string, Json> : {};
  const requestId = typeof body.requestId === 'string' && body.requestId.trim().length > 0
    ? body.requestId : `unresolved:${status.fact.id}`;
  const related = candidates.filter(row => {
    const candidate = row.body !== null && typeof row.body === 'object' && !Array.isArray(row.body)
      ? row.body as Record<string, Json> : {};
    return candidate.requestId === requestId;
  });
  const competingFacts = [...new Set([status.fact.id, ...related.map(row => row.fact.id),
    ...status.conflicts.flatMap(conflict => conflict.facts)])].sort();
  return Object.freeze({ fact: status.fact.id, requestId,
    consequence: typeof body.consequence === 'string' && body.consequence.length > 0 ? body.consequence : 'unknown',
    state: competingFacts.length > 1 || status.conflicts.length > 0 ? 'conflict' as const : 'unavailable' as const,
    approvable: false as const, primaryActions: Object.freeze([] as const), competingFacts: Object.freeze(competingFacts), reason });
}

function isTerminalDisposition(row: FactStatus): boolean {
  const disposition = object(row.body).disposition;
  const terminal = typeof disposition === 'string' && ['approved', 'declined', 'superseded', 'expired',
    'withdrawn', 'conflict', 'emergency-stopped'].includes(disposition);
  if (!terminal) return false;
  // Part Four's owner-issued admission is itself the closed request result. A
  // consumer snapshot that cannot decode its nested owner body must fail closed
  // against replay, while generic surface dispositions must still be clean.
  return row.fact.kind === 'intake-verified-act' || (row.taint.length === 0 && row.conflicts.length === 0);
}

function terminalRequest(composition: OperatorSurfaceComposition, request: string): boolean {
  return snapshot(composition.history).entries.some(row => composition.terminalKinds.includes(row.fact.kind)
    && isTerminalDisposition(row) && object(row.body).request === request);
}

function bindingView(composition: OperatorSurfaceComposition, input: Readonly<{ adapter: string; conversation: string; platformIdentity: string; identityEpoch: string }>): BindingView {
  const current = snapshot(composition.history);
  const candidates = current.entries.filter(row => row.fact.kind === composition.bindingKind && object(row.body).adapter === input.adapter
    && object(row.body).channel === input.conversation);
  const superseded = new Set(candidates.map(row => object(row.body).supersedes).filter(value => typeof value === 'string' && value !== 'none'));
  const heads = candidates.filter(row => !superseded.has(row.fact.id));
  const conflicted = heads.length > 1 || heads.some(row => row.conflicts.length || row.taint.length);
  const liveGrant = (row: FactStatus) => {
    const body = object(row.body), decoded = composition.history.decode();
    const scope = constitutional(row, 'scope', 'Scope');
    return decoded.grants?.find(grant => grant.id === body.grantId && grant.grantee.id === body.principalId
      && grant.standing === 'operator' && grant.source.class === 'verified' && scopeIncludes(grant.scope, scope)
      && grantLiveness(grant, decoded.revocations ?? [], composition.history.clock()) === 'live');
  };
  const candidate = !conflicted && heads.length === 1 && heads[0]!.taint.length === 0 && heads[0]!.conflicts.length === 0
    && heads[0]!.fact.provenance.class === 'verified' ? heads[0]! : null;
  const grant = candidate ? liveGrant(candidate) : undefined;
  const selected = grant ? candidate : null;
  const selectedBody = selected ? object(selected.body) : null;
  const stale = !!selectedBody && (selectedBody.sender !== input.platformIdentity || selectedBody.identityEpoch !== input.identityEpoch);
  const related = current.entries.filter(row => row.fact.kind === composition.bindingKind && object(row.body).adapter === input.adapter
    && object(row.body).sender === input.platformIdentity && row.taint.length === 0 && row.conflicts.length === 0 && !!liveGrant(row));
  const scope = selected ? constitutional(selected, 'scope', 'Scope') : take(decode('Scope',
    { type: 'Scope', schemaVersion: 1, kind: 'conversation', members: [input.conversation] }, composition.history.decode()));
  return Object.freeze({ platform: input.adapter, conversation: input.conversation, platformIdentity: input.platformIdentity,
    operatorIdentity: selectedBody ? text(selectedBody.principalId, 'principalId') : 'unbound', scope,
    state: conflicted ? 'conflict' as const : stale ? 'stale' as const : selected ? 'bound' as const : 'unbound' as const,
    provenanceClass: selected ? selected.fact.provenance.class : 'missing' as const, bindingFact: selected?.fact.id ?? null,
    grantOrRevocation: grant?.id ?? 'none', actions: BINDING_ACTIONS,
    competingClaims: Object.freeze(heads.map(row => Object.freeze({ fact: row.fact.id, operator: text(object(row.body).principalId, 'principalId'),
      provenance: row.fact.provenance.class }))), credentialBindingCount: new Set(related.map(row => object(row.body).channel)).size,
    exposesOtherConversations: false as const });
}

function protectionView(composition: OperatorSurfaceComposition, operation: string, path: string): ProtectionReceiptView {
  const uncertainty: string[] = [];
  function readEvidence<T>(result: Result<T>, fallback: T, label: string): T {
    return consumeResult(result, {
      Success: value => value,
      Refused: refusal => { uncertainty.push(`${label}-unavailable:${refusal.detail}`); return fallback; },
    });
  }
  type BrokerRead = Readonly<{ ok: true; receipt: ProtectionJournalEntry | null }> | Readonly<{ ok: false; detail: string }>;
  const brokerRead = consumeResult<ProtectionJournalEntry | null, BrokerRead>(composition.broker.query(operation), {
    Success: receipt => ({ ok: true, receipt }),
    Refused: refusal => ({ ok: false, detail: refusal.detail }),
  });
  const receipt = brokerRead.ok ? brokerRead.receipt : null;
  const postureRead = consumeResult(composition.broker.posture(path), {
    Success: posture => ({ posture, detail: null as string | null }),
    Refused: refusal => ({ posture: 'unprotected' as const, detail: refusal.detail }),
  });
  const brokerPosture = postureRead.posture;
  const rows = readEvidence(composition.verification.inspectCurrent(), [], 'independent-inventory');
  const probes = rows.filter((row): row is typeof row & { record: ProbeRecord } => row.record.type === 'ProbeRecord'
    && row.record.operation === operation && row.record.subject === path && row.taint.length === 0 && row.conflicts.length === 0);
  const probe = [...probes].sort((a, b) => b.record.completedAt - a.record.completedAt)[0];
  const clock = composition.history.clock(), now = clock.value;
  const evaluated = probe ? readEvidence(composition.verification.posture(probe.record.plan, clock), null, 'independent-posture') : null;
  const exactWitness = probe ? readEvidence(composition.verification.probeBound(probe.fact.id, clock), false, 'independent-probe') : false;
  requireOperator(typeof exactWitness === 'boolean', 'P11-NF-10/13: independent probe result must be a boolean');
  const witnessFresh = !!probe && evaluated?.plan === probe.record.plan && evaluated.evaluatedAt === now
    && evaluated.posture === 'healthy' && probe.record.disposition === 'passed' && probe.record.completedAt <= now
    && now - probe.record.completedAt <= composition.witnessFreshness && exactWitness === true;
  const isolationLive = readEvidence(composition.isolation.live(path), false, 'isolation-proof');
  requireOperator(typeof isolationLive === 'boolean', 'P11-NF-10/12: isolation result must be a boolean');
  const receiptMatches = !!receipt && receipt.operation === operation && receipt.path === path;
  const currentBase = composition.history.decode().currentBase;
  const currentBaseKnown = typeof currentBase === 'string' && currentBase.trim().length > 0;
  const receiptBaseCurrent = !!receipt && currentBaseKnown && receipt.base === currentBase;
  const receiptComplete = !!receipt
    && [receipt.attestation, receipt.base, receipt.authorization]
      .every(value => typeof value === 'string' && value.trim().length > 0)
    && [receipt.requestDigest, receipt.priorHash, receipt.proposedHash, receipt.effectiveHash]
      .every(value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value))
    && receiptMatches
    && receipt.requestDigest === take(canonical({ operation: receipt.operation, path: receipt.path,
      base: receipt.base, proposedHash: receipt.proposedHash, authorization: receipt.authorization })).hash
    && (receipt.disposition !== 'committed' || receipt.effectiveHash === receipt.proposedHash);
  if (receipt && !receiptComplete) uncertainty.push('broker-receipt-incomplete-or-inconsistent');
  const plan = probe ? rows.find(row => row.record.type === 'VerificationPlan'
    && row.record.id === probe.record.plan && row.record.bar.version === probe.record.planVersion
    && row.taint.length === 0 && row.conflicts.length === 0) : null;
  const effectiveDigestWitnessed = !!receipt && receiptMatches && plan?.record.type === 'VerificationPlan'
    && plan.record.bar.subjectDigest === receipt.effectiveHash;
  if (receiptMatches && !effectiveDigestWitnessed) uncertainty.push('independent-probe-effective-digest-mismatch');
  if (!currentBaseKnown) uncertainty.push('current-owner-base-unavailable');
  else if (receiptMatches && !receiptBaseCurrent) uncertainty.push('broker-receipt-current-base-mismatch');
  if (postureRead.detail !== null) uncertainty.push(`broker-posture-unavailable:${postureRead.detail}`);
  if (!brokerRead.ok) uncertainty.push(`broker-evidence-unavailable:${brokerRead.detail}`);
  if (!receipt) uncertainty.push('broker-receipt-missing');
  else if (!receiptMatches) uncertainty.push('broker-receipt-subject-mismatch');
  else if (receipt.disposition !== 'committed') uncertainty.push('broker-receipt-uncommitted');
  if (!probe) uncertainty.push('independent-probe-missing');
  else if (!witnessFresh) uncertainty.push('independent-probe-stale-or-failed');
  if (evaluated && evaluated.posture !== 'healthy') uncertainty.push(`independent-posture-${evaluated.posture}`);
  if (isolationLive === false) uncertainty.push('isolation-proof-missing');
  if (brokerPosture !== 'protected') uncertainty.push('broker-posture-unprotected');
  const protectedNow = brokerPosture === 'protected' && receiptMatches && receipt?.disposition === 'committed'
    && receiptComplete && receiptBaseCurrent && witnessFresh && isolationLive === true && effectiveDigestWitnessed;
  return Object.freeze({ operation, posture: protectedNow ? 'protected' as const : 'unprotected' as const,
    brokerReceipt: receiptMatches && receiptComplete ? receipt.attestation : null, effectiveDigest: receiptMatches ? receipt.effectiveHash : null,
    effectiveBase: receiptMatches ? receipt.base : null,
    latestProbe: probe?.fact.id ?? null, witnessFresh, isolationLive, uncertainty: Object.freeze(uncertainty) });
}

function stopSubject(composition: OperatorSurfaceComposition, operator: string, scope: Scope) {
  return Object.freeze({ kind: 'emergency-stop', surface: composition.id, operator, scope,
    generation: composition.history.generation() });
}

function requireRegisteredSurface(composition: OperatorSurfaceComposition): void {
  const register = composition.history.decode().register;
  requireOperator(register.entries.includes(composition.id) && register.producers.includes(composition.id),
    'P11-NF-04: authority completion requires a currently registered surface', 'standing');
}

export function createOperatorSurface(composition: OperatorSurfaceComposition): Result<OperatorSurfacePort> {
  return operatorBoundary('OperatorSurfaceFactory', composition.boundary, () => {
    const registered = composition.history.decode().register;
    requireOperator(composition.id.trim().length > 0 && Number.isSafeInteger(composition.maxPending) && composition.maxPending > 0
      && Number.isSafeInteger(composition.challengeLifetime) && composition.challengeLifetime > 0
      && Number.isSafeInteger(composition.witnessFreshness) && composition.witnessFreshness > 0,
      'P11-NF-04/15: registered surface requires identity and finite bounds');
    const generation = composition.history.generation();
    requireOperator(generation.owner === 'part-three' && generation.name === 'RegisterGeneration'
      && generation.id === registered.generation.id, 'P11-NF-04: surface register generation is not current', 'stale-base');
    requireOperator(composition.verifier.owner === 'part-nine' && composition.verifier.administration === 'independent',
      'P11-NF-07/12: surface verifier must be independently administered', 'standing');
    requireOperator(composition.broker.owner === 'part-nine' && composition.verification.owner === 'part-nine'
      && typeof composition.verification.probeBound === 'function'
      && composition.isolation.owner === 'part-ten', 'P11-NF-10/12: surface cannot certify itself', 'standing');
    const render = (request: string): Result<AuthorityRequestView> => operatorBoundary('OperatorSurfaceRender', composition.boundary,
      () => requestView(composition, request));
    return Object.freeze({ owner: 'part-eleven' as const, id: composition.id, render,
      pending(maxRows: number): Result<AuthorityQueueView> {
        return operatorBoundary('OperatorAuthorityQueue', composition.boundary, () => {
          requireOperator(Number.isSafeInteger(maxRows) && maxRows > 0, 'P11-NF-15: pending queue requires a finite positive page');
          const current = snapshot(composition.history), terminal = new Set(current.entries.filter(row => composition.terminalKinds.includes(row.fact.kind) && isTerminalDisposition(row))
            .map(row => object(row.body).request).filter((value): value is string => typeof value === 'string'));
          const candidates = current.entries.filter(row => row.fact.kind === composition.requestKind && !terminal.has(row.fact.id));
          const facts = current.entries.map(entry => entry.fact);
          const superseded = new Set(candidates.filter(row => candidates.some(successor => successor.fact.id !== row.fact.id
            && object(successor.body).requestId === object(row.body).requestId
            && causalCone(successor.fact, facts).some(ancestor => ancestor.id === row.fact.id))).map(row => row.fact.id));
          const heads = candidates.filter(row => !superseded.has(row.fact.id));
          const rows: (AuthorityRequestView | NonApprovableAuthorityRequestView)[] = [], representedConflicts = new Set<string>();
          for (const row of heads) {
            const body = row.body !== null && typeof row.body === 'object' && !Array.isArray(row.body)
              ? row.body as Record<string, Json> : {};
            const requestId = typeof body.requestId === 'string' && body.requestId.trim().length > 0
              ? body.requestId : `unresolved:${row.fact.id}`;
            const related = heads.filter(candidate => candidate.body !== null && typeof candidate.body === 'object'
              && !Array.isArray(candidate.body) && (candidate.body as Record<string, Json>).requestId === requestId);
            if (related.length > 1 || row.conflicts.length > 0 || row.taint.length > 0) {
              if (!representedConflicts.has(requestId)) {
                representedConflicts.add(requestId);
                rows.push(nonApprovableRequestView(row, related, 'authorization request is conflicted or unavailable in signed history'));
              }
              continue;
            }
            try { rows.push(requestView(composition, row.fact.id)); }
            catch (error) { rows.push(nonApprovableRequestView(row, heads, error instanceof Error ? error.message : 'request row is unavailable')); }
          }
          rows.sort((a, b) => (CONSEQUENCE[b.consequence] ?? 0) - (CONSEQUENCE[a.consequence] ?? 0)
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
          const renderingDigest = requestRenderingDigest(composition, view.fact);
          const challenge = take(composition.verifier.issue({ request: view.fact, requestDigest: view.requestDigest, renderingDigest,
            action: view.action, scope: view.scope, audience: view.audience, operator: view.approver.id,
            requestedBy: view.requestedBy.id, artifact: view.artifact, base: view.base, issuedAt: now.value,
            expiresAt: Math.min(view.expiresAt, now.value + composition.challengeLifetime), singleUse: true,
            surface: composition.id, generation: composition.history.generation() }));
          requireOperator(typeof challenge.singleUse === 'boolean' && challenge.singleUse === true,
            'P11-NF-09: issued challenge single-use state must be boolean true', 'standing');
          return challenge;
        });
      },
      confirm(input: Readonly<{ challenge: SurfaceChallenge; proof: string; decision: 'approve' | 'decline' }>): Result<FactEnvelopeReference> {
        return operatorBoundary('OperatorSurfaceConfirmation', composition.boundary, () => {
          requireRegisteredSurface(composition);
          requireOperator(input.decision === 'approve' || input.decision === 'decline',
            'P11-NF-07: decision must be exactly approve or decline', 'standing');
          requireOperator(composition.intake?.owner === 'part-four' && composition.intake.operation === 'admitVerifiedAct',
            'P11-NF-04: Part Four verified-act intake seam is unavailable', 'standing');
          const view = requestView(composition, input.challenge.request), now = composition.history.clock();
          requireOperator(view.completeness === 'complete', 'P11-NF-08: referenced request is incomplete', 'standing');
          requireOperator(!terminalRequest(composition, view.fact), 'P11-NF-09/14: authorization request is already terminal', 'standing');
          requireOperator(input.challenge.requestDigest === view.requestDigest
            && input.challenge.renderingDigest === requestRenderingDigest(composition, view.fact)
            && input.challenge.audience === view.audience && input.challenge.operator === view.approver.id,
          'P11-NF-08/09: challenge subject or rendering moved', 'standing');
          requireOperator(typeof input.challenge.singleUse === 'boolean', 'P11-NF-09: challenge single-use state must be a boolean', 'standing');
          requireOperator(now.value <= input.challenge.expiresAt && input.challenge.singleUse === true, 'P11-NF-09: challenge expired', 'stale-base');
          const proof = take(composition.verifier.verify(input.challenge, input.proof, input.decision));
          requireOperator(proof.challenge === input.challenge.id && proof.principal.id === view.approver.id
            && take(canonical(proof.principal)).hash === take(canonical(view.approver)).hash
            && proof.provenance.class === 'verified', 'P11-NF-07/08: explicit yes lacks the exact independently verified operator', 'standing');
          const disposition = take(composition.intake.port.admitVerifiedAct({
            request: { owner: 'part-two', name: 'FactEnvelope', id: view.fact }, requestDigest: view.requestDigest,
            decision: input.decision, act: proof.act, proof: proof.capture, surface: composition.id,
            generation: composition.history.generation(),
          }));
          return disposition.fact;
        });
      },
      binding(input: Readonly<{ adapter: string; conversation: string; platformIdentity: string; identityEpoch: string }>): Result<BindingView> {
        return operatorBoundary('ConversationBindingSurface', composition.boundary, () => bindingView(composition, input));
      },
      protection(operation: string, path: string): Result<ProtectionReceiptView> {
        return operatorBoundary('OperatorProtectionReceipt', composition.boundary, () => protectionView(composition, operation, path));
      },
      stopChallenge(input: Readonly<{ operator: string; scope: Scope }>): Result<SurfaceChallenge> {
        return operatorBoundary('OperatorEmergencyStopChallenge', composition.boundary, () => {
          const principal = composition.history.decode().principals?.find(row => row.id === input.operator
            && row.kind === 'person' && row.provenance.class === 'verified');
          requireOperator(principal, 'P11-NF-22/39: emergency stop operator is not independently verified', 'standing');
          const scope = take(decode('Scope', input.scope, composition.history.decode()));
          const digest = take(canonical(stopSubject(composition, principal.id, scope))).hash;
          const now = composition.history.clock();
          const challenge = take(composition.verifier.issue({ request: composition.id, requestDigest: digest, renderingDigest: digest,
            action: 'emergency-stop', scope, audience: 'independent-emergency-stop', operator: principal.id,
            requestedBy: principal.id, artifact: digest, base: composition.id, issuedAt: now.value,
            expiresAt: now.value + composition.challengeLifetime, singleUse: true,
            surface: composition.id, generation: composition.history.generation() }));
          requireOperator(typeof challenge.singleUse === 'boolean' && challenge.singleUse === true,
            'P11-NF-22: issued stop challenge single-use state must be boolean true', 'standing');
          return challenge;
        });
      },
      stop(input: Readonly<{ challenge: SurfaceChallenge; proof: string; scope: Scope }>): Result<FactEnvelopeReference> {
        return operatorBoundary('OperatorEmergencyStop', composition.boundary, () => {
          requireRegisteredSurface(composition);
          requireOperator(composition.emergencyStop?.owner === 'part-four',
            'P11-NF-22: independent emergency-stop owner seam is unavailable', 'standing');
          const principal = composition.history.decode().principals?.find(row => row.id === input.challenge.operator
            && row.kind === 'person' && row.provenance.class === 'verified');
          requireOperator(principal, 'P11-NF-22/39: emergency stop operator is not independently verified', 'standing');
          const scope = take(decode('Scope', input.scope, composition.history.decode()));
          const digest = take(canonical(stopSubject(composition, principal.id, scope))).hash;
          requireOperator(typeof input.challenge.singleUse === 'boolean',
            'P11-NF-22: emergency-stop challenge single-use state must be a boolean', 'standing');
          requireOperator(input.challenge.request === composition.id && input.challenge.requestDigest === digest
            && input.challenge.renderingDigest === digest && input.challenge.audience === 'independent-emergency-stop'
            && input.challenge.singleUse === true && composition.history.clock().value <= input.challenge.expiresAt,
          'P11-NF-22: emergency-stop challenge moved, expired, or changed generation', 'stale-base');
          const proof = take(composition.verifier.verify(input.challenge, input.proof, 'approve'));
          requireOperator(proof.challenge === input.challenge.id && proof.principal.id === principal.id
            && take(canonical(proof.principal)).hash === take(canonical(principal)).hash
            && proof.provenance.class === 'verified' && proof.act === null,
          'P11-NF-22: emergency stop requires an independent proof with no authority act', 'standing');
          return take(composition.emergencyStop.stop({ principal, scope, proof: proof.provenance,
            challenge: input.challenge.id, surface: composition.id, generation: composition.history.generation() }));
        });
      },
    });
  });
}

export function consumeSurfaceResult<T>(result: Result<T>, success: (value: T) => void, refused: (detail: string) => void): void {
  consumeResult(result, { Success: value => success(value), Refused: failure => refused(failure.detail) });
}

import { acceptedReplyOpening, acceptedReplyPreviewText } from '../rungraph/accepted-reply.js';
import { hashBytes } from '../facts/index.js';
import { requireRunPairAdmission } from './run-pair.js';
import { decode, decodeMeasurement, grantLiveness, scopeIncludes } from '../index.js';
import type { BoundaryContext, Json, Result } from '../index.js';
import { causalCone, registerOwnedBody } from '../facts/index.js';
import type { FactEnvelope, FactSchema, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import type { AdmissionReservation, FenceToken, Lease, LoopPolicy, LoopRecord, RunPairAdmission, ScanCursor, SettlementConsumer, TransportFact, TransportHost, TransportRecord } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { admissionAccounting, bindSettlementConsumer, checkApplicationEvidence, latestApplication, noteAccountingCandidate, requireApplication } from './settlement.js';

const txt = { kind: 'text', maxLength: 256 } as const;
const int = { kind: 'integer' } as const;
const common = { type: txt, schemaVersion: int };
const row = { ...common, domain: txt, command: txt, predecessor: txt, authority: txt, tick: int };
const fence: OwnedShape = { kind: 'object', fields: { ...common, domain: txt, epoch: int, assignment: txt, holder: txt, machine: txt, incarnation: txt, authority: txt, generation: txt } };
const policy: OwnedShape = { kind: 'object', fields: { ...common, id: txt, maxAttempts: int, minDelay: int, maxDuration: int, timeout: int, concurrency: int, failDirection: txt, breaker: txt } };
export const transportShapes: Readonly<Record<string, OwnedShape>> = freeze({
  Lease: { kind: 'object', fields: { ...row, epoch: int, holder: txt, machine: txt, incarnation: txt, generation: txt, expires: int, state: txt, operation: txt, term: int } },
  FenceToken: fence, LoopPolicy: policy,
  AdmissionReservation: { kind: 'object', fields: { ...row, operation: txt, request: txt, attempt: txt, digest: txt, run: txt, semanticMessage: txt, deliveryAttempt: txt, fence, charge: int, state: txt, executor: txt, durability: txt, replicas: int } },
  LoopRecord: { kind: 'object', fields: { ...row, run: txt, episode: txt, policy, attempts: int, started: int, nextWake: int, state: txt, pending: txt } },
  RecoveryRecord: { kind: 'object', fields: { ...row, operation: txt, episode: txt, observation: txt, disposition: txt } },
  ScanCursor: { kind: 'object', fields: { ...row, scan: txt, generation: txt, orderedKeysDigest: txt,
    keyCount: int, previous: txt, selectedFrom: int, selectedCount: int, nextIndex: int,
    maxItems: int, maxDuration: int, elapsed: int, wrapped: int } },
  SettlementApplication: { kind: 'object', fields: { ...row, operation: txt, request: txt, reservation: txt, claim: txt, digest: txt,
    settlement: txt, settlementFact: txt, settlementHash: txt, actualCharge: int, exposure: int, released: int, unresolved: int, capViolation: int, retryEligible: int } },
});
export const runPairAdmissionShape: OwnedShape = freeze({ kind: 'object', fields: { ...row, profile: txt, provider: txt, reply: txt, opening: txt,
  acceptance: txt, originalPredecessor: txt, obligation: txt, operation: txt, answerDigest: txt, conversation: txt, budget: int, replyPolicy: policy } });
const recordNames = ['Lease', 'AdmissionReservation', 'LoopRecord', 'RecoveryRecord', 'ScanCursor', 'SettlementApplication', 'RunPairAdmission'];
export const kindFor = (name: string) => `transport-${name}`;
export function transportSchemas(host: TransportHost): readonly FactSchema[] {
  return recordNames.map(name => ({ kind: kindFor(name), version: 1,
    fields: { record: { kind: 'owned', owner: 'part-six', name } }, machineScope: 'shared',
    // The issuer identity and current standing are checked by the owner boundary too.
    standing: 'requester', action: 'work', scope: host.scope, causallyBound: false,
    requiredReferences: [], authority: 'none' }));
}
export function shapeCheck(v: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') { ensure(typeof v === 'string' && v.length <= shape.maxLength, 'bounded text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(v), 'safe integer required'); return; }
  ensure(shape.kind === 'object' && v !== null && typeof v === 'object' && !Array.isArray(v), 'closed object required');
  const r = v as Record<string, unknown>;
  ensure(Object.keys(r).length === Object.keys(shape.fields).length, 'undeclared or missing field');
  for (const [key, field] of Object.entries(shape.fields)) { ensure(Object.hasOwn(r, key), `missing ${key}`); shapeCheck(r[key], field); }
}
export function policyCheck(p: LoopPolicy): void {
  shapeCheck(p, policy);
  ensure(p.type === 'LoopPolicy' && p.schemaVersion === 1 && p.id.length > 0, 'policy identity');
  ensure(p.maxAttempts >= 0 && p.maxDuration >= 0 && p.minDelay > 0 && p.timeout > 0,
    'finite nonnegative bounds and positive delays required');
  ensure(p.concurrency === 1 && p.failDirection === 'closed' && p.breaker === 'stub-closed', 'unsupported loop policy');
}
export function decodeLoopPolicy(input: unknown, c: BoundaryContext): Result<LoopPolicy> {
  return boundary('LoopPolicyInput', input, c, safe => { const p = safe as unknown as LoopPolicy; policyCheck(p); return freeze(p); });
}
export function rows(facts: readonly FactEnvelope[], domain: string): TransportFact[] {
  return facts.filter(f => recordNames.some(n => f.kind === kindFor(n))).map(fact => ({ fact,
    record: (fact.body as { readonly record: Json }).record as unknown as TransportRecord,
  })).filter(f => f.record.domain === domain);
}
export function latestLease(all: readonly TransportFact[]): TransportFact & { readonly record: Lease } | undefined {
  return all.filter((v): v is TransportFact & { record: Lease } => v.record.type === 'Lease').at(-1);
}
export function latestLoop(all: readonly TransportFact[], run: string): LoopRecord | undefined {
  let loop: LoopRecord | undefined;
  for (const { record: r } of all) {
    if (r.type === 'LoopRecord' && r.run === run) loop = r;
    // A matching durable result is the completion/release of an active wake,
    // not the passage of time or the creation of another API object.
    if (r.type === 'RecoveryRecord' && loop && loop.command === `${r.command}:wake`)
      loop = freeze({ ...loop, state: r.disposition === 'waiting' ? 'waiting' : 'stopped' });
  }
  return loop;
}
export function loopActive(all: readonly TransportFact[], loop: LoopRecord): boolean {
  return ['running', 'restoring', 'waiting'].includes(loop.state)
    && !all.some(({ record: r }) => r.type === 'RecoveryRecord' && loop.command === `${r.command}:wake`);
}
export function observationAdmission(loop: LoopRecord, tick: number, authority: string): 'ordinary' | 'restored' | 'none' {
  if (loop.attempts >= loop.policy.maxAttempts || loop.policy.maxDuration === 0) return 'none';
  // Separate, one-shot read-only allowance when the old duration clock is
  // suspect. Its committed state is restoring and its result stops the loop.
  if (authority !== loop.authority) return 'restored';
  return tick - loop.started < loop.policy.maxDuration ? 'ordinary' : 'none';
}
export function reservations(all: readonly TransportFact[]): AdmissionReservation[] {
  const ops = new Map<string, AdmissionReservation>();
  for (const { record: r } of all) if (r.type === 'AdmissionReservation') ops.set(r.operation, r);
  return [...ops.values()];
}
export function latestScanCursor(all: readonly TransportFact[], scan: string): (TransportFact & { readonly record: ScanCursor }) | undefined {
  return all.filter((v): v is TransportFact & { readonly record: ScanCursor } => v.record.type === 'ScanCursor' && v.record.scan === scan).at(-1);
}
function completedScanRound(all: readonly TransportFact[], scan: string): boolean {
  let orderedKeysDigest: string | undefined;
  let keyCount: number | undefined;
  let completed = false;
  for (const { record } of all) {
    if (record.type !== 'ScanCursor' || record.scan !== scan) continue;
    if (record.orderedKeysDigest !== orderedKeysDigest || record.keyCount !== keyCount) {
      orderedKeysDigest = record.orderedKeysDigest;
      keyCount = record.keyCount;
      completed = record.keyCount === 0;
    }
    // A zero-work page does not undo a completed round for the same key
    // identity. Positive work either completes at zero or starts/leaves a new
    // unfinished round, so its durable cursor replaces the accumulated state.
    if (record.selectedCount > 0) completed = record.wrapped === 1 && record.nextIndex === 0;
  }
  return completed;
}
export function validateScanGeneration(all: readonly TransportFact[], scan: string, generation: string,
  orderedKeysDigest: string, keyCount: number): void {
  const prior = latestScanCursor(all, scan);
  const original = all.find((v): v is TransportFact & { readonly record: ScanCursor } =>
    v.record.type === 'ScanCursor' && v.record.scan === scan && v.record.generation === generation);
  if (original) ensure(original.record.orderedKeysDigest === orderedKeysDigest && original.record.keyCount === keyCount,
    'scan generation changed its original ordered keys');
  if (!prior || prior.record.generation === generation) return;
  ensure(!original, 'scan generation cannot resume after supersession');
  const sameKeys = prior.record.orderedKeysDigest === orderedKeysDigest && prior.record.keyCount === keyCount;
  ensure(sameKeys || completedScanRound(all, scan),
    'scan generation change is unsupported while key remainder is unfinished');
}
export function fenceFor(all: readonly TransportFact[], lease: Lease): FenceToken {
  const assignment = all.find(v => v.record.type === 'Lease' && v.record.epoch === lease.epoch);
  ensure(assignment, 'missing committed assignment');
  return freeze({ type: 'FenceToken', schemaVersion: 1, domain: lease.domain, epoch: lease.epoch,
    assignment: assignment.fact.id, holder: lease.holder, machine: lease.machine,
    incarnation: lease.incarnation, authority: lease.authority, generation: lease.generation } as FenceToken);
}
export function checkFence(all: readonly TransportFact[], token: FenceToken, host: TransportHost, tick: number): Lease {
  shapeCheck(token, fence);
  const lease = latestLease(all)?.record;
  ensure(lease && lease.state === 'held' && lease.expires > tick, 'lease absent, released or expired');
  ensure(lease.authority === host.authorityIncarnation, 'restored timer is not current authority');
  ensure(lease.holder === host.principal.id && lease.machine === host.machine && lease.incarnation === host.incarnation,
    'fence principal or process incarnation mismatch');
  ensure(encoded(token).bytes === encoded(fenceFor(all, lease)).bytes, 'stale or uncommitted fence');
  ensure(lease.generation === host.current().generation.id, 'register generation moved');
  return lease;
}
export function live(host: TransportHost): void {
  const current = host.current();
  ensure(!current.stopped, 'stop prohibits new admission');
  ensure(current.generation.owner === 'part-three' && current.generation.name === 'RegisterGeneration'
    && current.generation.id === current.decode.register.generation.id, 'current generation mismatch');
  const principal = take(decode('VerifiedPrincipal', host.principal, { ...current.decode, provenance: host.principal.provenance }));
  const scope = take(decode('Scope', host.scope, current.decode));
  const now = take(decodeMeasurement('clock', current.clock, current.decode));
  const grants = (current.decode.grants ?? []).map(g => take(decode('StandingGrant', g, { ...current.decode, provenance: g.source })));
  ensure(grants.some(g => g.grantee.id === principal.id && grantLiveness(g, current.decode.revocations ?? [], now) === 'live'
    && scopeIncludes(g.scope, scope) && (g.standing === 'operator' || g.actions.includes('work'))), 'current standing does not cover transport admission');
}

export function checkPairParent(all: readonly TransportFact[], facts: readonly FactEnvelope[]): void {
  const pair = all.find(p => p.record.type === 'RunPairAdmission')?.record as RunPairAdmission | undefined;
  if (!pair) return;
  ensure(latestLoop(all, pair.provider)?.state !== 'stopped', 'parent stop inhibits dependent reply');
  ensure(!reservations(all).some(p => p.run === pair.provider && all.some(v => v.record.type === 'SettlementApplication'
    && v.record.operation === p.operation && v.record.capViolation === 1)), 'parent cap violation inhibits dependent reply');
  const head = facts.filter(f => ['run-opening', 'run-transition'].includes(f.kind)
    && (f.body as { run?: string }).run === pair.provider).at(-1);
  const wire = head && (head.body as { record: { id: string; to?: string } }).record;
  const replyHead = facts.filter(f => ['run-opening', 'run-transition'].includes(f.kind)
    && (f.body as { run?: string }).run === pair.reply).at(-1);
  const replyWire = replyHead && (replyHead.body as { record: { to?: string } }).record;
  ensure(replyWire && !['halted', 'cancelled', 'completed', 'unreachable'].includes(replyWire.to ?? ''),
    'reply Run stopped or terminal');
  ensure(wire?.id === pair.originalPredecessor && !['halted', 'cancelled', 'completed', 'unreachable'].includes(wire.to ?? ''),
    'parent predecessor changed or stopped');
}

// The owner validator runs INSIDE P2's append boundary, after signed-chain checks and
// before its compare-head durable append. A caller bypassing the authority API cannot
// rebase a stale transition on a newer envelope head.
export function validateTransition(r: TransportRecord, all: readonly TransportFact[], host: TransportHost, origin = false, facts: readonly FactEnvelope[] = []): void {
  ensure(r.domain === host.domain && r.schemaVersion === 1 && r.command.length > 0 && r.tick >= 0, 'record domain or identity');
  ensure(r.predecessor === (all.at(-1)?.fact.id ?? ''), 'conditional predecessor changed');
  ensure(!all.some(v => v.record.command === r.command), 'command already committed');
  const previous = latestLease(all)?.record;
  const active = () => {
    ensure(previous, 'lease required');
    ensure(previous.state === 'held' && previous.authority === r.authority && previous.expires > r.tick, 'stale lease at boundary');
    return previous;
  };
  if (r.type === 'Lease') {
    ensure(r.epoch >= 1 && r.holder === host.principal.id && r.machine === host.machine && r.incarnation.length > 0 && r.generation.length > 0, 'lease binding');
    ensure(r.state === 'held' || r.state === 'released', 'lease state');
    ensure(['acquire', 'renew', 'release', 'write'].includes(r.operation)
      && ((r.operation === 'acquire' || r.operation === 'renew') ? r.term > 0 && r.expires === r.tick + r.term : r.term === 0), 'lease command binding');
    if (!previous || r.epoch !== previous.epoch) {
      ensure(r.state === 'held' && r.operation === 'acquire' && r.epoch === (previous?.epoch ?? 0) + 1, 'epoch must extend committed maximum');
      ensure(!previous || previous.state === 'released' || previous.authority !== r.authority || previous.expires <= r.tick, 'lease is still held');
    } else {
      const p = active();
      ensure(r.operation !== 'acquire' && (r.state === 'released') === (r.operation === 'release'), 'lease transition command');
      if (r.operation !== 'renew') ensure(r.expires === p.expires, 'write/release changed term');
      ensure(r.holder === p.holder && r.machine === p.machine && r.incarnation === p.incarnation && r.generation === p.generation, 'renew/release changed owner');
    }
    ensure(r.expires > r.tick && r.expires - r.tick <= host.maxLeaseTerm, 'lease term outside finite bound');
  } else if (r.type === 'ScanCursor') {
    ensure(r.scan.length > 0 && r.generation.length > 0 && /^sha256:[a-f0-9]{64}$/.test(r.orderedKeysDigest), 'scan cursor identity');
    ensure(r.keyCount >= 0 && r.selectedFrom >= 0 && r.selectedCount >= 0 && r.nextIndex >= 0
      && r.maxItems >= 0 && r.maxDuration >= 0 && r.elapsed >= 0, 'scan cursor bounds');
    ensure(r.selectedCount <= r.maxItems && r.selectedCount <= r.keyCount && r.elapsed <= r.maxDuration,
      'scan cursor exceeded page bound');
    ensure(r.maxDuration !== 0 || r.selectedCount === 0, 'zero-duration scan cannot select work');
    ensure(r.wrapped === 0 || r.wrapped === 1, 'scan cursor wrap marker');
    const prior = latestScanCursor(all, r.scan);
    ensure(r.previous === (prior?.fact.id ?? ''), 'scan cursor is absent or stale');
    ensure(r.selectedFrom === (prior?.record.nextIndex ?? 0), 'scan cursor progress reset or skipped');
    ensure(r.keyCount === 0 ? r.selectedFrom === 0 && r.nextIndex === 0 && r.selectedCount === 0 && r.wrapped === 0
      : r.selectedFrom < r.keyCount && r.nextIndex === (r.selectedFrom + r.selectedCount) % r.keyCount
        && r.wrapped === (r.selectedCount > 0 && r.selectedFrom + r.selectedCount >= r.keyCount ? 1 : 0),
    'scan cursor progression changed');
    validateScanGeneration(all, r.scan, r.generation, r.orderedKeysDigest, r.keyCount);
  } else {
    const lease = active();
    const pair = all.find(p => p.record.type === 'RunPairAdmission')?.record as RunPairAdmission | undefined;
    if (r.type === 'RunPairAdmission') {
      ensure(!pair && r.profile === 'provider-reply-v1' && r.provider !== r.reply
        && r.budget >= 0 && (!origin || r.budget === host.budget), 'fixed pair profile already admitted or bounds differ');
      policyCheck(r.replyPolicy);
      const joined = acceptedReplyOpening(facts, r.reply);
      const parentHead = facts.filter(f => ['run-opening', 'run-transition'].includes(f.kind)
        && (f.body as { run?: string }).run === r.provider).at(-1);
      ensure(parentHead && (parentHead.body as { record: { id: string } }).record.id === r.originalPredecessor,
        'pair original predecessor changed');
      ensure(encoded(joined).bytes === encoded({ opening: r.opening, acceptance: r.acceptance, provider: r.provider,
        reply: r.reply, predecessor: r.originalPredecessor, obligation: r.obligation, operation: r.operation,
        answerDigest: r.answerDigest, conversation: r.conversation }).bytes, 'pair differs from Five accepted opening');
      const obligation = all.find(p => p.fact.id === r.obligation);
      const parent = latestLoop(all, r.provider);
      ensure(obligation?.record.type === 'LoopRecord' && obligation.record.run === r.provider
        && parent && parent.state !== 'stopped', 'pair requires original same-domain live obligation');
      ensure(all.filter(p => p.record.type === 'LoopRecord').every(p => (p.record as LoopRecord).run === r.provider),
        'pair requires singleton provider history');
      const operation = reservations(all).find(p => p.operation === r.operation);
      ensure(operation?.run === r.provider && operation.state === 'consumed', 'pair provider operation not consumed');
      ensure(!reservations(all).some(op => op.run === r.provider && all.some(p => p.record.type === 'SettlementApplication'
        && p.record.operation === op.operation && p.record.capViolation === 1)), 'parent cap violation inhibits dependent reply');
      ensure(!facts.some(f => f.kind === 'transport-RunPairAdmission'
        && (f.body as unknown as { record: RunPairAdmission }).record.reply === r.reply), 'reply already admitted in another domain');
      if (origin) requireRunPairAdmission(host, r);
    } else if (r.type === 'AdmissionReservation') {
      const opening = facts.find(f => f.kind === 'run-opening' && (f.body as { run?: string }).run === r.run);
      const cause = opening && (opening.body as { record: { opening: { id: string } } }).record.opening.id;
      ensure(!facts.some(f => f.id === cause && f.kind === 'judgment-provider-ProviderAnswerAcceptance') || pair?.reply === r.run,
        'accepted reply requires same-domain pair admission');
      if (pair && r.state !== 'closed') {
        checkPairParent(all, facts);
        ensure(![pair.provider, pair.reply].some(run => { const loop = latestLoop(all, run);
          return loop && loopActive(all, loop); }), 'pair recovery observation already active');
        ensure(r.run === pair.provider || r.run === pair.reply, 'fixed pair permits no other Run');
        if (r.run === pair.provider) ensure(reservations(all).some(p => p.operation === r.operation),
          'fixed pair permits no further provider operation');
        if (r.run === pair.reply) {
          ensure(!reservations(all).some(p => p.run === pair.reply && p.operation !== r.operation),
            'accepted reply permits one outbound operation only');
          const requestFact = facts.find(f => f.kind === 'effect-EffectRequest'
            && (f.body as { record: { id: string } }).record.id === r.request);
          const request = requestFact && (requestFact.body as { record: Record<string, unknown> }).record;
          const messageFact = facts.find(f => f.kind === 'effect-OutboundMessage'
            && (f.body as { record: { id: string } }).record.id === request?.message);
          const message = messageFact && (messageFact.body as { record: Record<string, unknown> }).record;
          ensure(request && message && request.run === r.run && request.digest === r.digest && request.attempt === r.attempt
            && message.run === r.run && message.purpose === 'ordinary-reply' && message.sourceResult === pair.acceptance
            && typeof message.text === 'string' && (hashBytes(message.text) === pair.answerDigest
              || (() => { try { return message.text === acceptedReplyPreviewText(facts, pair.reply); } catch { return false; } })())
            && encoded(message).hash === r.digest && message.semanticMessage === r.semanticMessage,
          'reply reservation requires exact accepted-answer outbound request; no model operation');
        }
      }

      // A conditional close exists BECAUSE the reserving fence is gone; it keeps
      // the immutable original fence and is still written under the live lease.
      ensure(r.state === 'closed' || encoded(r.fence).bytes === encoded(fenceFor(all, lease)).bytes, 'stale fence at durable boundary');
      ensure(r.charge >= 0 && r.request.length > 0 && r.attempt.length > 0 && /^sha256:[a-f0-9]{64}$/.test(r.digest), 'reservation identity or demand');
      ensure(r.operation === `operation:${encoded([r.domain, r.request, r.attempt]).hash}`, 'operation mapping must be injective');
      ensure(r.deliveryAttempt === `delivery:${encoded([r.operation, r.semanticMessage]).hash}`, 'delivery attempt identity changed');
      ensure((r.durability === 'local-durable' && r.replicas === 0) || (r.durability === 'replicated' && r.replicas > 0), 'effect durability requirement');
      const prior = reservations(all).find(p => p.operation === r.operation);
      if (!prior) {
        ensure(r.state === 'prepared' && r.executor === '', 'reservation must precede claim');
        // Inhibition is sticky until an owned governed reconciliation exists.
        // Different request/attempt/semantic keys cannot erase a same-run breach.
        ensure(!reservations(all).some(p => p.run === r.run && all.some(v => v.record.type === 'SettlementApplication'
          && v.record.operation === p.operation && v.record.capViolation === 1)), 'cap violation inhibits affected admission');
        // A closed operation is proven never dispatch-claimed: zero exposure and
        // resolved. Every other state still needs qualified accounting evidence.
        const states = new Map(reservations(all).map(p => [p.operation, p.state === 'closed' ? { exposure: 0, unresolved: 0 }
          : origin ? admissionAccounting(all, p, host)
          : latestApplication(all, p.operation) ?? { exposure: p.charge, unresolved: 1 }]));
        ensure(!reservations(all).some(p => p.request === r.request || p.semanticMessage === r.semanticMessage
          || p.run === r.run && states.get(p.operation)!.unresolved !== 0), 'unresolved execution or charge prohibits a new attempt; unproven accounting durability is unresolved');
        ensure(reservations(all).reduce((n, p) => n + states.get(p.operation)!.exposure, r.charge) <= Math.min(host.budget, pair?.budget ?? host.budget), 'spend bound exhausted');
        const loop = latestLoop(all, r.run); ensure(loop && loop.state !== 'stopped', 'durable recovery wake required before reservation');
      } else {
        const immutable = (v: AdmissionReservation) => ({ ...v, command: '', predecessor: '', tick: 0, authority: '', state: '', executor: '' });
        ensure(encoded(immutable(r)).bytes === encoded(immutable(prior)).bytes, 'immutable operation mapping changed');
        if (r.state === 'closed') {
          // Proof, not assumption: no row for this operation ever left 'prepared'
          // anywhere in the committed prefix. A close is terminal and unexecuted.
          ensure(prior.state === 'prepared' && !all.some(v => v.record.type === 'AdmissionReservation'
            && v.record.operation === r.operation && v.record.state !== 'prepared'), 'close requires proof no dispatch-claim exists');
          ensure(r.executor === '', 'a closed operation has no executor');
        } else {
          ensure((prior.state === 'prepared' && r.state === 'dispatch-claimed') || (prior.state === 'dispatch-claimed' && r.state === 'consumed'), 'claim is one-use');
          ensure(r.executor === lease.incarnation && (prior.executor === '' || prior.executor === r.executor), 'executor binding mismatch');
        }
      }
    } else if (r.type === 'LoopRecord') {
      policyCheck(r.policy);
      ensure(r.run.length > 0 && r.episode === `loop:${encoded([r.domain, r.run]).hash}`, 'stable loop episode');
      ensure(['scheduled', 'running', 'restoring', 'waiting', 'stopped'].includes(r.state) && r.attempts >= 0 && r.attempts <= r.policy.maxAttempts, 'loop state or count');
      const prior = latestLoop(all, r.run);
      if (!prior) {
        ensure(!all.some(p => p.record.type === 'LoopRecord') || pair?.reply === r.run,
          'slice supports one run only');
        const opening = facts.find(f => f.kind === 'run-opening' && (f.body as { run?: string }).run === r.run);
        const cause = opening && (opening.body as { record: { opening: { id: string } } }).record.opening.id;
        ensure(!facts.some(f => f.id === cause && f.kind === 'judgment-provider-ProviderAnswerAcceptance') || pair?.reply === r.run,
          'accepted reply requires same-domain pair admission');
        if (pair) { checkPairParent(all, facts); ensure(r.run === pair.reply, 'fixed pair permits no third Run');
          ensure(encoded(r.policy).bytes === encoded(pair.replyPolicy).bytes, 'reply policy differs from durable pair admission'); }
        ensure(r.attempts === 0 && r.started === r.tick && r.pending === '' && r.state === 'scheduled', 'initial loop');
      }
      else {
        if (pair) {
          if (r.run === pair.reply) checkPairParent(all, facts);
          ensure(![pair.provider, pair.reply].some(run => { const loop = latestLoop(all, run);
            return loop && loopActive(all, loop); }), 'pair recovery observation already active');
        }
        ensure(prior.state !== 'stopped', 'stopped is terminal, not closed or restartable');
        ensure(!loopActive(all, prior), 'observation already active; durable completion required');
        ensure(encoded(r.policy).bytes === encoded(prior.policy).bytes && r.started === prior.started && r.episode === prior.episode, 'loop bounds cannot reset');
        const admission = observationAdmission(prior, r.tick, r.authority);
        ensure(r.attempts === prior.attempts + (admission === 'none' ? 0 : 1), 'loop attempts cannot reset or skip');
        ensure(r.authority !== prior.authority || r.tick >= prior.nextWake, 'wake not due');
        ensure(admission === 'none' ? r.state === 'stopped' : admission === 'restored' ? r.state === 'restoring'
          : r.state === 'running' || r.state === 'waiting', 'loop duration/attempt admission mismatch');
      }
      ensure(r.nextWake >= r.tick + r.policy.minDelay, 'minimum wake delay');
    } else if (r.type === 'SettlementApplication') {
      const op = reservations(all).find(p => p.operation === r.operation);
      ensure(op && (op.state === 'dispatch-claimed' || op.state === 'consumed'), 'application requires dispatched reservation');
      ensure(!all.some(v => v.record.type === 'SettlementApplication' && v.record.settlement === r.settlement), 'settlement already applied');
      const prior = latestApplication(all, r.operation);
      ensure(!prior || prior.actualCharge === -1 || prior.actualCharge === r.actualCharge, 'settled charge changed');
      ensure(!prior || prior.unresolved === 1 || r.unresolved === 0, 'resolved accounting cannot regress');
      ensure(r.actualCharge >= -1 && r.exposure >= 0 && r.released >= 0 && [0, 1].includes(r.unresolved)
        && [0, 1].includes(r.capViolation) && r.retryEligible === 0, 'invalid application accounting');
    } else {
      const op = reservations(all).find(v => v.operation === r.operation);
      ensure(op && op.state !== 'prepared', 'recovery must name an unresolved claim');
      const loop = latestLoop(all, op.run);
      ensure(loop && loop.pending === op.operation && r.episode === loop.episode, 'owned recovery episode required');
      ensure(loop.command === `${r.command}:wake`, 'result must complete its exact active wake');
      ensure((r.disposition === 'waiting' && ['running', 'waiting'].includes(loop.state))
        || (r.disposition === 'stopped-at-bound' && ['restoring', 'stopped'].includes(loop.state)), 'recovery disposition is not effect settlement');
      if (loop.state === 'stopped') ensure(r.observation === '', 'stopped admission cannot start an observation');
    }
  }
}
export function registerTransportBodies<S = never>(host: TransportHost, c: BoundaryContext, settlementConsumer?: SettlementConsumer<S>): Result<readonly OwnedBodyRegistration[]> {
  return boundary('TransportRegistrations', null, c, () => {
    const registrations = Object.entries({ ...transportShapes, RunPairAdmission: runPairAdmissionShape }).map(([name, shape]) => take(registerOwnedBody({
    name, owner: 'part-six', currentVersion: 1, versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: (input, ctx) => {
      try {
        shapeCheck(input, shape);
        const v = input as unknown as TransportRecord;
        ensure((input as { type: string }).type === name && v.schemaVersion === 1, 'owned type mismatch');
        if (name === 'LoopPolicy') policyCheck(input as unknown as LoopPolicy);
        else if (name === 'FenceToken') {
          const past = rows(causalCone(ctx.origin, ctx.facts.facts), host.domain), lease = latestLease(past)?.record;
          ensure(lease && encoded(input).bytes === encoded(fenceFor(past, lease)).bytes, 'fence lacks committed assignment');
          if (ctx.mode === 'origin') { live(host); checkFence(past, input as unknown as FenceToken, host, host.monotonic()); }
        }
        else if (recordNames.includes(name)) {
          // The independently configured one-voter identity is invariant across
          // origin, replication and replay. Process incarnations may change;
          // a different signed actor/machine cannot speak for this authority.
          ensure(ctx.origin.machine === host.machine && ctx.origin.principal.id === host.principal.id
            && ctx.origin.principal.kind === host.principal.kind, 'issuer is not this authority');
          const past = rows(causalCone(ctx.origin, ctx.facts.facts), host.domain);
          ensure(past.every(({ fact }) => fact.machine === host.machine && fact.principal.id === host.principal.id
            && fact.principal.kind === host.principal.kind), 'predecessor issuer is not this authority');
          // P2 also live-decodes preserved facts for projection reconstruction.
          // Such a fact is already in its verified input set; it is NOT a new
          // append. Only a new origin candidate may perform current custody I/O.
          // Raw P2 origin append still lacks this fact and therefore checks R1.
          const candidate = !ctx.facts.facts.some(f => f.id === ctx.origin.id);
          // Any NEW six candidate, origin or replicated, invalidates an in-memory
          // prepared prefix. Historical/projection reads are pure and do not.
          // Even a subsequently refused candidate conservatively invalidates it.
          if (candidate) noteAccountingCandidate(host);
          const admitting = ctx.mode === 'origin' && candidate;
          validateTransition(v, past, host, admitting, causalCone(ctx.origin, ctx.facts.facts));
          if (v.type === 'SettlementApplication') {
            checkApplicationEvidence(v, causalCone(ctx.origin, ctx.facts.facts), past, ctx.facts);
            if (ctx.mode === 'origin') requireApplication(host, v, settlementConsumer);
          }
          if (ctx.mode === 'origin') {
            live(host);
            const now = host.monotonic();
            ensure(v.authority === host.authorityIncarnation && v.tick <= now
              && !past.some(p => p.record.authority === v.authority && p.record.tick > v.tick), 'untrusted authority clock or incarnation');
            ensure(v.predecessor === (rows(ctx.facts.facts, host.domain).at(-1)?.fact.id ?? ''), 'stale origin predecessor');
            if (v.type !== 'ScanCursor') {
              const lease = latestLease(past)?.record;
              if (v.type !== 'Lease' || v.epoch === lease?.epoch) {
                ensure(lease?.incarnation === host.incarnation && lease.authority === host.authorityIncarnation && lease.expires > now
                  && lease.generation === host.current().generation.id, 'stale owner at durable boundary');
              } else ensure(v.incarnation === host.incarnation && v.expires > now
                && v.generation === host.current().generation.id, 'acquisition incarnation or expiration');
            }
          }
        }
        return { ok: true, value: freeze(input) };
      } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'transport record refused' }; }
    },
    }, shape, c)));
    bindSettlementConsumer(host, settlementConsumer); return registrations;
  });
}

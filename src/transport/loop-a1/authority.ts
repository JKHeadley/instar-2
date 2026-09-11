import { decodeMeasurement } from '../../index.js';
import type { BoundaryContext, Clock, Result } from '../../index.js';
import { authorAndAppend } from '../../facts/index.js';
import type { FactStorePort } from '../../facts/index.js';
import type { FactAuthor, FenceToken, TransportFact } from '../contracts.js';
import { createTransportAuthority, createTransportSpine } from '../authority.js';
import { boundary, encoded, ensure, freeze, json, take } from '../boundary.js';
import { latestLease, live } from '../records.js';
import type {
  LoopA1Authority,
  LoopA1Host,
  LoopA1Spine,
  LoopA1TransportFact,
  LoopOutcome,
  SharedLoopRecord,
} from './contracts.js';
import {
  atOrAfter,
  checkLoopA1Fence,
  failureCountAt,
  latestSharedLoopByParent,
  registerLoopA1Bodies,
  resolvePolicyFact,
  resolvePressureBinding,
  resolveRunReference,
  restorationReferenceComplete,
  rowsA1,
  sameClock,
  sharedAdmissionDecision,
  sharedLoopEvidence,
  sharedOutcomeDecision,
  shifted,
  windowAt,
  withSharedLoopCandidate,
} from './records.js';
import {
  rejectTransitionExtensions,
  rejectRequestExtensions,
  requireOpaqueSourceReference,
  sharedLoopRecordFactKind,
  sharedPolicyCheck,
  storeSharedLoopRecord,
} from './shapes.js';

export function createLoopA1Spine(host: LoopA1Host, author: FactAuthor, store: FactStorePort): LoopA1Spine {
  const legacy = createTransportSpine(host, author, store);
  return Object.freeze({
    store,
    context: author.context,
    legacy,
    append: (record: SharedLoopRecord, required: readonly string[]) => authorAndAppend({
      kind: sharedLoopRecordFactKind,
      schemaVersion: 1,
      machine: host.machine,
      principal: json(host.principal),
      provenance: json(host.principal.provenance),
      at: json(host.current().clock),
      body: json({ record: storeSharedLoopRecord(record) }),
      required,
    }, author.context, store, author.privateKey),
  });
}

function closedInput(input: unknown, allowed: readonly string[], detail: string): asserts input is Record<string, unknown> {
  ensure(input !== null && typeof input === 'object' && !Array.isArray(input), detail);
  const keys = Object.keys(input);
  ensure(keys.length === allowed.length && keys.every(key => allowed.includes(key))
    && allowed.every(key => Object.hasOwn(input, key)), detail);
}

export function createLoopA1Authority<S = never>(host: LoopA1Host, spine: LoopA1Spine,
  context: BoundaryContext): LoopA1Authority<S> {
  const legacy = createTransportAuthority<S>(host, spine.legacy, context);
  let lastTick = -1;
  const tick = () => {
    const value = host.monotonic();
    ensure(Number.isSafeInteger(value) && value >= lastTick && value >= 0, 'monotonic clock regressed');
    lastTick = value;
    return value;
  };
  const evidenceFacts = () => {
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(entry => !entry.taint.length && !entry.conflicts.length),
      'tainted or conflicted fact prefix');
    return [...new Map([...spine.context.facts, ...snapshot.entries.map(entry => entry.fact)]
      .map(fact => [fact.id, fact])).values()];
  };
  const read = (): readonly LoopA1TransportFact[] => {
    const all = rowsA1(evidenceFacts(), host.domain);
    ensure(all.length <= 4096, 'single-conversation replay bound exhausted');
    return all;
  };
  const checked = <T>(name: string, input: unknown, run: () => T): Result<T> =>
    boundary(name, input, context, () => {
      ensure(Number.isSafeInteger(host.budget) && host.budget >= 0
        && Number.isSafeInteger(host.maxLeaseTerm) && host.maxLeaseTerm > 0, 'invalid host bounds');
      live(host);
      return run();
    });
  const meta = (all: readonly LoopA1TransportFact[], command: string) => ({
    schemaVersion: 1 as const,
    domain: host.domain,
    command,
    predecessor: all.at(-1)?.fact.id ?? '',
    authority: host.authorityIncarnation,
    tick: tick(),
  });
  const clock = (): Clock => {
    ensure(host.loopClock?.owner === 'part-ten', 'shared loop clock unavailable');
    const value = take(decodeMeasurement('clock', host.loopClock.now(), host.current().decode));
    ensure(Number.isSafeInteger(value.value), 'shared loop clock is not finite');
    return value;
  };
  const outcomeDigest = (policy: SharedLoopRecord['policy'], outcomes: readonly LoopOutcome[], now: Clock) =>
    encoded(windowAt({ policy, outcomeLog: outcomes }, now)).hash;
  const withoutSubmission = (record: SharedLoopRecord): SharedLoopRecord => {
    const { stoppedSubmission: _stopped, closureSubmission: _closure,
      evidenceSubmission: _evidence, ...rest } = record;
    return rest as SharedLoopRecord;
  };
  const fence = (all: readonly LoopA1TransportFact[], token: FenceToken) =>
    checkLoopA1Fence(all, token, host, tick());
  const managedWrite = (all: readonly LoopA1TransportFact[], record: SharedLoopRecord): SharedLoopRecord => {
    const dependencies = sharedLoopEvidence(record, evidenceFacts(), spine.context, host);
    const required = [...new Set([record.predecessor, ...dependencies.map(fact => fact.id)].filter(Boolean))];
    return withSharedLoopCandidate(host, record, () => {
      const receipt = take(spine.append(record, required));
      ensure(!receipt.taint.length, 'append was provisional or contested');
      ensure(receipt.fact.kind === sharedLoopRecordFactKind
        && encoded(receipt.fact.body).bytes === encoded({ record: storeSharedLoopRecord(record) }).bytes,
      'append returned different shared loop record');
      return freeze(record);
    });
  };
  const sharedByEpisode = (all: readonly LoopA1TransportFact[], episode: string): SharedLoopRecord => {
    const record = all.filter(row => row.record.type === 'LoopRecord'
      && 'policy' in row.record && row.record.policy.breaker === 'shared-circuit-v1'
      && row.record.episode === episode).at(-1)?.record as SharedLoopRecord | undefined;
    ensure(record?.policy.breaker === 'shared-circuit-v1', 'shared loop episode unavailable');
    const current = latestSharedLoopByParent(all, record.run);
    ensure(current?.command === record.command, 'shared pressure moved to another episode');
    return record;
  };

  const api: LoopA1Authority<S> = {
    legacy,
    inspect: () => boundary('LoopA1Inspect', null, context, read),
    acquire: legacy.acquire,
    renew: legacy.renew,
    release: legacy.release,
    admitWrite: legacy.admitWrite,
    schedule: legacy.schedule,
    reserve: legacy.reserve,
    claim: legacy.claim,
    consume: legacy.consume,
    recover: legacy.recover,
    close: legacy.close,
    settle: legacy.settle,
    scheduleEpisode: input => checked('SharedLoopScheduleA1', input, () => {
      rejectRequestExtensions(input);
      closedInput(input, ['command', 'fence', 'currentOwnerRun', 'policy', 'episodeKey',
        'operationFamily', 'pressureScope', 'sourceVector'], 'closed A1 schedule input required');
      requireOpaqueSourceReference(input.sourceVector);
      const all = read();
      fence(all, input.fence);
      sharedPolicyCheck(input.policy);
      ensure(input.currentOwnerRun.owner === 'part-five' && input.currentOwnerRun.name === 'Run'
        && input.currentOwnerRun.id.length > 0, 'current owner Run reference required');
      ensure(input.episodeKey.length > 0 && input.episodeKey.length <= 256
        && input.operationFamily.length > 0 && input.operationFamily.length <= 256
        && Object.values(input.pressureScope).every(value => value.length > 0 && value.length <= 256),
      'bounded shared pressure input required');
      const now = clock();
      const current = host.current();
      ensure(current.generation.id === current.decode.register.generation.id, 'current generation mismatch');
      const history = evidenceFacts();
      resolvePolicyFact(input.policy, current.generation.id, history, spine.context);
      resolveRunReference(input.currentOwnerRun, history, spine.context);
      ensure(host.loopScopeBinding?.owner === 'part-three', 'governed loop pressure binding unavailable');
      const binding = take(host.loopScopeBinding.resolve({
        parentDuty: input.currentOwnerRun,
        operationFamily: input.operationFamily,
        pressureScope: input.pressureScope,
      }));
      ensure(binding.operationFamily.length > 0
        && Object.values(binding.pressureScope).every(value => value.length > 0),
      'governed pressure binding is incomplete');
      const pressureKey = `pressure:${encoded([binding.operationFamily, binding.pressureScope]).hash}`;
      const bindingRecord = {
        currentOwnerRun: input.currentOwnerRun,
        operationFamily: binding.operationFamily,
        pressureScope: binding.pressureScope,
        pressureKey,
        pressureBinding: binding.witness,
      };
      resolvePressureBinding(bindingRecord, history, spine.context, host);
      const parent = latestSharedLoopByParent(all, input.currentOwnerRun.id);
      if (parent) {
        ensure(encoded(parent.policy).bytes === encoded(input.policy).bytes,
          'conflicting shared pressure policy or parent');
        ensure(parent.pressureKey === pressureKey && parent.episodeKey === input.episodeKey,
          'unsupported-in-slice-a1');
        ensure(encoded(parent.operationFamily).bytes === encoded(binding.operationFamily).bytes
          && encoded(parent.pressureScope).bytes === encoded(binding.pressureScope).bytes
          && encoded(parent.pressureBinding).bytes === encoded(binding.witness).bytes,
        'conflicting shared pressure policy or parent');
        ensure(encoded(parent.sourceVector).bytes === encoded(input.sourceVector).bytes,
          'unsupported-in-slice-a1');
        ensure(parent.clockBasis === now.subject.instance, 'incomparable shared pressure time');
        return parent;
      }
      const episode = `loop:${encoded([pressureKey, input.episodeKey]).hash}`;
      ensure(!all.some(row => row.record.type === 'LoopRecord'
        && 'episode' in row.record && row.record.episode === episode), 'episode identity already used');
      const attemptLog = [] as const;
      const outcomeLog = [] as const;
      const firstEligible = shifted(now, input.policy.initialDelay);
      const m = meta(all, input.command);
      const record = freeze({
        ...m,
        type: 'LoopRecord',
        run: input.currentOwnerRun.id,
        episode,
        policy: input.policy,
        attempts: 0,
        started: now.value,
        nextWake: firstEligible.value,
        state: 'scheduled',
        pending: '',
        currentOwnerRun: input.currentOwnerRun,
        policyGeneration: current.generation,
        pressureBinding: binding.witness,
        operationFamily: binding.operationFamily,
        pressureScope: binding.pressureScope,
        pressureKey,
        episodeKey: input.episodeKey,
        transition: 'scheduled',
        transitionAt: now,
        nextEligible: firstEligible,
        clockBasis: now.subject.instance,
        sourceVector: input.sourceVector,
        totalFailures: 0,
        failureCount: 0,
        breakerHasOpened: 0,
        breakerOpenCount: 0,
        breakerFirstOpened: now,
        halfOpenAdmitted: 0,
        halfOpenSucceeded: 0,
        pendingAttempts: [],
        attemptLog,
        outcomeLog,
        outcomeWindowDigest: outcomeDigest(input.policy, outcomeLog, now),
        closureEvidence: [],
      } as unknown as SharedLoopRecord);
      return managedWrite(all, record);
    }),
    admitLoopAttempt: input => checked('SharedLoopAttemptAdmissionA1', input, () => {
      rejectTransitionExtensions(input);
      closedInput(input, ['command', 'fence', 'episode', 'attempt'], 'closed A1 attempt input required');
      const all = read();
      fence(all, input.fence);
      ensure(input.episode.owner === 'part-six' && input.episode.name === 'LoopRecord'
        && input.episode.id.length > 0, 'LoopRecord reference owner');
      ensure(input.attempt.length > 0 && input.attempt.length <= 256, 'bounded loop attempt input required');
      const previous = sharedByEpisode(all, input.episode.id);
      const now = clock();
      const current = host.current();
      const history = evidenceFacts();
      ensure(previous.clockBasis === now.subject.instance && sameClock(previous.transitionAt, now)
        && atOrAfter(now, previous.transitionAt), 'incomparable or backward shared pressure time');
      resolvePolicyFact(previous.policy, current.generation.id, history, spine.context);
      resolveRunReference(previous.currentOwnerRun, history, spine.context);
      if (previous.stoppedSubmission
        && encoded(previous.stoppedSubmission).bytes === encoded(input).bytes) return previous;
      const existing = previous.attemptLog.find(attempt => attempt.id === input.attempt);
      if (existing) return previous;
      const decision = sharedAdmissionDecision(previous, now,
        { id: input.attempt, episode: previous.episode, admittedAt: now });
      if (decision.kind === 'stopped') {
        const currentOutcomes = windowAt(previous, now);
        const stopped = freeze({
          ...withoutSubmission(previous),
          ...meta(all, input.command),
          nextWake: now.value,
          state: 'stopped',
          pending: '',
          transition: 'stopped',
          transitionAt: now,
          nextEligible: now,
          sourceVector: previous.sourceVector,
          policyGeneration: current.generation,
          failureCount: failureCountAt(previous.policy, currentOutcomes),
          outcomeWindowDigest: outcomeDigest(previous.policy, previous.outcomeLog, now),
          stoppedSubmission: freeze({ ...input }),
        } as SharedLoopRecord);
        return managedWrite(all, stopped);
      }
      const attemptLog = [...previous.attemptLog, decision.attempt];
      const pendingAttempts = [...previous.pendingAttempts, input.attempt];
      const currentOutcomes = windowAt(previous, now);
      const record = freeze({
        ...withoutSubmission(previous),
        ...meta(all, input.command),
        attempts: attemptLog.length,
        nextWake: now.value,
        state: decision.state,
        pending: pendingAttempts[0]!,
        transition: decision.transition,
        transitionAt: now,
        nextEligible: now,
        sourceVector: previous.sourceVector,
        policyGeneration: current.generation,
        failureCount: failureCountAt(previous.policy, currentOutcomes),
        outcomeWindowDigest: outcomeDigest(previous.policy, previous.outcomeLog, now),
        breakerHasOpened: decision.breakerHasOpened,
        breakerFirstOpened: decision.breakerFirstOpened,
        halfOpenAdmitted: decision.halfOpenAdmitted,
        halfOpenSucceeded: decision.halfOpenSucceeded,
        pendingAttempts,
        attemptLog,
        closureEvidence: decision.closureEvidence,
      } as SharedLoopRecord);
      return managedWrite(all, record);
    }),
    recordLoopOutcome: input => checked('SharedLoopOutcomeA1', input, () => {
      rejectTransitionExtensions(input);
      closedInput(input, ['command', 'fence', 'episode', 'attempt', 'kind', 'failureClass',
        'completion', 'jitterPermille', 'restoration'], 'closed A1 outcome input required');
      const all = read();
      fence(all, input.fence);
      ensure(input.episode.owner === 'part-six' && input.episode.name === 'LoopRecord'
        && input.episode.id.length > 0, 'LoopRecord reference owner');
      const previous = sharedByEpisode(all, input.episode.id);
      const now = clock();
      const current = host.current();
      const history = evidenceFacts();
      ensure(previous.clockBasis === now.subject.instance && sameClock(previous.transitionAt, now)
        && atOrAfter(now, previous.transitionAt), 'incomparable or backward shared pressure time');
      resolvePolicyFact(previous.policy, current.generation.id, history, spine.context);
      resolveRunReference(previous.currentOwnerRun, history, spine.context);
      const attempt = previous.attemptLog.find(value => value.id === input.attempt);
      ensure(attempt, 'contributing loop attempt is absent');
      ensure(atOrAfter(now, attempt.admittedAt), 'outcome clock precedes its admission');
      if ((previous.closureSubmission
        && encoded(previous.closureSubmission).bytes === encoded(input).bytes)
        || (previous.evidenceSubmission
          && encoded(previous.evidenceSubmission).bytes === encoded(input).bytes)) {
        sharedLoopEvidence(previous, history, spine.context, host);
        return previous;
      }
      const completeRestoration = input.restoration.filter(reference => restorationReferenceComplete(reference,
        history, spine.context, now, previous.pressureKey, previous.operationFamily, host));
      const existing = previous.outcomeLog.find(value => value.attempt === input.attempt);
      if (existing) {
        ensure(existing.kind === input.kind && existing.failureClass === input.failureClass
          && existing.jitterPermille === input.jitterPermille
          && encoded(existing.completion).bytes === encoded(input.completion).bytes,
        'loop outcome changed after admission');
        if (encoded(existing.restoration).bytes === encoded(input.restoration).bytes) return previous;
        const restoration = freeze([...new Map([...existing.restoration, ...input.restoration]
          .map(value => [value.id, value])).values()]);
        if (restoration.length === existing.restoration.length) return previous;
        const outcomeLog = freeze(previous.outcomeLog.map(value => value.attempt === existing.attempt
          ? freeze({ ...value, restoration } as LoopOutcome) : value));
        const currentOutcomes = windowAt({ policy: previous.policy, outcomeLog }, now);
        const closureEvidence = freeze([...new Map([...previous.closureEvidence, ...completeRestoration]
          .map(value => [value.id, value])).values()]);
        const mayClose = input.kind === 'accepted' && completeRestoration.length > 0
          && previous.state === 'half-open' && previous.pendingAttempts.length === 0
          && previous.halfOpenSucceeded >= previous.policy.halfOpenTrials
          && closureEvidence.length > previous.closureEvidence.length;
        if (!mayClose) {
          ensure(input.kind === 'accepted' && previous.state === 'half-open'
            && (completeRestoration.length === 0 || previous.pendingAttempts.length > 0
              || previous.halfOpenSucceeded < previous.policy.halfOpenTrials),
          'loop outcome changed after admission without new complete restoration');
          const retained = freeze({
            ...withoutSubmission(previous),
            ...meta(all, input.command),
            transition: 'evidence-retained',
            transitionAt: now,
            sourceVector: previous.sourceVector,
            policyGeneration: current.generation,
            outcomeLog,
            closureEvidence,
            failureCount: failureCountAt(previous.policy, currentOutcomes),
            outcomeWindowDigest: encoded(currentOutcomes).hash,
            evidenceSubmission: freeze({ ...input }),
          } as SharedLoopRecord);
          return managedWrite(all, retained);
        }
        const closed = freeze({
          ...withoutSubmission(previous),
          ...meta(all, input.command),
          nextWake: now.value,
          state: 'closed',
          pending: '',
          transition: 'closed',
          transitionAt: now,
          nextEligible: now,
          sourceVector: previous.sourceVector,
          policyGeneration: current.generation,
          outcomeLog,
          closureEvidence,
          failureCount: failureCountAt(previous.policy, currentOutcomes),
          outcomeWindowDigest: encoded(currentOutcomes).hash,
          closureSubmission: freeze({ ...input }),
        } as SharedLoopRecord);
        return managedWrite(all, closed);
      }
      ensure(previous.pendingAttempts.includes(input.attempt), 'attempt is not pending');
      ensure(input.kind === 'accepted' || input.kind === 'failed', 'unknown loop outcome');
      ensure(Number.isSafeInteger(input.jitterPermille)
        && input.jitterPermille >= previous.policy.jitterMinPermille
        && input.jitterPermille <= previous.policy.jitterMaxPermille, 'jitter outside pinned policy');
      const completionFact = history.find(fact => fact.id === input.completion.fact.id);
      ensure(completionFact, 'Outcome fact is absent');
      const actualOutcome = (completionFact.body as Record<string, unknown>)[input.completion.field] as {
        kind?: unknown;
      } | undefined;
      const derivedKind = actualOutcome?.kind === 'happened' ? 'accepted' : 'failed';
      ensure(input.kind === derivedKind, 'loop result classification differs from signed Outcome');
      const outcome = freeze({
        attempt: input.attempt,
        kind: derivedKind,
        failureClass: input.failureClass,
        observedAt: completionFact.at,
        recordedAt: now,
        completion: input.completion,
        jitterPermille: input.jitterPermille,
        restoration: input.restoration,
      } as LoopOutcome);
      ensure(atOrAfter(outcome.observedAt, attempt.admittedAt) && atOrAfter(now, outcome.observedAt),
        'outcome evidence or receipt clock precedes its admission');
      const decision = sharedOutcomeDecision(previous, outcome, now, completeRestoration);
      const record = freeze({
        ...withoutSubmission(previous),
        ...meta(all, input.command),
        nextWake: decision.nextEligible.value,
        state: decision.state,
        pending: decision.pendingAttempts[0] ?? '',
        transition: decision.transition,
        transitionAt: now,
        nextEligible: decision.nextEligible,
        sourceVector: previous.sourceVector,
        policyGeneration: current.generation,
        totalFailures: decision.totalFailures,
        failureCount: decision.failureCount,
        breakerHasOpened: decision.breakerHasOpened,
        breakerOpenCount: decision.breakerOpenCount,
        breakerFirstOpened: decision.breakerFirstOpened,
        halfOpenAdmitted: decision.halfOpenAdmitted,
        halfOpenSucceeded: decision.halfOpenSucceeded,
        pendingAttempts: decision.pendingAttempts,
        outcomeLog: decision.outcomeLog,
        outcomeWindowDigest: decision.outcomeWindowDigest,
        closureEvidence: decision.closureEvidence,
      } as SharedLoopRecord);
      return managedWrite(all, record);
    }),
  };
  return Object.freeze(api);
}

// Referenced by the owner fixture to make the wiring dependency explicit.
export { registerLoopA1Bodies };

import { decodeMeasurement } from '../index.js';
import type { BoundaryContext, Clock, Result } from '../index.js';
import { authorAndAppend } from '../facts/index.js';
import type { FactStorePort } from '../facts/index.js';
import type { AdmissionReservation, BoundedDueScanPort, DispatchClaim, FactAuthor, FenceToken, Lease, LoopAttempt, LoopOutcome, LoopRecord,
  RecoveryRecord, ScanCursor, SettlementAccountingInput, SettlementApplication, SettlementConsumer, SharedLoopRecord,
  TransportAuthority, TransportFact, TransportHost, TransportRecord, TransportRowRecord, TransportSpine } from './contracts.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { checkFence, fenceFor, kindFor, latestLease, latestLoop, latestScanCursor, latestSharedLoop, live, loopActive,
  observationAdmission, policyCheck, reservations, resolvePolicyFact, resolveRunReference, resolveSourceVector, rows,
  resolvePressureBinding, resolveSharedLoopAdmission, restorationReferenceComplete, sharedAdmissionDecision, sharedLoopEvidence, sharedOutcomeDecision, sourceVectorCheck,
  validateScanGeneration, validateSharedParentPolicy, validateTransition,
  withSharedLoopCandidate } from './records.js';
import { accounting, accountingRevision, checkAccountingReceipt, checkApplicationEvidence, invalidateAccounting, qualifyAccounting,
  requireAccountingDurability, requireSettlementConsumer, settlementMatches, withApplication, withSettlementAttempt } from './settlement.js';

export function createTransportSpine(host: TransportHost, author: FactAuthor, store: FactStorePort): TransportSpine {
  return Object.freeze({ store, context: author.context, append: (record: TransportRecord, required: readonly string[]) => authorAndAppend({
    kind: kindFor(record.type), schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(host.current().clock),
    body: json({ record }), required,
  }, author.context, store, author.privateKey) });
}

export function createBoundedDueScanPort(host: TransportHost, spine: TransportSpine, c: BoundaryContext): BoundedDueScanPort {
  let lastTick = -1;
  const tick = () => {
    const value = host.monotonic();
    ensure(Number.isSafeInteger(value) && value >= lastTick && value >= 0, 'monotonic clock regressed');
    lastTick = value;
    return value;
  };
  const read = (): readonly TransportFact[] => {
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(entry => !entry.taint.length && !entry.conflicts.length), 'tainted or conflicted fact prefix');
    const all = rows(snapshot.entries.map(entry => entry.fact), host.domain);
    ensure(all.length <= 4096, 'single-conversation replay bound exhausted');
    return all;
  };
  const reference = (id: string) => freeze({ owner: 'part-six' as const, name: 'ScanCursor' as const, id });
  return freeze({
    owner: 'part-six' as const,
    page: input => boundary('BoundedDueScanPage', input, c, () => {
      live(host);
      ensure(input !== null && typeof input === 'object' && Object.keys(input).length === 6
        && ['scan', 'generation', 'orderedKeys', 'cursor', 'maxItems', 'maxDuration'].every(key => Object.hasOwn(input, key)),
      'closed scan page input required');
      ensure(typeof input.scan === 'string' && input.scan.length > 0 && input.scan.length <= 256,
        'bounded scan identity required');
      ensure(typeof input.generation === 'string' && input.generation.length > 0 && input.generation.length <= 256,
        'bounded scan generation required');
      ensure(Array.isArray(input.orderedKeys) && input.orderedKeys.every(key => typeof key === 'string' && key.length > 0 && key.length <= 256),
        'bounded ordered keys required');
      ensure(new Set(input.orderedKeys).size === input.orderedKeys.length, 'ordered keys must be unique');
      ensure(Number.isSafeInteger(input.maxItems) && input.maxItems >= 0
        && Number.isSafeInteger(input.maxDuration) && input.maxDuration >= 0, 'finite nonnegative page bounds required');
      const digest = encoded(input.orderedKeys).hash;
      const all = read();
      let previous: (TransportFact & { readonly record: ScanCursor }) | undefined;
      if (input.cursor !== null) {
        ensure(input.cursor.owner === 'part-six' && input.cursor.name === 'ScanCursor' && input.cursor.id.length > 0,
          'scan cursor reference owner');
        const found = all.find((entry): entry is TransportFact & { readonly record: ScanCursor } =>
          entry.fact.id === input.cursor!.id && entry.record.type === 'ScanCursor');
        ensure(found, 'scan cursor absent');
        ensure(found.record.scan === input.scan, 'scan cursor belongs to another scan');
        previous = found;
      }
      const successor = all.find((entry): entry is TransportFact & { readonly record: ScanCursor } =>
        entry.record.type === 'ScanCursor' && entry.record.scan === input.scan
          && entry.record.previous === (previous?.fact.id ?? ''));
      if (successor) {
        ensure(latestScanCursor(all, input.scan)?.fact.id === successor.fact.id, 'scan cursor is stale');
        ensure(successor.record.generation === input.generation && successor.record.orderedKeysDigest === digest
          && successor.record.keyCount === input.orderedKeys.length && successor.record.maxItems === input.maxItems
          && successor.record.maxDuration === input.maxDuration, 'scan cursor page changed after admission');
        const selected = Array.from({ length: successor.record.selectedCount }, (_, offset) =>
          input.orderedKeys[(successor.record.selectedFrom + offset) % input.orderedKeys.length]!);
        return freeze({ selected, cursor: reference(successor.fact.id), wrapped: successor.record.wrapped === 1 });
      }
      ensure(latestScanCursor(all, input.scan)?.fact.id === previous?.fact.id, 'scan cursor is absent or stale');
      validateScanGeneration(all, input.scan, input.generation, digest, input.orderedKeys.length);

      const started = tick();
      const selectedFrom = input.orderedKeys.length === 0 ? 0 : previous?.record.nextIndex ?? 0;
      const limit = Math.min(input.maxItems, input.orderedKeys.length);
      let selectedCount = 0;
      let elapsed = 0;
      // Clock sampling belongs to this bounded operational page, never to the
      // deterministic fact-history fold in validateTransition.
      while (selectedCount < limit && input.maxDuration > 0) {
        const observed = tick() - started;
        if (observed >= input.maxDuration) { elapsed = input.maxDuration; break; }
        elapsed = observed;
        selectedCount++;
      }
      const selected = Array.from({ length: selectedCount }, (_, offset) =>
        input.orderedKeys[(selectedFrom + offset) % input.orderedKeys.length]!);
      // This is a per-page marker. Accumulated completion across zero-work
      // pages is derived from the signed prefix by validateScanGeneration.
      const wrapped = selectedCount > 0 && selectedFrom + selectedCount >= input.orderedKeys.length;
      const predecessor = all.at(-1)?.fact.id ?? '';
      const record = freeze({
        type: 'ScanCursor', schemaVersion: 1, domain: host.domain,
        command: `scan:${encoded([input.scan, previous?.fact.id ?? '', input.generation, digest, input.maxItems, input.maxDuration]).hash}`,
        predecessor, authority: host.authorityIncarnation, tick: started,
        scan: input.scan, generation: input.generation, orderedKeysDigest: digest,
        keyCount: input.orderedKeys.length, previous: previous?.fact.id ?? '', selectedFrom, selectedCount,
        nextIndex: input.orderedKeys.length === 0 ? 0 : (selectedFrom + selectedCount) % input.orderedKeys.length,
        maxItems: input.maxItems, maxDuration: input.maxDuration, elapsed, wrapped: wrapped ? 1 : 0,
      } as ScanCursor);
      validateTransition(record, all, host, true);
      const receipt = take(spine.append(record, predecessor ? [predecessor] : []));
      ensure(!receipt.taint.length, 'append was provisional or contested');
      ensure(receipt.fact.kind === kindFor(record.type)
        && encoded(receipt.fact.body).bytes === encoded({ record }).bytes, 'append returned different scan cursor');
      return freeze({ selected, cursor: reference(receipt.fact.id), wrapped });
    }),
  });
}

export function createTransportAuthority<S = never>(host: TransportHost, spine: TransportSpine, c: BoundaryContext, settlementConsumer?: SettlementConsumer<S>): TransportAuthority<S> {
  // A capability is minted only by this live issuer. JSON/restart never recreates it.
  const claims = new WeakMap<object, { operation: string; used: boolean }>();
  let lastTick = -1;
  const tick = () => { const t = host.monotonic(); ensure(Number.isSafeInteger(t) && t >= lastTick && t >= 0, 'monotonic clock regressed'); lastTick = t; return t; };
  const evidenceFacts = () => {
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(e => !e.taint.length && !e.conflicts.length), 'tainted or conflicted fact prefix');
    return [...new Map([...(spine.context?.facts ?? []), ...snapshot.entries.map(entry => entry.fact)]
      .map(fact => [fact.id, fact])).values()];
  };
  const semanticContext = () => {
    ensure(spine.context, 'owner evidence context unavailable');
    return spine.context;
  };
  const read = (): readonly TransportFact[] => {
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(e => !e.taint.length && !e.conflicts.length), 'tainted or conflicted fact prefix');
    const all = rows(snapshot.entries.map(e => e.fact), host.domain);
    ensure(all.length <= 4096, 'single-conversation replay bound exhausted');
    return all;
  };
  const readComplete = (): readonly TransportFact[] => {
    const all = rows(evidenceFacts(), host.domain);
    ensure(all.length <= 4096, 'single-conversation replay bound exhausted');
    return all;
  };
  const checked = <T>(name: string, input: unknown, run: () => T): Result<T> => boundary(name, input, c, () => {
    ensure(Number.isSafeInteger(host.budget) && host.budget >= 0 && Number.isSafeInteger(host.maxLeaseTerm) && host.maxLeaseTerm > 0, 'invalid host bounds');
    live(host); return run();
  });
  const meta = (all: readonly TransportFact[], command: string) => ({ schemaVersion: 1 as const, domain: host.domain,
    command, predecessor: all.at(-1)?.fact.id ?? '', authority: host.authorityIncarnation, tick: tick() });
  const write = <T extends TransportRowRecord>(all: readonly TransportFact[], r: T,
    extraRequired: readonly string[] = []): { record: T; all: readonly TransportFact[] } => {
    validateTransition(r, all, host, true);
    const required = r.predecessor ? [r.predecessor, ...extraRequired] : [...extraRequired];
    if (r.type === 'SettlementApplication') required.push(r.settlementFact);
    const receipt = take(spine.append(r, [...new Set(required)]));
    ensure(!receipt.taint.length, 'append was provisional or contested');
    ensure(receipt.fact.kind === kindFor(r.type) && encoded(receipt.fact.body).bytes === encoded({ record: r }).bytes, 'append returned different record');
    if (r.type === 'AdmissionReservation' && r.durability === 'replicated')
      ensure(receipt.durability.kind === 'replicated' && receipt.durability.n >= r.replicas, 'effect requires stronger durability than lease');
    if (r.type === 'SettlementApplication') checkAccountingReceipt(receipt.fact, receipt, reservations(all).find(p => p.operation === r.operation)!);
    const result = freeze(r); return { record: result, all: [...all, { record: result, fact: receipt.fact }] };
  };
  const sharedClock = (): Clock => {
    ensure(host.loopClock?.owner === 'part-ten', 'shared loop clock unavailable');
    const value = take(decodeMeasurement('clock', host.loopClock.now(), host.current().decode));
    ensure(Number.isSafeInteger(value.value), 'shared loop clock is not finite'); return value;
  };
  const sameClock = (left: Clock, right: Clock) => left.subject.kind === right.subject.kind
    && left.subject.instance === right.subject.instance && left.unit === right.unit;
  const after = (base: Clock, delta: number): Clock => {
    ensure(Number.isSafeInteger(delta) && delta >= 0 && Number.isSafeInteger(base.value + delta), 'shared loop time overflow');
    return freeze({ ...base, value: base.value + delta, at: base.at + delta } as unknown as Clock);
  };
  const atOrAfter = (left: Clock, right: Clock) => sameClock(left, right) && left.value >= right.value;
  const vectorKey = (vector: SharedLoopRecord['sourceVector']) => encoded(vector).bytes;
  const compareBytes = (left: string, right: string) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
  const sortedOutcomes = (outcomes: readonly LoopOutcome[]) => [...outcomes].sort((a, b) =>
    a.observedAt.value - b.observedAt.value
      || compareBytes(vectorKey(a.sourceVector), vectorKey(b.sourceVector)) || compareBytes(a.attempt, b.attempt));
  const windowAt = (record: Pick<SharedLoopRecord, 'policy' | 'outcomeLog'>, now: Clock) => sortedOutcomes(record.outcomeLog
    .filter(outcome => sameClock(outcome.observedAt, now) && outcome.observedAt.value > now.value - record.policy.acceptedOutcomeWindow));
  const failureCountAt = (policy: SharedLoopRecord['policy'], outcomes: readonly LoopOutcome[]) => {
    let count = 0;
    for (const outcome of outcomes) count = outcome.kind === 'accepted' ? 0
      : policy.countedFailureClasses.includes(outcome.failureClass) ? count + 1 : count;
    return count;
  };
  const rollingAt = (record: Pick<SharedLoopRecord, 'policy' | 'attemptLog'>, now: Clock) => {
    const attempts = record.attemptLog.filter(attempt => sameClock(attempt.admittedAt, now)
      && attempt.admittedAt.value > now.value - record.policy.budgetWindow);
    return { rollingAttempts: attempts.length, rollingResource: attempts.reduce((sum, attempt) => sum + attempt.resource, 0) };
  };
  const sharedByEpisode = (all: readonly TransportFact[], episode: string): SharedLoopRecord => {
    const record = all.filter(row => row.record.type === 'LoopRecord' && row.record.policy.breaker === 'shared-circuit-v1'
      && row.record.episode === episode).at(-1)?.record;
    ensure(record?.type === 'LoopRecord' && record.policy.breaker === 'shared-circuit-v1', 'shared loop episode unavailable');
    const value = record as SharedLoopRecord;
    ensure(latestSharedLoop(all, value.pressureKey)?.command === value.command, 'shared pressure moved to another episode');
    return value;
  };
  const parentAttempts = (all: readonly TransportFact[], policy: SharedLoopRecord['policy']) => {
    const latest = new Map<string, SharedLoopRecord>();
    for (const row of all) if (row.record.type === 'LoopRecord' && row.record.policy.breaker === 'shared-circuit-v1') {
      const loop = row.record as SharedLoopRecord;
      if (loop.parentDuty.id === policy.parentDuty.id) latest.set(loop.pressureKey, loop);
    }
    const attempts = new Map<string, LoopAttempt>();
    for (const loop of latest.values()) for (const attempt of loop.attemptLog) {
      const prior = attempts.get(attempt.id);
      ensure(!prior || encoded(prior).bytes === encoded(attempt).bytes, 'parent attempt identity is conflicted across pressure scopes');
      attempts.set(attempt.id, attempt);
    }
    return [...attempts.values()];
  };
  const parentRollingAt = (all: readonly TransportFact[], policy: SharedLoopRecord['policy'], now: Clock,
    added?: LoopAttempt) => {
    const attempts = parentAttempts(all, policy);
    if (added) {
      const prior = attempts.find(value => value.id === added.id);
      ensure(!prior, 'parent attempt identity already belongs to another pressure scope'); attempts.push(added);
    }
    ensure(attempts.every(attempt => sameClock(attempt.admittedAt, now)),
      'parent budget contains an incomparable attempt clock');
    return rollingAt({ policy, attemptLog: attempts }, now);
  };
  const managedWrite = (all: readonly TransportFact[], record: SharedLoopRecord) => {
    const required = sharedLoopEvidence(record, evidenceFacts(), semanticContext(), host).map(fact => fact.id);
    return withSharedLoopCandidate(host, record, () => write(all, record, required).record as SharedLoopRecord);
  };
  const outcomeDigest = (policy: SharedLoopRecord['policy'], outcomes: readonly LoopOutcome[], now: Clock) =>
    encoded(sortedOutcomes(outcomes.filter(outcome => sameClock(outcome.observedAt, now)
      && outcome.observedAt.value > now.value - policy.acceptedOutcomeWindow))).hash;
  const fence = (all: readonly TransportFact[], token: FenceToken) => checkFence(all, token, host, tick());
  const duplicateLease = (all: readonly TransportFact[], command: string) => {
    const found = all.find(v => v.record.command === command);
    if (found) ensure(found.record.type === 'Lease', 'command id collision');
    return found?.record as Lease | undefined;
  };
  const leaseWrite = (name: string, command: string, token: FenceToken, term?: number): Result<Lease> => checked(name, { command, token, term: term ?? null }, () => {
    const all = read(), prior = duplicateLease(all, command);
    const operation = name === 'LeaseRelease' ? 'release' : name === 'LeaseRenew' ? 'renew' : 'write';
    if (prior) { ensure(prior.epoch === token.epoch && prior.incarnation === token.incarnation
      && prior.operation === operation && prior.term === (term ?? 0), 'command reused for different lease'); return prior; }
    const old = fence(all, token), m = meta(all, command);
    return write(all, { ...old, ...m, operation, term: term ?? 0, state: name === 'LeaseRelease' ? 'released' : 'held', expires: term === undefined ? old.expires : m.tick + term }).record;
  });
  // Conditional preparation of ONE accounting row for an authenticated settlement
  // view. Everything here may wait; nothing here releases credit. The returned
  // prefix is checked, so the final guarded callback needs no further storage.
  const prepareApplication = (s: SettlementAccountingInput, token: FenceToken) => {
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(e => !e.taint.length && !e.conflicts.length), 'tainted settlement prefix');
    const facts = snapshot.entries.map(e => e.fact), all = read(); fence(all, token);
    const op = reservations(all).find(p => p.operation === s.operation);
    ensure(op, 'settlement operation absent');
    const sf = facts.find(f => settlementMatches(s, f));
    ensure(sf, 'owner-issued settlement missing from local fact prefix');
    const fields = { operation: s.operation, request: s.request, reservation: s.reservation, claim: s.claim,
      digest: s.digest, settlement: s.id, settlementFact: sf.id, settlementHash: sf.contentHash, ...accounting(s, op) };
    const prior = all.find(v => v.record.type === 'SettlementApplication' && v.record.settlement === s.id)?.record;
    let record: SettlementApplication;
    if (prior) {
      ensure(prior.type === 'SettlementApplication' && Object.entries(fields).every(([k, v]) => prior[k as keyof SettlementApplication] === v), 'settlement identity reused with changed application');
      requireAccountingDurability(all.find(v => v.record === prior)!, op, host);
      record = prior;
    } else {
      const r = { ...meta(all, `settle:${encoded([s.operation, s.id]).hash}`), type: 'SettlementApplication', ...fields } as SettlementApplication;
      checkApplicationEvidence(r, facts, all);
      record = withApplication(host, r, settlementConsumer, () => write(all, r).record);
    }
    // Capture a fresh checked prefix after the LAST six storage wait. The owner
    // decoder's local revision detects any later raw, API or replicated six
    // candidate without rereading physical storage inside nine's guard.
    const current = read(); fence(current, token);
    const row = current.find(v => v.record.type === 'SettlementApplication' && v.record.settlement === s.id);
    ensure(row && encoded(row.record).bytes === encoded(record).bytes, 'prepared accounting changed');
    return { row, all: current, record, input: encoded(s).bytes, revision: accountingRevision(host) };
  };
  return Object.freeze({
    inspect: () => boundary('TransportInspect', null, c, read),
    settle: (token, settlement) => checked('SettlementApply', { token }, () => {
      ensure(settlementConsumer, 'eight settlement consumer is not installed');
      requireSettlementConsumer(host, settlementConsumer);
      return withSettlementAttempt(host, () => {
        // Eight's consumption seam is entered TWICE for one settlement.
        //
        // Pass one obtains an authenticated CURRENT preparation view. Its callback
        // runs inside the owner's non-waiting guard, so it only copies bounded
        // in-memory bytes: no store read, append, custody, clock or authority use.
        let operation: string | undefined;
        const input = take(settlementConsumer(settlement, c, s => {
          ensure(operation === undefined, 'settlement preparation called twice');
          operation = s.operation; return s;
        }));
        try {
          // Between the passes, OUTSIDE any owner guard, six performs every step
          // that may wait: P2 projection reads, the conditional accounting append
          // and the original operation's custody-durability proof.
          invalidateAccounting(host, input.operation);
          const prepared = prepareApplication(input, token);
          // Pass two is the consequential decision. Eight rechecks its assessment,
          // evidence, custody and durability after all six waits, then calls this
          // back inside nine's current-assessment guard. NO store read, append,
          // fsync, replication or deferred authority use may run here.
          return take(settlementConsumer(settlement, c, s => {
            ensure(operation === s.operation, 'settlement finalization names another operation');
            ensure(encoded(s).bytes === prepared.input, 'prepared settlement changed');
            ensure(accountingRevision(host) === prepared.revision, 'accounting prefix changed during owner wait');
            live(host); fence(prepared.all, token);
            qualifyAccounting(host, prepared.row);
            return prepared.record;
          }));
        } catch (error) { invalidateAccounting(host, input.operation); throw error; }
      });
    }),
    close: (command, token, operation) => checked('OperationClose', { command, token, operation }, () => {
      const all = read(); fence(all, token);
      const old = reservations(all).find(p => p.operation === operation);
      ensure(old?.state === 'prepared', 'close requires a prepared, never-claimed operation');
      // A live capability is minted only after its durable dispatch-claimed row,
      // so the committed prefix is the proof; no in-memory handle can outrun it.
      ensure(!all.some(v => v.record.type === 'AdmissionReservation' && v.record.operation === operation
        && v.record.state !== 'prepared'), 'close requires proof no dispatch-claim exists');
      return write(all, { ...old, ...meta(all, command), state: 'closed' }).record;
    }),
    acquire: (command, expected, term) => checked('LeaseAcquire', { command, expected, term }, () => {
      const all = read(), previous = duplicateLease(all, command);
      if (previous) { ensure(previous.operation === 'acquire' && previous.predecessor === expected && previous.incarnation === host.incarnation && previous.term === term, 'acquire command changed'); return fenceFor(all, previous); }
      ensure(expected === (all.at(-1)?.fact.id ?? ''), 'conditional predecessor changed');
      const m = meta(all, command);
      const r = { ...m, type: 'Lease', epoch: (latestLease(all)?.record.epoch ?? 0) + 1,
        holder: host.principal.id, machine: host.machine, incarnation: host.incarnation,
        generation: host.current().generation.id, expires: m.tick + term, state: 'held', operation: 'acquire', term } as Lease;
      const saved = write(all, r); return fenceFor(saved.all, saved.record);
    }),
    renew: (command, token, term) => checked('LeaseRenew', { command, token, term }, () => {
      const result = take(leaseWrite('LeaseRenew', command, token, term)); return fenceFor(read(), result);
    }),
    release: (command, token) => leaseWrite('LeaseRelease', command, token),
    admitWrite: (command, token) => leaseWrite('LeaseWrite', command, token),
    schedule: (command, token, run, policy) => checked('LoopSchedule', { command, token, run, policy }, () => {
      const all = read(); fence(all, token); policyCheck(policy);
      ensure(policy.breaker === 'stub-closed', 'shared breaker requires scheduleEpisode');
      ensure(run.owner === 'part-five' && run.name === 'Run' && run.id.length > 0, 'run reference owner');
      ensure(!latestLoop(all, run.id), 'episode already exists; bounds cannot reset');
      const m = meta(all, command);
      return write(all, { ...m, type: 'LoopRecord', run: run.id, episode: `loop:${encoded([host.domain, run.id]).hash}`,
        policy, attempts: 0, started: m.tick, nextWake: m.tick + policy.minDelay, state: 'scheduled', pending: '' } as LoopRecord).record;
    }),
    scheduleEpisode: input => checked('SharedLoopSchedule', input, () => {
      const all = readComplete(); fence(all, input.fence); policyCheck(input.policy);
      ensure(input.policy.breaker === 'shared-circuit-v1', 'real breaker policy required');
      ensure(input.currentOwnerRun.owner === 'part-five' && input.currentOwnerRun.name === 'Run'
        && input.currentOwnerRun.id.length > 0, 'current owner Run reference required');
      sourceVectorCheck(input.sourceVector);
      ensure(input.episodeKey.length > 0 && input.episodeKey.length <= 256 && input.operationFamily.length > 0
        && input.operationFamily.length <= 256 && Object.values(input.pressureScope).every(value => value.length > 0 && value.length <= 256),
      'bounded shared pressure input required');
      const now = sharedClock(), current = host.current();
      ensure(current.generation.id === current.decode.register.generation.id, 'current generation mismatch');
      const history = evidenceFacts();
      const context = semanticContext();
      resolvePolicyFact(input.policy, current.generation.id, history, context);
      resolveRunReference(input.policy.parentDuty, history, context);
      resolveRunReference(input.currentOwnerRun, history, context);
      resolveSourceVector(input.sourceVector, history, context);
      ensure(host.loopScopeBinding?.owner === 'part-three', 'governed loop pressure binding unavailable');
      const binding = take(host.loopScopeBinding.resolve({ parentDuty: input.policy.parentDuty,
        operationFamily: input.operationFamily, pressureScope: input.pressureScope }));
      ensure(binding.operationFamily.length > 0 && Object.values(binding.pressureScope).every(value => value.length > 0),
        'governed pressure binding is incomplete');
      const pressureKey = `pressure:${encoded([binding.operationFamily, binding.pressureScope]).hash}`;
      const bindingRecord = { parentDuty: input.policy.parentDuty, operationFamily: binding.operationFamily,
        pressureScope: binding.pressureScope, pressureKey, pressureBinding: binding.witness };
      resolvePressureBinding(bindingRecord, history, context, host);
      const previous = latestSharedLoop(all, pressureKey);
      if (previous) {
        ensure(encoded(previous.policy).bytes === encoded(input.policy).bytes
          && encoded(previous.parentDuty).bytes === encoded(input.policy.parentDuty).bytes
          && previous.operationFamily === binding.operationFamily
          && encoded(previous.pressureScope).bytes === encoded(binding.pressureScope).bytes
          && encoded(previous.pressureBinding).bytes === encoded(binding.witness).bytes,
        'conflicting shared pressure policy or parent');
        ensure(previous.clockBasis === now.subject.instance, 'incomparable shared pressure time');
        if (previous.state !== 'closed' && previous.state !== 'stopped') {
          ensure(encoded(previous.currentOwnerRun).bytes === encoded(input.currentOwnerRun).bytes,
            'active shared pressure owner Run changed');
          return previous;
        }
        ensure(previous.state === 'closed' || previous.pendingAttempts.length === 0
          && previous.failureCount < previous.policy.failureThreshold, 'shared pressure has an unfinished episode');
      }
      validateSharedParentPolicy({ parentDuty: input.policy.parentDuty, policy: input.policy }, all);
      const episode = `loop:${encoded([pressureKey, input.episodeKey]).hash}`;
      ensure(!all.some(row => row.record.type === 'LoopRecord' && row.record.episode === episode), 'episode identity already used');
      const attemptLog = previous?.attemptLog ?? [], outcomeLog = previous?.outcomeLog ?? [];
      const currentOutcomes = windowAt({ policy: input.policy, outcomeLog }, now);
      const rolling = parentRollingAt(all, input.policy, now);
      const firstEligible = after(now, input.policy.initialDelay), m = meta(all, input.command);
      const record = freeze({ ...m, type: 'LoopRecord', run: input.currentOwnerRun.id, episode, policy: input.policy,
        attempts: attemptLog.length, started: now.value, nextWake: firstEligible.value, state: 'scheduled', pending: '',
        parentDuty: input.policy.parentDuty, currentOwnerRun: input.currentOwnerRun, policyGeneration: current.generation,
        pressureBinding: binding.witness, operationFamily: binding.operationFamily,
        pressureScope: binding.pressureScope, pressureKey,
        episodeKey: input.episodeKey, transition: 'scheduled', transitionAt: now, nextEligible: firstEligible,
        clockBasis: now.subject.instance, sourceVector: input.sourceVector, episodeAttempts: 0,
        totalFailures: previous?.totalFailures ?? 0, failureCount: failureCountAt(input.policy, currentOutcomes),
        ...rolling, breakerHasOpened: previous?.breakerHasOpened ?? 0, breakerOpenCount: previous?.breakerOpenCount ?? 0,
        breakerFirstOpened: previous?.breakerFirstOpened ?? now,
        halfOpenAdmitted: 0, halfOpenSucceeded: 0, pendingAttempts: [], attemptLog, outcomeLog,
        outcomeWindowDigest: outcomeDigest(input.policy, outcomeLog, now), closureEvidence: [],
      } as unknown as SharedLoopRecord);
      return managedWrite(all, record);
    }),
    admitLoopAttempt: input => checked('SharedLoopAttemptAdmission', input, () => {
      const all = readComplete(); fence(all, input.fence);
      ensure(input.episode.owner === 'part-six' && input.episode.name === 'LoopRecord' && input.episode.id.length > 0,
        'LoopRecord reference owner');
      sourceVectorCheck(input.sourceVector);
      ensure(input.attempt.length > 0 && input.holderFamily.length > 0 && input.worker.length > 0 && input.machine.length > 0
        && Number.isSafeInteger(input.resource) && input.resource >= 0, 'bounded loop attempt input required');
      const previous = sharedByEpisode(all, input.episode.id), policy = previous.policy, now = sharedClock();
      const current = host.current(), history = evidenceFacts();
      ensure(previous.clockBasis === now.subject.instance && sameClock(previous.transitionAt, now)
        && atOrAfter(now, previous.transitionAt), 'incomparable or backward shared pressure time');
      const context = semanticContext();
      resolvePolicyFact(policy, current.generation.id, history, context);
      resolveRunReference(previous.parentDuty, history, context);
      resolveRunReference(previous.currentOwnerRun, history, context);
      ensure(vectorKey(input.sourceVector) === vectorKey(previous.sourceVector), 'attempt frontier differs from the governed episode');
      resolveSourceVector(input.sourceVector, history, context);
      const existing = previous.attemptLog.find(attempt => attempt.id === input.attempt);
      if (existing) {
        ensure(existing.holderFamily === input.holderFamily && existing.worker === input.worker && existing.machine === input.machine
          && existing.resource === input.resource && vectorKey(existing.sourceVector) === vectorKey(input.sourceVector),
        'attempt identity reused with changed contributor');
        return previous;
      }
      const baseAttempt = { id: input.attempt, holderFamily: input.holderFamily, worker: input.worker,
        machine: input.machine, episode: previous.episode, admittedAt: now, resource: input.resource,
        sourceVector: input.sourceVector };
      const decision = sharedAdmissionDecision(previous, all, now, baseAttempt);
      if (decision.kind === 'stopped') {
        const currentOutcomes = windowAt(previous, now), rolling = parentRollingAt(all, policy, now);
        const m = meta(all, input.command);
        const stopped = freeze({ ...previous, ...m, nextWake: now.value, state: 'stopped', pending: '',
          transition: 'stopped', transitionAt: now, nextEligible: now, sourceVector: previous.sourceVector,
          failureCount: failureCountAt(policy, currentOutcomes), ...rolling,
          outcomeWindowDigest: outcomeDigest(policy, previous.outcomeLog, now) } as SharedLoopRecord);
        return managedWrite(all, stopped);
      }
      const { attempt } = decision;
      const attemptLog = [...previous.attemptLog, attempt];
      const pendingAttempts = [...previous.pendingAttempts, input.attempt], currentOutcomes = windowAt(previous, now);
      const m = meta(all, input.command);
      const record = freeze({ ...previous, ...m, attempts: attemptLog.length, episodeAttempts: previous.episodeAttempts + 1,
        nextWake: now.value, state: decision.state, pending: pendingAttempts[0]!, transition: decision.transition, transitionAt: now,
        nextEligible: now, sourceVector: previous.sourceVector,
        failureCount: failureCountAt(policy, currentOutcomes), outcomeWindowDigest: outcomeDigest(policy, previous.outcomeLog, now),
        rollingAttempts: decision.rollingAttempts,
        rollingResource: decision.rollingResource, halfOpenAdmitted: decision.halfOpenAdmitted,
        halfOpenSucceeded: decision.halfOpenSucceeded,
        pendingAttempts, attemptLog } as SharedLoopRecord);
      return managedWrite(all, record);
    }),
    recordLoopOutcome: input => checked('SharedLoopOutcome', input, () => {
      const all = readComplete(); fence(all, input.fence);
      ensure(input.episode.owner === 'part-six' && input.episode.name === 'LoopRecord' && input.episode.id.length > 0,
        'LoopRecord reference owner'); sourceVectorCheck(input.sourceVector);
      const previous = sharedByEpisode(all, input.episode.id), policy = previous.policy, now = sharedClock();
      const current = host.current(), history = evidenceFacts();
      ensure(previous.clockBasis === now.subject.instance && sameClock(previous.transitionAt, now)
        && atOrAfter(now, previous.transitionAt), 'incomparable or backward shared pressure time');
      const context = semanticContext();
      resolvePolicyFact(policy, current.generation.id, history, context);
      resolveRunReference(previous.parentDuty, history, context);
      resolveRunReference(previous.currentOwnerRun, history, context);
      const attempt = previous.attemptLog.find(value => value.id === input.attempt);
      ensure(attempt, 'contributing loop attempt is absent');
      ensure(atOrAfter(now, attempt.admittedAt), 'outcome clock precedes its admission');
      ensure(vectorKey(input.sourceVector) === vectorKey(attempt.sourceVector), 'outcome frontier differs from its admitted attempt');
      resolveSourceVector(input.sourceVector, history, context);
      const completeRestoration = input.restoration.filter(reference => restorationReferenceComplete(reference,
        history, context, now, previous.pressureKey, previous.operationFamily, host));
      const existing = previous.outcomeLog.find(value => value.attempt === input.attempt);
      if (existing) {
        ensure(existing.kind === input.kind && existing.failureClass === input.failureClass
          && existing.jitterPermille === input.jitterPermille && vectorKey(existing.sourceVector) === vectorKey(input.sourceVector)
          && encoded(existing.completion).bytes === encoded(input.completion).bytes,
        'loop outcome changed after admission');
        if (encoded(existing.restoration).bytes === encoded(input.restoration).bytes) return previous;
        const closureEvidence = freeze([...new Map([...previous.closureEvidence, ...completeRestoration]
          .map(value => [value.id, value])).values()]);
        ensure(input.kind === 'accepted' && completeRestoration.length > 0
          && previous.state === 'half-open' && previous.pendingAttempts.length === 0
          && previous.halfOpenSucceeded >= policy.halfOpenTrials
          && closureEvidence.length > previous.closureEvidence.length,
        'loop outcome changed after admission without new complete restoration');
        const m = meta(all, input.command);
        const closed = freeze({ ...previous, ...m, nextWake: now.value, state: 'closed', pending: '',
          transition: 'closed', transitionAt: now, nextEligible: now, sourceVector: previous.sourceVector,
          policyGeneration: current.generation, closureEvidence } as SharedLoopRecord);
        return managedWrite(all, closed);
      }
      ensure(previous.pendingAttempts.includes(input.attempt), 'attempt is not pending');
      ensure(input.kind === 'accepted' || input.kind === 'failed', 'unknown loop outcome');
      ensure(Number.isSafeInteger(input.jitterPermille) && input.jitterPermille >= policy.jitterMinPermille
        && input.jitterPermille <= policy.jitterMaxPermille, 'jitter outside pinned policy');
      const completionFact = history.find(fact => fact.id === input.completion.fact.id);
      ensure(completionFact, 'Outcome fact is absent');
      const actualOutcome = (completionFact.body as Record<string, unknown>)[input.completion.field] as { kind?: unknown } | undefined;
      const derivedKind = actualOutcome?.kind === 'happened' ? 'accepted' : 'failed';
      ensure(input.kind === derivedKind, 'loop result classification differs from signed Outcome');
      const outcome = freeze({ attempt: input.attempt, kind: derivedKind, failureClass: input.failureClass,
        observedAt: completionFact.at, completion: input.completion, jitterPermille: input.jitterPermille,
        restoration: input.restoration, sourceVector: input.sourceVector } as LoopOutcome);
      ensure(atOrAfter(outcome.observedAt, attempt.admittedAt) && atOrAfter(now, outcome.observedAt),
        'outcome evidence or receipt clock precedes its admission');
      const decision = sharedOutcomeDecision(previous, all, outcome, now, completeRestoration), m = meta(all, input.command);
      const record = freeze({ ...previous, ...m, nextWake: decision.nextEligible.value, state: decision.state,
        pending: decision.pendingAttempts[0] ?? '', transition: decision.transition, transitionAt: now,
        nextEligible: decision.nextEligible, sourceVector: input.sourceVector,
        policyGeneration: current.generation,
        totalFailures: decision.totalFailures, failureCount: decision.failureCount,
        rollingAttempts: decision.rollingAttempts, rollingResource: decision.rollingResource,
        breakerHasOpened: decision.breakerHasOpened, breakerOpenCount: decision.breakerOpenCount,
        breakerFirstOpened: decision.breakerFirstOpened, halfOpenAdmitted: decision.halfOpenAdmitted,
        halfOpenSucceeded: decision.halfOpenSucceeded, pendingAttempts: decision.pendingAttempts,
        outcomeLog: decision.outcomeLog, outcomeWindowDigest: decision.outcomeWindowDigest,
        closureEvidence: decision.closureEvidence } as SharedLoopRecord);
      return managedWrite(all, record);
    }),
    reserve: input => checked('OperationReserve', input, () => {
      const all = read(); fence(all, input.fence);
      ensure(input.request.owner === 'part-eight' && input.request.name === 'EffectRequest' && input.run.owner === 'part-five' && input.run.name === 'Run', 'foreign reference owner');
      const operation = `operation:${encoded([host.domain, input.request.id, input.attempt]).hash}`;
      const previous = reservations(all).find(p => p.operation === operation);
      if (previous) {
        ensure(previous.digest === input.payloadDigest && previous.charge === input.charge && previous.run === input.run.id
          && previous.semanticMessage === input.semanticMessage && previous.durability === input.durability && previous.replicas === input.replicas, 'operation mapping changed');
        return previous;
      }
      const loopAdmission = resolveSharedLoopAdmission(all, input.run.id, input.attempt);
      return write(all, { ...meta(all, input.command), type: 'AdmissionReservation', operation, request: input.request.id,
        attempt: input.attempt, digest: input.payloadDigest, run: input.run.id, semanticMessage: input.semanticMessage,
        deliveryAttempt: `delivery:${encoded([operation, input.semanticMessage]).hash}`, fence: input.fence,
        charge: input.charge, state: 'prepared', executor: '', durability: input.durability, replicas: input.replicas } as AdmissionReservation,
      loopAdmission ? [loopAdmission.fact.id] : []).record;
    }),
    claim: (command, token, operation) => checked('DispatchClaim', { command, token, operation }, () => {
      const all = read(); fence(all, token);
      const old = reservations(all).find(p => p.operation === operation);
      ensure(old?.state === 'prepared', 'claim already issued or reservation absent');
      const loopAdmission = resolveSharedLoopAdmission(all, old.run, old.attempt);
      const saved = write(all, { ...old, ...meta(all, command), state: 'dispatch-claimed', executor: host.incarnation },
        loopAdmission ? [loopAdmission.fact.id] : []);
      const capability = Object.freeze({ operation, attempt: old.attempt, digest: old.digest, executor: host.incarnation }) as DispatchClaim;
      claims.set(capability, { operation: saved.record.operation, used: false }); return capability;
    }),
    consume: (capability, token) => checked('DispatchConsume', { operation: capability?.operation, token }, () => {
      const claim = claims.get(capability); ensure(claim && !claim.used, 'dispatch claim absent or already consumed');
      const all = read(); fence(all, token);
      const old = reservations(all).find(p => p.operation === claim.operation);
      ensure(old?.state === 'dispatch-claimed' && old.executor === host.incarnation, 'claim no longer callable');
      // Burn before durable append. Failed acknowledgement is uncertainty, never a reusable handle.
      claim.used = true;
      const loopAdmission = resolveSharedLoopAdmission(all, old.run, old.attempt);
      return write(all, { ...old, ...meta(all, `consume:${old.operation}`), state: 'consumed' },
        loopAdmission ? [loopAdmission.fact.id] : []).record;
    }),
    recover: (command, token, operation, observer) => checked('RecoveryObserve', { command, token, operation }, () => {
      let all = read(); fence(all, token); ensure(observer.owner === 'part-eight', 'observation owner');
      const op = reservations(all).find(p => p.operation === operation);
      ensure(op && op.state !== 'prepared', 'unresolved claim not found');
      const loop = latestLoop(all, op.run); ensure(loop && loop.state !== 'stopped', 'recovery loop stopped or missing');
      ensure(!loopActive(all, loop), 'observation already active; durable completion required');
      const m = meta(all, `${command}:wake`);
      ensure(loop.authority !== m.authority || m.tick >= loop.nextWake, 'wake not due');
      const admission = observationAdmission(loop, m.tick, m.authority);
      const w = write(all, { ...loop, ...m, attempts: loop.attempts + (admission === 'none' ? 0 : 1),
        nextWake: m.tick + loop.policy.minDelay, state: admission === 'none' ? 'stopped' : admission === 'restored' ? 'restoring' : 'running', pending: operation });
      all = w.all;
      // The active reservation excludes re-entry across every issuer sharing the
      // spine. Only a matching durable result releases it. A missing durable
      // result retains active uncertainty; a new incarnation is not quiescence.
      let observation = '';
      let failed = false; let failure: unknown;
      if (admission !== 'none') {
        try {
          const ref = take(observer.observe(operation));
          ensure(ref.owner === 'part-eight' && ref.name === 'OperationObservation' && ref.id.length > 0, 'observation reference owner');
          observation = ref.id;
        } catch (error) { failed = true; failure = error; }
      }
      // Other permitted fact writes may have occurred while observe was on-stack.
      // Keep its returned evidence; revalidate the exact wake against the fresh head.
      all = read(); fence(all, token);
      const result = write(all, { ...meta(all, command), type: 'RecoveryRecord', operation, episode: loop.episode,
        observation, disposition: admission === 'ordinary' ? 'waiting' : 'stopped-at-bound' } as RecoveryRecord).record;
      if (failed) throw failure;
      return result;
    }),
  } satisfies TransportAuthority<S>);
}

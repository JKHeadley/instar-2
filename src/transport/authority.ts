import { bindDispatchInvocation } from './dispatch-invocation.js';
import { consumeAcceptedReplyOpening } from '../rungraph/accepted-reply.js';
import { bindRunPairIssuer, withRunPairAdmission } from './run-pair.js';
import { bindServingIssuer, servingView, withServingRecord } from './sequential-serving-admission.js';
import type { ServingBinding } from './sequential-serving-admission.js';
import type { BoundaryContext, Result } from '../index.js';
import { authorAndAppend } from '../facts/index.js';
import type { FactStorePort } from '../facts/index.js';
import type { AdmissionReservation, BoundedDueScanPort, DispatchClaim, FactAuthor, FenceToken, Lease, LoopRecord, RecoveryRecord, RunPairAdmission, ScanCursor, ServingRecord,
  SettlementAccountingInput, SettlementApplication, SettlementConsumer, TransportAuthority, TransportFact, TransportHost, TransportRecord, TransportSpine } from './contracts.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { checkFence, checkPairParent, checkServingRun, fenceFor, kindFor, latestLease, latestLoop, latestScanCursor, live, loopActive, observationAdmission, policyCheck, reservations, rows, servingPair, servingRecords,
  validateScanGeneration, validateTransition } from './records.js';
import { accounting, accountingRevision, checkAccountingReceipt, checkApplicationEvidence, invalidateAccounting, qualifyAccounting,
  requireAccountingDurability, requireSettlementConsumer, settlementMatches, withApplication, withSettlementAttempt } from './settlement.js';
import { bindProviderSettlementContext, providerSettlementContext } from './provider-settlement.js';

export function createTransportSpine(host: TransportHost, author: FactAuthor, store: FactStorePort): TransportSpine {
  bindProviderSettlementContext(store, author.context);
  return Object.freeze({ store, append: (record: TransportRecord, required: readonly string[]) => authorAndAppend({
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
  const claims = new WeakMap<object, { operation: string; used: boolean; invoked: boolean; consumed?: AdmissionReservation }>();
  let lastTick = -1;
  const tick = () => { const t = host.monotonic(); ensure(Number.isSafeInteger(t) && t >= lastTick && t >= 0, 'monotonic clock regressed'); lastTick = t; return t; };
  const snapshot = () => {
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(e => !e.taint.length && !e.conflicts.length), 'tainted or conflicted fact prefix');
    const all = rows(snapshot.entries.map(e => e.fact), host.domain);
    ensure(all.length <= 4096, 'single-conversation replay bound exhausted');
    return { all, facts: snapshot.entries.map(e => e.fact) };
  };
  const read = (): readonly TransportFact[] => snapshot().all;
  const checked = <T>(name: string, input: unknown, run: () => T): Result<T> => boundary(name, input, c, () => {
    ensure(Number.isSafeInteger(host.budget) && host.budget >= 0 && Number.isSafeInteger(host.maxLeaseTerm) && host.maxLeaseTerm > 0, 'invalid host bounds');
    live(host); return run();
  });
  const meta = (all: readonly TransportFact[], command: string) => ({ schemaVersion: 1 as const, domain: host.domain,
    command, predecessor: all.at(-1)?.fact.id ?? '', authority: host.authorityIncarnation, tick: tick() });
  const write = <T extends TransportRecord>(all: readonly TransportFact[], r: T): { record: T; all: readonly TransportFact[] } => {
    validateTransition(r, all, host, true, take(spine.store.read()));
    const required = r.predecessor ? [r.predecessor] : [];
    if (r.type === 'SettlementApplication') required.push(r.settlementFact);
    if (r.type === 'RunPairAdmission') required.push(r.opening, r.acceptance, r.obligation);
    if (r.type === 'ServingRecord') required.push(...[r.installation, r.conversation, r.input, r.opening]
      .filter(Boolean));
    if (r.type === 'AdmissionReservation' && all.some(p => p.record.type === 'RunPairAdmission')) {
      const request = take(spine.store.read()).find(f => f.kind === 'effect-EffectRequest'
        && (f.body as { record: { id: string } }).record.id === r.request);
      if (request) required.push(request.id);
    }
    const receipt = take(spine.append(r, [...new Set(required)]));
    ensure(!receipt.taint.length, 'append was provisional or contested');
    ensure(receipt.fact.kind === kindFor(r.type) && encoded(receipt.fact.body).bytes === encoded({ record: r }).bytes, 'append returned different record');
    if (r.type === 'AdmissionReservation' && r.durability === 'replicated')
      ensure(receipt.durability.kind === 'replicated' && receipt.durability.n >= r.replicas, 'effect requires stronger durability than lease');
    if (r.type === 'SettlementApplication') checkAccountingReceipt(receipt.fact, receipt, reservations(all).find(p => p.operation === r.operation)!);
    const result = freeze(r); return { record: result, all: [...all, { record: result, fact: receipt.fact }] };
  };
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
    const sf = facts.find(f => settlementMatches(s, f, providerSettlementContext(spine.store, facts)));
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
      checkApplicationEvidence(r, facts, all, providerSettlementContext(spine.store, facts));
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
  const authority: TransportAuthority<S> = Object.freeze({
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
      ensure(run.owner === 'part-five' && run.name === 'Run' && run.id.length > 0, 'run reference owner');
      ensure(!latestLoop(all, run.id), 'episode already exists; bounds cannot reset');
      const m = meta(all, command);
      return write(all, { ...m, type: 'LoopRecord', run: run.id, episode: `loop:${encoded([host.domain, run.id]).hash}`,
        policy, attempts: 0, started: m.tick, nextWake: m.tick + policy.minDelay, state: 'scheduled', pending: '' } as LoopRecord).record;
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
      return write(all, { ...meta(all, input.command), type: 'AdmissionReservation', operation, request: input.request.id,
        attempt: input.attempt, digest: input.payloadDigest, run: input.run.id, semanticMessage: input.semanticMessage,
        deliveryAttempt: `delivery:${encoded([operation, input.semanticMessage]).hash}`, fence: input.fence,
        charge: input.charge, state: 'prepared', executor: '', durability: input.durability, replicas: input.replicas } as AdmissionReservation).record;
    }),
    claim: (command, token, operation) => checked('DispatchClaim', { command, token, operation }, () => {
      const all = read(); fence(all, token);
      const old = reservations(all).find(p => p.operation === operation);
      ensure(old?.state === 'prepared', 'claim already issued or reservation absent');
      const saved = write(all, { ...old, ...meta(all, command), state: 'dispatch-claimed', executor: host.incarnation });
      const capability = Object.freeze({ operation, attempt: old.attempt, digest: old.digest, executor: host.incarnation }) as DispatchClaim;
      claims.set(capability, { operation: saved.record.operation, used: false, invoked: false }); return capability;
    }),
    consume: (capability, token) => checked('DispatchConsume', { operation: capability?.operation, token }, () => {
      const claim = claims.get(capability); ensure(claim && !claim.used, 'dispatch claim absent or already consumed');
      const all = read(); fence(all, token);
      const old = reservations(all).find(p => p.operation === claim.operation);
      ensure(old?.state === 'dispatch-claimed' && old.executor === host.incarnation, 'claim no longer callable');
      // Burn before durable append. Failed acknowledgement is uncertainty, never a reusable handle.
      claim.used = true;
      claim.consumed = write(all, { ...old, ...meta(all, `consume:${old.operation}`), state: 'consumed' }).record;
      return claim.consumed;
    }),
    recover: (command, token, operation, observer) => checked('RecoveryObserve', { command, token, operation }, () => {
      let all = read(); fence(all, token); ensure(observer.owner === 'part-eight', 'observation owner');
      const op = reservations(all).find(p => p.operation === operation);
      ensure(op && op.state !== 'prepared', 'unresolved claim not found');
      const serving = servingView(servingRecords(all));
      const pair = servingPair(all, op.run);
      ensure(!serving.binding || !serving.slot || serving.slot === op.run ||
        pair?.provider === serving.slot && pair.reply === op.run,
      'recovery observer conflicts with active serving executor');
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
  bindDispatchInvocation(authority, (capability, token, invoke) => boundary('DispatchInvocation',
    { operation: capability?.operation, token }, c, () => {
      const claim = claims.get(capability);
      ensure(claim?.consumed && !claim.invoked, 'consumed dispatch claim absent or invocation already attempted');
      // Burn BEFORE reads/checks: a late refusal is observation-only, never a retry.
      claim.invoked = true;
      const { all, facts } = snapshot();
      const op = reservations(all).find(p => p.operation === claim.operation);
      ensure(op?.state === 'consumed' && encoded(op).bytes === encoded(claim.consumed).bytes
        && op.operation === capability.operation
        && op.attempt === capability.attempt && op.digest === capability.digest
        && op.executor === capability.executor && op.executor === host.incarnation
        && encoded(op.fence).bytes === encoded(token).bytes, 'exact consumed operation required');
      const serving = servingView(servingRecords(all));
      if (serving.binding) {
        checkServingRun(all, op.run);
        ensure(host.monotonic() < serving.binding.expires, 'serving profile expired before physical invocation');
      }
      const pair = servingView(servingRecords(all)).binding ? servingPair(all, op.run)
        : all.find(p => p.record.type === 'RunPairAdmission')?.record as RunPairAdmission | undefined;
      if (pair) checkPairParent(all, facts, pair);
      // Storage/callback-capable work is complete. These host accessors are local,
      // non-waiting, and cannot reenter; invoke immediately after the live checks.
      live(host); fence(all, token);
      return invoke();
    }));
  bindRunPairIssuer(authority, (graph, command, token, reply, policy) => checked('RunPairAdmission', { command, token, reply, policy }, () => {
    ensure(reply.owner === 'part-five' && reply.name === 'Run', 'reply Run reference required');
    policyCheck(policy);
    let all = read(); fence(all, token);
    const joined = consumeAcceptedReplyOpening(graph, spine.store, reply.id, value => value);
    const prior = servingPair(all, joined.provider);
    if (prior) {
      ensure(prior.reply === reply.id, 'fixed pair already has its one reply');
      ensure(encoded(prior.replyPolicy).bytes === encoded(policy).bytes, 'reply bounds cannot reset');
      const loop = latestLoop(all, reply.id);
      if (loop) { ensure(encoded(loop.policy).bytes === encoded(policy).bytes, 'reply bounds cannot reset'); return loop; }
    } else {
      consumeAcceptedReplyOpening(graph, spine.store, reply.id, joined => {
        all = read(); fence(all, token);
        const record = { ...meta(all, command), type: 'RunPairAdmission', profile: 'provider-reply-v1',
          ...joined, predecessor: all.at(-1)?.fact.id ?? '', originalPredecessor: joined.predecessor,
          budget: servingView(servingRecords(all)).binding?.ceiling ?? host.budget, replyPolicy: policy } as RunPairAdmission;
        withRunPairAdmission(host, record, () => write(all, record));
      });
    }
    return take(authority.schedule(`${command}:reply-loop`, token, reply, policy));
  }));
  const servingBase = (all: readonly TransportFact[]) => {
    const bound = servingView(servingRecords(all)).binding;
    ensure(bound, 'serving profile not bound');
    return { installation: bound.installation, conversation: bound.conversation, generation: bound.generation,
      ceiling: bound.ceiling, maxTurns: bound.maxTurns, maxReplies: bound.maxReplies,
      expires: bound.expires, providerMax: bound.providerMax, replyMax: bound.replyMax,
      errorLimit: bound.errorLimit, totalErrorLimit: bound.totalErrorLimit };
  };
  const servingWrite = (all: readonly TransportFact[], record: ServingRecord) =>
    withServingRecord(host, record, () => write(all, record).record);
  let servingQuiescence: ((run: string) => boolean) | undefined;
  const returned = (run: string) => host.executionQuiescent
    ? host.executionQuiescent(run) === true : servingQuiescence?.(run) === true;
  bindServingIssuer(authority, {
    registerQuiescence: check => checked('ServingQuiescence', null, () => {
      ensure(typeof check === 'function' && !servingQuiescence,
        'serving quiescence supervisor already registered or absent');
      servingQuiescence = check;
    }),
    inspect: () => checked('ServingInspect', null, () => servingView(servingRecords(read()))),
    bind: (command: string, token: FenceToken, binding: ServingBinding) => checked('ServingBind', binding, () => {
      const all = read(); fence(all, token);
      const existing = servingView(servingRecords(all)).binding;
      if (existing) {
        ensure(existing.command === command && encoded(binding).bytes === encoded({ installation: existing.installation,
          conversation: existing.conversation, ceiling: existing.ceiling, maxTurns: existing.maxTurns,
          maxReplies: existing.maxReplies, expires: existing.expires, providerMax: existing.providerMax,
          replyMax: existing.replyMax, errorLimit: existing.errorLimit,
          totalErrorLimit: existing.totalErrorLimit }).bytes, 'serving binding changed');
        return existing;
      }
      const record = { ...meta(all, command), type: 'ServingRecord', profile: 'successive-turns-v1', action: 'bind',
        ...binding, generation: token.generation, input: '', opening: '', provider: '', reply: '',
        operation: '', attempt: '', operations: [], outcome: 'none' } as unknown as ServingRecord;
      return servingWrite(all, record);
    }),
    admit: (command: string, token: FenceToken, input: string, provider: string) => checked('ServingAdmit',
      { command, input, provider }, () => {
        const all = read(); fence(all, token);
        const history = servingRecords(all), prior = history.find(r => r.action === 'admit' && r.input === input);
        if (prior) { ensure(prior.provider === provider, 'admitted input relabelled'); return prior; }
        const facts = take(spine.store.read()), opening = facts.find(f => f.kind === 'run-opening'
          && (f.body as { run?: string }).run === provider
          && (f.body as { record?: { opening?: { id?: string } } }).record?.opening?.id === input);
        ensure(opening, 'exact Five opening absent');
        const record = { ...meta(all, command), type: 'ServingRecord', profile: 'successive-turns-v1',
          action: 'admit', ...servingBase(all), input, opening: opening.id, provider,
          reply: '', operation: '', attempt: '', operations: [], outcome: 'none' } as unknown as ServingRecord;
        return servingWrite(all, record);
      }),
    retire: (command: string, token: FenceToken, provider: string, operation: string) => checked('ServingRetire',
      { command, provider, operation }, () => {
        let all = read(); fence(all, token);
        const history = servingRecords(all), prior = history.find(r => r.action === 'retire' && r.provider === provider);
        if (prior) { ensure(prior.operation === operation, 'retirement changed'); return prior; }
        const pair = all.find(p => p.record.type === 'RunPairAdmission' && p.record.provider === provider)?.record as RunPairAdmission | undefined;
        ensure(returned(provider) && (!pair || returned(pair.reply)),
          'local executor has not returned or terminated');
        for (const prepared of reservations(all).filter(p => p.state === 'prepared'
          && (p.run === provider || p.run === pair?.reply))) {
          take(authority.close(`${command}:close:${encoded(prepared.operation).hash}`, token, prepared.operation));
          all = read(); fence(all, token);
        }
        ensure(returned(provider) && (!pair || returned(pair.reply)),
          'local executor resumed before retirement');
        const operations = reservations(all).filter(p => p.run === provider || p.run === pair?.reply)
          .map(p => p.operation).sort();
        const record = { ...meta(all, command), type: 'ServingRecord', profile: 'successive-turns-v1',
          action: 'retire', ...servingBase(all), input: '', opening: '', provider,
          reply: pair?.reply ?? '', operation, attempt: '', operations, outcome: 'none' } as unknown as ServingRecord;
        return servingWrite(all, record);
      }),
    start: (command: string, token: FenceToken, attempt: string, provider: string) => checked('ServingStart',
      { command, attempt, provider }, () => {
        const all = read(); fence(all, token);
        const prior = servingRecords(all).find(r => r.action === 'start' && r.attempt === attempt);
        if (prior) { ensure(prior.provider === provider, 'attempt changed'); return prior; }
        return servingWrite(all, { ...meta(all, command), type: 'ServingRecord', profile: 'successive-turns-v1',
          action: 'start', ...servingBase(all), input: '', opening: '', provider,
          reply: '', operation: '', attempt, operations: [], outcome: 'none' } as unknown as ServingRecord);
      }),
    result: (command: string, token: FenceToken, attempt: string, outcome: 'success' | 'error', operation: string) =>
      checked('ServingResult', { command, attempt, outcome }, () => {
        const all = read(); fence(all, token);
        const history = servingRecords(all), start = history.find(r => r.action === 'start' && r.attempt === attempt);
        ensure(start, 'attempt start absent');
        const prior = history.find(r => r.action === 'result' && r.attempt === attempt);
        if (prior) { ensure(prior.outcome === outcome && prior.operation === operation, 'attempt result changed'); return prior; }
        if (outcome === 'error') ensure(returned(start.provider),
          'pending attempt has a live local executor');
        return servingWrite(all, { ...meta(all, command), type: 'ServingRecord', profile: 'successive-turns-v1',
          action: 'result', ...servingBase(all), input: '', opening: '', provider: start.provider,
          reply: '', operation, attempt, operations: [], outcome } as unknown as ServingRecord);
      }),
  });
  return authority;
}

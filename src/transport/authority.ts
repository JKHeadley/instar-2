import type { BoundaryContext, Result } from '../index.js';
import { authorAndAppend } from '../facts/index.js';
import type { FactStorePort } from '../facts/index.js';
import type { AdmissionReservation, DispatchClaim, FactAuthor, FenceToken, Lease, LoopRecord, RecoveryRecord,
  SettlementApplication, SettlementConsumer, TransportAuthority, TransportFact, TransportHost, TransportRecord, TransportSpine } from './contracts.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { checkFence, fenceFor, kindFor, latestLease, latestLoop, live, loopActive, observationAdmission, policyCheck, reservations, rows, validateTransition } from './records.js';
import { accounting, checkAccountingReceipt, checkApplicationEvidence, requireAccountingDurability, requireSettlementConsumer, settlementMatches, withApplication } from './settlement.js';

export function createTransportSpine(host: TransportHost, author: FactAuthor, store: FactStorePort): TransportSpine {
  return Object.freeze({ store, append: (record: TransportRecord, required: readonly string[]) => authorAndAppend({
    kind: kindFor(record.type), schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(host.current().clock),
    body: json({ record }), required,
  }, author.context, store, author.privateKey) });
}

export function createTransportAuthority<S = never>(host: TransportHost, spine: TransportSpine, c: BoundaryContext, settlementConsumer?: SettlementConsumer<S>): TransportAuthority<S> {
  // A capability is minted only by this live issuer. JSON/restart never recreates it.
  const claims = new WeakMap<object, { operation: string; used: boolean }>();
  let lastTick = -1;
  const tick = () => { const t = host.monotonic(); ensure(Number.isSafeInteger(t) && t >= lastTick && t >= 0, 'monotonic clock regressed'); lastTick = t; return t; };
  const read = (): readonly TransportFact[] => {
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(e => !e.taint.length && !e.conflicts.length), 'tainted or conflicted fact prefix');
    const all = rows(snapshot.entries.map(e => e.fact), host.domain);
    ensure(all.length <= 4096, 'single-conversation replay bound exhausted');
    return all;
  };
  const checked = <T>(name: string, input: unknown, run: () => T): Result<T> => boundary(name, input, c, () => {
    ensure(Number.isSafeInteger(host.budget) && host.budget >= 0 && Number.isSafeInteger(host.maxLeaseTerm) && host.maxLeaseTerm > 0, 'invalid host bounds');
    live(host); return run();
  });
  const meta = (all: readonly TransportFact[], command: string) => ({ schemaVersion: 1 as const, domain: host.domain,
    command, predecessor: all.at(-1)?.fact.id ?? '', authority: host.authorityIncarnation, tick: tick() });
  const write = <T extends TransportRecord>(all: readonly TransportFact[], r: T): { record: T; all: readonly TransportFact[] } => {
    validateTransition(r, all, host, true);
    const required = r.predecessor ? [r.predecessor] : [];
    if (r.type === 'SettlementApplication') required.push(r.settlementFact);
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
  return Object.freeze({
    inspect: () => boundary('TransportInspect', null, c, read),
    settle: (token, settlement) => checked('SettlementApply', { token }, () => {
      ensure(settlementConsumer, 'eight settlement consumer is not installed');
      requireSettlementConsumer(host, settlementConsumer);
      return take(settlementConsumer(settlement, c, s => {
        // Eight may have persisted assessment/settlement facts during consumption.
        // Read the fresh status-bearing prefix only AFTER that owner recheck.
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
        if (prior) {
          ensure(prior.type === 'SettlementApplication' && Object.entries(fields).every(([k, v]) => prior[k as keyof SettlementApplication] === v), 'settlement identity reused with changed application');
          requireAccountingDurability(all.find(v => v.record === prior)!, op, host);
          return prior;
        }
        const r = { ...meta(all, `settle:${encoded([s.operation, s.id]).hash}`), type: 'SettlementApplication', ...fields } as SettlementApplication;
        checkApplicationEvidence(r, facts, all);
        return withApplication(host, r, settlementConsumer, () => write(all, r).record);
      }));
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
      claims.set(capability, { operation: saved.record.operation, used: false }); return capability;
    }),
    consume: (capability, token) => checked('DispatchConsume', { operation: capability?.operation, token }, () => {
      const claim = claims.get(capability); ensure(claim && !claim.used, 'dispatch claim absent or already consumed');
      const all = read(); fence(all, token);
      const old = reservations(all).find(p => p.operation === claim.operation);
      ensure(old?.state === 'dispatch-claimed' && old.executor === host.incarnation, 'claim no longer callable');
      // Burn before durable append. Failed acknowledgement is uncertainty, never a reusable handle.
      claim.used = true;
      return write(all, { ...old, ...meta(all, `consume:${old.operation}`), state: 'consumed' }).record;
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

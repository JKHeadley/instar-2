/** Five's receiving Run owner. Proposals are data, never authority: opening,
 * start, settlement and exit all pass the existing canonical graph. The ledger
 * retains the one remote-child → local-Run mapping; there is no second store. */
import { decode, grantLiveness, scopeIncludes } from '../index.js';
import type { Clock, Result } from '../index.js';
import type { FactStorePort } from '../facts/index.js';
import type { TransportAuthority, AdmissionReservation } from '../transport/index.js';
import type { DelegationContract, DelegationLedger, DelegationRequest } from './delegation.js';
import type { DelegatedRunAuthority, WorkerOutcome } from './agent-transport.js';
import { childAuthority, foldDelegation } from './delegation.js';
import { offerEnvelope } from './agent-transport.js';
import type { Run, RunAdmissionPort, RunDecodeContext, RunGraphDependencies, RunGraphPort, RunView } from './types.js';
import { constitutional, decodeRun, runIdFor } from './records.js';
import { boundary, encoded, freeze, json, need, same, take } from './boundary.js';

/** The installed issuer supplies candidate records from Four's admitted cause
 * and the existing run policy. These methods cannot admit a record or replace
 * Five/Six/Eight/Nine's independent checks. */
export interface DelegatedRunProposals {
  opening(contract: DelegationContract): Result<unknown>;
  start(contract: DelegationContract, run: RunView): Result<unknown>;
  /** Seven requires Five's admitted pending step before Eight can prepare the
   * exact provider operation. Preparation reserves; it does not dispatch. */
  prepare?(contract: DelegationContract, run: RunView): Result<void>;
  close(contract: DelegationContract, run: RunView, outcome: WorkerOutcome): Result<unknown>;
  /** Existing recorded output only; never dispatches or re-executes work. */
  recover?(contract: DelegationContract, run: RunView): Result<WorkerOutcome | null>;
}
export interface DelegatedRunOwnerInput {
  readonly graph: RunGraphPort;
  readonly ledger: DelegationLedger;
  readonly store: FactStorePort;
  readonly admission: RunAdmissionPort;
  readonly transport: TransportAuthority<unknown>;
  readonly proposals: DelegatedRunProposals;
  readonly exitCheck: RunGraphDependencies['exitCheck'];
  context(): RunDecodeContext;
  current(): Readonly<{ clock: Clock; stopped: boolean; principal: string }>;
}

/** Narrow an already admitted local policy Run. Four remains the cause and
 * owner resolver; the remote contract never supplies a local principal, grant,
 * exit-bar implementation or result destination. Step/closure candidates come
 * from the installed Eight/Ten work issuer and still pass the graph below. */
export function createDelegatedRunProposals(input: Readonly<{
  graph: RunGraphPort; policyRun(): string; context(): RunDecodeContext; clock(): Clock;
  steps: Pick<DelegatedRunProposals, 'start' | 'prepare' | 'close' | 'recover'>;
}>): DelegatedRunProposals {
  return freeze({ ...input.steps,
    opening: contract => boundary('DelegatedRunProposal', contract, input.context(), () => {
      const c = input.context(), policy = take(input.graph.read(input.policyRun()));
      need(policy.conflicts.length === 0 && policy.state !== 'halted', 'delegation: local policy Run inhibited');
      const matching = c.facts.facts.filter(fact => fact.kind === 'intake-admitted'
        && (fact.body as { intent?: { ask?: unknown } }).intent?.ask === encoded(offerEnvelope(contract)).bytes);
      const cause = matching[0]; need(cause, 'delegation: authenticated Four cause absent');
      const opening = { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: cause.id };
      const rawIntent = (cause.body as { intent: { id: string; under: readonly string[] } }).intent;
      const prior = policy.run, clock = input.clock(), budgetId = `budget:${contract.id}`;
      need(prior.scope.kind !== 'organization', 'delegation: explicit local scope required');
      const directives = rawIntent.under.map(id => {
        const directive = prior.directives.find(row => row.id === id);
        need(directive, 'delegation: applicable directive missing from local policy'); return directive;
      });
      return take(decodeRun({ ...prior, id: runIdFor(opening), opening,
        intent: { type: 'Intent', id: rawIntent.id, fact: opening, field: 'intent' }, directives,
        authority: { ...prior.authority, resolution: opening },
        scope: { ...prior.scope, members: prior.scope.members.filter(member => contract.scope.includes(member)) },
        budget: { ...prior.budget, id: budgetId,
          resources: prior.budget.resources.map(row => ({ ...row, subject: { ...row.subject, instance: budgetId },
            value: row.subject.kind === 'run-work' && row.unit === 'steps' ? Math.min(row.value, contract.budget) : row.value })),
          maxChildren: Math.min(prior.budget.maxChildren, contract.childLimit.maxChildren),
          maxDepth: Math.min(prior.budget.maxDepth, contract.childLimit.maxDepth),
          safetyCeiling: { ...prior.budget.safetyCeiling,
            value: Math.min(prior.budget.safetyCeiling.value, contract.expiresAt),
            at: Math.min(prior.budget.safetyCeiling.value, contract.expiresAt) } },
        createdAt: clock, blockedOn: { kind: 'nothing' },
        nextWake: { owner: prior.owner, at: clock, reason: 'admitted delegated work' },
      }, c));
    }) });
}

const issued = new WeakSet<object>();
export const isDelegatedRunAuthority = (authority: DelegatedRunAuthority): boolean => issued.has(authority);

export interface ProductionDelegatedRunAuthority extends DelegatedRunAuthority {
  /** Recheck after origin projection and immediately before an effectful offer. */
  authorizeDispatch(contract: DelegationContract): Result<void>;
  delegate(parentRun: string, request: Omit<DelegationRequest, 'parent' | 'grants' | 'at' | 'generation' | 'resultDestination'>):
    Result<Readonly<{ contract: DelegationContract; parent: Run }>>;
}

export function createDelegatedRunAuthority(input: DelegatedRunOwnerInput): ProductionDelegatedRunAuthority {
  const context = () => {
    const c = input.context();
    // A clean verified prefix is required even when a previously admitted Run
    // can be read. Missing evidence is not permission to reconstruct authority.
    const prefix = take(input.store.verifiedPrefix());
    const snapshot = take(input.store.readForProjection());
    need(snapshot.entries.every(row => !row.taint.length && !row.conflicts.length),
      'delegation: tainted or conflicting owner evidence');
    return { ...c, facts: { ...c.facts, facts: prefix.facts } };
  };
  const contractAt = (contract: DelegationContract, at: number, executing: boolean) => {
    const now = input.current(), c = context();
    need(Number.isSafeInteger(at) && at <= now.clock.value
      && (!executing || now.clock.value - at <= Math.min(1000, contract.collectionCadence)), 'delegation: stale or future owner observation');
    need(!now.stopped, 'delegation: installation stopped');
    const edge = input.ledger.view().get(contract.id);
    need(edge && same(edge.contract, contract) && edge.conflicts.length === 0
      && edge.dispatchable, 'delegation: exact durable contract unavailable');
    need(contract.recipient === now.principal, 'delegation: contract belongs to another recipient');
    if (executing) need(now.clock.value >= contract.createdAt && now.clock.value < contract.expiresAt
      && edge.cancellation === 'none' && !edge.result && !edge.retained,
    'delegation: expired, cancelled or terminal edge');
    return { now, c, edge };
  };
  const bound = (contract: DelegationContract, run: Run, c: RunDecodeContext) => {
    const cause = c.facts.facts.find(fact => fact.id === run.opening.id);
    need(cause?.kind === 'intake-admitted', 'delegation: actual Four intake required');
    const intent = constitutional(run.intent, 'Intent', c).view;
    need(intent.via === 'threadline-intake-v1' && intent.principal.kind === 'agent'
      && intent.principal.id === contract.owner
      && intent.ask === encoded(offerEnvelope(contract)).bytes,
    'delegation: authenticated sender or exact offered intent differs');
    need(run.owner.id === contract.recipient, 'delegation: local accountable Run owner differs');
    need(run.scope.kind !== 'organization' && run.scope.members.length > 0
      && run.scope.members.every(member => contract.scope.includes(member)), 'delegation: Run exceeds contract scope');
    need(run.budget.safetyCeiling.value <= contract.expiresAt
      && run.budget.maxChildren <= contract.childLimit.maxChildren
      && run.budget.maxDepth <= contract.childLimit.maxDepth,
    'delegation: local lifetime or recursion exceeds allocation');
    need(run.exitTest.check === contract.exitTest.check && run.exitTest.version === contract.exitTest.version
      && same([...run.exitTest.evidenceKinds].sort(), [...contract.exitTest.evidence].sort()),
    'delegation: local exit test differs');
    // The count is an explicitly declared run-work/steps allocation; never
    // compare an unrelated money/token measurement with a task count.
    const work = run.budget.resources.filter(row => row.subject.kind === 'run-work' && row.unit === 'steps');
    need(work.length === 1 && work[0]!.value <= contract.budget, 'delegation: bounded task allocation required');
    need(run.authority.grants.length > 0, 'delegation: local standing required');
    const grants = run.authority.grants.map(ref => {
      const historical = constitutional(ref, 'StandingGrant', c);
      const grant = c.types.grants?.find(item => item.id === ref.id);
      need(grant && same(grant, historical.view) && grant.grantee.id === run.owner.id
        && (grant.standing === 'operator' || grant.standing === 'delegate') && scopeIncludes(grant.scope, run.scope)
        && grantLiveness(grant, c.types.revocations ?? [], input.current().clock) === 'live',
      'delegation: resolved local grant is missing, stale or outside scope');
      return grant;
    });
    need(contract.actions.length > 0 && contract.actions.every(action => grants.some(grant =>
      grant.standing === 'operator' || grant.actions.includes(action))), 'delegation: action outside resolved standing');
    // Intersection, never substitution: verified sender standing AND recipient
    // standing must cover every action. A foreign id alone grants nothing; the
    // existing P1 context must already hold its resolved live grant. No grant
    // is minted by receiving a message, and the recipient cannot borrow a wider
    // local role to escape the contract's actions or scope.
    const parentGrants = contract.grants.map(id => c.types.grants?.find(grant => grant.id === id));
    need(parentGrants.length > 0 && parentGrants.every(grant => grant
      && grant.grantee.id === contract.owner && scopeIncludes(grant.scope, run.scope)
      && grantLiveness(grant, c.types.revocations ?? [], input.current().clock) === 'live'
      && (grant.standing === 'operator' || c.types.register.allowRedelegation)),
    'delegation: foreign grant is unresolved, revoked or cannot redelegate');
    need(contract.actions.every(action => parentGrants.some(grant => grant
      && (grant.standing === 'operator' || grant.actions.includes(action)))), 'delegation: sender action outside standing');
  };
  const local = (contract: DelegationContract, localRun: string, c: RunDecodeContext) => {
    const edge = input.ledger.view().get(contract.id);
    need(edge?.acceptance?.localRun === localRun && edge.executable,
      'delegation: exact durable recipient mapping required');
    const run = take(input.graph.read(localRun));
    need(run.conflicts.length === 0, 'delegation: conflicted Run');
    bound(contract, run.run, c); return run;
  };
  const terminal = (contract: DelegationContract, localRun: string) => {
    const edge = input.ledger.view().get(contract.id);
    need(edge && same(edge.contract, contract) && edge.conflicts.length === 0
      && edge.acceptance?.localRun === localRun && edge.executable,
    'delegation: exact durable terminal mapping required');
    const run = take(input.graph.read(localRun));
    need(run.conflicts.length === 0 && run.run.owner.id === contract.recipient,
      'delegation: conflicting terminal owner');
    if (run.state !== 'completed') return null;
    need(run.pending.length === 0, 'delegation: terminal Run still has pending work');
    const exit = take(input.graph.readExit({ owner: 'part-five', name: 'Run', id: localRun }));
    take(input.exitCheck.verify(exit.exit, run.run, exit.exit.at));
    const c = context();
    const result = take(take(decode('Result', constitutional(exit.exit.result, 'Result', c).view, c.types)));
    need(result !== null && typeof result === 'object'
      && !Array.isArray(result), 'delegation: checked worker result absent');
    const value = result as Record<string, unknown>;
    need(['completed', 'refused', 'cancelled', 'failed'].includes(String(value.terminal))
      && typeof value.result === 'string'
      && Object.keys(value).every(key => ['terminal', 'result', 'evidence', 'effects'].includes(key))
      && [value.evidence, value.effects].every(items => items === undefined
        || Array.isArray(items) && items.every(item => typeof item === 'string')),
    'delegation: checked result is not a closed worker outcome');
    const rows = take(input.transport.inspect());
    for (const key of run.usedKeys) {
      const reservation = rows.filter(row => row.record.type === 'AdmissionReservation'
        && row.record.semanticMessage === key && row.record.run === localRun).at(-1)?.record;
      need(reservation?.type === 'AdmissionReservation', 'delegation: exact used operation mapping absent');
      const operation = reservation.operation;
      const accounting = rows.filter(row => row.record.type === 'SettlementApplication'
        && row.record.operation === operation).at(-1)?.record;
      need(accounting?.type === 'SettlementApplication' && accounting.unresolved === 0
        && accounting.actualCharge >= 0 && accounting.capViolation === 0,
      'delegation: actual closed resource accounting unavailable');
    }
    // The contract's budget is run-work/steps, not currency. Six separately
    // proves each actual resource charge closed and within its reservation.
    const spent = run.usedKeys.length;
    need(spent <= contract.budget, 'delegation: task allocation exceeded');
    return { outcome: value as WorkerOutcome, runExit: exit.exit.id, spent };
  };
  const parentStanding = (parentRun: string, actions: readonly string[]) => {
          const current = input.current(), view = take(input.graph.read(parentRun));
          need(!current.stopped && ['ready', 'running'].includes(view.state) && view.conflicts.length === 0
            && view.run.owner.id === current.principal, 'delegation: current accountable parent required');
          const run = view.run, c = context();
          const leases = take(input.transport.inspect()).filter(row => row.record.type === 'Lease');
          const lease = leases.at(-1)?.record;
          need(lease?.type === 'Lease' && lease.state === 'held' && lease.expires > current.clock.value
            && lease.holder === run.owner.id && lease.generation === run.generation.id,
          'delegation: parent current lease unavailable');
          const assignment = leases.find(row => row.record.type === 'Lease' && row.record.epoch === lease.epoch
            && row.record.operation === 'acquire');
          need(assignment, 'delegation: parent lease assignment absent');
          take(input.admission.execution(parentRun, { owner: 'part-six', name: 'Lease', id: assignment.fact.id }));
          need(run.scope.kind !== 'organization', 'delegation: explicit parent scope required');
          const grants = run.authority.grants.map(reference => {
            const saved = constitutional(reference, 'StandingGrant', c).view;
            const live = c.types.grants?.find(grant => grant.id === saved.id);
            need(live && same(live, saved) && live.grantee.id === run.owner.id
              && scopeIncludes(live.scope, run.scope)
              && grantLiveness(live, c.types.revocations ?? [], current.clock) === 'live',
            'delegation: parent standing is absent, changed or stale');
            need(live.standing === 'operator' || c.types.register.allowRedelegation,
              'delegation: parent cannot redelegate'); return live;
          });
          need(grants.length > 0 && actions.every(action => grants.some(grant =>
            grant.standing === 'operator' || grant.actions.includes(action))), 'delegation: action outside parent standing');
    return { current, view, run, c, grants };
  };
  const authority: ProductionDelegatedRunAuthority = freeze({
    authorizeDispatch: contract => boundary('DelegationDispatch', contract, input.context(), () => {
      const edge = input.ledger.view().get(contract.id);
      need(edge && same(edge.contract, contract) && edge.dispatchable && edge.conflicts.length === 0
        && edge.cancellation === 'none' && !edge.result, 'delegation: exact active outgoing edge required');
      const parentEdge = contract.parentEdge === null ? null : input.ledger.view().get(contract.parentEdge);
      need(contract.parentEdge === null || parentEdge?.contract.childRun === contract.parentRun
        && parentEdge.acceptance && parentEdge.cancellation === 'none' && !parentEdge.result,
      'delegation: accountable incoming parent unavailable');
      const parentRun = parentEdge?.acceptance?.localRun ?? contract.parentRun;
      const { current, run, grants } = parentStanding(parentRun, contract.actions);
      const scope = run.scope;
      need(contract.owner === current.principal && current.clock.value < contract.expiresAt
        && contract.grants.every(id => grants.some(grant => grant.id === id))
        && scope.kind !== 'organization' && contract.scope.every(member => scope.members.includes(member)),
      'delegation: outgoing scope, standing or lifetime changed');
    }),
    delegate: (parentRun, request) => boundary('DelegateFromRun', { parentRun, request }, input.context(), () => {
          const { current, view, run, grants } = parentStanding(parentRun, request.actions);
          need(run.scope.kind !== 'organization', 'delegation: explicit parent scope required');
          const allocation = run.budget.resources.find(row => row.subject.kind === 'run-work' && row.unit === 'steps');
          need(allocation && allocation.value > view.usedKeys.length, 'delegation: parent task allocation exhausted');
          const incoming = [...input.ledger.view().values()].find(edge => edge.acceptance?.localRun === parentRun && edge.executable);
          const parent = incoming ? { ...childAuthority(incoming.contract),
            grants: grants.map(grant => grant.id),
            budget: Math.min(incoming.contract.budget, allocation.value - view.usedKeys.length) } : {
            run: parentRun, edge: null, depth: 1, owner: run.owner.id, scope: run.scope.members,
            actions: request.actions, grants: grants.map(grant => grant.id), budget: allocation.value - view.usedKeys.length,
            maxChildren: run.budget.maxChildren, maxDepth: run.budget.maxDepth, expiresAt: run.budget.safetyCeiling.value };
          need(!incoming || incoming.cancellation === 'none' && !incoming.result,
            'delegation: parent edge is cancelled or terminal');
          const contract = take(input.ledger.delegate({ ...request, parent, grants: parent.grants,
            resultDestination: { run: parent.run, edge: parent.edge },
            at: current.clock.value, generation: run.generation.id }));
          return { contract, parent: run };
    }),
    admit: (contract, at) => boundary('DelegatedRunAdmit', contract, input.context(), () => {
      const { c, edge } = contractAt(contract, at, true);
      if (edge.acceptance) { local(contract, edge.acceptance.localRun, c); return { localRun: edge.acceptance.localRun }; }
      const candidate = take(decodeRun(take(input.proposals.opening(contract)), c));
      bound(contract, candidate, c);
      const opened = take(input.graph.open(candidate));
      need(same(opened.run, candidate), 'delegation: canonical Run opening differs');
      return { localRun: opened.run.id };
    }),
    start: (contract, localRun, at) => boundary('DelegatedRunStart', { contract, localRun }, input.context(), () => {
      const { c } = contractAt(contract, at, true);
      let run = local(contract, localRun, c);
      need(run.state === 'ready' || run.state === 'running', 'delegation: stopped or unresolved Run');
      if (run.state === 'ready') {
        const allocation = run.run.budget.resources.find(row => row.subject.kind === 'run-work' && row.unit === 'steps')!;
        need(run.usedKeys.length < allocation.value, 'delegation: task allocation exhausted');
        run = take(input.graph.transition(take(input.proposals.start(contract, run))));
      }
      need(run.state === 'running' && run.pending.length === 1, 'delegation: one canonical pending step required');
      const step = run.pending[0]!;
      take(input.admission.execution(localRun, step.ownership));
      // Worker placement allocation and the provider/effect invocation are
      // distinct Six reservations. Five's allocation cannot stand in for the
      // latter, and a later invocation cannot retroactively place a worker.
      take(input.admission.reservation(step.allocation.reservation, step));
      if (input.proposals.prepare) take(input.proposals.prepare(contract, run));
      const rows = take(input.transport.inspect());
      const lease = rows.filter(row => row.record.type === 'Lease').at(-1)?.record;
      need(lease?.type === 'Lease' && lease.state === 'held' && lease.expires > input.current().clock.value
        && lease.holder === run.run.owner.id && lease.generation === run.run.generation.id,
      'delegation: current lease or generation unavailable');
      const reservations = rows.filter((row): row is typeof row & { record: AdmissionReservation } =>
        row.record.type === 'AdmissionReservation' && row.record.semanticMessage === step.operation.key
          && row.record.run === localRun && row.record.digest === step.operation.digest);
      const reservation = reservations.at(-1);
      need(reservation
        && reservation.record.state === 'prepared' && reservation.record.run === localRun
        && reservation.record.digest === step.operation.digest
        && reservation.record.fence.assignment === step.ownership.id,
      'delegation: exact unconsumed resource reservation required; unknown execution cannot restart');
      const refreshed = context();
      const request = refreshed.facts.facts.find(fact => (fact.body as { record?: { id?: string } }).record?.id === reservation.record.request);
      const requestBody = (request?.body as { record?: { definition?: string; run?: string } } | undefined)?.record;
      const definition = refreshed.facts.facts.find(fact => fact.kind.startsWith('effect-')
        && (fact.body as { record?: { id?: string } }).record?.id === requestBody?.definition);
      const definitionBody = (definition?.body as { record?: { feature?: string; scopeDigest?: string;
        authority?: { scope?: string } } } | undefined)?.record;
      need(requestBody?.run === localRun && definitionBody?.feature
        && contract.actions.includes(definitionBody.feature)
        && (definitionBody.scopeDigest ?? definitionBody.authority?.scope) === encoded(run.run.scope).hash,
      'delegation: prepared effect escapes delegated action or exact scope');
      const final = contractAt(contract, input.current().clock.value, true);
      bound(contract, run.run, final.c);
      need(lease.expires > input.current().clock.value, 'delegation: lease expired during admission');
      return { reservation: reservation.fact.id };
    }),
    close: (contract, localRun, outcome, at) => boundary('DelegatedRunClose', { contract, localRun, outcome }, input.context(), () => {
      const { c } = contractAt(contract, at, false);
      let run = local(contract, localRun, c);
      // Each next candidate must use the head actually admitted by the previous
      // transition. Precomputing an array would guess Five's signed fact ids.
      for (let remaining = 4; run.state !== 'completed' && remaining > 0; remaining--) {
        const before = run.head;
        run = take(input.graph.transition(take(input.proposals.close(contract, run, outcome))));
        need(run.head !== before, 'delegation: closure made no canonical progress');
      }
      const completed = terminal(contract, localRun);
      need(completed && same(completed.outcome, json(outcome)), 'delegation: checked terminal result differs from worker claim');
      return { runExit: completed.runExit, spent: completed.spent };
    }),
    reconcile: (contract, localRun, at) => boundary('DelegatedRunReconcile', { contract, localRun }, input.context(), () => {
      const { c } = contractAt(contract, at, false);
      const run = local(contract, localRun, c);
      if (!input.proposals.recover || run.usedKeys.length === 0) return null;
      const outcome = take(input.proposals.recover(contract, run));
      if (outcome === null) return null;
      take(authority.close(contract, localRun, outcome, at));
      return terminal(contract, localRun);
    }),
    // Read-only recovery is legal after stop, expiry or revocation. It returns
    // only an already checked exit and settled charges; it never re-runs work.
    collect: (contract, localRun) => boundary('DelegatedRunCollect', { contract, localRun }, input.context(),
      () => terminal(contract, localRun)),
  });
  issued.add(authority); return authority;
}

/** Six's schedule consumer for an already admitted receiving Run. This extends
 * the old one-root slice using Five's existing signed acceptance and Four cause;
 * it does not open a Run or resolve a foreign grant. The Six lease, placement,
 * global exposure, per-run unresolved-work and dispatch checks still apply. */
export function delegatedRunSchedule(facts: readonly import('../facts/index.js').FactEnvelope[],
  runId: string, principal: string): DelegationContract | null {
  const opening = facts.find(fact => fact.kind === 'run-opening' && (fact.body as { run?: string }).run === runId);
  const run = (opening?.body as { record?: Run } | undefined)?.record;
  if (!run || run.owner.id !== principal) return null;
  const rows = facts.filter(fact => fact.kind === 'run-delegation' && fact.principal.id === principal)
    .map(fact => JSON.parse(String((fact.body as { record: string }).record)) as import('./delegation.js').DelegationRecord);
  const matched = [...foldDelegation(rows).values()].filter(edge => edge.acceptance?.localRun === runId);
  if (matched.length !== 1) return null;
  const edge = matched[0]!, contract = edge.contract, { digest, ...body } = contract;
  const cause = facts.find(fact => fact.id === run.opening.id && fact.kind === 'intake-admitted');
  const intent = (cause?.body as { intent?: { via?: string; ask?: string; principal?: { id?: string; kind?: string } } } | undefined)?.intent;
  if (!edge.executable || edge.conflicts.length || edge.cancellation !== 'none' || edge.result
    || contract.recipient !== principal || digest !== encoded(body).hash
    || intent?.via !== 'threadline-intake-v1' || intent.principal?.id !== contract.owner
    || intent.principal.kind !== 'agent' || intent.ask !== encoded(offerEnvelope(contract)).bytes
    || !opening!.predecessors.required.includes(run.opening.id)
    || run.authority.grants.length === 0 || run.budget.safetyCeiling.value > contract.expiresAt
    || run.budget.resources.filter(row => row.subject.kind === 'run-work' && row.unit === 'steps').length !== 1
    || run.budget.resources.some(row => row.subject.kind === 'run-work' && row.unit === 'steps' && row.value > contract.budget)) return null;
  return contract;
}

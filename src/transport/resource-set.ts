// Composed multidomain resource admission (SEAM-LEDGER row 36, the resource-set
// addendum of seam-response-loop-followup.md; docs/10 §5 "delegation transfers
// credits without duplicating them"). Additive: the existing one-domain `reserve`,
// AdmissionReservation and every legacy record keep their bytes and meaning.
//
// One immutable allocation id is prepared in each of its domains, one durable
// version per domain, and becomes spendable (`committed`) only after every domain
// accepted its exact debit. Attachment to an ordinary AdmissionReservation is the
// launch gate. Close returns each debit once, one durable version per domain.
// A crash leaves a readable preparing/closing set: re-issuing the same command
// completes the same set, and closing a preparing set returns only the debits it
// actually prepared. Unknown execution keeps the allocation reserved: only the
// caller that knows the outcome closes, and a Six settlement with unresolved
// charge refuses the close.
import type { BoundaryContext, Result } from '../index.js';
import { authorAndAppend, causalCone, registerOwnedBody } from '../facts/index.js';
import type { AppendReceipt, FactEnvelope, FactSchema, FactStorePort, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import type { AdmissionReservation, FactAuthor, FenceToken, ResourceAllocationSet, ResourceDemand, ResourceDomainPolicy,
  ResourceSetAuthority, ResourceSetHost, TransportFact } from './contracts.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { checkFence, fenceFor, latestLease, live, reservations, rows, shapeCheck, transportShapes } from './records.js';

export const resourceSetFactKind = 'transport-ResourceAllocationSet';
const txt = { kind: 'text', maxLength: 256 } as const;
const int = { kind: 'integer' } as const;
const list = { kind: 'array', maxLength: 16, items: txt } as const;
const demandShape: OwnedShape = { kind: 'object', fields: { dimension: txt, domain: txt, resource: txt, amount: int,
  policy: txt, expectedPredecessor: txt } };
export const resourceSetShape: OwnedShape = freeze({ kind: 'object', fields: { type: txt, schemaVersion: int, owner: txt, id: txt, operation: txt,
  request: txt, run: txt, fence: transportShapes.FenceToken!, parentAllocation: txt,
  demands: { kind: 'array', maxLength: 16, items: demandShape }, prepared: list, committed: list, released: list,
  state: txt, predecessor: txt, sourceVector: txt } });
const dimensions = new Set(['global', 'installation', 'framework', 'account', 'job-family', 'job', 'ancestor']);
const states = new Set(['preparing', 'committed', 'closing', 'closed']);

export interface ResourceSetSpine {
  readonly store: FactStorePort;
  append(record: ResourceAllocationSet, required: readonly string[]): Result<AppendReceipt>;
}
type SetFact = Readonly<{ fact: FactEnvelope; record: ResourceAllocationSet }>;

/** Deterministic byte order (never locale-dependent). */
const byteOrder = (a: string, b: string): number => {
  const left = new TextEncoder().encode(a), right = new TextEncoder().encode(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i]! - right[i]!;
  return left.length - right.length;
};
const demandOrder = (a: ResourceDemand, b: ResourceDemand) => byteOrder(a.domain, b.domain) || byteOrder(a.resource, b.resource);
/** The set's domains in canonical order, each once. */
export const setDomains = (set: Pick<ResourceAllocationSet, 'demands'>): readonly string[] =>
  set.demands.map(d => d.domain).filter((domain, index, all) => all.indexOf(domain) === index);
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const prefixOf = (part: readonly string[], whole: readonly string[]) => part.length <= whole.length && part.every((v, i) => v === whole[i]);

export function resourceSetSchemas(host: ResourceSetHost): readonly FactSchema[] {
  return [{ kind: resourceSetFactKind, version: 1, fields: { record: { kind: 'owned', owner: 'part-six', name: 'ResourceAllocationSet' } },
    machineScope: 'shared', standing: 'requester', action: 'work', scope: host.scope, causallyBound: false,
    requiredReferences: [], authority: 'none' }];
}

/** Every resource-set version of this authority domain, in fact order. */
export function resourceSetRows(facts: readonly FactEnvelope[], domain: string): SetFact[] {
  return facts.filter(f => f.kind === resourceSetFactKind).map(fact => ({ fact,
    record: (fact.body as unknown as { record: ResourceAllocationSet }).record }))
    .filter(r => r.record.fence?.domain === domain);
}
const latestById = (all: readonly SetFact[]): Map<string, SetFact> => {
  const latest = new Map<string, SetFact>();
  for (const row of all) latest.set(row.record.id, row);
  return latest;
};
/** The fact that last changed a domain's debits (a prepare or a return), or '' when none. */
export function resourceDomainHead(all: readonly SetFact[], domain: string): string {
  const previous = new Map<string, ResourceAllocationSet>();
  let head = '';
  for (const { fact, record } of all) {
    const prior = previous.get(record.id);
    const prepared = record.prepared.includes(domain) && !prior?.prepared.includes(domain);
    const released = record.released.includes(domain) && !prior?.released.includes(domain);
    if (prepared || released) head = fact.id;
    previous.set(record.id, record);
  }
  return head;
}
/** Units of one domain resource currently debited by sets other than `except`. */
export function resourceDebited(all: readonly SetFact[], domain: string, resource: string, except = ''): number {
  let total = 0;
  for (const { record } of latestById(all).values()) {
    if (record.id === except || !record.prepared.includes(domain) || record.released.includes(domain)) continue;
    for (const d of record.demands) if (d.domain === domain && d.resource === resource) total += d.amount;
  }
  ensure(Number.isSafeInteger(total), 'resource accounting overflow');
  return total;
}

function recordCheck(r: ResourceAllocationSet): void {
  shapeCheck(r, resourceSetShape);
  ensure(r.type === 'ResourceAllocationSet' && r.schemaVersion === 1, 'owned type mismatch');
  ensure(r.owner === 'part-six' && r.id.startsWith('allocation:') && r.request.length > 0 && r.run.length > 0,
    'resource set identity');
  ensure(states.has(r.state), 'resource set state');
  ensure(r.demands.length > 0, 'a resource set needs at least one demand');
  const pairs = new Set<string>();
  for (const [index, d] of r.demands.entries()) {
    ensure(dimensions.has(d.dimension) && d.domain.length > 0 && d.resource.length > 0 && d.policy.length > 0,
      'demand identity');
    ensure(Number.isSafeInteger(d.amount) && d.amount > 0, 'demand amount must be a positive finite integer');
    const pair = `${d.dimension}\u0000${d.resource}`;
    ensure(!pairs.has(pair), 'exactly one demand per dimension and resource');
    pairs.add(pair);
    if (index > 0) ensure(demandOrder(r.demands[index - 1]!, d) < 0, 'demands must be canonically ordered by domain');
    ensure(d.dimension !== 'ancestor' || (r.parentAllocation.length > 0 && d.domain === r.parentAllocation),
      'an ancestor demand names the exact parent allocation');
  }
  const domains = setDomains(r);
  ensure(prefixOf(r.prepared, domains) && r.prepared.length > 0, 'prepared domains follow canonical order');
  ensure(r.committed.length === 0 || same(r.committed, domains), 'committed only with every domain');
  ensure(prefixOf(r.released, r.prepared), 'returns follow prepared order, once each');
  if (r.state === 'preparing') ensure(r.committed.length === 0 && r.released.length === 0 && r.operation === '', 'preparing set');
  if (r.state === 'committed') ensure(same(r.committed, domains) && same(r.prepared, domains) && r.released.length === 0,
    'committed set');
  if (r.state === 'closing') ensure(r.released.length > 0 && r.sourceVector.length > 0, 'closing set returns and binds its settlement');
  if (r.state === 'closed') ensure(same(r.released, r.prepared), 'closed set returned every prepared debit');
}

/** The one legal step from `prior` (the set's previous version) to `next`. */
function transitionCheck(next: ResourceAllocationSet, prior: SetFact | undefined): void {
  recordCheck(next);
  if (!prior) {
    ensure(next.state === 'preparing' && next.prepared.length === 1 && next.predecessor === '', 'a set starts by preparing its first domain');
    return;
  }
  const p = prior.record;
  ensure(next.predecessor === prior.fact.id, 'resource set predecessor changed');
  const fixed = (v: ResourceAllocationSet) => encoded({ id: v.id, request: v.request, run: v.run, fence: v.fence,
    parentAllocation: v.parentAllocation, demands: v.demands }).bytes;
  ensure(fixed(next) === fixed(p), 'resource set identity is immutable');
  const domains = setDomains(p);
  if (next.state === 'preparing') {
    ensure(p.state === 'preparing' && next.prepared.length === p.prepared.length + 1 && prefixOf(p.prepared, next.prepared)
      && next.sourceVector === p.sourceVector, 'prepare one more domain');
  } else if (next.state === 'committed' && p.state === 'preparing') {
    ensure(same(p.prepared, domains) && next.operation === '' && next.sourceVector === p.sourceVector, 'commit after every domain accepted');
  } else if (next.state === 'committed') {
    ensure(p.state === 'committed' && p.operation === '' && next.operation.startsWith('operation:') && next.sourceVector.length > 0,
      'attach once to one operation');
  } else if (next.state === 'closing' && (p.state === 'preparing' || p.state === 'committed')) {
    ensure(next.released.length === 1 && same(next.prepared, p.prepared) && next.operation === p.operation, 'close starts with the first debit');
  } else if (next.state === 'closing') {
    ensure(p.state === 'closing' && next.released.length === p.released.length + 1 && next.sourceVector === p.sourceVector
      && same(next.prepared, p.prepared) && next.operation === p.operation, 'return one more domain');
  } else {
    ensure(p.state === 'closing' && same(next.released, p.prepared) && same(p.released, p.prepared)
      && next.sourceVector === p.sourceVector && next.operation === p.operation, 'closed after every debit returned');
  }
}

/** Admission at origin: the newly prepared domain has capacity for every demand in it. */
function capacityCheck(next: ResourceAllocationSet, prior: SetFact | undefined, all: readonly SetFact[],
  policies: readonly ResourceDomainPolicy[]): void {
  const added = next.prepared.find(d => !prior?.record.prepared.includes(d));
  if (!added || next.state !== 'preparing') return;
  const demands = next.demands.filter(d => d.domain === added);
  const head = resourceDomainHead(all, added);
  for (const d of demands) {
    ensure(d.expectedPredecessor === head, 'domain predecessor changed');
    let capacity: number;
    if (d.dimension === 'ancestor') {
      const parent = latestById(all).get(d.domain)?.record;
      ensure(parent && parent.state === 'committed', 'ancestor allocation must be committed and open');
      capacity = parent.demands.filter(p => p.resource === d.resource).reduce((n, p) => n + p.amount, 0);
    } else {
      const policy = policies.filter(p => p.domain === d.domain && p.resource === d.resource);
      ensure(policy.length === 1, 'domain resource is not registered: missing approved quantity holds admission');
      const found = policy[0]!;
      ensure(found.dimension === d.dimension && found.policy === d.policy, 'demand names another domain policy');
      ensure(Number.isSafeInteger(found.capacity) && found.capacity >= 0, 'domain capacity must be finite');
      capacity = found.capacity;
    }
    ensure(resourceDebited(all, d.domain, d.resource, next.id) + d.amount <= capacity, 'resource domain capacity exhausted');
  }
}

export function registerResourceSetBodies(host: ResourceSetHost, c: BoundaryContext): Result<readonly OwnedBodyRegistration[]> {
  return boundary('ResourceSetRegistrations', null, c, () => [take(registerOwnedBody({
    name: 'ResourceAllocationSet', owner: 'part-six', currentVersion: 1,
    versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: (input, ctx) => {
      try {
        const next = input as unknown as ResourceAllocationSet;
        recordCheck(next);
        ensure(ctx.origin.machine === host.machine && ctx.origin.principal.id === host.principal.id
          && ctx.origin.principal.kind === host.principal.kind, 'issuer is not this authority');
        const cone = causalCone(ctx.origin, ctx.facts.facts);
        const past = resourceSetRows(cone, next.fence.domain);
        const prior = [...past].reverse().find(r => r.record.id === next.id);
        transitionCheck(next, prior);
        // Capacity is the CURRENT operator policy: checked when a debit is admitted,
        // never re-judged on replay of a debit it already accepted.
        if (ctx.mode === 'origin' && !ctx.facts.facts.some(f => f.id === ctx.origin.id))
          capacityCheck(next, prior, resourceSetRows(ctx.facts.facts, next.fence.domain), host.resourceDomains());
        return { ok: true, value: input };
      } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'resource set refused' }; }
    },
  }, resourceSetShape, c))]);
}

export function createResourceSetSpine(host: ResourceSetHost, author: FactAuthor, store: FactStorePort): ResourceSetSpine {
  return freeze({ store, append: (record: ResourceAllocationSet, required: readonly string[]) => authorAndAppend({
    kind: resourceSetFactKind, schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(host.current().clock),
    body: json({ record }), required,
  }, author.context, store, author.privateKey) });
}

export function createResourceSetAuthority(host: ResourceSetHost, spine: ResourceSetSpine, c: BoundaryContext): ResourceSetAuthority {
  const facts = (): readonly FactEnvelope[] => {
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(e => !e.taint.length && !e.conflicts.length), 'tainted or conflicted fact prefix');
    return snapshot.entries.map(e => e.fact);
  };
  const legacy = (all: readonly FactEnvelope[]): readonly TransportFact[] => {
    const found = rows(all, host.domain);
    ensure(found.length <= 4096, 'single-conversation replay bound exhausted');
    return found;
  };
  const sets = (all: readonly FactEnvelope[]) => resourceSetRows(all, host.domain);
  /** The current held lease of this authority: a later incarnation may close an earlier one's set. */
  const currentFence = (rowsNow: readonly TransportFact[]): FenceToken => {
    const lease = latestLease(rowsNow)?.record;
    ensure(lease, 'lease required');
    const token = fenceFor(rowsNow, lease);
    checkFence(rowsNow, token, host, host.monotonic());
    return token;
  };
  const write = (next: ResourceAllocationSet, prior: SetFact | undefined, all: readonly SetFact[]): ResourceAllocationSet => {
    transitionCheck(next, prior);
    capacityCheck(next, prior, all, host.resourceDomains());
    const receipt = take(spine.append(freeze(next), prior ? [prior.fact.id] : []));
    ensure(!receipt.taint.length, 'append was provisional or contested');
    ensure(receipt.fact.kind === resourceSetFactKind && encoded(receipt.fact.body).bytes === encoded({ record: next }).bytes,
      'append returned different resource set');
    return freeze(next);
  };
  const checked = <T>(name: string, input: unknown, run: () => T): Result<T> => boundary(name, input, c, () => { live(host); return run(); });
  const latest = (id: string): SetFact | undefined => [...sets(facts())].reverse().find(r => r.record.id === id);
  const step = (current: SetFact | undefined, next: ResourceAllocationSet): SetFact => {
    write(next, current, sets(facts()));
    const found = latest(next.id);
    ensure(found && encoded(found.record).bytes === encoded(next).bytes, 'resource set did not land');
    return found;
  };
  /** Prepare the remaining domains, then commit: the completion path after a crash too. */
  const prepareRest = (from: SetFact): SetFact => {
    let current = from;
    const domains = setDomains(current.record);
    while (current.record.state === 'preparing') {
      const r = current.record;
      current = step(current, r.prepared.length < domains.length
        ? { ...r, prepared: domains.slice(0, r.prepared.length + 1), predecessor: current.fact.id }
        : { ...r, state: 'committed', committed: domains, predecessor: current.fact.id });
    }
    return current;
  };
  const returnRest = (from: SetFact): SetFact => {
    let current = from;
    while (current.record.state === 'closing') {
      const r = current.record;
      current = step(current, r.released.length < r.prepared.length
        ? { ...r, released: r.prepared.slice(0, r.released.length + 1), predecessor: current.fact.id }
        : { ...r, state: 'closed', predecessor: current.fact.id });
    }
    return current;
  };
  const setReference = (ref: unknown) => {
    const r = ref as { owner?: unknown; name?: unknown; id?: unknown };
    ensure(r && r.owner === 'part-six' && r.name === 'ResourceAllocationSet' && typeof r.id === 'string' && r.id.length > 0,
      'resource set reference owner');
    return r.id as string;
  };
  return freeze({
    reserveResourceSet: input => checked('ResourceSetReserve', input, () => {
      ensure(typeof input.command === 'string' && input.command.length > 0 && input.command.length <= 256, 'bounded command required');
      ensure(input.request.owner === 'part-eight' && input.request.name === 'EffectRequest' && input.request.id.length > 0
        && input.run.owner === 'part-five' && input.run.name === 'Run' && input.run.id.length > 0, 'foreign reference owner');
      const all = facts(), rowsNow = legacy(all);
      checkFence(rowsNow, input.fence, host, host.monotonic());
      const id = `allocation:${encoded([host.domain, input.command]).hash}`;
      const demands = input.demands.map(d => ({ dimension: d.dimension, domain: d.domain, resource: d.resource,
        amount: d.amount, policy: d.policy, expectedPredecessor: d.expectedPredecessor }));
      const existing = latest(id);
      if (existing) {
        ensure(encoded({ r: existing.record.request, run: existing.record.run, p: existing.record.parentAllocation,
          d: existing.record.demands.map(d => ({ ...d, expectedPredecessor: '' })) }).bytes
          === encoded({ r: input.request.id, run: input.run.id, p: input.parentAllocation,
            d: demands.map(d => ({ ...d, expectedPredecessor: '' })) }).bytes, 'command reused for a different resource set');
        // A preparing set resumes; a committed, closing or closed set replays unchanged.
        return prepareRest(existing).record;
      }
      const record = { type: 'ResourceAllocationSet', schemaVersion: 1, owner: 'part-six', id, operation: '', request: input.request.id, run: input.run.id, fence: input.fence,
        parentAllocation: input.parentAllocation, demands, prepared: demands.length ? [demands[0]!.domain] : [], committed: [],
        released: [], state: 'preparing', predecessor: '', sourceVector: all.at(-1)?.id ?? '' } as unknown as ResourceAllocationSet;
      return prepareRest(step(undefined, record)).record;
    }),
    attachResourceSet: (reservation, allocationSet) => checked('ResourceSetAttach', { reservation, allocationSet }, () => {
      ensure(reservation.owner === 'part-six' && reservation.name === 'AdmissionReservation', 'reservation reference owner');
      const id = setReference(allocationSet);
      const all = facts(), rowsNow = legacy(all);
      const current = latest(id);
      ensure(current, 'resource set absent');
      const set = current.record;
      checkFence(rowsNow, set.fence, host, host.monotonic());
      // The reservation is in this domain, or in its own single-run Six domain via the trusted resolver.
      const foreign = host.resolveReservation?.(reservation);
      const op = foreign?.reservation ?? reservations(rowsNow).find(p => p.operation === reservation.id);
      ensure(op && op.operation === reservation.id, 'reservation absent');
      if (set.operation === op.operation) return op;
      ensure(set.state === 'committed' && set.operation === '', 'only a committed, unattached set can attach');
      ensure(op.state === 'prepared', 'attach precedes dispatch: the reservation is already claimed or closed');
      ensure(op.request === set.request && op.run === set.run, 'reservation and resource set bind different work');
      if (!foreign) ensure(encoded(op.fence).bytes === encoded(set.fence).bytes, 'reservation and resource set bind different fences');
      ensure(![...latestById(sets(all)).values()].some(s => s.record.operation === op.operation), 'operation already has a resource set');
      const reservationFact = foreign?.fact
        ?? rowsNow.filter(v => v.record.type === 'AdmissionReservation' && v.record.operation === op.operation).at(-1)!.fact.id;
      step(current, { ...set, operation: op.operation, sourceVector: reservationFact, predecessor: current.fact.id });
      return op as AdmissionReservation;
    }),
    closeResourceSet: input => checked('ResourceSetClose', input, () => {
      ensure(typeof input.command === 'string' && input.command.length > 0 && input.command.length <= 256, 'bounded command required');
      ensure(typeof input.settlement === 'string' && input.settlement.length > 0 && input.settlement.length <= 256,
        'close names the settlement that proves the outcome');
      const id = setReference(input.allocationSet);
      const all = facts(), rowsNow = legacy(all);
      currentFence(rowsNow);
      const current = latest(id);
      ensure(current, 'resource set absent');
      const set = current.record;
      if (set.state === 'closed' || set.state === 'closing') {
        ensure(set.sourceVector === input.settlement, 'resource set already closing under another settlement');
        return returnRest(current).record;
      }
      if (set.operation) {
        ensure(!host.resolveReservation?.({ owner: 'part-six', name: 'AdmissionReservation', id: set.operation })?.settlementUnresolved,
          'unknown execution or charge keeps the allocation reserved');
        const applications = rowsNow.filter(v => v.record.type === 'SettlementApplication' && v.record.operation === set.operation);
        ensure(!applications.some(v => v.record.type === 'SettlementApplication' && v.record.unresolved !== 0),
          'unknown execution or charge keeps the allocation reserved');
      }
      ensure(![...latestById(sets(all)).values()].some(s => s.record.parentAllocation === set.id && s.record.state !== 'closed'),
        'a parent allocation returns only after every child closed');
      const closing = { ...set, state: 'closing', released: set.prepared.slice(0, 1), sourceVector: input.settlement,
        predecessor: current.fact.id } as ResourceAllocationSet;
      return returnRest(step(current, closing)).record;
    }),
  });
}

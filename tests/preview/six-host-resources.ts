// The host launch adapter's Six allocation (SEAM-LEDGER row 36), composed for the preview
// launcher. Waived preview shell: like the stage-2 owners it signs with the fixture key and
// principal; the authority, decoders and records are Part Six's public ones.
//
// One host resource store holds every launch's ResourceAllocationSet, so each domain's capacity
// and predecessor are decided on one log. Each launch's ordinary AdmissionReservation lives in its
// own single-run Six domain and store (landed Six admits one run per domain), and the set is
// attached to it across domains through the trusted resolver before the launch is claimed.
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult, defineDecoder, deriveThrough } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createResourceSetAuthority, createResourceSetSpine, createTransportAuthority, createTransportSpine, decodeLoopPolicy,
  registerResourceSetBodies, registerTransportBodies, resourceDomainHead, resourceSetRows, resourceSetSchemas, transportSchemas } from '../../src/transport/index.js';
import type { AdmissionReservation, FenceToken, ResourceDemand, ResourceDomainPolicy, ResourceSetHost, TransportAuthority } from '../../src/transport/index.js';
import { factsFixture, privateKey } from '../facts/fixtures.js';
// @ts-expect-error Physical file adapter is outside pure core.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

export type HostAllocationCeilings = Readonly<{
  launch: Readonly<{ memoryBytes: number; processCount: number }>;
  aggregate: Readonly<{ memoryBytes: number; processCount: number; launches: number }>;
  reserveLaunches: number;
}>;
export type AllocationHandle = Readonly<{ set: string; operation: string; launch: string }>;
export type HostAllocation = Readonly<{
  reserve(input: Readonly<{ launch: string; work: string; memoryBytes: number; processCount: number }>):
    { ok: true; handle: AllocationHandle } | { ok: false; reason: string };
  close(set: string, settlement: string): { ok: boolean; reason?: string };
  open(): readonly Readonly<{ set: string; launch: string }>[];
  generation(): number;
  policies: readonly ResourceDomainPolicy[];
}>;

/** A launch's debit: its own ceiling, or its equal share of the aggregate when that is lower, so every
 * launch slot stays reservable under a lowered aggregate (the answer reserve is never starved by it). */
export const share = (launch: number, aggregate: number, slots = 3): number => Math.max(1, Math.min(launch, Math.floor(aggregate / slots)));
const detail = <T>(r: Result<T>): string => consumeResult(r, { Success: () => '', Refused: x => x.detail });
const take = <T>(r: Result<T>): T => consumeResult(r, { Success: v => v, Refused: x => { throw Error(x.detail); } });

/** The finite domains: the installation (launch slots, memory, processes) and one family per work class
 * (maintenance never takes the answer reserve). Capacities are the owner's aggregate ceilings. */
export function hostResourcePolicies(machine: string, ceilings: HostAllocationCeilings): ResourceDomainPolicy[] {
  const installation = `installation:${machine}`;
  return [
    { domain: installation, dimension: 'installation', resource: 'launches', capacity: ceilings.aggregate.launches, policy: 'policy:host-launches' },
    { domain: installation, dimension: 'installation', resource: 'memory-bytes', capacity: ceilings.aggregate.memoryBytes, policy: 'policy:host-memory' },
    { domain: installation, dimension: 'installation', resource: 'processes', capacity: ceilings.aggregate.processCount, policy: 'policy:host-processes' },
    ...(['answer', 'review', 'maintenance'] as const).map(work => ({ domain: `job-family:${work}`, dimension: 'job-family' as const,
      resource: 'launches', policy: 'policy:family-launches',
      capacity: work === 'maintenance' ? Math.max(0, ceilings.aggregate.launches - ceilings.reserveLaunches) : ceilings.aggregate.launches })),
  ];
}

export function createHostResourceAllocation(options: Readonly<{ root: string; machine: string; ceilings: HostAllocationCeilings;
  incarnation: string; now: () => number; monotonic: () => number; generationFacts?: number }>): HostAllocation {
  const f = factsFixture();
  const policies = hostResourcePolicies(options.machine, options.ceilings);
  const directory = join(options.root, 'six');
  mkdirSync(join(directory, 'launches'), { recursive: true, mode: 0o700 });
  const GENERATION_FACTS = options.generationFacts ?? 128;
  const tick = () => Math.max(0, Math.floor(options.monotonic()));
  const launches = new Map<string, { authority: TransportAuthority; fence: FenceToken; op: AdmissionReservation }>();
  const host: ResourceSetHost = { domain: 'host-resources', machine: 'machine-a', incarnation: options.incarnation,
    authorityIncarnation: options.incarnation, principal: f.alice, scope: f.scope, maxLeaseTerm: 86_400_000, budget: 0,
    monotonic: tick, resourceDomains: () => policies,
    resolveReservation: reference => {
      for (const launch of launches.values()) {
        const found = take(launch.authority.inspect()).filter(v => v.record.type === 'AdmissionReservation'
          && v.record.operation === reference.id).at(-1);
        if (found?.record.type === 'AdmissionReservation') return { reservation: found.record, fact: found.fact.id,
          settlementUnresolved: take(launch.authority.inspect()).some(v => v.record.type === 'SettlementApplication'
            && v.record.operation === reference.id && v.record.unresolved !== 0) };
      }
      return undefined;
    },
    current: () => {
      const gen = { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: 'generation:1' };
      return { decode: { ...f.ctx.decode, register: { ...f.ctx.decode.register, generation: gen } }, clock: f.clock(100), generation: gen, stopped: false };
    } };
  const result = <T>(run: () => T): Result<T> => {
    const decoder = take(defineDecoder<T, typeof f.c>({ name: 'FileReceipt', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
      decodeCurrent: () => { try { return { ok: true, value: run() }; } catch (error) { return { ok: false, detail: String(error) }; } },
    }, f.c.preserved));
    return deriveThrough(decoder, { type: 'FileReceipt', schemaVersion: 1 }, f.c);
  };
  const ctx = { ...f.ctx, schemas: [...transportSchemas(host), ...resourceSetSchemas(host)],
    ownedBodies: [...take(registerTransportBodies(host, f.c)), ...take(registerResourceSetBodies(host, f.c))] };
  const policy = take(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'loop-policy:host-launch', maxAttempts: 1,
    minDelay: 1, maxDuration: 86_400_000, timeout: 86_400_000, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, f.c));
  // Generations bound the log each decision reads: a new generation starts only when no set is open
  // in the current one, so nothing unsettled is ever left behind. Every generation stays on disk.
  const generations = () => { try { return readdirSync(directory).filter(n => /^host-\d+$/u.test(n)).map(n => Number(n.slice(5))); } catch { return []; } };
  let generation = Math.max(0, ...generations());
  const open = (n: number) => {
    const store = createFactStore(ctx, createTransportFileStorage(join(directory, `host-${n}`), result));
    const six = createTransportAuthority(host, createTransportSpine(host, { context: ctx, privateKey }, store), f.c);
    const sets = createResourceSetAuthority(host, createResourceSetSpine(host, { context: ctx, privateKey }, store), f.c);
    // This process's lease on the host resource domain; a restarted process is a new authority incarnation.
    const fence = take(six.acquire(`acquire:${options.incarnation}:${n}`, take(six.inspect()).at(-1)?.fact.id ?? '', host.maxLeaseTerm));
    return { store, six, sets, fence };
  };
  let g = open(generation);
  const current = (): FenceToken => {
    const lease = take(g.six.inspect()).filter(v => v.record.type === 'Lease').at(-1)?.record;
    if (lease?.type === 'Lease' && lease.expires - tick() < host.maxLeaseTerm / 2)
      g = { ...g, fence: take(g.six.renew(`renew:${options.incarnation}:${tick()}`, g.fence, host.maxLeaseTerm)) };
    return g.fence;
  };
  const rows = () => resourceSetRows(take(g.store.read()), host.domain);
  const openSets = () => {
    const latest = new Map<string, ReturnType<typeof rows>[number]>();
    for (const row of rows()) latest.set(row.record.id, row);
    return [...latest.values()].filter(r => r.record.state !== 'closed');
  };
  const rotate = () => {
    if (rows().length < GENERATION_FACTS || openSets().length) return;
    generation++;
    g = open(generation);
  };
  const openLaunchDomain = (launch: string) => {
    const lh = { ...host, domain: `launch:${launch}`, incarnation: `${options.incarnation}:${launch}` };
    const lctx = { ...f.ctx, schemas: transportSchemas(lh), ownedBodies: take(registerTransportBodies(lh, f.c)) };
    const lstore = createFactStore(lctx, createTransportFileStorage(join(directory, 'launches', launch), result));
    return createTransportAuthority(lh, createTransportSpine(lh, { context: lctx, privateKey }, lstore), f.c);
  };
  return Object.freeze({
    policies,
    reserve: input => {
      const run = { owner: 'part-five' as const, name: 'Run' as const, id: `host-launch:${input.launch}` };
      const request = { owner: 'part-eight' as const, name: 'EffectRequest' as const, id: `provider-launch:${input.launch}` };
      const installation = `installation:${options.machine}`, family = `job-family:${input.work}`;
      const head = (domain: string) => resourceDomainHead(rows(), domain);
      const demands: ResourceDemand[] = [
        { dimension: 'installation', domain: installation, resource: 'launches', amount: 1, policy: 'policy:host-launches', expectedPredecessor: head(installation) },
        { dimension: 'installation', domain: installation, resource: 'memory-bytes', amount: share(input.memoryBytes, options.ceilings.aggregate.memoryBytes, options.ceilings.aggregate.launches),
          policy: 'policy:host-memory', expectedPredecessor: head(installation) },
        { dimension: 'installation', domain: installation, resource: 'processes', amount: share(input.processCount, options.ceilings.aggregate.processCount, options.ceilings.aggregate.launches),
          policy: 'policy:host-processes', expectedPredecessor: head(installation) },
        { dimension: 'job-family', domain: family, resource: 'launches', amount: 1, policy: 'policy:family-launches', expectedPredecessor: head(family) },
      ].sort((a, b) => a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : a.resource < b.resource ? -1 : a.resource > b.resource ? 1 : 0) as ResourceDemand[];
      let token: FenceToken;
      try { rotate(); token = current(); } catch (error) { return { ok: false, reason: String((error as Error).message) }; }
      const reserved = g.sets.reserveResourceSet({ command: `launch:${input.launch}`, fence: token, request, run, parentAllocation: '', demands });
      const refusal = detail(reserved);
      if (refusal) return { ok: false, reason: refusal };
      const set = take(reserved);
      const giveBack = (reason: string) => { g.sets.closeResourceSet({ command: `close:${input.launch}`, allocationSet:
        { owner: 'part-six', name: 'ResourceAllocationSet', id: set.id }, settlement: `never-launched:${input.launch}` }); return { ok: false as const, reason }; };
      try {
        // The launch's own single-run Six domain: lease, loop, and its ordinary prepared reservation.
        const authority = openLaunchDomain(input.launch);
        const lfence = take(authority.acquire(`acquire:${input.launch}`, '', host.maxLeaseTerm));
        take(authority.schedule(`schedule:${input.launch}`, lfence, run, policy));
        const op = take(authority.reserve({ command: `reserve:${input.launch}`, fence: lfence, request, attempt: 'attempt:1',
          payloadDigest: `sha256:${'0'.repeat(64)}`, charge: 0, run, semanticMessage: `launch:${input.launch}`,
          durability: 'local-durable', replicas: 0 }));
        launches.set(input.launch, { authority, fence: lfence, op });
        // The launch gate: the committed set is attached before the operation is claimed for dispatch.
        take(g.sets.attachResourceSet({ owner: 'part-six', name: 'AdmissionReservation', id: op.operation },
          { owner: 'part-six', name: 'ResourceAllocationSet', id: set.id }));
        take(authority.claim(`claim:${input.launch}`, lfence, op.operation));
        return { ok: true, handle: { set: set.id, operation: op.operation, launch: input.launch } };
      } catch (error) { return giveBack(String((error as Error).message)); }
    },
    close: (set, settlement) => {
      try { current(); } catch (error) { return { ok: false, reason: String((error as Error).message) }; }
      const closed = g.sets.closeResourceSet({ command: `close:${set}`, allocationSet: { owner: 'part-six', name: 'ResourceAllocationSet', id: set }, settlement });
      const refusal = detail(closed);
      return refusal ? { ok: false, reason: refusal } : { ok: true };
    },
    open: () => openSets().map(r => ({ set: r.record.id, launch: r.record.run.replace(/^host-launch:/u, '') })),
    generation: () => generation,
  });
}
/** Launch domains on disk (read-only diagnostic for status). */
export const hostLaunchDomains = (root: string): number => { try { return readdirSync(join(root, 'six', 'launches')).length; } catch { return 0; } };

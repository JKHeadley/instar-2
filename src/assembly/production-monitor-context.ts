import type { BoundaryContext, Clock, Result } from '../index.js';
import { createFactStore } from '../facts/index.js';
import type { FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';
import { createProductionRunAdmission } from '../transport/index.js';
import type { AdmissionReservation, Lease, LoopRecord, TransportAuthority } from '../transport/index.js';
import type { ProductionStorageReader } from './production-storage.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

/**
 * Lane A's public capacity reader (`TransportAuthority.inspectCapacity` returning
 * `CapacityInspection`, branch impl-r1-m3i, NOT yet landed on this base). Stated
 * structurally as the exact subset of that public shape this adapter reads
 * (`fact` is the capacity fact id string; `record` is the CapacityReservation),
 * so lane A's own result is assignable without re-deriving its verdicts. Absent
 * means every launch refuses for missing capacity authority A.
 */
export interface MonitorCapacityReader {
  inspectCapacity(): Result<Readonly<{
    sourceFrontier: string;
    heads: readonly Readonly<{ capacity: string; fact: string; usable: boolean; blocker: string | null;
      record: Readonly<{ instance: string; installation: string; machine: string; state: string }> }>[];
  }>>;
}

/** Lane A's protected reserve. It never grants ordinary worker/control use. */
const RESPONDER_RESERVE = 'minimal-responder-binding';

/** Inputs the installed boot (R4/R6) supplies. None is selected by a request. */
export interface InstalledMonitorInputs {
  readonly installation: string;
  readonly machine: string;
  /** Installed decoders for Five/Six/Eight/Ten bodies (the owners' own registrations). */
  readonly facts: FactContext;
  /** Read-only view of the one installed root (never the writer's lease). */
  readonly storage: ProductionStorageReader;
  /** Six authority over this same store; only its read-side verdicts are used. */
  readonly authority: TransportAuthority<unknown>;
  /** Installed current context: stop, register generation and genuine clock. */
  current(): Readonly<{ stopped: boolean; generation: string; clock: Clock }>;
  readonly capacity?: MonitorCapacityReader;
  /** R6: the capacity instance that is this installation's genuine worker/control
   * allocation. Absent (today) means worker allocation is unavailable and every
   * launch refuses; the responder reserve can never be named here. */
  readonly workerCapacityInstance?: string;
  /** R4/R6: the installed owner watermark (committed record count and head fact
   * id), independent of the file being read, so a view rolled back across a
   * reader restart is refused. Absent means restart currency is unavailable and
   * every resolve refuses. */
  watermark?(): Readonly<{ records: number; head: string }> | null;
  readonly context: BoundaryContext;
}

export interface MonitorLaunchLocators {
  readonly request: string; readonly specification: string; readonly claim: string;
  readonly consumed: string; readonly operation: string; readonly digest: string;
}
export interface MonitorObservationLocators {
  readonly request: string; readonly operation: string; readonly digest: string;
  readonly observationAuthority: string;
}

export interface MonitorLaunchClosure {
  readonly installation: string; readonly machine: string; readonly run: string;
  readonly request: string; readonly operation: string; readonly digest: string;
  readonly specification: string; readonly claim: string; readonly consumed: string;
  readonly prepared: string; readonly capacity: readonly string[];
  readonly assignment: string; readonly generation: string;
  /** Hash over the exact fact contents of the closure: any change refuses at recheck. */
  readonly bundle: string;
}
export interface MonitorObservationClosure {
  readonly installation: string; readonly machine: string; readonly run: string;
  readonly request: string; readonly operation: string; readonly digest: string;
  readonly wake: string; readonly bundle: string;
}

export interface ProductionMonitorContext {
  readonly owner: 'part-ten';
  resolveLaunch(locators: MonitorLaunchLocators): Result<MonitorLaunchClosure>;
  resolveObservation(locators: MonitorObservationLocators): Result<MonitorObservationClosure>;
  /** Re-read the installed view and require the identical closure plus current
   * stop/generation/fence/clock. Called at release and at every mediated use. */
  recheck(closure: MonitorLaunchClosure): Result<MonitorLaunchClosure>;
}

type Row = Readonly<{ fact: FactEnvelope; record: Readonly<Record<string, unknown>> }>;
type Reservation = Readonly<{ fact: FactEnvelope; record: AdmissionReservation }>;

const bodyRecord = (fact: FactEnvelope): Readonly<Record<string, unknown>> | undefined => {
  const body = fact.body as { record?: unknown } | null;
  return body && typeof body === 'object' && body.record && typeof body.record === 'object'
    ? body.record as Readonly<Record<string, unknown>> : undefined;
};

/**
 * The fixed installed read adapter (MUST-FIX 1). It composes only genuine public
 * owner readers over the read-only installed view: Five's verified store prefix
 * (installed decoders) and Six's production run admission. It keeps no cache,
 * approval flag or copied fold; every resolve and recheck re-reads the view.
 * It never appends, recovers or takes the writer's lease.
 */
export function createProductionMonitorContext(input: InstalledMonitorInputs): Result<ProductionMonitorContext> {
  return boundary('ProductionMonitorContext', null, input.context, () => {
    ensure(input.installation.length > 0 && input.machine.length > 0, 'monitor-context: installation binding required');
    const store: FactStorePort = createFactStore(input.facts, input.storage.segment);
    const admission = createProductionRunAdmission({ authority: input.authority, store, context: input.context });
    let lastClock = -Infinity;

    const view = () => {
      take(input.storage.refresh());
      take(store.sweep());
      const prefix = take(store.verifiedPrefix());
      const snapshot = take(store.readForProjection());
      ensure(snapshot.entries.every(entry => !entry.taint.length && !entry.conflicts.length),
        'monitor-context: tainted or conflicted installed view');
      const facts = prefix.facts;
      ensure(input.watermark, 'monitor-context: installed owner watermark unavailable (R4/R6); restart rollback cannot be excluded');
      const mark = input.watermark();
      ensure(mark && Number.isSafeInteger(mark.records) && mark.records > 0 && facts.length >= mark.records
        && facts.findIndex(fact => fact.id === mark.head) >= 0,
      'monitor-context: installed view is behind or diverges from the owner watermark');
      const transport = facts.filter(fact => fact.kind.startsWith('transport-'))
        .map(fact => freeze({ fact, record: bodyRecord(fact) ?? {} }) as Row);
      return { facts, transport };
    };
    const currentContext = () => {
      const now = input.current();
      ensure(!now.stopped, 'monitor-context: installation stopped');
      ensure(now.clock.value >= lastClock, 'monitor-context: clock regressed');
      lastClock = now.clock.value;
      return now;
    };
    // Current owner standing, re-derived per call: Six's own execution verdict
    // for the operation's lease assignment (current held lease, same fence and
    // worker placement), plus that lease's finite horizon on the installed owner
    // clock. Signed history alone is never present authority.
    const standing = (transport: readonly Row[], run: string, assignment: string, clock: number) => {
      take(admission.execution(run, { owner: 'part-six', name: 'Lease', id: assignment }));
      const lease = (transport.filter(row => row.record.type === 'Lease').at(-1)?.record) as unknown as Lease | undefined;
      ensure(lease && lease.state === 'held' && Number.isSafeInteger(lease.expires) && clock < lease.expires,
        'monitor-context: owner lease horizon expired');
    };
    const reservations = (transport: readonly Row[], operation: string): Reservation[] =>
      transport.filter(row => row.fact.kind === 'transport-AdmissionReservation'
        && row.record.type === 'AdmissionReservation' && row.record.operation === operation) as unknown as Reservation[];

    const launch = (locators: MonitorLaunchLocators): MonitorLaunchClosure => {
      for (const field of ['request', 'specification', 'claim', 'consumed', 'operation', 'digest'] as const)
        ensure(typeof locators[field] === 'string' && locators[field].length > 0, `monitor-context: ${field} locator required`);
      const now = currentContext();
      const { facts, transport } = view();
      // Ten's genuine specification, on this installation's store and machine.
      const specification = facts.find(fact => fact.id === locators.specification);
      const spec = specification && specification.kind === 'assembly-HarnessLaunchSpec' ? bodyRecord(specification) : undefined;
      ensure(spec, 'monitor-context: launch specification absent from the installed store');
      ensure(spec.machine === input.machine, 'monitor-context: specification belongs to another machine');
      const run = spec.run as string, incarnation = spec.incarnation as string;
      const latestSpec = facts.filter(fact => fact.kind === 'assembly-HarnessLaunchSpec').map(fact => ({ fact, record: bodyRecord(fact)! }))
        .filter(row => row.record.run === run && row.record.machine === input.machine && row.record.incarnation === incarnation).at(-1);
      ensure(latestSpec?.fact.id === specification!.id, 'monitor-context: specification is not the current worker placement');
      // Prepared reservation P, the dispatch claim and its consumed successor.
      const prepared = transport.find(row => row.fact.id === spec.processOperation
        && row.fact.kind === 'transport-AdmissionReservation') as unknown as Reservation | undefined;
      ensure(prepared && prepared.record.state === 'prepared' && prepared.record.run === run,
        'monitor-context: specification process operation is not a prepared reservation for this Run');
      ensure(prepared.record.operation === locators.operation && prepared.record.digest === locators.digest
        && prepared.record.request === locators.request, 'monitor-context: request/operation/digest differ from the prepared reservation');
      const rows = reservations(transport, locators.operation);
      const claimIndex = rows.findIndex(row => row.fact.id === locators.claim);
      const claim = rows[claimIndex], consumed = rows[claimIndex + 1];
      ensure(claim && claim.record.state === 'dispatch-claimed' && claim.record.digest === locators.digest,
        'monitor-context: dispatch claim absent or changed');
      ensure(consumed && consumed.fact.id === locators.consumed && consumed.record.state === 'consumed'
        && consumed.record.command === `consume:${locators.operation}` && consumed.record.digest === locators.digest
        && consumed.record.executor === claim.record.executor && encoded(consumed.record.fence).bytes === encoded(claim.record.fence).bytes,
      'monitor-context: consumed successor does not join the exact claim');
      ensure(rows.at(-1)?.fact.id === consumed.fact.id, 'monitor-context: operation progressed after its consumed claim');
      // Six's own verdicts: S11 prepared-fact resolution and current worker placement.
      const ownership = { owner: 'part-six' as const, name: 'Lease' as const, id: prepared.record.fence.assignment };
      take(admission.reservation({ owner: 'part-six', name: 'AdmissionReservation', id: prepared.fact.id },
        { run, ownership } as never));
      const execution = take(admission.execution(run, ownership));
      ensure(execution.harness === spec.harness && execution.worker === spec.principal,
        'monitor-context: Six execution differs from the specification');
      ensure(prepared.record.fence.generation === now.generation, 'monitor-context: register generation changed');
      standing(transport, run, prepared.record.fence.assignment, now.clock.value);
      // Capacity A (lane A): resources are exactly sorted unique A union {P}.
      const resources = spec.resourceReferences as readonly string[];
      ensure(Array.isArray(resources) && encoded([...new Set(resources)].sort()).bytes === encoded(resources).bytes
        && resources.includes(prepared.fact.id), 'monitor-context: resources are not sorted unique A union {P}');
      const capacity = resources.filter(id => id !== prepared.fact.id);
      ensure(capacity.length > 0, 'monitor-context: capacity authority A absent');
      ensure(input.capacity, 'monitor-context: capacity reader unavailable (lane A impl-r1-m3i not landed)');
      const inspection = take(input.capacity.inspectCapacity());
      ensure(inspection.sourceFrontier === transport.at(-1)?.fact.id, 'monitor-context: capacity view is not current');
      for (const id of capacity) {
        const head = inspection.heads.find(entry => entry.fact === id);
        ensure(head && typeof head.record === 'object' && head.record !== null, 'monitor-context: capacity reservation not usable');
        ensure(head.record.instance !== RESPONDER_RESERVE,
          'monitor-context: capacity A is the protected minimal-responder reserve, not a worker/control allocation');
        ensure(input.workerCapacityInstance && input.workerCapacityInstance !== RESPONDER_RESERVE,
          'monitor-context: worker/control capacity allocation unavailable (R6)');
        ensure(head.record.instance === input.workerCapacityInstance && head.record.installation === input.installation
          && head.record.machine === input.machine && head.record.state === 'held',
        'monitor-context: capacity A is not this installation\'s worker/control allocation');
        ensure(head.usable && head.blocker === null, 'monitor-context: capacity reservation not usable');
      }
      const closureFacts = [specification!, prepared.fact, claim.fact, consumed.fact,
        ...capacity.map(id => facts.find(fact => fact.id === id)!)];
      return freeze({ installation: input.installation, machine: input.machine, run,
        request: locators.request, operation: locators.operation, digest: locators.digest,
        specification: specification!.id, claim: claim.fact.id, consumed: consumed.fact.id,
        prepared: prepared.fact.id, capacity: freeze([...capacity]), assignment: prepared.record.fence.assignment,
        generation: now.generation, bundle: encoded(closureFacts.map(fact => fact.contentHash)).hash });
    };

    const observation = (locators: MonitorObservationLocators): MonitorObservationClosure => {
      for (const field of ['request', 'operation', 'digest', 'observationAuthority'] as const)
        ensure(typeof locators[field] === 'string' && locators[field].length > 0, `monitor-context: ${field} locator required`);
      const now = currentContext();
      const { transport } = view();
      const rows = reservations(transport, locators.operation);
      const original = rows[0];
      ensure(original && original.record.request === locators.request && original.record.digest === locators.digest,
        'monitor-context: original operation absent or changed');
      ensure(rows.at(-1)!.record.state !== 'prepared', 'monitor-context: operation was never dispatched; nothing to observe');
      // Reuse Six's LoopRecord wake (Eight's existing observation authority).
      const wakes = transport.filter(row => row.fact.kind === 'transport-LoopRecord'
        && row.record.type === 'LoopRecord' && row.record.run === original.record.run) as unknown as
        Readonly<{ fact: FactEnvelope; record: LoopRecord }>[];
      const wake = wakes.at(-1);
      ensure(wake && wake.fact.id === locators.observationAuthority && wake.record.pending === locators.operation
        && ['running', 'restoring', 'waiting'].includes(wake.record.state),
      'monitor-context: observation authority is not the current admitted wake for this operation');
      const latest = rows.at(-1)!;
      ensure(latest.record.fence.generation === now.generation, 'monitor-context: register generation changed');
      standing(transport, original.record.run, latest.record.fence.assignment, now.clock.value);
      return freeze({ installation: input.installation, machine: input.machine, run: original.record.run,
        request: locators.request, operation: locators.operation, digest: locators.digest, wake: wake.fact.id,
        bundle: encoded([original.fact.contentHash, wake.fact.contentHash]).hash });
    };

    return freeze({ owner: 'part-ten' as const,
      resolveLaunch: (locators: MonitorLaunchLocators) => boundary('ProductionMonitorLaunchResolve', locators, input.context, () => launch(locators)),
      resolveObservation: (locators: MonitorObservationLocators) =>
        boundary('ProductionMonitorObservationResolve', locators, input.context, () => observation(locators)),
      recheck: (closure: MonitorLaunchClosure) => boundary('ProductionMonitorRecheck', null, input.context, () => {
        const again = launch(closure);
        ensure(encoded(again).bytes === encoded(closure).bytes, 'monitor-context: launch closure changed since admission');
        return again;
      }),
    });
  });
}

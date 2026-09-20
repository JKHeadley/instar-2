import type { BoundaryContext, FactEnvelopeReference, Json, LeaseReference, OwnedReference, Result } from '../index.js';
import { canonical } from '../index.js';
import type { AppendReceipt, DurabilityState, FactEnvelope, FactStorePort } from '../facts/index.js';
import { recordFromWire } from '../rungraph/index.js';
import type { RunAdmissionPort, RunStep } from '../rungraph/index.js';
import type { AdmissionReservation, FenceToken, Lease, TransportAuthority, TransportFact, TransportRecord } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { shapeCheck, transportShapes } from './records.js';

export interface ProductionRunAdmissionInput {
  readonly authority: TransportAuthority<unknown>;
  readonly store: FactStorePort;
  readonly context: BoundaryContext;
}
export interface ProductionRunAdmissionDelegateInput {
  /** Construction-order bridge. Every call still resolves to a separately
   * factory-issued adapter; an arbitrary structural implementation never runs. */
  readonly resolve: () => RunAdmissionPort;
}

type RunWire = Readonly<Record<string, unknown>>;
type CleanPrefix = Readonly<{
  facts: readonly FactEnvelope[];
  transport: readonly TransportFact[];
}>;

const productionAdmissions = new WeakSet<object>();
const runKinds = new Set(['run-opening', 'run-transition', 'session-grounding']);
const transportFactNames = new Set(['Lease', 'AdmissionReservation', 'LoopRecord', 'RecoveryRecord',
  'ScanCursor', 'SettlementApplication']);

const reference = (fact: FactEnvelope): FactEnvelopeReference => freeze({
  owner: 'part-two' as const, name: 'FactEnvelope' as const, id: fact.id,
});

const object = (value: unknown, detail: string): Record<string, unknown> => {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), detail);
  return value as Record<string, unknown>;
};

const same = (left: unknown, right: unknown): boolean => encoded(left).bytes === encoded(right).bytes;

function runWire(fact: FactEnvelope): RunWire | undefined {
  if (!runKinds.has(fact.kind)) return undefined;
  const body = object(fact.body, 'run fact body required');
  return object(body.record, 'run record body required');
}

function runOf(fact: FactEnvelope): string | undefined {
  if (!runKinds.has(fact.kind)) return undefined;
  const body = object(fact.body, 'run fact body required');
  return typeof body.run === 'string' ? body.run : undefined;
}

function command(kind: 'create' | 'commit', input: unknown): string {
  return `run-admission:${kind}:${take(canonical(input)).hash}`;
}

function fenceFor(all: readonly TransportFact[], lease: Lease): FenceToken {
  const assignment = all.find(row => row.record.type === 'Lease' && row.record.epoch === lease.epoch);
  ensure(assignment, 'current lease lacks its committed assignment');
  return freeze({ type: 'FenceToken', schemaVersion: 1, domain: lease.domain, epoch: lease.epoch,
    assignment: assignment.fact.id, holder: lease.holder, machine: lease.machine,
    incarnation: lease.incarnation, authority: lease.authority, generation: lease.generation } as FenceToken);
}

function transportFrom(facts: readonly FactEnvelope[]): readonly TransportFact[] {
  return facts.flatMap(fact => {
    if (!fact.kind.startsWith('transport-')) return [];
    const name = fact.kind.slice('transport-'.length);
    if (!transportFactNames.has(name)) return [];
    const record = object(fact.body, 'transport fact body required').record;
    ensure(record !== undefined, 'transport record body required');
    shapeCheck(record, transportShapes[name]!);
    ensure(object(record, 'transport record required').type === name, 'transport fact kind differs from record');
    return [freeze({ fact, record: record as unknown as TransportRecord })];
  });
}

/**
 * Six's production adapter records a Lease/write immediately before every Five
 * append. The adjacency is the durable exclusion witness: it survives restart,
 * but can only be minted through the live TransportAuthority and its current
 * lease/fence checks.
 */
export function createProductionRunAdmission(
  configured: ProductionRunAdmissionInput | ProductionRunAdmissionDelegateInput,
): RunAdmissionPort {
  if ('resolve' in configured) {
    let delegated!: RunAdmissionPort;
    const target = (): RunAdmissionPort => {
      const resolved = configured.resolve();
      ensure(resolved !== delegated && isProductionRunAdmission(resolved),
        'delegated run admission lacks factory provenance');
      return resolved;
    };
    delegated = freeze({ owner: 'part-six' as const,
      create: (opening, run, append) => target().create(opening, run, append),
      commit: (request, append) => target().commit(request, append),
      verify: record => target().verify(record),
      reservation: (referenceInput, step) => target().reservation(referenceInput, step),
      execution: (run, ownership) => target().execution(run, ownership),
    });
    productionAdmissions.add(delegated);
    return delegated;
  }
  const input = Object.freeze({ ...configured });
  let certified: Readonly<{ key: string; facts: readonly FactEnvelope[]; transport: readonly TransportFact[] }> | undefined;
  const ownerPrefix = () => {
    const prefix = take(input.store.verifiedPrefix());
    const key = encoded({ context: prefix.contextHash, count: prefix.facts.length,
      watermarks: prefix.watermarks }).hash;
    return { prefix, key };
  };
  const clean = (reuse = false): CleanPrefix => {
    // Every decision resolves from an owner-issued verified prefix. Create,
    // commit, reservation and execution refresh it; immutable witness replays
    // reuse rows decoded from the same prefix and its lineage watermarks.
    if (reuse && certified) return freeze({ facts: certified.facts, transport: certified.transport });
    const { prefix, key } = ownerPrefix();
    if (certified?.key !== key) {
      const transport = transportFrom(prefix.facts);
      certified = freeze({ key, facts: prefix.facts, transport });
    }
    return freeze({ facts: prefix.facts, transport: certified.transport });
  };
  const current = (ownership?: LeaseReference, owner = clean()): Readonly<{ lease: Lease; fence: FenceToken; assignment: TransportFact }> => {
    const { transport } = owner;
    const row = transport.filter((entry): entry is TransportFact & { readonly record: Lease } =>
      entry.record.type === 'Lease').at(-1);
    ensure(row && row.record.state === 'held', 'current held lease required');
    const scoped = transport.filter(entry => entry.record.domain === row.record.domain);
    const fence = fenceFor(scoped, row.record);
    const assignment = scoped.find(entry => entry.fact.id === fence.assignment);
    ensure(assignment?.record.type === 'Lease' && assignment.record.operation === 'acquire',
      'lease assignment is not a committed acquisition');
    if (ownership) ensure(ownership.owner === 'part-six' && ownership.name === 'Lease'
      && ownership.id === fence.assignment, 'stale or foreign run ownership');
    return freeze({ lease: row.record, fence, assignment });
  };
  const head = (facts: readonly FactEnvelope[], run: string): FactEnvelope | undefined =>
    facts.filter(fact => fact.kind !== 'session-grounding' && runOf(fact) === run).at(-1);
  const writtenAfter = (before: readonly FactEnvelope[], expectedCommand: string,
    record: Lease): Readonly<{ facts: readonly FactEnvelope[]; witness: TransportFact & { readonly record: Lease } }> => {
    const prior = certified;
    ensure(prior?.facts.length === before.length, 'run admission clean prefix changed before write');
    const { prefix, key } = ownerPrefix();
    ensure(prefix.facts.length === before.length + 1, 'run admission write interleaved with another fact');
    const fact = prefix.facts.at(-1);
    const body = fact && object(fact.body, 'transport witness body required');
    ensure(fact?.kind === 'transport-Lease' && body && same(body.record, record)
      && record.operation === 'write' && record.command === expectedCommand,
    'exact Six write witness missing');
    const witness = freeze({ fact, record }) as TransportFact & { readonly record: Lease };
    certified = freeze({ key, facts: prefix.facts, transport: freeze([...prior.transport, witness]) });
    return freeze({ facts: prefix.facts, witness });
  };
  const appendOnce = (beforeWrite: readonly FactEnvelope[], writeCommand: string,
    write: Lease, append: () => Result<AppendReceipt>, validate: (receipt: AppendReceipt) => void): AppendReceipt => {
    const afterWrite = writtenAfter(beforeWrite, writeCommand, write);
    let calls = 0;
    const receipt = take((() => {
      ensure(++calls === 1, 'run admission callback repeated');
      return append();
    })());
    ensure(calls === 1, 'run admission callback count changed');
    const prior = certified;
    ensure(prior?.facts.length === afterWrite.facts.length, 'run admission clean prefix changed before append');
    const { prefix, key } = ownerPrefix();
    ensure(prefix.facts.length === afterWrite.facts.length + 1, 'run append interleaved with another fact');
    const stored = prefix.facts.at(-1);
    ensure(stored && same(stored, receipt.fact), 'owner observation is absent or changed in the signed prefix');
    ensure(receipt.taint.length === 0, 'run append returned taint');
    certified = freeze({ key, facts: prefix.facts, transport: prior.transport });
    ensure(stored.predecessors.inSegment === afterWrite.witness.fact.id,
      'run append is not adjacent to its Six witness');
    const preceding = prefix.facts.find(fact => fact.id === stored.predecessors.inSegment);
    ensure(preceding && preceding.id === prefix.facts.at(-2)?.id, 'run witness adjacency changed');
    validate(receipt);
    return freeze(receipt);
  };
  const witnessed = (record: FactEnvelopeReference): FactEnvelope => {
    ensure(record.owner === 'part-two' && record.name === 'FactEnvelope', 'fact reference owner mismatch');
    let owner = clean();
    let fact = owner.facts.find(row => row.id === record.id);
    if (!fact) { owner = clean(); fact = owner.facts.find(row => row.id === record.id); }
    const { facts, transport } = owner;
    ensure(fact && runKinds.has(fact.kind), 'admitted run fact absent');
    const predecessor = facts.find(row => row.id === fact.predecessors.inSegment);
    const witness = transport.find(row => row.fact.id === predecessor?.id);
    ensure(predecessor && witness?.record.type === 'Lease' && witness.record.operation === 'write',
      'run fact lacks adjacent Six write witness');
    const write = witness.record as Lease;
    const assignment = transport.find(row => row.record.type === 'Lease'
      && row.record.domain === write.domain && row.record.epoch === write.epoch && row.record.operation === 'acquire');
    ensure(assignment, 'run witness lacks committed lease assignment');
    const wire = runWire(fact)!;
    let expected: string;
    if (fact.kind === 'run-opening') {
      expected = command('create', { opening: wire.opening, run: runOf(fact), assignment: assignment.fact.id });
    } else {
      const step = fact.kind !== 'run-transition' || wire.step === undefined
        ? undefined : object(wire.step, 'run step body required');
      const operation = typeof step?.operation === 'object'
        ? object(step.operation, 'run operation required') : undefined;
      const operationKey = typeof operation?.key === 'string' ? operation.key : wire.id;
      const operationDigest = typeof operation?.digest === 'string' ? operation.digest
        : encoded(recordFromWire(wire as Json)).hash;
      expected = command('commit', { run: runOf(fact), expected: wire.expected, ownership: wire.ownership,
        generation: wire.generation, operation: operationKey, digest: operationDigest,
        durability: { kind: 'local-durable' }, assignment: assignment.fact.id });
    }
    ensure(write.command === expected, 'run witness command does not bind the exact record');
    return fact;
  };

  const admission: RunAdmissionPort = freeze({
    owner: 'part-six' as const,
    create: (opening, run, append) => boundary('ProductionRunCreateAdmission', { opening, run }, input.context, () => {
      ensure(opening.owner === 'part-two' && opening.name === 'FactEnvelope' && run.length > 0,
        'closed run creation request required');
      const before = clean();
      ensure(before.facts.some(fact => fact.id === opening.id), 'run opening cause absent');
      ensure(!head(before.facts, run), 'run already exists');
      const live = current(undefined, before);
      const writeCommand = command('create', { opening, run, assignment: live.fence.assignment });
      const write = take(input.authority.admitWrite(writeCommand, live.fence));
      return appendOnce(before.facts, writeCommand, write, append, receipt => {
        const wire = runWire(receipt.fact);
        ensure(receipt.fact.kind === 'run-opening' && runOf(receipt.fact) === run
          && wire?.type === 'Run' && wire.id === run && same(wire.opening, opening),
        'run creation callback returned another record');
      });
    }),
    commit: (request, append) => boundary('ProductionRunCommitAdmission', request, input.context, () => {
      ensure(request.run.length > 0 && request.expected.length > 0 && request.operation.length > 0
        && request.digest.length > 0, 'closed run commit request required');
      const before = clean();
      const beforeHead = head(before.facts, request.run);
      ensure(beforeHead && runWire(beforeHead)?.id === request.expected, 'run opening head changed');
      const live = current(request.ownership, before);
      ensure(request.generation.owner === 'part-three' && request.generation.name === 'RegisterGeneration'
        && request.generation.id === live.lease.generation, 'run register generation changed');
      const fields = { run: request.run, expected: request.expected, ownership: request.ownership,
        generation: request.generation, operation: request.operation, digest: request.digest,
        durability: request.durability, assignment: live.fence.assignment };
      const writeCommand = command('commit', fields);
      const write = take(input.authority.admitWrite(writeCommand, live.fence));
      return appendOnce(before.facts, writeCommand, write, append, receipt => {
        const wire = runWire(receipt.fact);
        ensure(runOf(receipt.fact) === request.run && wire?.run === request.run
          && wire.expected === request.expected && same(wire.ownership, request.ownership)
          && same(wire.generation, request.generation) && receipt.durability.kind === request.durability.kind,
        'run commit callback returned another record');
      });
    }),
    verify: record => boundary('ProductionRunAdmissionWitness', record, input.context,
      () => reference(witnessed(record))),
    reservation: (referenceInput: OwnedReference<'part-six', 'AdmissionReservation'>, step: RunStep) =>
      boundary('ProductionRunReservationWitness', { reference: referenceInput, step }, input.context, () => {
        ensure(referenceInput.owner === 'part-six' && referenceInput.name === 'AdmissionReservation',
          'reservation reference owner mismatch');
        const { transport } = clean();
        const exact = transport.find((row): row is TransportFact & { readonly record: AdmissionReservation } =>
          row.fact.id === referenceInput.id && row.record.type === 'AdmissionReservation');
        ensure(exact, 'admission reservation absent');
        const latest = transport.filter((row): row is TransportFact & { readonly record: AdmissionReservation } =>
          row.record.type === 'AdmissionReservation' && row.record.operation === exact.record.operation).at(-1);
        ensure(latest?.record.state !== 'closed' && latest?.record.run === step.run,
        'reservation does not authorize this run step');
        ensure(latest.record.fence.assignment === step.ownership.id,
          'reservation belongs to another lease assignment');
        return reference(exact.fact);
      }),
    execution: (run, ownership) => boundary('ProductionRunExecutionObservation', { run, ownership }, input.context, () => {
      ensure(run.length > 0, 'run identity required');
      const owner = clean(), live = current(ownership, owner), { facts, transport } = owner;
      const launches = facts.filter(fact => fact.kind === 'assembly-HarnessLaunchSpec').map(fact => ({ fact,
        record: object(object(fact.body, 'launch fact body required').record, 'launch record required') }))
        .filter(row => row.record.run === run && row.record.machine === live.lease.machine
          && row.record.incarnation === live.lease.incarnation);
      const launch = launches.at(-1);
      ensure(launch && typeof launch.record.principal === 'string' && launch.record.principal.length > 0
        && typeof launch.record.harness === 'string' && launch.record.harness.length > 0
        && typeof launch.record.processOperation === 'string' && Array.isArray(launch.record.resourceReferences),
      'signed current worker placement absent');
      const resourceReferences = launch.record.resourceReferences as unknown[];
      const referenced = transport.find((row): row is TransportFact & { readonly record: AdmissionReservation } =>
        row.record.type === 'AdmissionReservation' && row.record.operation === launch.record.processOperation
          && row.record.run === run && resourceReferences.includes(row.fact.id));
      const reservation = transport.filter((row): row is TransportFact & { readonly record: AdmissionReservation } =>
        row.record.type === 'AdmissionReservation' && row.record.operation === launch.record.processOperation).at(-1);
      ensure(referenced && reservation && reservation.record.state !== 'closed'
        && reservation.record.run === run && reservation.record.fence.assignment === live.fence.assignment,
      'current worker resource reservation absent');
      return freeze({ worker: launch.record.principal, harness: launch.record.harness,
        ownership, context: reference(live.assignment.fact) });
    }),
  });
  productionAdmissions.add(admission);
  return admission;
}

/** Ten uses owner-minted construction provenance rather than a structural label. */
export function isProductionRunAdmission(admission: RunAdmissionPort): boolean {
  return productionAdmissions.has(admission);
}

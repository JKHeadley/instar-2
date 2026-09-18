import type { BoundaryContext, FactEnvelopeReference, Json, LeaseReference, OwnedReference, Result } from '../index.js';
import { canonical } from '../index.js';
import type { AppendReceipt, DurabilityState, FactEnvelope, FactStorePort } from '../facts/index.js';
import { recordFromWire } from '../rungraph/index.js';
import type { RunAdmissionPort, RunStep } from '../rungraph/index.js';
import type { AdmissionReservation, FenceToken, Lease, TransportAuthority, TransportFact } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

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

function exactStored(facts: readonly FactEnvelope[], candidate: FactEnvelope): FactEnvelope {
  const found = facts.find(fact => fact.id === candidate.id);
  ensure(found && same(found, candidate), 'owner observation is absent or changed in the signed prefix');
  return found;
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
  const clean = (): CleanPrefix => {
    const snapshot = take(input.store.readForProjection());
    ensure(snapshot.entries.every(row => row.taint.length === 0 && row.conflicts.length === 0),
      'tainted or conflicted run-admission prefix');
    const facts = snapshot.entries.map(row => row.fact);
    const transport = take(input.authority.inspect());
    for (const row of transport) exactStored(facts, row.fact);
    return freeze({ facts, transport });
  };
  const current = (ownership?: LeaseReference): Readonly<{ lease: Lease; fence: FenceToken; assignment: TransportFact }> => {
    const { transport } = clean();
    const row = transport.filter((entry): entry is TransportFact & { readonly record: Lease } =>
      entry.record.type === 'Lease').at(-1);
    ensure(row && row.record.state === 'held', 'current held lease required');
    const fence = fenceFor(transport, row.record);
    const assignment = transport.find(entry => entry.fact.id === fence.assignment);
    ensure(assignment?.record.type === 'Lease' && assignment.record.operation === 'acquire',
      'lease assignment is not a committed acquisition');
    if (ownership) ensure(ownership.owner === 'part-six' && ownership.name === 'Lease'
      && ownership.id === fence.assignment, 'stale or foreign run ownership');
    return freeze({ lease: row.record, fence, assignment });
  };
  const head = (facts: readonly FactEnvelope[], run: string): FactEnvelope | undefined =>
    facts.filter(fact => fact.kind !== 'session-grounding' && runOf(fact) === run).at(-1);
  const writtenAfter = (before: readonly FactEnvelope[], expectedCommand: string): TransportFact & { readonly record: Lease } => {
    const after = clean();
    ensure(after.facts.length === before.length + 1, 'run admission write interleaved with another fact');
    const witness = after.transport.find(row => row.fact.id === after.facts.at(-1)?.id);
    ensure(witness?.record.type === 'Lease' && witness.record.operation === 'write'
      && witness.record.command === expectedCommand, 'exact Six write witness missing');
    return witness as TransportFact & { readonly record: Lease };
  };
  const appendOnce = (beforeWrite: readonly FactEnvelope[], writeCommand: string,
    append: () => Result<AppendReceipt>, validate: (receipt: AppendReceipt) => void): AppendReceipt => {
    const witness = writtenAfter(beforeWrite, writeCommand);
    let calls = 0;
    const receipt = take((() => {
      ensure(++calls === 1, 'run admission callback repeated');
      return append();
    })());
    ensure(calls === 1, 'run admission callback count changed');
    const after = clean();
    const stored = exactStored(after.facts, receipt.fact);
    ensure(receipt.taint.length === 0, 'run append returned taint');
    ensure(stored.predecessors.inSegment === witness.fact.id,
      'run append is not adjacent to its Six witness');
    const preceding = after.facts.find(fact => fact.id === stored.predecessors.inSegment);
    ensure(preceding && preceding.id === after.facts.at(-2)?.id, 'run witness adjacency changed');
    validate(receipt);
    return freeze(receipt);
  };
  const witnessed = (record: FactEnvelopeReference): FactEnvelope => {
    ensure(record.owner === 'part-two' && record.name === 'FactEnvelope', 'fact reference owner mismatch');
    const { facts, transport } = clean();
    const fact = facts.find(row => row.id === record.id);
    ensure(fact && runKinds.has(fact.kind), 'admitted run fact absent');
    const predecessor = facts.find(row => row.id === fact.predecessors.inSegment);
    const witness = transport.find(row => row.fact.id === predecessor?.id);
    ensure(predecessor && witness?.record.type === 'Lease' && witness.record.operation === 'write',
      'run fact lacks adjacent Six write witness');
    const write = witness.record as Lease;
    const assignment = transport.find(row => row.record.type === 'Lease'
      && row.record.epoch === write.epoch && row.record.operation === 'acquire');
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
      const live = current();
      const writeCommand = command('create', { opening, run, assignment: live.fence.assignment });
      take(input.authority.admitWrite(writeCommand, live.fence));
      return appendOnce(before.facts, writeCommand, append, receipt => {
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
      const live = current(request.ownership);
      ensure(request.generation.owner === 'part-three' && request.generation.name === 'RegisterGeneration'
        && request.generation.id === live.lease.generation, 'run register generation changed');
      const fields = { run: request.run, expected: request.expected, ownership: request.ownership,
        generation: request.generation, operation: request.operation, digest: request.digest,
        durability: request.durability, assignment: live.fence.assignment };
      const writeCommand = command('commit', fields);
      take(input.authority.admitWrite(writeCommand, live.fence));
      return appendOnce(before.facts, writeCommand, append, receipt => {
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
      const live = current(ownership), { facts, transport } = clean();
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

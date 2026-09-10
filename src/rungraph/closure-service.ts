import { consumeResult } from '../index.js';
import type { FactEnvelopeReference, Json, Result } from '../index.js';
import { causalCone, createFactStore, hashBytes } from '../facts/index.js';
import type { AppendReceipt, ConflictClass, FactEnvelope } from '../facts/index.js';
import { foldProjection } from '../projections/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import {
  clockDifference, factRef, runProjection, statePairs, validateTransition,
} from './graph.js';
import { createRunGraph } from './service.js';
import {
  decodeRun, decodeRunTransition, decodeSessionGrounding, factReference, recordFromWire, runKinds,
} from './records.js';
import { checkIdentities, identityIndex } from './identity.js';
import { preserveRunInput } from './rungraph.js';
import type {
  RunDecodeContext, RunExit, RunTransition, RunView, SessionGrounding, UnreachableRunExit,
} from './types.js';
import {
  closureRecordReferences, closureRecordWire, decodeContinuityAccounting, decodeExhaustionRecord,
  decodeUnreachableRunExit, runClosureKinds, validateContinuitySendWitness,
} from './closure-records.js';
import { continuityAdmission, exhaustionAdmission, unreachableExitAdmission } from './closure.js';
import type {
  ContinuityAccounting, ExhaustionRecord, RunClosureGraphDependencies, RunClosureGraphPort,
  RunClosureRecord,
} from './closure-types.js';

type AdmittedClosure = Readonly<{ fact: FactEnvelope; record: RunClosureRecord }>;
type ClosureExitRead = Result<Readonly<{ fact: FactEnvelopeReference; exit: RunExit }>>;

function decodeByType(input: unknown, context: RunDecodeContext): Result<RunClosureRecord> {
  const type = object(json(input)).type;
  if (type === 'ExhaustionRecord') return decodeExhaustionRecord(input, context);
  if (type === 'ContinuityAccounting') return decodeContinuityAccounting(input, context);
  return decodeUnreachableRunExit(input, context);
}

/**
 * Additive closure composition. The legacy createRunGraph instance is used as-is;
 * new kinds are appended and replayed beside it and never enter legacy decoders.
 */
export function createRunClosureGraph(dependencies: RunClosureGraphDependencies): Result<RunClosureGraphPort> {
  return boundary('CreateRunClosureGraph', null, dependencies.context, () => {
    const legacy = take(createRunGraph(dependencies));
    need(dependencies.continuitySend?.owner === 'part-eight'
      && typeof dependencies.continuitySend.verify === 'function',
    'continuity send owner witness reader required');
    const context = (): RunDecodeContext => ({
      ...dependencies.context,
      facts: { ...dependencies.context.facts, facts: take(dependencies.store.read()) },
    });
    const once = (admit: (write: () => Result<AppendReceipt>) => Result<AppendReceipt>,
      write: () => AppendReceipt): AppendReceipt => {
      let calls = 0;
      let written: AppendReceipt | undefined;
      const receipt = take(admit(() => boundary('RunClosureConditionalAppend', null, dependencies.context, () => {
        need(++calls === 1, 'admission callback repeated');
        written = write();
        return written;
      })));
      need(calls === 1 && written && same(written, receipt),
        'admission did not commit the exact callback record');
      return receipt;
    };
    const predecessor = (view: RunView): FactEnvelope => {
      const fact = take(dependencies.store.read()).find(candidate =>
        (candidate.kind === runKinds.Run || candidate.kind === runKinds.RunTransition
          || candidate.kind === runClosureKinds.UnreachableRunExit)
        && object(recordFromWire(object(candidate.body).record!)).id === view.head);
      need(fact, 'durable transition predecessor missing');
      return fact;
    };
    const decodeFact = (fact: FactEnvelope, current: RunDecodeContext): RunClosureRecord => {
      const expectedKind = Object.entries(runClosureKinds).find(([, kind]) => kind === fact.kind);
      need(expectedKind, 'not an additive closure fact');
      const coneFacts = causalCone(fact, current.facts.facts);
      const coneContext = { ...current, facts: { ...current.facts, facts: coneFacts } };
      const record = take(decodeByType(recordFromWire(object(fact.body).record!), coneContext));
      need(record.type === expectedKind[0], 'closure fact kind and record type differ');
      need(record.run === object(fact.body).run, 'closure envelope and record run differ');
      const cone = new Set(coneFacts.map(candidate => candidate.id));
      need(closureRecordReferences(json(record)).every(id => cone.has(id)),
        'closure record reference is outside signed causal cone');
      need(same(take(dependencies.admission.verify(factRef(fact))), factRef(fact)),
        'closure record missing owner admission witness');
      return record;
    };
    const rawFor = (run: string, kind?: string): readonly FactEnvelope[] =>
      take(dependencies.store.read()).filter(fact => (!kind
        ? Object.values(runClosureKinds).includes(fact.kind as never) : fact.kind === kind)
        && object(fact.body).run === run);
    const admitted = (fact: FactEnvelope, current: RunDecodeContext): Result<AdmittedClosure> =>
      boundary('ReplayRunClosureFact', fact, current, () => ({ fact, record: decodeFact(fact, current) }));
    const acceptedFor = (run: string, type: RunClosureRecord['type'], current: RunDecodeContext): readonly AdmittedClosure[] =>
      rawFor(run, runClosureKinds[type]).flatMap(fact => consumeResult(admitted(fact, current), {
        Success: value => [value], Refused: () => [],
      }));
    const immutableCopies = (run: string, type: RunClosureRecord['type'], current: RunDecodeContext,
      id?: string): Readonly<{ records: readonly AdmittedClosure[]; conflicts: readonly ConflictClass[] }> => {
      const groups = new Map<string, AdmittedClosure[]>();
      for (const candidate of acceptedFor(run, type, current)) {
        if (id !== undefined && candidate.record.id !== id) continue;
        const rows = groups.get(candidate.record.id) ?? [];
        rows.push(candidate);
        groups.set(candidate.record.id, rows);
      }
      const records: AdmittedClosure[] = [], conflicts: ConflictClass[] = [];
      for (const [recordId, rows] of groups) {
        const original = rows[0]!;
        records.push(original);
        if (!rows.every(candidate => same(candidate.record, original.record))) conflicts.push({
          key: `${type}:${recordId}`,
          kind: 'immutable-disagreement',
          facts: rows.map(candidate => candidate.fact.id).sort(),
          detail: `conflicting immutable ${type} identity`,
        });
      }
      return { records, conflicts };
    };
    const exactAdmitted = (reference: Readonly<{ owner: string; name: string; id: string; fact: FactEnvelopeReference }>,
      name: RunClosureRecord['type'], current: RunDecodeContext): AdmittedClosure => {
      need(reference.owner === 'part-five' && reference.name === name,
        `${name} reference owner/name/id required`);
      const fact = factReference(json(reference.fact), current);
      need(fact.kind === runClosureKinds[name], `${name} reference fact kind differs`);
      const selected = decodeFact(fact, current);
      need(selected.type === name && selected.id === reference.id,
        `${name} reference identity differs from fact`);
      const copies = immutableCopies(selected.run, selected.type, current, selected.id);
      need(copies.conflicts.length === 0, `conflicting immutable ${selected.type} identity`);
      return { fact, record: selected };
    };
    const validateContinuityOwner = (record: ContinuityAccounting, view: RunView,
      current: RunDecodeContext): void => {
      need(record.run === view.run.id && record.expected === view.head,
        'continuity expected predecessor differs');
      const groundingFact = factReference(json(record.grounding.fact), current);
      need(groundingFact.kind === runKinds.SessionGrounding,
        'SessionGrounding reference fact kind differs');
      const grounding = take(decodeSessionGrounding(recordFromWire(object(groundingFact.body).record!), current));
      need(record.grounding.id === grounding.id && grounding.run === view.run.id
        && grounding.expected === view.head && grounding.reason === 'resume',
      'continuity grounding belongs to another run, head, or start reason');
      need(same(take(dependencies.admission.verify(factRef(groundingFact))), factRef(groundingFact)),
        'SessionGrounding admission witness missing');
    };
    const groundingCaptureCarrier = (fact: FactEnvelope, current: RunDecodeContext): FactEnvelope => {
      const schema = current.facts.schemas.find(candidate => candidate.kind === fact.kind
        && candidate.version === fact.schemaVersion);
      need(schema, 'continuity grounding capture not bound to the signed message capture field');
      if (Object.values(schema.fields).some(policy => policy.kind === 'capture')) return fact;
      const bearers = Object.entries(schema.fields).filter(([, policy]) => policy.kind === 'reference').map(([field]) => {
        const id = object(fact.body)[field];
        const ancestor = typeof id === 'string'
          ? current.facts.facts.find(candidate => candidate.id === id) : undefined;
        const ancestorSchema = ancestor && current.facts.schemas.find(candidate => candidate.kind === ancestor.kind
          && candidate.version === ancestor.schemaVersion);
        need(ancestor && ancestorSchema, 'continuity grounding capture ancestor missing or unverified');
        return { ancestor, captureBearing: Object.values(ancestorSchema.fields).some(policy => policy.kind === 'capture') };
      }).filter(candidate => candidate.captureBearing);
      need(bearers.length === 1, 'continuity grounding capture ancestor missing, ambiguous, or unverified');
      const selected = bearers[0]!;
      need(causalCone(fact, current.facts.facts).some(ancestor => ancestor.id === selected.ancestor.id),
        'continuity grounding capture ancestor missing or unverified');
      return selected.ancestor;
    };
    const validateUnavailableGrounding = (grounding: SessionGrounding, view: RunView,
      record: ContinuityAccounting, current: RunDecodeContext): void => {
      need(grounding.run === view.run.id && grounding.expected === view.head
        && same(grounding.principal, view.run.owner)
        && same(grounding.binding, view.run.resultDestination.binding),
      'continuity grounding run/head/principal/binding mismatch');
      need(same(grounding.directives, view.run.directives) && same(grounding.generation, view.run.generation),
        'continuity grounding directives or generation differ');
      need(same([...grounding.pendingOperations].sort(), view.pending.map(step => step.operation.key).sort())
        && grounding.children.length === 0, 'continuity grounding omitted pending work');
      const receipt = factReference(json(grounding.consumption), current);
      const receiptBody = object(receipt.body);
      const consumedCone = [...causalCone(receipt, current.facts.facts), receipt];
      for (const [machine, position] of Object.entries(grounding.frontier))
        need(consumedCone.some(fact => fact.machine === machine && fact.segment.epoch === position.epoch
          && fact.segment.position === position.position), 'continuity grounding frontier claims unseen history');
      const history = current.facts.facts.filter(fact => current.stimulusKinds.includes(fact.kind)
        && grounding.frontier[fact.machine]
        && (fact.segment.epoch < grounding.frontier[fact.machine]!.epoch
          || fact.segment.epoch === grounding.frontier[fact.machine]!.epoch
          && fact.segment.position <= grounding.frontier[fact.machine]!.position));
      need(new Set(history.map(fact => fact.machine)).size === 1,
        'out of slice scope: multi-lineage conversation ordering');
      history.sort((left, right) => left.segment.epoch - right.segment.epoch
        || left.segment.position - right.segment.position);
      need(history.length <= grounding.threshold,
        'out of slice scope: history requires summaries; no skim permitted');
      need(grounding.messages.length === history.length
        && new Set(grounding.messages.map(message => message.fact.id)).size === history.length,
      'continuity grounding history coverage gap or overlap');
      const expected = new Set(history.map(fact => fact.id));
      for (const message of grounding.messages) {
        const fact = factReference(json(message.fact), current);
        need(expected.has(fact.id) && message.sequence === fact.segment.position,
          'continuity grounding claims an absent/post-frontier message');
        const capture = current.facts.captures[message.capture];
        if (message.fact.id === record.prePauseInbound.id) {
          need(message.capture === record.prePauseCapture.reference && message.hash === record.prePauseCapture.hash
            && (!capture || capture.status !== 'available'),
          'continuity grounding unavailable capture differs from the accounted pre-pause inbound');
        } else need(capture?.status === 'available' && capture.bytes !== null && capture.hash === message.hash
          && hashBytes(capture.bytes) === message.hash,
        'continuity grounding has another unavailable or changed capture');
        const carrier = groundingCaptureCarrier(fact, current);
        const carrierSchema = current.facts.schemas.find(candidate => candidate.kind === carrier.kind
          && candidate.version === carrier.schemaVersion);
        need(carrierSchema && Object.entries(carrierSchema.fields).some(([field, policy]) => policy.kind === 'capture'
          && same(object(carrier.body)[field], { reference: message.capture, hash: message.hash })),
        'continuity grounding capture is not bound to the signed message capture field');
      }
      need(grounding.knownLineages.length === Object.keys(grounding.frontier).length
        && grounding.knownLineages.every(machine => Object.hasOwn(grounding.frontier, machine)),
      'continuity grounding lineage coverage differs');
      const latest = history.at(-1);
      need(latest && latest.id === grounding.lastInbound.id, 'continuity grounding last inbound differs');
      need(receiptBody.worker === grounding.worker && receiptBody.harness === grounding.harness
        && typeof receiptBody.hashes === 'string' && typeof receiptBody.classes === 'string'
        && same(JSON.parse(receiptBody.hashes), grounding.messages.map(message => message.hash))
        && same(JSON.parse(receiptBody.classes), grounding.briefingClasses),
      'continuity grounding consumption receipt does not bind delivered context');
    };
    const validateUnavailableStart = (transition: RunTransition, view: RunView,
      record: ContinuityAccounting, current: RunDecodeContext): void => {
      checkIdentities(json(transition), view.identities);
      need(transition.run === view.run.id && transition.expected === view.head && transition.from === view.state,
        'continuity transition expected predecessor/state differs');
      need(statePairs[transition.from]?.includes(transition.to), 'continuity state pair is not permitted');
      need(same(transition.responsible, view.run.owner) && same(transition.generation, view.run.generation),
        'continuity transition owner/generation differs');
      need(transition.kind === 'start' && transition.from === 'ready' && transition.to === 'running'
        && transition.step && transition.grounding && !transition.outcome && !transition.exit,
      'continuity start requires admitted step and actual-start grounding');
      need(view.pending.length === 0, 'continuity start cannot bypass an uncertain predecessor');
      const step = transition.step;
      need(step.run === view.run.id && step.expected === view.head && same(step.ownership, transition.ownership)
        && same(step.generation, view.run.generation), 'continuity step identity/predecessor/ownership differs');
      need(!view.usedKeys.includes(step.operation.key), 'continuity operation key is already admitted');
      need(step.allocation.budget === view.run.budget.id && view.run.budget.maxWorkers > 0
        && view.run.budget.maxProcesses > 0 && view.pending.length < view.run.budget.maxOutstanding
        && clockDifference(transition.at, view.run.budget.safetyCeiling, current) <= 0,
      'continuity budget ceiling or zero capacity forbids work');
      need(same(step.directives, view.run.directives)
        && same(step.resultDestination, view.run.resultDestination),
      'continuity step changed directives/destination');
      const groundingFact = factReference(json(transition.grounding), current);
      need(groundingFact.kind === runKinds.SessionGrounding, 'continuity grounding reference has wrong schema');
      const grounding = take(decodeSessionGrounding(recordFromWire(object(groundingFact.body).record!), current));
      validateUnavailableGrounding(grounding, view, record, current);
      need(same(take(dependencies.admission.verify(factRef(groundingFact))), factRef(groundingFact)),
        'continuity grounding admission witness missing');
      need(same(grounding.ownership, transition.ownership),
        'continuity grounding belongs to another ownership context');
      need(clockDifference(transition.at, grounding.at, current) >= 0,
        'continuity grounding clock is in the future');
      need(transition.blockedOn.kind === 'step' && transition.blockedOn.reference === step.id,
        'continuity running step lost its pending obligation');
    };
    const unavailableContinuityView = (record: ContinuityAccounting, current: RunDecodeContext): RunView => {
      need(record.prePauseCapture.status === 'unavailable' && record.disposition.kind === 'pending',
        'continuity authority is unavailable outside the honest pending arm');
      need(Object.entries(current.facts.captures).every(([reference, capture]) =>
        reference === record.prePauseCapture.reference || capture.status === 'available'),
      'unavailable continuity has another unavailable capture dependency');
      const snapshot = take(dependencies.store.readForProjection());
      const generation = dependencies.generation();
      const source = take(foldProjection(runProjection(generation), snapshot, generation, current));
      need(source.conflicts.length === 0 && source.taint.length > 0
        && source.taint.every(taint => taint === 'evidence-unavailable'),
      'unavailable continuity requires an otherwise clean signed history');
      const openingRecord = source.values[`${runKinds.Run}:${record.run}`];
      need(openingRecord && !Array.isArray(openingRecord), 'owner run is missing or conflicted');
      const run = take(decodeRun(recordFromWire(openingRecord), current));
      const facts = snapshot.entries.map(entry => entry.fact);
      const opening = facts.find(fact => fact.kind === runKinds.Run && object(fact.body).run === record.run);
      need(opening, 'owner run is missing or conflicted');
      need(same(take(dependencies.admission.verify(factRef(opening))), factRef(opening)),
        'run opening admission witness missing');
      const transitionFacts = facts.filter(fact => fact.kind === runKinds.RunTransition
        && object(fact.body).run === record.run);
      const transitions = transitionFacts.map(fact => ({ fact,
        record: take(decodeRunTransition(recordFromWire(object(fact.body).record!), current)) }));
      const identities = identityIndex(facts);
      let view: RunView = { run, head: run.id, state: 'ready', pending: [], settled: [], usedKeys: [],
        blockedOn: run.blockedOn, nextWake: run.nextWake, source, conflicts: [], identities };
      const remaining = new Map(transitions.map(row => [encoded(row.record).bytes, row]));
      while (remaining.size) {
        const successors = [...remaining.values()].filter(row => row.record.expected === view.head);
        need(successors.length === 1, successors.length
          ? 'incompatible concurrent continuity transition successors'
          : 'continuity transition predecessor is missing or cyclic');
        const { fact, record: transition } = successors[0]!;
        const parent = transitionFacts.find(candidate =>
          object(recordFromWire(object(candidate.body).record!)).id === transition.expected) ?? opening;
        need(causalCone(fact, current.facts.facts).some(ancestor => ancestor.id === parent.id),
          'continuity transition is not causally linked to its predecessor');
        if (transition.kind === 'start') validateUnavailableStart(transition, view, record, current);
        else validateTransition(transition, view, current);
        need(same(take(dependencies.admission.verify(factRef(fact))), factRef(fact)),
          'continuity transition admission witness missing');
        let pending = [...view.pending];
        const settled = [...view.settled];
        const usedKeys = [...view.usedKeys];
        if (transition.kind === 'start') {
          pending.push(transition.step!);
          usedKeys.push(transition.step!.operation.key);
        }
        if (transition.kind === 'observe' && transition.to === 'ready') {
          const step = pending.find(candidate => candidate.id === transition.affectedStep);
          need(step, 'continuity settlement pending step missing');
          settled.push(step.operation.key);
          pending = pending.filter(candidate => candidate.id !== step.id);
        }
        view = { ...view, state: transition.to, head: transition.id, pending, settled, usedKeys,
          blockedOn: transition.blockedOn, nextWake: transition.nextWake };
        remaining.delete(encoded(transition).bytes);
      }
      need(record.expected === view.head,
        'unavailable continuity expected predecessor differs from signed transition history');
      return freeze(view);
    };
    const continuityView = (record: ContinuityAccounting, current: RunDecodeContext): RunView => {
      const ordinary = legacy.read(record.run);
      return consumeResult(ordinary, {
        Success: value => value,
        Refused: refusal => {
          need(refusal.detail === 'conflicted or tainted authority', refusal.detail);
          return consumeResult(boundary('ReadUnavailableContinuityHistory', record, current,
            () => unavailableContinuityView(record, current)), {
            Success: value => value,
            Refused: () => {
              need(false, refusal.detail);
            },
          });
        },
      });
    };
    const frontierBefore = (fact: FactEnvelope, current: RunDecodeContext) => {
      const frontier: Record<string, { epoch: number; position: number }> = {};
      for (const ancestor of causalCone(fact, current.facts.facts)) {
        const prior = frontier[ancestor.machine];
        if (!prior || ancestor.segment.epoch > prior.epoch
          || ancestor.segment.epoch === prior.epoch && ancestor.segment.position > prior.position)
          frontier[ancestor.machine] = { epoch: ancestor.segment.epoch, position: ancestor.segment.position };
      }
      return frontier;
    };
    const validateUnreachableOwner = (record: UnreachableRunExit, view: RunView,
      current: RunDecodeContext, origin?: FactEnvelope): void => {
      need(!view.conflicts.length, 'conflicted head inhibits unreachable closure');
      need(view.pending.length === 0 && same([...record.settledOperations].sort(), [...view.settled].sort()),
        'unreachable exit has unsettled operations or incomplete settlement manifest');
      const exhaustion = exactAdmitted(record.exhaustion, 'ExhaustionRecord', current);
      need(exhaustion.record.type === 'ExhaustionRecord' && exhaustion.record.run === record.run,
        'unreachable exit exhaustion is absent or unwitnessed');
      const standing = factReference(json(record.standing), current);
      need(same(take(dependencies.control.verify('resume', factRef(standing), view.run)), factRef(standing)),
        'unreachable standing owner witness differs');
      need(same(record.frontier, origin ? frontierBefore(origin, current) : view.source.foldedThrough),
        'unreachable exit frontier differs from current signed run history');
      const validationClock = origin?.at ?? dependencies.clock();
      const validationContext = origin ? {
        ...current,
        facts: { ...current.facts, facts: causalCone(origin, current.facts.facts) },
      } : current;
      take(decodeExhaustionRecord({ ...exhaustion.record, at: validationClock }, validationContext));
      const age = clockDifference(validationClock, record.at, current);
      need(age >= 0 && age <= dependencies.groundingPolicy.maxAge,
        'unreachable exit clock stale or uncertain');
      need(clockDifference(record.recheck.at, validationClock, current) > 0,
        'unreachable recheck is already due');
      if (record.phase === 'proposal') {
        need(record.expected === view.head && !['closing', 'completed', 'unreachable', 'cancelled'].includes(view.state),
          'unreachable proposal expected predecessor differs');
      }
      else {
        need(record.proposal, 'unreachable close lacks its exact witnessed proposal');
        const proposal = exactAdmitted(record.proposal, 'UnreachableRunExit', current);
        need(proposal.record.type === 'UnreachableRunExit' && proposal.record.phase === 'proposal'
          && proposal.record.run === record.run && record.expected === view.head
          && record.proposal.id === proposal.record.id,
          'unreachable close lacks its exact witnessed proposal');
      }
    };
    const append = (record: RunClosureRecord, extra: readonly string[]): AppendReceipt => {
      const required = [...new Set([...closureRecordReferences(json(record)), ...extra])].sort();
      const kind = runClosureKinds[record.type];
      const receipt = take(dependencies.writer.append(kind, record.run, record as never, required));
      need(receipt.fact.kind === kind && receipt.fact.schemaVersion === 1
        && object(receipt.fact.body).run === record.run
        && same(object(receipt.fact.body).record, closureRecordWire(record))
        && receipt.taint.length === 0, 'writer returned a different or tainted closure record');
      need(required.every(id => receipt.fact.predecessors.required.includes(id)),
        'writer omitted closure causal references');
      need(take(dependencies.store.read()).some(fact => same(fact, receipt.fact)),
        'writer acknowledged without durable spine admission');
      return receipt;
    };
    const legacyBefore = (origin: FactEnvelope, current: RunDecodeContext): RunView => {
      const facts = causalCone(origin, current.facts.facts);
      const frontier = frontierBefore(origin, current);
      const historicalContext = { ...current, facts: { ...current.facts, facts: [] } };
      const unavailable = (): never => { throw new Error('historical closure validation is read-only'); };
      const store = createFactStore(historicalContext.facts, {
        owner: 'part-ten', read: () => facts, append: unavailable,
      });
      const generation = dependencies.generation();
      const graph = take(createRunGraph({ ...dependencies, context: historicalContext, store,
        clock: () => origin.at,
        generation: () => ({ ...generation, lineages: Object.fromEntries(Object.entries(frontier)
          .map(([machine, head]) => [machine, { head, observedAt: origin.at.value, closed: false }])) }),
        writer: { owner: 'part-ten', append: unavailable },
      }));
      return take(graph.read(String(object(origin.body).run)));
    };
    const closureView = (base: RunView, current: RunDecodeContext): RunView => {
      const exitCopies = immutableCopies(base.run.id, 'UnreachableRunExit', current);
      const candidates = exitCopies.records;
      const conflicts: ConflictClass[] = [...base.conflicts, ...exitCopies.conflicts];
      for (const candidate of candidates) {
        const record = candidate.record as UnreachableRunExit;
        conflicts.push(...immutableCopies(record.run, 'ExhaustionRecord', current, record.exhaustion.id).conflicts);
        if (record.phase === 'close')
          conflicts.push(...immutableCopies(record.run, 'UnreachableRunExit', current, record.proposal!.id).conflicts);
      }
      // The legacy fold can advance past a predecessor also consumed by a new exit.
      // Revalidate that proposal at its signed frontier before retaining the disagreement.
      const legacyTransitions = current.facts.facts.filter(fact => fact.kind === runKinds.RunTransition
        && object(fact.body).run === base.run.id);
      for (const candidate of candidates) {
        if (candidate.record.type !== 'UnreachableRunExit' || candidate.record.phase !== 'proposal') continue;
        const record = candidate.record;
        const competing = legacyTransitions.filter(fact =>
          object(recordFromWire(object(fact.body).record!)).expected === record.expected);
        if (!competing.length) continue;
        consumeResult(boundary('ReplayMixedRunSuccessors', candidate.fact, current, () => {
          validateUnreachableOwner(record, legacyBefore(candidate.fact, current), current, candidate.fact);
          return true;
        }), {
          Success: () => { conflicts.push({ key: `run-head:${record.run}:${record.expected}`,
            kind: 'immutable-disagreement', facts: [candidate.fact.id, ...competing.map(fact => fact.id)].sort(),
            detail: 'incompatible legacy transition and unreachable proposal consume the same predecessor' }); },
          Refused: () => undefined,
        });
      }
      const withConflicts = (view: RunView): RunView => conflicts.length ? freeze({ ...view, state: 'halted',
        conflicts: [...conflicts].sort((left, right) => left.key.localeCompare(right.key)) }) : view;
      const successors = (view: RunView, phase: UnreachableRunExit['phase']): readonly AdmittedClosure[] =>
        candidates.filter(candidate =>
          candidate.record.type === 'UnreachableRunExit' && candidate.record.phase === phase
          && candidate.record.expected === view.head).flatMap(candidate => consumeResult(
          boundary('ReplayUnreachableRunState', candidate.fact, current, () => {
            validateUnreachableOwner(candidate.record as UnreachableRunExit, view, current, candidate.fact);
            return candidate;
          }), { Success: value => [value], Refused: () => [] }));
      const proposals = successors(base, 'proposal');
      need(proposals.length <= 1, 'conflicting unreachable proposals');
      if (!proposals.length) return withConflicts(base);
      const proposal = proposals[0] as Readonly<{ fact: FactEnvelope; record: UnreachableRunExit }>;
      const closing: RunView = freeze({ ...base, state: 'closing', head: proposal.record.id,
        blockedOn: { kind: 'evidence', reference: proposal.record.exhaustion.id,
          owner: proposal.record.recheck.owner, nextObservation: proposal.record.recheck.at },
        nextWake: { owner: proposal.record.recheck.owner, at: proposal.record.recheck.at,
          reason: 'recheck unreachable dependency' } });
      const closes = successors(closing, 'close');
      need(closes.length <= 1, 'conflicting unreachable exits');
      if (!closes.length) return withConflicts(closing);
      const close = closes[0] as Readonly<{ fact: FactEnvelope; record: UnreachableRunExit }>;
      return withConflicts(freeze({ ...closing, state: 'unreachable', head: close.record.id }));
    };
    const read = (run: string): RunView => {
      const base = take(legacy.read(run));
      return closureView(base, context());
    };
    const appendOwned = (input: unknown, ownership: Parameters<RunClosureGraphPort['recordExhaustion']>[1],
      admit: (value: unknown, current: RunDecodeContext) => Result<RunClosureRecord>): Result<FactEnvelope> =>
      preserveRunInput(input, dependencies.context, dependencies.governance, captured =>
        boundary('RecordRunClosure', input, captured, safe => {
          const current = { ...context(), preserved: captured.preserved };
          const record = take(admit(safe, current));
          const copies = immutableCopies(record.run, record.type, current, record.id);
          need(copies.conflicts.length === 0, `conflicting immutable ${record.type} identity`);
          const sameIdentity = copies.records;
          if (sameIdentity.length && record.type === 'UnreachableRunExit') {
            need(same(sameIdentity[0]!.record, record),
              `immutable ${record.type} identity changed or conflicted`);
            return sameIdentity[0]!.fact;
          }
          const view = record.type === 'ContinuityAccounting'
            ? continuityView(record, current) : read(record.run);
          need(!view.conflicts.length, 'conflicted head inhibits closure record admission');
          if (record.type === 'ExhaustionRecord') {
            need(record.expected === view.head, 'exhaustion expected predecessor differs');
            const age = clockDifference(dependencies.clock(), record.at, current);
            need(age >= 0 && age <= view.run.exitTest.freshFor,
              'exhaustion record clock is stale or from the future');
          }
          if (record.type === 'ContinuityAccounting') validateContinuityOwner(record, view, current);
          if (record.type === 'UnreachableRunExit')
            validateUnreachableOwner(record, view, current, sameIdentity[0]?.fact);
          if (sameIdentity.length) {
            need(same(sameIdentity[0]!.record, record),
              `immutable ${record.type} identity changed or conflicted`);
            return sameIdentity[0]!.fact;
          }
          const parent = record.type === 'UnreachableRunExit' && record.phase === 'close'
            ? factReference(json(record.proposal!.fact), current) : predecessor(view);
          const receipt = once(write => dependencies.admission.commit({
            run: record.run,
            expected: record.expected,
            ownership,
            generation: view.run.generation,
            operation: record.id,
            digest: encoded(record).hash,
            durability: { kind: 'local-durable' },
          }, write), () => {
            const fresh = context();
            const freshRecord = take(decodeByType(record, fresh));
            need(same(freshRecord, record), `${record.type} changed during conditional admission`);
            const freshView = record.type === 'ContinuityAccounting'
              ? continuityView(record, fresh) : read(record.run);
            if (record.type === 'ExhaustionRecord') {
              need(record.expected === freshView.head, 'run changed during exhaustion append');
              const age = clockDifference(dependencies.clock(), record.at, fresh);
              need(age >= 0 && age <= freshView.run.exitTest.freshFor,
                'exhaustion record clock is stale or from the future');
            }
            if (record.type === 'ContinuityAccounting') validateContinuityOwner(record, freshView, fresh);
            if (record.type === 'UnreachableRunExit') validateUnreachableOwner(record, freshView, fresh);
            return append(record, [parent.id]);
          });
          return receipt.fact;
        }));
    const readExit = (run: Parameters<RunClosureGraphPort['readExit']>[0]): ClosureExitRead => {
      const legacyExit = legacy.readExit(run);
      return consumeResult(legacyExit, {
        Success: (): ClosureExitRead => {
          if (!rawFor(run.id, runClosureKinds.UnreachableRunExit).length) return legacyExit;
          return consumeResult(boundary('ReadRunExit', run, dependencies.context, () => {
            const view = read(run.id);
            need(view.conflicts.length === 0 && view.state === 'completed',
              'conflicting run successors prevent a terminal exit claim');
            return true;
          }), { Success: () => legacyExit, Refused: refusal => refusal });
        },
        Refused: (refusal): ClosureExitRead => refusal.detail !== 'terminal run exit absent' ? refusal
          : boundary('ReadRunExit', run, dependencies.context, safe => {
            const referenceValue = object(safe);
            need(referenceValue.owner === 'part-five' && referenceValue.name === 'Run'
              && typeof referenceValue.id === 'string' && referenceValue.id.length > 0,
            'run reference owner/name/id mismatch');
            const view = read(referenceValue.id as string);
            need(view.state === 'unreachable', 'terminal run exit absent');
            const resolved = immutableCopies(referenceValue.id as string, 'UnreachableRunExit', context(), view.head);
            need(resolved.conflicts.length === 0, 'conflicting unreachable exits');
            const matches = resolved.records
              .filter(candidate => candidate.record.type === 'UnreachableRunExit'
                && candidate.record.phase === 'close');
            need(matches.length === 1, 'terminal run exit fact absent');
            const selected = matches[0]!;
            need(selected.record.type === 'UnreachableRunExit', 'terminal run exit fact absent');
            return freeze({ fact: factRef(selected.fact), exit: selected.record as UnreachableRunExit });
          }),
      });
    };
    const readExitAny = (run: Parameters<RunClosureGraphPort['readExitAny']>[0]) => readExit(run);
    const verifyContinuitySend = (accounting: Parameters<RunClosureGraphPort['verifyContinuitySend']>[0],
      send: Parameters<RunClosureGraphPort['verifyContinuitySend']>[1]) =>
      boundary('VerifyContinuitySend', { accounting, send }, dependencies.context, () => {
        const current = context();
        need(accounting.owner === 'part-five' && accounting.name === 'ContinuityAccounting',
          'ContinuityAccounting reference owner/name/id required');
        const accountingFact = factReference(json(accounting.fact), current);
        need(accountingFact.kind === runClosureKinds.ContinuityAccounting,
          'ContinuityAccounting reference fact kind differs');
        const record = decodeFact(accountingFact, current);
        need(record.type === 'ContinuityAccounting' && record.id === accounting.id,
          'ContinuityAccounting reference identity differs from fact');
        const copies = immutableCopies(record.run, record.type, current, record.id);
        need(copies.conflicts.length === 0, `conflicting immutable ${record.type} identity`);
        validateContinuityOwner(record, continuityView(record, current), current);
        const sendFact = validateContinuitySendWitness(accountingFact, record, send,
          dependencies.clock(), dependencies.groundingPolicy.maxAge, current);
        const sendContext = {
          ...current,
          facts: { ...current.facts, facts: causalCone(sendFact, current.facts.facts) },
        };
        need(same(take(decodeContinuityAccounting(record, sendContext)), record),
          'continuity disposition changed before the first-reply send');
        need(same(take(decodeContinuityAccounting(record, current)), record),
          'continuity disposition is no longer supported by current signed history');
        need(same(take(dependencies.continuitySend.verify(factRef(sendFact), record)), factRef(sendFact)),
          'first-reply send owner witness differs from signed send record');
        return factRef(sendFact);
      });
    const publicRead = (run: string): Result<RunView> => consumeResult(legacy.read(run), {
      Refused: refusal => refusal,
      Success: base => boundary('ReadRun', run, dependencies.context, () => closureView(base, context())),
    });
    const publicOpen = (input: unknown): Result<RunView> => consumeResult(legacy.open(input), {
      Refused: refusal => refusal,
      Success: opened => publicRead(opened.run.id),
    });
    const publicGround: RunClosureGraphPort['ground'] = (run, worker, harness, reason, ownership) => {
      const base = legacy.read(run);
      return consumeResult(base, {
        Refused: () => legacy.ground(run, worker, harness, reason, ownership),
        Success: baseView => consumeResult(
          boundary('ReadRun', run, dependencies.context, () => closureView(baseView, context())), {
            Refused: refusal => refusal,
            Success: combined => {
              const additiveClosure = combined.state !== baseView.state || combined.head !== baseView.head;
              if (additiveClosure) return boundary('GroundRun', null, dependencies.context, () => {
                need(false, 'terminal/conflicted run cannot start a worker');
              });
              return legacy.ground(run, worker, harness, reason, ownership);
            },
          }),
      });
    };
    const publicTransition: RunClosureGraphPort['transition'] = input => {
      const candidate = input && typeof input === 'object' && !Array.isArray(input)
        ? input as Readonly<Record<string, unknown>> : undefined;
      const run = typeof candidate?.run === 'string' ? candidate.run : undefined;
      if (!run) return legacy.transition(input);
      const base = legacy.read(run);
      return consumeResult(base, {
        Refused: () => legacy.transition(input),
        Success: baseView => consumeResult(
          boundary('ReadRun', run, dependencies.context, () => closureView(baseView, context())), {
            Refused: refusal => refusal,
            Success: combined => {
              const additiveClosure = combined.state !== baseView.state || combined.head !== baseView.head;
              if (additiveClosure) return boundary('TransitionRun', input, dependencies.context, () => {
                need(false, 'terminal run cannot admit new execution');
              });
              return legacy.transition(input);
            },
          }),
      });
    };
    return freeze({
      ...legacy,
      open: publicOpen,
      read: publicRead,
      ground: publicGround,
      transition: publicTransition,
      readExit,
      recordExhaustion: (input, ownership) => appendOwned(input, ownership,
        (value, current) => exhaustionAdmission(value, current, dependencies.governance)),
      recordContinuity: (input, ownership) => appendOwned(input, ownership,
        (value, current) => continuityAdmission(value, current, dependencies.governance)),
      recordUnreachableExit: (input, ownership) => appendOwned(input, ownership,
        (value, current) => unreachableExitAdmission(value, current, dependencies.governance)),
      readExitAny,
      verifyContinuitySend,
    } satisfies RunClosureGraphPort);
  });
}

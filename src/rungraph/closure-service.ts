import { consumeResult } from '../index.js';
import type { FactEnvelopeReference, Json, Result } from '../index.js';
import { causalCone } from '../facts/index.js';
import type { AppendReceipt, FactEnvelope } from '../facts/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import { factRef, clockDifference } from './graph.js';
import { createRunGraph } from './service.js';
import { decodeRun, decodeSessionGrounding, factReference, recordFromWire, runKinds } from './records.js';
import { preserveRunInput } from './rungraph.js';
import type { RunDecodeContext, RunExit, RunView, UnreachableRunExit } from './types.js';
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
    const exactAdmitted = (reference: Readonly<{ owner: string; name: string; id: string; fact: FactEnvelopeReference }>,
      name: RunClosureRecord['type'], current: RunDecodeContext): AdmittedClosure => {
      need(reference.owner === 'part-five' && reference.name === name,
        `${name} reference owner/name/id required`);
      const fact = factReference(json(reference.fact), current);
      need(fact.kind === runClosureKinds[name], `${name} reference fact kind differs`);
      const selected = decodeFact(fact, current);
      need(selected.type === name && selected.id === reference.id,
        `${name} reference identity differs from fact`);
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
    const unavailableContinuityView = (record: ContinuityAccounting, current: RunDecodeContext): RunView => {
      need(record.prePauseCapture.status === 'unavailable' && record.disposition.kind === 'pending',
        'continuity authority is unavailable outside the honest pending arm');
      const openings = take(dependencies.store.read()).filter(fact => fact.kind === runKinds.Run
        && object(fact.body).run === record.run);
      need(openings.length === 1, 'owner run is missing or conflicted');
      const opening = openings[0]!;
      need(rawFor(record.run, runKinds.RunTransition).length === 0,
        'unavailable continuity cannot reconstruct a transitioned run head');
      const run = take(decodeRun(recordFromWire(object(opening.body).record!), current));
      need(same(take(dependencies.admission.verify(factRef(opening))), factRef(opening)),
        'run opening admission witness missing');
      need(record.expected === run.id && record.prePauseInbound.id === run.opening.id
        && record.disposition.work.id === run.opening.id,
      'unavailable continuity does not retain the original owned run and inbound');
      return freeze({ run, state: 'ready', head: run.id, pending: [], settled: [], usedKeys: [],
        blockedOn: run.blockedOn, nextWake: run.nextWake,
        source: { projection: 'run-view', generation: run.generation.id,
          policy: { class: 'authority-answering', stalenessBound: 60_000 }, values: {}, conflicts: [], taint: [],
          foldedThrough: {}, knownLineages: {}, retractions: [], corrections: [] },
        conflicts: [], identities: [] }) as unknown as RunView;
    };
    const continuityView = (record: ContinuityAccounting, current: RunDecodeContext): RunView => {
      const ordinary = legacy.read(record.run);
      return consumeResult(ordinary, {
        Success: value => value,
        Refused: refusal => {
          need(refusal.detail === 'conflicted or tainted authority', refusal.detail);
          need(rawFor(record.run, runKinds.RunTransition).length === 0, refusal.detail);
          return unavailableContinuityView(record, current);
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
    const closureView = (base: RunView, current: RunDecodeContext): RunView => {
      const successors = (view: RunView, phase: UnreachableRunExit['phase']): readonly AdmittedClosure[] =>
        acceptedFor(base.run.id, 'UnreachableRunExit', current).filter(candidate =>
          candidate.record.type === 'UnreachableRunExit' && candidate.record.phase === phase
          && candidate.record.expected === view.head).flatMap(candidate => consumeResult(
          boundary('ReplayUnreachableRunState', candidate.fact, current, () => {
            validateUnreachableOwner(candidate.record as UnreachableRunExit, view, current, candidate.fact);
            return candidate;
          }), { Success: value => [value], Refused: () => [] }));
      const proposals = successors(base, 'proposal');
      need(proposals.length <= 1, 'conflicting unreachable proposals');
      if (!proposals.length) return base;
      const proposal = proposals[0] as Readonly<{ fact: FactEnvelope; record: UnreachableRunExit }>;
      const closing: RunView = freeze({ ...base, state: 'closing', head: proposal.record.id,
        blockedOn: { kind: 'evidence', reference: proposal.record.exhaustion.id,
          owner: proposal.record.recheck.owner, nextObservation: proposal.record.recheck.at },
        nextWake: { owner: proposal.record.recheck.owner, at: proposal.record.recheck.at,
          reason: 'recheck unreachable dependency' } });
      const closes = successors(closing, 'close');
      need(closes.length <= 1, 'conflicting unreachable exits');
      if (!closes.length) return closing;
      const close = closes[0] as Readonly<{ fact: FactEnvelope; record: UnreachableRunExit }>;
      return freeze({ ...closing, state: 'unreachable', head: close.record.id });
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
          const sameIdentity = rawFor(record.run, runClosureKinds[record.type]).filter(candidate =>
            object(recordFromWire(object(candidate.body).record!)).id === record.id)
            .map(candidate => ({ fact: candidate, record: decodeFact(candidate, current) }));
          if (record.type === 'UnreachableRunExit')
            validateUnreachableOwner(record, view, current, sameIdentity[0]?.fact);
          if (sameIdentity.length) {
            need(sameIdentity.length === 1 && same(sameIdentity[0]!.record, record),
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
        Success: (): ClosureExitRead => legacyExit,
        Refused: (refusal): ClosureExitRead => refusal.detail !== 'terminal run exit absent' ? refusal
          : boundary('ReadRunExit', run, dependencies.context, safe => {
            const referenceValue = object(safe);
            need(referenceValue.owner === 'part-five' && referenceValue.name === 'Run'
              && typeof referenceValue.id === 'string' && referenceValue.id.length > 0,
            'run reference owner/name/id mismatch');
            const view = read(referenceValue.id as string);
            need(view.state === 'unreachable', 'terminal run exit absent');
            const matches = rawFor(referenceValue.id as string, runClosureKinds.UnreachableRunExit).filter(fact => {
              const wire = object(recordFromWire(object(fact.body).record!));
              return wire.id === view.head && wire.phase === 'close';
            });
            need(matches.length === 1,
              matches.length ? 'conflicting unreachable exits' : 'terminal run exit fact absent');
            const selected = decodeFact(matches[0]!, context());
            need(selected.type === 'UnreachableRunExit', 'terminal run exit fact absent');
            return freeze({ fact: factRef(matches[0]!), exit: selected });
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
        validateContinuityOwner(record, continuityView(record, current), current);
        const sendFact = validateContinuitySendWitness(accountingFact, record, send,
          dependencies.clock(), dependencies.groundingPolicy.maxAge, current);
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

import { consumeResult } from '../index.js';
import type { FactEnvelopeReference, Json, Result } from '../index.js';
import { causalCone } from '../facts/index.js';
import type { AppendReceipt, FactEnvelope } from '../facts/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import { factRef, clockDifference } from './graph.js';
import { createRunGraph } from './service.js';
import { decodeSessionGrounding, factReference, recordFromWire, runKinds } from './records.js';
import { preserveRunInput } from './rungraph.js';
import type { RunDecodeContext, RunView } from './types.js';
import {
  closureRecordReferences, closureRecordWire, decodeContinuityAccounting, decodeExhaustionRecord,
  decodeUnreachableRunExit, runClosureKinds, validateContinuitySendWitness,
} from './closure-records.js';
import { continuityAdmission, exhaustionAdmission, unreachableExitAdmission } from './closure.js';
import type {
  ContinuityAccounting, ExhaustionRecord, RunClosureGraphDependencies, RunClosureGraphPort,
  RunClosureRecord, UnreachableRunExit,
} from './closure-types.js';

type AdmittedClosure = Readonly<{ fact: FactEnvelope; record: RunClosureRecord }>;

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
        (candidate.kind === runKinds.Run || candidate.kind === runKinds.RunTransition)
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
      const currentRecord = take(decodeByType(record, current));
      need(same(currentRecord, record), 'closure dependency changed after signed admission');
      need(same(take(dependencies.admission.verify(factRef(fact))), factRef(fact)),
        'closure record missing owner admission witness');
      return record;
    };
    const admittedFor = (run: string): readonly AdmittedClosure[] => {
      const current = context();
      return take(dependencies.store.read()).filter(fact => Object.values(runClosureKinds).includes(fact.kind as never)
        && object(fact.body).run === run).map(fact => ({ fact, record: decodeFact(fact, current) }));
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
      admitted: readonly AdmittedClosure[], current: RunDecodeContext, origin?: FactEnvelope): void => {
      need(!view.conflicts.length, 'conflicted head inhibits unreachable closure');
      need(view.pending.length === 0 && same([...record.settledOperations].sort(), [...view.settled].sort()),
        'unreachable exit has unsettled operations or incomplete settlement manifest');
      need(same(record.frontier, origin ? frontierBefore(origin, current) : view.source.foldedThrough),
        'unreachable exit frontier differs from current signed run history');
      const age = clockDifference(dependencies.clock(), record.at, current);
      need(age >= 0 && age <= dependencies.groundingPolicy.maxAge,
        'unreachable exit clock stale or uncertain');
      need(clockDifference(record.recheck.at, dependencies.clock(), current) > 0,
        'unreachable recheck is already due');
      const exhaustion = admitted.find(candidate => candidate.record.type === 'ExhaustionRecord'
        && candidate.record.id === record.exhaustion.id && candidate.fact.id === record.exhaustion.fact.id);
      need(exhaustion, 'unreachable exit exhaustion is absent or unwitnessed');
      if (record.phase === 'proposal') need(record.expected === view.head,
        'unreachable proposal expected predecessor differs');
      else {
        const proposal = admitted.find(candidate => candidate.record.type === 'UnreachableRunExit'
          && candidate.record.phase === 'proposal' && candidate.record.id === record.expected
          && candidate.fact.id === record.proposal?.fact.id);
        need(proposal && record.proposal?.id === proposal.record.id,
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
    const appendOwned = (input: unknown, ownership: Parameters<RunClosureGraphPort['recordExhaustion']>[1],
      admit: (value: unknown, current: RunDecodeContext) => Result<RunClosureRecord>): Result<FactEnvelope> =>
      preserveRunInput(input, dependencies.context, dependencies.governance, captured =>
        boundary('RecordRunClosure', input, captured, safe => {
          const current = { ...context(), preserved: captured.preserved };
          const record = take(admit(safe, current));
          const view = take(legacy.read(record.run));
          need(!view.conflicts.length, 'conflicted head inhibits closure record admission');
          if (record.type === 'ExhaustionRecord') {
            need(record.expected === view.head, 'exhaustion expected predecessor differs');
            const age = clockDifference(dependencies.clock(), record.at, current);
            need(age >= 0 && age <= view.run.exitTest.freshFor,
              'exhaustion record clock is stale or from the future');
          }
          if (record.type === 'ContinuityAccounting') validateContinuityOwner(record, view, current);
          const before = admittedFor(record.run);
          const sameIdentity = before.filter(candidate => candidate.record.type === record.type
            && candidate.record.id === record.id);
          if (record.type === 'UnreachableRunExit')
            validateUnreachableOwner(record, view, before, current, sameIdentity[0]?.fact);
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
            const freshView = take(legacy.read(record.run));
            const admitted = admittedFor(record.run);
            if (record.type === 'ExhaustionRecord') {
              need(record.expected === freshView.head, 'run changed during exhaustion append');
              const age = clockDifference(dependencies.clock(), record.at, fresh);
              need(age >= 0 && age <= freshView.run.exitTest.freshFor,
                'exhaustion record clock is stale or from the future');
            }
            if (record.type === 'ContinuityAccounting') validateContinuityOwner(record, freshView, fresh);
            if (record.type === 'UnreachableRunExit') validateUnreachableOwner(record, freshView, admitted, fresh);
            return append(record, [parent.id]);
          });
          return receipt.fact;
        }));
    const readExitAny = (run: Parameters<RunClosureGraphPort['readExitAny']>[0]) =>
      boundary('ReadRunExitAny', run, dependencies.context, safe => {
        const referenceValue = object(safe);
        need(referenceValue.owner === 'part-five' && referenceValue.name === 'Run'
          && typeof referenceValue.id === 'string' && referenceValue.id.length > 0,
        'run reference owner/name/id mismatch');
        const legacyExit = legacy.readExit(run);
        const completed = consumeResult(legacyExit, {
          Success: value => value,
          Refused: () => undefined,
        });
        const records = admittedFor(referenceValue.id as string);
        const closes = records.filter((candidate): candidate is Readonly<{ fact: FactEnvelope; record: UnreachableRunExit }> =>
          candidate.record.type === 'UnreachableRunExit' && candidate.record.phase === 'close');
        need(!(completed && closes.length), 'conflicting completed and unreachable exits');
        if (completed) return completed;
        need(closes.length === 1, closes.length ? 'conflicting unreachable exits' : 'terminal run exit absent');
        const view = take(legacy.read(referenceValue.id as string));
        validateUnreachableOwner(closes[0]!.record, view, records, context(), closes[0]!.fact);
        return freeze({ fact: factRef(closes[0]!.fact), exit: closes[0]!.record });
      });
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
        validateContinuityOwner(record, take(legacy.read(record.run)), current);
        const sendFact = validateContinuitySendWitness(accountingFact, record, send,
          dependencies.clock(), dependencies.groundingPolicy.maxAge, current);
        need(same(take(dependencies.continuitySend.verify(factRef(sendFact), record)), factRef(sendFact)),
          'first-reply send owner witness differs from signed send record');
        return factRef(sendFact);
      });
    return freeze({
      ...legacy,
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

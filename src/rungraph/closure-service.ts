import { consumeResult } from '../index.js';
import type { FactEnvelopeReference, Json, Result } from '../index.js';
import { causalCone, createFactStore } from '../facts/index.js';
import type { AppendReceipt, ConflictClass, FactEnvelope } from '../facts/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import { clockDifference, factRef } from './graph.js';
import { createRunGraph } from './service.js';
import { factReference, recordFromWire, runKinds } from './records.js';
import { preserveRunInput } from './rungraph.js';
import type { RunDecodeContext, RunExit, RunView, UnreachableRunExit } from './types.js';
import {
  closureRecordReferences, closureRecordWire, decodeExhaustionRecord,
  decodeUnreachableRunExit, runClosureKinds,
} from './closure-records.js';
import { exhaustionAdmission, unreachableExitAdmission } from './closure.js';
import type {
  RunClosureGraphDependencies, RunClosureGraphPort, RunClosureRecord,
} from './closure-types.js';

type AdmittedClosure = Readonly<{ fact: FactEnvelope; record: RunClosureRecord }>;
type ClosureExitRead = Result<Readonly<{ fact: FactEnvelopeReference; exit: RunExit }>>;

function decodeByType(input: unknown, context: RunDecodeContext): Result<RunClosureRecord> {
  const type = object(json(input)).type;
  if (type === 'ExhaustionRecord') return decodeExhaustionRecord(input, context);
  return decodeUnreachableRunExit(input, context);
}

/**
 * Additive closure composition. The legacy createRunGraph instance is used as-is;
 * new kinds are appended and replayed beside it and never enter legacy decoders.
 */
export function createRunClosureGraph(dependencies: RunClosureGraphDependencies): Result<RunClosureGraphPort> {
  return boundary('CreateRunClosureGraph', null, dependencies.context, () => {
    const legacy = take(createRunGraph(dependencies));
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
      if (selected.type === 'ExhaustionRecord') {
        const origins = new Set([
          fact.id,
          ...causalCone(fact, current.facts.facts).map(ancestor => ancestor.id),
        ]);
        const supported = acceptedFor(selected.run, selected.type, current).some(candidate =>
          origins.has(candidate.fact.id) && same(candidate.record, selected) && consumeResult(
            boundary('RevalidateExhaustionOrigin', candidate.fact, current, () => {
              const prior = closureBefore(candidate.fact, current);
              need(prior.conflicts.length === 0 && selected.expected === prior.head,
                'referenced exhaustion predecessor differs from its signed admission history');
              const age = clockDifference(candidate.fact.at, selected.at, current);
              need(age >= 0 && age <= prior.run.exitTest.freshFor,
                'referenced exhaustion clock is stale or from the future at admission');
              return true;
            }), { Success: value => value, Refused: () => false }));
        need(supported, 'referenced exhaustion has no consistent signed admission origin');
      }
      return { fact, record: selected };
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
      need(record.run === view.run.id, 'unreachable exit belongs to another run');
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
    // Rebuild a record's actual admission frontier, including earlier additive exits.
    // Each recursive reference is strictly inside a prior causal cone.
    const closureBefore = (origin: FactEnvelope, current: RunDecodeContext): RunView => {
      const facts = causalCone(origin, current.facts.facts);
      const frontier = frontierBefore(origin, current);
      const historicalContext = { ...current, facts: { ...current.facts, facts: [] } };
      const unavailable = (): never => { throw new Error('historical exhaustion validation is read-only'); };
      const store = createFactStore(historicalContext.facts, {
        owner: 'part-ten', read: () => facts, append: unavailable,
      });
      const generation = dependencies.generation();
      const graph = take(createRunClosureGraph({
        ...dependencies,
        context: historicalContext,
        store,
        clock: () => origin.at,
        generation: () => ({
          ...generation,
          lineages: Object.fromEntries(Object.entries(frontier)
            .map(([machine, head]) => [machine, { head, observedAt: origin.at.value, closed: false }])),
        }),
        writer: { owner: 'part-ten', append: unavailable },
      }));
      return take(graph.read(String(object(origin.body).run)));
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
          if (sameIdentity.length && record.type === 'ExhaustionRecord') {
            need(same(sameIdentity[0]!.record, record),
              `immutable ${record.type} identity changed or conflicted`);
            exactAdmitted({
              owner: 'part-five',
              name: 'ExhaustionRecord',
              id: record.id,
              fact: factRef(sameIdentity[0]!.fact),
            }, 'ExhaustionRecord', current);
          }
          if (sameIdentity.length && record.type === 'UnreachableRunExit') {
            need(same(sameIdentity[0]!.record, record),
              `immutable ${record.type} identity changed or conflicted`);
            exactAdmitted(record.exhaustion, 'ExhaustionRecord', current);
            if (record.phase === 'close')
              exactAdmitted(record.proposal!, 'UnreachableRunExit', current);
            const origin = sameIdentity[0]!.fact;
            validateUnreachableOwner(record, closureBefore(origin, current), current, origin);
            return origin;
          }
          if (sameIdentity.length && record.type === 'ExhaustionRecord') return sameIdentity[0]!.fact;
          const view = read(record.run);
          need(!view.conflicts.length, 'conflicted head inhibits closure record admission');
          if (record.type === 'ExhaustionRecord') {
            need(record.expected === view.head, 'exhaustion expected predecessor differs');
            const age = clockDifference(dependencies.clock(), record.at, current);
            need(age >= 0 && age <= view.run.exitTest.freshFor,
              'exhaustion record clock is stale or from the future');
          }
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
            const freshView = read(record.run);
            need(!freshView.conflicts.length, 'conflicted head inhibits closure record admission');
            if (record.type === 'ExhaustionRecord') {
              need(record.expected === freshView.head, 'run changed during exhaustion append');
              const age = clockDifference(dependencies.clock(), record.at, fresh);
              need(age >= 0 && age <= freshView.run.exitTest.freshFor,
                'exhaustion record clock is stale or from the future');
            }
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
      recordUnreachableExit: (input, ownership) => appendOwned(input, ownership,
        (value, current) => unreachableExitAdmission(value, current, dependencies.governance)),
      readExitAny,
    } satisfies RunClosureGraphPort);
  });
}

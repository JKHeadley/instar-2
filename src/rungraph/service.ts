import type { FactEnvelopeReference, Result } from '../index.js';
import type { AppendReceipt, FactEnvelope } from '../facts/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import { factRef, foldRun, readRecordFact, validateGrounding, validateTransition, outcomeAt, clockDifference } from './graph.js';
import { decodeRun, decodeRunTransition, decodeSessionGrounding, factReference, recordReferences, recordWire, runIdFor, runKinds } from './records.js';
import { checkIdentities, identityIndex } from './identity.js';
import { consumeProductionGroundingRead, productionGroundingReaderScope, bindProductionGroundedGraph, isDeclaredFactoryReader } from '../assembly/grounding-capability.js';
import { isProductionGroundingReader, issueProductionGroundedGraph } from './types.js';
import type { AcceptedProviderAnswerView, AcceptedProviderReplyInput, RunDecodeContext, RunGraphDependencies, RunGraphPort, RunRecord, RunView } from './types.js';
import { runGraphConstruct, preserveRunInput, runAdmission, stepAdmission, transitionAdmission, stopAdmission, exitAdmission, groundingAdmission } from './rungraph.js';

/** No effect executor lives here. Six/eight consume a DURABLY admitted step;
 * returned views and caller annotations are never admission authority. */
export function createRunGraph(d: RunGraphDependencies): Result<RunGraphPort> {
  // Bind the actual delegation; mutating the caller's composition cannot turn
  // an admitted production graph into a compatibility-only graph after boot.
  d = Object.freeze({ ...d });
  return boundary('CreateRunGraph', null, d.context, () => {
    need(d.governance, 'verified governed gate installation required'); runGraphConstruct(d.governance);
    need(d.writer?.owner === 'part-ten' && typeof d.writer.append === 'function', 'real fact writer required');
    need(d.admission?.owner === 'part-six' && typeof d.admission.create === 'function' && typeof d.admission.commit === 'function'
      && typeof d.admission.verify === 'function' && typeof d.admission.execution === 'function'
      && typeof d.admission.reservation === 'function', 'conditional admission, execution context, reservation and durable witness reader required');
    need(d.grounding?.owner === 'part-ten' && typeof d.grounding.read === 'function', 'actual-start grounding reader required');
    need(!d.grounding.production || d.assemblyHistory?.owner === 'part-ten', 'production grounding requires public Ten assembly history');
    need(!d.grounding.production || isProductionGroundingReader(d.grounding) || isDeclaredFactoryReader(d.grounding),
      'production grounding requires the invocation-bound Ten delivery reader');
    need(d.settlement?.owner === 'part-eight' && typeof d.settlement.read === 'function', 'settlement consumer required');
    need(d.control?.owner === 'part-four' && typeof d.control.verify === 'function', 'control consumer required');
    need(d.exitCheck?.owner === 'part-nine' && typeof d.exitCheck.verify === 'function', 'exit check consumer required');
    need(typeof d.clock === 'function' && typeof d.generation === 'function', 'clock and register readers required');
    need(d.context.types.register.entries.includes(d.groundingPolicy.entry)
      && Number.isSafeInteger(d.groundingPolicy.threshold) && d.groundingPolicy.threshold > 0
      && Number.isSafeInteger(d.groundingPolicy.maxAge) && d.groundingPolicy.maxAge > 0
      && d.groundingPolicy.briefingClasses.length > 0, 'registered positive grounding policy required');
    const context = (): RunDecodeContext => ({ ...d.context, facts: { ...d.context.facts,
      // Preservation can add a capture during this call. Resolve the owner's
      // current capture table at consumption, including physical custody loss.
      get captures() { return d.context.facts.captures; }, facts: take(d.store.read()) } });
    const groundingValidation = (now: import('../index.js').Clock, candidateStep?: import('./types.js').RunStep,
      transitionTrigger?: FactEnvelopeReference) => ({ now,
      ...(d.grounding.production ? { production: true as const, assemblyHistory: d.assemblyHistory! } : {}),
      ...(candidateStep ? { candidateStep } : {}), ...(transitionTrigger ? { transitionTrigger } : {}) });
    const replay = (id: string): Readonly<{ view: RunView; transition: Readonly<{ fact: FactEnvelope; record: Extract<RunRecord, { type: 'RunTransition' }> }> | undefined }> => {
      let transition: Readonly<{ fact: FactEnvelope; record: Extract<RunRecord, { type: 'RunTransition' }> }> | undefined;
      const snapshot = take(d.store.readForProjection()), c = context();
      const now = d.clock();
      const view = take(foldRun(id, snapshot, d.generation(), c, now, { verify: (fact, record, before) => boundary('RunReplayWitness', null, c, () => {
        need(same(take(d.admission.verify(factRef(fact))), factRef(fact)), 'durable admission witness missing');
        if (record.type === 'RunTransition' && before) {
          if (record.step) {
            const reservation = factReference(json(take(d.admission.reservation(record.step.allocation.reservation, record.step))), c);
            need(fact.predecessors.required.includes(reservation.id), 'reservation witness differs from admitted causal reference');
          }
          if (record.kind === 'stop' || record.kind === 'resume') need(same(take(d.control.verify(record.kind, record.trigger, before.run)), record.standing), 'control witness mismatch');
          if (record.settlement) {
            const step = before.pending.find(s => s.id === record.affectedStep); need(step, 'settlement pending step missing');
            const receipt = take(d.settlement.read(record.settlement, step));
            need(same(receipt.record, record.settlement) && same(receipt.outcome, outcomeAt(record, c)), 'settlement replay witness mismatch');
            if (record.to === 'ready') need(receipt.claimClosed && receipt.chargeSettled, 'unsettled replay cannot advance');
          }
          if (record.exit) need(same(take(d.exitCheck.verify(record.exit, before.run, record.at)), record.exit.check), 'exit replay witness mismatch');
          transition = { fact, record };
        } return factRef(fact);
      }) }, groundingValidation(now)));
      return { view, transition };
    };
    const read = (id: string): RunView => replay(id).view;
    const predecessor = (view: RunView): FactEnvelope => {
      const fact = take(d.store.read()).find(f => (f.kind === runKinds.Run || f.kind === runKinds.RunTransition)
        && object(readRecordFact(f)).id === view.head); need(fact, 'durable transition predecessor missing'); return fact;
    };
    const replyRequirements = new Map<string, readonly string[]>();
    let replyOpening: Readonly<{ input: AcceptedProviderReplyInput; accepted: AcceptedProviderAnswerView;
      opening: FactEnvelope; original: RunView }> | undefined;
    const append = (record: RunRecord, extra: readonly string[] = []): AppendReceipt => {
      checkIdentities(json(record), identityIndex(take(d.store.read())));
      const run = record.type === 'Run' ? record.id : record.run;
      const replyRequired = record.type === 'Run' ? replyRequirements.get(record.id) : undefined;
      const required = [...new Set([...recordReferences(json(record)), ...extra, ...(replyRequired ?? [])])].sort();
      const receipt = take(d.writer.append(runKinds[record.type], run, record, required));
      need(receipt.fact.kind === runKinds[record.type] && receipt.fact.schemaVersion === 1 && object(receipt.fact.body).run === run
        && same(object(receipt.fact.body).record, recordWire(record)) && receipt.taint.length === 0, 'writer returned a different or tainted record');
      need(required.every(id => receipt.fact.predecessors.required.includes(id)), 'writer omitted causal references');
      need(take(d.store.read()).some(f => same(f, receipt.fact)), 'writer acknowledged without durable spine admission');
      return receipt;
    };
    const once = (admit: (write: () => Result<AppendReceipt>) => Result<AppendReceipt>, write: () => AppendReceipt): AppendReceipt => {
      let calls = 0, written: AppendReceipt | undefined;
      const receipt = take(admit(() => boundary('RunConditionalAppend', null, d.context, () => {
        need(++calls === 1, 'admission callback repeated'); written = write(); return written;
      })));
      need(calls === 1 && written && same(written, receipt), 'admission did not commit the exact callback record'); return receipt;
    };
    const graph: RunGraphPort = freeze({
      owner: 'part-five',
      read: (run: string) => boundary('ReadRun', run, d.context, () => read(run)),
      readExit: run => boundary('ReadRunExit', run, d.context, safe => {
        const reference = object(safe);
        need(reference.owner === 'part-five' && reference.name === 'Run'
          && typeof reference.id === 'string' && reference.id.length > 0, 'run reference owner/name/id mismatch');
        const replayed = replay(reference.id), view = replayed.view;
        need(['completed', 'unreachable', 'cancelled'].includes(view.state), 'terminal run exit absent');
        const selected = replayed.transition;
        need(selected, 'terminal run exit fact absent');
        const { fact, record: transition } = selected;
        need(transition.run === reference.id && transition.kind === 'close' && transition.to === view.state
          && transition.exit, 'terminal run exit absent');
        return freeze({ fact: factRef(fact), exit: transition.exit });
      }),
      open: (input: unknown) => preserveRunInput(input, d.context, d.governance, captured => boundary('OpenRun', input, captured, safe => {
        const run = take(runAdmission(safe, { ...context(), preserved: captured.preserved }, d.governance));
        const openingFact = take(d.store.read()).find(fact => fact.id === run.opening.id);
        const acceptedReply = openingFact?.kind === 'judgment-provider-ProviderAnswerAcceptance';
        let replyCommit: Readonly<{ input: AcceptedProviderReplyInput; accepted: AcceptedProviderAnswerView;
          original: RunView }> | undefined;
        if (acceptedReply) {
          const gate = replyOpening;
          need(gate && gate.opening.id === run.opening.id && gate.accepted.acceptance.id === gate.input.acceptance.id,
            'acceptance-backed Run requires the conditional accepted-reply boundary');
          const original = read(gate.input.originalRun);
          need(original.head === gate.input.expected && original.conflicts.length === 0
            && !['completed', 'cancelled', 'unreachable'].includes(original.state),
          'accepted reply original run predecessor is no longer current');
          const snapshot = take(d.store.readForProjection());
          const obligation = snapshot.entries.find(entry => entry.fact.id === gate.input.obligation.id);
          const obligationRecord = obligation ? object(object(obligation.fact.body).record) : undefined;
          need(obligation && !obligation.taint.length && !obligation.conflicts.length
            && obligation.fact.kind === 'transport-LoopRecord' && obligationRecord?.run === gate.input.originalRun
            && typeof obligationRecord.episode === 'string' && obligationRecord.episode.length > 0,
          'accepted reply conversation obligation differs, stopped, or is unavailable');
          const episodeRows = snapshot.entries.filter(entry => {
            if (entry.fact.kind !== 'transport-LoopRecord') return false;
            const candidate = object(object(entry.fact.body).record);
            return candidate?.run === gate.input.originalRun && candidate.episode === obligationRecord.episode;
          });
          need(episodeRows.length > 0 && episodeRows.every(entry => !entry.taint.length && !entry.conflicts.length),
            'accepted reply current conversation obligation is unavailable or conflicted');
          const latestTick = Math.max(...episodeRows.map(entry => Number(object(object(entry.fact.body).record)?.tick)));
          need(Number.isSafeInteger(latestTick), 'accepted reply current conversation obligation tick differs');
          const latestRows = episodeRows.filter(entry => Number(object(object(entry.fact.body).record)?.tick) === latestTick);
          const latestRecords = latestRows.map(entry => object(object(entry.fact.body).record));
          need(latestRows.length === 1 && latestRecords[0]
            && !['stopped', 'closed'].includes(String(latestRecords[0].state)),
          'accepted reply current conversation obligation is stopped, closed, or conflicted');
          need(same(gate.input.standing, original.run.owner.fact),
            'accepted reply standing differs from original accountable owner');
          const transport = take(d.store.read()).filter(fact => fact.kind.startsWith('transport-'));
          const leases = transport.filter(fact => fact.kind === 'transport-Lease');
          const leaseFact = leases.at(-1), lease = leaseFact ? object(object(leaseFact.body).record) : undefined;
          need(leaseFact && lease?.type === 'Lease' && lease.state === 'held' && Number(lease.expires) > d.clock().value,
            'accepted reply has no live current lease');
          const assignment = leases.find(fact => {
            const candidate = object(object(fact.body).record);
            return candidate.type === 'Lease' && candidate.operation === 'acquire' && candidate.epoch === lease.epoch;
          });
          need(assignment, 'accepted reply current lease assignment absent');
          const expectedFence = { type: 'FenceToken', schemaVersion: 1, domain: lease.domain, epoch: lease.epoch,
            assignment: assignment.id, holder: lease.holder, machine: lease.machine, incarnation: lease.incarnation,
            authority: lease.authority, generation: lease.generation };
          need(same(gate.input.fence, expectedFence) && gate.input.ownership.owner === 'part-six'
            && gate.input.ownership.name === 'Lease' && gate.input.ownership.id.length > 0
            && gate.input.fence.holder === original.run.owner.id
            && gate.input.fence.generation === original.run.generation.id,
          'accepted reply lease-derived fence or ownership differs');
          const execution = take(d.admission.execution(gate.input.originalRun, gate.input.ownership));
          need(same(execution.ownership, gate.input.ownership), 'accepted reply current ownership differs');
          need(gate.accepted.originalRun === gate.input.originalRun && gate.accepted.predecessor === gate.input.expected
            && gate.accepted.obligation === gate.input.obligation.id,
          'accepted reply durable cause differs');
          replyCommit = { input: gate.input, accepted: gate.accepted, original };
        }
        const existing = take(d.store.read()).find(f => f.kind === runKinds.Run && object(f.body).run === run.id);
        if (existing) { need(same(readRecordFact(existing), run), 'immutable run opening changed'); return read(run.id); }
        const admit = (write: () => Result<AppendReceipt>) => replyCommit
          ? d.admission.commit({ run: replyCommit.input.originalRun, expected: replyCommit.input.expected,
            ownership: replyCommit.input.ownership, generation: replyCommit.original.run.generation,
            operation: `accepted-provider-reply:${replyCommit.accepted.acceptance.id}`, digest: encoded(run).hash,
            durability: { kind: 'local-durable' } }, write)
          : d.admission.create(run.opening, run.id, write);
        once(admit, () => {
          need(!take(d.store.read()).some(f => f.kind === runKinds.Run && object(f.body).run === run.id), 'root already committed');
          return append(take(decodeRun(safe, context())));
        });
        return read(run.id);
      })),
      openAcceptedProviderReply: (input: AcceptedProviderReplyInput) => boundary('OpenAcceptedProviderReply', input, d.context, () => {
        need(d.acceptedAnswer?.owner === 'part-eight', 'accepted-answer consumer is not installed');
        const acceptanceFact = take(d.store.read()).find(fact => fact.id === input.acceptance.id
          && fact.kind === 'judgment-provider-ProviderAnswerAcceptance');
        need(acceptanceFact, 'accepted reply opening fact absent');
        const opening = factRef(acceptanceFact), replyId = runIdFor(opening);
        const prior = take(d.store.read()).find(fact => fact.kind === runKinds.Run && object(fact.body).run === replyId);
        if (prior) {
          const stored = readRecordFact(prior), candidate = object(JSON.parse(encoded(input.reply).bytes));
          need(same(stored, candidate), 'accepted answer was already consumed by another reply run');
          const acceptance = object(object(acceptanceFact.body).record);
          const request = take(d.store.read()).find(fact => fact.kind === 'judgment-provider-ProviderJudgmentRequest'
            && object(object(fact.body).record).id === acceptance.request);
          const requestRecord = request ? object(object(request.body).record) : undefined;
          const effect = requestRecord ? take(d.store.read()).find(fact => fact.kind === 'effect-provider-ProviderEffectRequest'
            && object(object(fact.body).record).id === requestRecord.effectRequest) : undefined;
          const effectRecord = effect ? object(object(effect.body).record) : undefined;
          const storedRun = object(stored), storedOwner = object(storedRun.owner);
          need(requestRecord?.run === input.originalRun && requestRecord.predecessor === input.expected
            && effectRecord?.obligation === input.obligation.id && same(input.standing, storedOwner.fact),
          'historical accepted reply cause differs');
          return read(replyId);
        }
        return take(d.acceptedAnswer.consumeAcceptedProviderAnswer(input.acceptance, accepted => {
          need(accepted.acceptance.id === input.acceptance.id && accepted.originalRun === input.originalRun
            && accepted.predecessor === input.expected && accepted.obligation === input.obligation.id,
          'accepted reply cause, predecessor, or conversation obligation differs');
          const original = read(input.originalRun);
          need(accepted.acceptanceFact.id === acceptanceFact.id,
            'accepted reply consumer returned another opening fact');
          const candidate = object(JSON.parse(encoded(input.reply).bytes));
          need(candidate.type === 'Run' && candidate.schemaVersion === 1 && candidate.id === replyId
            && same(candidate.opening, opening) && same(candidate.intent, original.run.intent)
            && same(candidate.directives, original.run.directives) && same(candidate.owner, original.run.owner)
            && same(candidate.scope, original.run.scope) && same(candidate.resultDestination, original.run.resultDestination)
            && same(candidate.generation, original.run.generation) && candidate.depth === 1,
          'accepted reply must be one standard Run bound to the original conversation');
          replyRequirements.set(replyId, [...new Set([...accepted.required, input.obligation.id])].sort());
          replyOpening = { input, accepted, opening: acceptanceFact, original };
          try {
            const opened: RunView = take(graph.open(json(input.reply)));
            const fact = take(d.store.read()).find(item => item.kind === runKinds.Run && object(item.body).run === replyId);
            need(fact && replyRequirements.get(replyId)!.every(id => fact.predecessors.required.includes(id)),
              'reply opening omitted accepted answer causal closure');
            return opened;
          } finally { replyOpening = undefined; replyRequirements.delete(replyId); }
        }));
      }),
      ground: (run, worker, harness, reason, ownership) => boundary('GroundRun', null, d.context, () => {
        const view = read(run); need(!view.conflicts.length && !['completed', 'cancelled', 'unreachable'].includes(view.state), 'terminal/conflicted run cannot start a worker');
        const execution = take(d.admission.execution(run, ownership));
        need(execution.worker === worker && execution.harness === harness && same(execution.ownership, ownership), 'worker/harness differs from verified execution context');
        factReference(json(execution.context), context());
        const before = d.clock(), invocation = {};
        const readResult = take(d.grounding.read({ run: view, worker, harness, reason, execution, invocation }));
        const input = d.grounding.production
          ? consumeProductionGroundingRead(d.grounding, invocation, readResult)
          : readResult;
        const after = d.clock();
        const grounding = take(preserveRunInput(input, context(), d.governance, captured => groundingAdmission(input, captured, d.governance)));
        need(grounding.worker === worker && grounding.harness === harness && grounding.reason === reason
          && same(grounding.ownership, execution.ownership) && same(grounding.executionContext, execution.context)
          && clockDifference(grounding.at, before, context()) >= 0 && clockDifference(after, grounding.at, context()) >= 0, 'grounding reused an intake clock or another worker');
        need(grounding.threshold === d.groundingPolicy.threshold && same(grounding.briefingClasses, d.groundingPolicy.briefingClasses), 'grounding changed governed coverage policy');
        validateGrounding(grounding, view.run, view.head, view.pending, context(), groundingValidation(after));
        const parent = predecessor(view);
        const receipt = once(write => d.admission.commit({ run, expected: view.head, ownership, generation: view.run.generation,
          operation: grounding.id, digest: encoded(grounding).hash, durability: { kind: 'local-durable' } }, write), () => {
          need(read(run).head === view.head, 'run changed during grounding');
          need(same(take(d.admission.execution(run, ownership)), execution), 'execution context changed during grounding');
          const commitNow = d.clock();
          validateGrounding(grounding, view.run, view.head, view.pending, context(), groundingValidation(commitNow));
          return append(grounding, [parent.id]);
        }); return receipt.fact;
      }),
      transition: (input: unknown) => preserveRunInput(input, d.context, d.governance, captured => boundary('TransitionRun', input, captured, safe => {
        const admissionContext = { ...context(), preserved: captured.preserved };
        const t = take(object(safe).kind === 'stop' ? stopAdmission(safe, admissionContext, d.governance) : transitionAdmission(safe, admissionContext, d.governance));
        if (t.step) take(stepAdmission(t.step, admissionContext, d.governance));
        if (t.exit) take(exitAdmission(t.exit, admissionContext, d.governance));
        const existing = take(d.store.read()).find(f => f.kind === runKinds.RunTransition && object(readRecordFact(f)).id === t.id);
        if (existing) { need(same(readRecordFact(existing), t), 'immutable transition identity changed'); return read(t.run); }
        const view = read(t.run); need(view.conflicts.length === 0, 'conflicted head inhibits admission');
        once(write => d.admission.commit({ run: t.run, expected: t.expected, ownership: t.ownership, generation: t.generation,
          operation: t.step?.operation.key ?? t.id, digest: t.step?.operation.digest ?? encoded(t).hash, durability: { kind: 'local-durable' } }, write), () => {
          const current = read(t.run), c = context(), now = d.clock();
          need(current.conflicts.length === 0, 'conflicted head inhibits admission'); validateTransition(t, current, c, groundingValidation(now));
          const age = clockDifference(now, t.at, c); need(age >= 0 && age <= d.groundingPolicy.maxAge, 'transition clock stale or uncertain');
          if (t.grounding) {
            const fact = c.facts.facts.find(f => f.id === t.grounding!.id); need(fact, 'grounding absent');
            const g = take(decodeSessionGrounding(readRecordFact(fact), c));
            need(same(take(d.admission.verify(factRef(fact))), factRef(fact)), 'grounding admission witness missing');
            const execution = take(d.admission.execution(t.run, t.ownership));
            need(execution.worker === g.worker && execution.harness === g.harness && same(execution.ownership, t.ownership)
              && same(g.ownership, execution.ownership) && same(g.executionContext, execution.context), 'grounding differs from verified executing worker/ownership context');
            factReference(json(execution.context), c);
            const groundingAge = clockDifference(now, g.at, c); need(groundingAge >= 0 && groundingAge <= d.groundingPolicy.maxAge, 'actual-start grounding stale');
            need(g.threshold === d.groundingPolicy.threshold && same(g.briefingClasses, d.groundingPolicy.briefingClasses), 'grounding policy mismatch');
            validateGrounding(g, current.run, current.head, current.pending, c, groundingValidation(now, t.step, t.trigger));
            need(c.facts.facts.filter(f => c.stimulusKinds.includes(f.kind)).every(f => g.messages.some(m => m.fact.id === f.id)), 'new inbound requires fresh grounding');
          }
          if (t.settlement) {
            const step = current.pending.find(s => s.id === t.affectedStep); need(step, 'settlement has no pending step');
            const receipt = take(d.settlement.read(t.settlement, step));
            need(same(receipt.record, t.settlement) && same(receipt.outcome, outcomeAt(t, c)), 'settlement consumer disagrees with recorded outcome');
            if (t.to === 'ready') need(receipt.claimClosed && receipt.chargeSettled, 'settlement has unresolved execution or charge');
          }
          if (t.kind === 'stop' || t.kind === 'resume') need(same(take(d.control.verify(t.kind, t.trigger, current.run)), t.standing), 'control standing differs');
          if (t.exit) need(same(take(d.exitCheck.verify(t.exit, current.run, now)), t.exit.check), 'exit check differs');
          const reservation = t.step ? factReference(json(take(d.admission.reservation(t.step.allocation.reservation, t.step))), c) : undefined;
          return append(t, [predecessor(current).id, ...(reservation ? [reservation.id] : [])]);
        });
        return read(t.run);
      })),
    } satisfies RunGraphPort);
    return d.grounding.production ? bindProductionGroundedGraph(graph, d.grounding, d.store, d.assemblyHistory, d.generation().reference.id) : graph;
  });
}

export function openAcceptedProviderReply(graph: Pick<RunGraphPort, 'openAcceptedProviderReply'>,
  input: AcceptedProviderReplyInput): Result<RunView> {
  return graph.openAcceptedProviderReply(input);
}

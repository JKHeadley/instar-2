import type { FactEnvelopeReference, Result } from '../index.js';
import type { AppendReceipt, FactEnvelope } from '../facts/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import { factRef, foldRun, readRecordFact, validateGrounding, validateTransition, outcomeAt } from './graph.js';
import { decodeRun, decodeRunTransition, decodeSessionGrounding, recordReferences, recordWire, runKinds } from './records.js';
import type { RunDecodeContext, RunGraphDependencies, RunGraphPort, RunRecord, RunView } from './types.js';

/** No effect executor lives here. Six/eight consume a DURABLY admitted step;
 * returned views and caller annotations are never admission authority. */
export function createRunGraph(d: RunGraphDependencies): Result<RunGraphPort> {
  return boundary('CreateRunGraph', null, d.context, () => {
    need(d.writer?.owner === 'part-ten' && typeof d.writer.append === 'function', 'real fact writer required');
    need(d.admission?.owner === 'part-six' && typeof d.admission.create === 'function' && typeof d.admission.commit === 'function'
      && typeof d.admission.verify === 'function', 'conditional admission and durable witness reader required');
    need(d.grounding?.owner === 'part-ten' && typeof d.grounding.read === 'function', 'actual-start grounding reader required');
    need(d.settlement?.owner === 'part-eight' && typeof d.settlement.read === 'function', 'settlement consumer required');
    need(d.control?.owner === 'part-four' && typeof d.control.verify === 'function', 'control consumer required');
    need(d.exitCheck?.owner === 'part-nine' && typeof d.exitCheck.verify === 'function', 'exit check consumer required');
    need(typeof d.clock === 'function' && typeof d.generation === 'function', 'clock and register readers required');
    need(d.context.types.register.entries.includes(d.groundingPolicy.entry)
      && Number.isSafeInteger(d.groundingPolicy.threshold) && d.groundingPolicy.threshold > 0
      && Number.isSafeInteger(d.groundingPolicy.maxAge) && d.groundingPolicy.maxAge > 0
      && d.groundingPolicy.briefingClasses.length > 0, 'registered positive grounding policy required');
    const context = (): RunDecodeContext => ({ ...d.context, facts: { ...d.context.facts, facts: take(d.store.read()) } });
    const read = (id: string): RunView => {
      const snapshot = take(d.store.readForProjection()), c = context();
      return take(foldRun(id, snapshot, d.generation(), c, d.clock(), { verify: (fact, record, before) => boundary('RunReplayWitness', null, c, () => {
        need(same(take(d.admission.verify(factRef(fact))), factRef(fact)), 'durable admission witness missing');
        if (record.type === 'RunTransition' && before) {
          if (record.kind === 'stop' || record.kind === 'resume') need(same(take(d.control.verify(record.kind, record.trigger, before.run)), record.standing), 'control witness mismatch');
          if (record.settlement) {
            const step = before.pending.find(s => s.id === record.affectedStep); need(step, 'settlement pending step missing');
            const receipt = take(d.settlement.read(record.settlement, step));
            need(same(receipt.record, record.settlement) && same(receipt.outcome, outcomeAt(record, c)), 'settlement replay witness mismatch');
            if (record.to === 'ready') need(receipt.claimClosed && receipt.chargeSettled, 'unsettled replay cannot advance');
          }
          if (record.exit) need(same(take(d.exitCheck.verify(record.exit, before.run, record.at)), record.exit.check), 'exit replay witness mismatch');
        } return factRef(fact);
      }) }));
    };
    const predecessor = (view: RunView): FactEnvelope => {
      const fact = take(d.store.read()).find(f => (f.kind === runKinds.Run || f.kind === runKinds.RunTransition)
        && object(readRecordFact(f)).id === view.head); need(fact, 'durable transition predecessor missing'); return fact;
    };
    const append = (record: RunRecord, extra: readonly string[] = []): AppendReceipt => {
      const run = record.type === 'Run' ? record.id : record.run;
      const required = [...new Set([...recordReferences(json(record)), ...extra])].sort();
      const receipt = take(d.writer.append(runKinds[record.type], run, record, required));
      need(receipt.fact.kind === runKinds[record.type] && object(receipt.fact.body).run === run
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
    return freeze({
      read: (run: string) => boundary('ReadRun', run, d.context, () => read(run)),
      open: (input: unknown) => boundary('OpenRun', input, d.context, safe => {
        const run = take(decodeRun(safe, context()));
        const existing = take(d.store.read()).find(f => f.kind === runKinds.Run && object(f.body).run === run.id);
        if (existing) { need(same(readRecordFact(existing), run), 'immutable run opening changed'); return read(run.id); }
        once(write => d.admission.create(run.opening, run.id, write), () => {
          need(!take(d.store.read()).some(f => f.kind === runKinds.Run && object(f.body).run === run.id), 'root already committed');
          return append(take(decodeRun(safe, context())));
        });
        return read(run.id);
      }),
      ground: (run, worker, harness, reason, ownership) => boundary('GroundRun', null, d.context, () => {
        const view = read(run); need(!view.conflicts.length && !['completed', 'cancelled', 'unreachable'].includes(view.state), 'terminal/conflicted run cannot start a worker');
        const before = d.clock(), input = take(d.grounding.read({ run: view, worker, harness, reason })), after = d.clock();
        const grounding = take(decodeSessionGrounding(input, context()));
        need(grounding.worker === worker && grounding.harness === harness && grounding.reason === reason
          && grounding.at.subject.instance === before.subject.instance && before.subject.instance === after.subject.instance
          && before.value <= grounding.at.value && grounding.at.value <= after.value, 'grounding reused an intake clock or another worker');
        need(grounding.threshold === d.groundingPolicy.threshold && same(grounding.briefingClasses, d.groundingPolicy.briefingClasses), 'grounding changed governed coverage policy');
        validateGrounding(grounding, view.run, view.head, view.pending, context());
        const parent = predecessor(view);
        const receipt = once(write => d.admission.commit({ run, expected: view.head, ownership, generation: view.run.generation,
          operation: grounding.id, digest: encoded(grounding).hash, durability: { kind: 'local-durable' } }, write), () => {
          need(read(run).head === view.head, 'run changed during grounding');
          validateGrounding(grounding, view.run, view.head, view.pending, context());
          return append(grounding, [parent.id]);
        }); return receipt.fact;
      }),
      transition: (input: unknown) => boundary('TransitionRun', input, d.context, safe => {
        const t = take(decodeRunTransition(safe, context()));
        const existing = take(d.store.read()).find(f => f.kind === runKinds.RunTransition && object(readRecordFact(f)).id === t.id);
        if (existing) { need(same(readRecordFact(existing), t), 'immutable transition identity changed'); return read(t.run); }
        const view = read(t.run); need(view.conflicts.length === 0, 'conflicted head inhibits admission');
        once(write => d.admission.commit({ run: t.run, expected: t.expected, ownership: t.ownership, generation: t.generation,
          operation: t.step?.operation.key ?? t.id, digest: t.step?.operation.digest ?? encoded(t).hash, durability: { kind: 'local-durable' } }, write), () => {
          const current = read(t.run), c = context(), now = d.clock();
          need(current.conflicts.length === 0, 'conflicted head inhibits admission'); validateTransition(t, current, c);
          need(t.at.subject.instance === now.subject.instance && t.at.value <= now.value && now.value - t.at.value <= d.groundingPolicy.maxAge, 'transition clock stale or uncertain');
          if (t.grounding) {
            const fact = c.facts.facts.find(f => f.id === t.grounding!.id); need(fact, 'grounding absent');
            const g = take(decodeSessionGrounding(readRecordFact(fact), c));
            need(now.value - g.at.value <= d.groundingPolicy.maxAge, 'actual-start grounding stale');
            need(g.threshold === d.groundingPolicy.threshold && same(g.briefingClasses, d.groundingPolicy.briefingClasses), 'grounding policy mismatch');
            validateGrounding(g, current.run, current.head, current.pending, c);
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
          return append(t, [predecessor(current).id]);
        });
        return read(t.run);
      }),
    } satisfies RunGraphPort);
  });
}

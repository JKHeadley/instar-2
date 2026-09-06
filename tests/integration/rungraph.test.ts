import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { setup, value, refused, json, ref } from '../rungraph/fixtures.js';

function fixture() {
  const f = setup(), ready = value(f.graph.open(f.run)), ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const running = value(f.graph.transition(f.start(ready, ground)));
  const observation = f.observe(running, 'happened');
  const outcome = value(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: 'happened', evidence: [`observation:${running.head}`] }, f.ctx.decode));
  const settlement = value(decode('Evidence', f.evidenceInput({ id: 'settlement:1', claim: { subject: 'operation:1', predicate: 'operation-settled',
    value: { digest: running.pending[0]!.operation.digest, claimClosed: true, chargeSettled: true } }, freshFor: 1000 }), f.ctx.decode));
  const settlementFact = f.append('evidence-record', json({ evidence: settlement })).fact;
  const graph = value(createRunGraph({ ...f.deps, settlement: { owner: 'part-eight', read: record => f.success({ record, outcome, claimClosed: true, chargeSettled: true }) } }));
  const observed = { ...observation, to: 'ready', blockedOn: { kind: 'nothing' }, settlement: ref(settlementFact) };
  return { ...f, graph, running, observed, outcome, settlementFact };
}
it('P5-NF-12 P5-NF-59 recorded outcome and exact settlement advance once through the fact ports', () => {
  const f = fixture(), ready = value(f.graph.transition(f.observed));
  expect(ready.pending).toEqual([]); expect(ready.settled).toEqual(['operation:1']);
  expect(value(f.graph.transition(f.observed)).head).toBe(ready.head);
  const ground = value(f.graph.ground(f.id, 'w2', 'h', 'start', f.lease));
  refused(f.graph.transition({ ...f.start(ready, ground, 'operation:1'), id: 'retry-same-operation' }), 'already admitted');
  expect(value(f.graph.transition(f.start(ready, ground, 'operation:2'))).pending).toHaveLength(1);
});
it('P5-NF-17 exact fresh exit test is mandatory; worker exit, lower bar, missing evidence and refused results cannot close', () => {
  const f = fixture(), ready = value(f.graph.transition(f.observed));
  const check = value(decode('Evidence', f.evidenceInput({ id: 'exit-check', claim: { subject: f.run.exitTest.subject,
    predicate: `exit:${f.run.exitTest.check}:${f.run.exitTest.version}`, value: f.run.exitTest.acceptance }, freshFor: 1000 }), f.ctx.decode));
  const checkFact = f.append('evidence-record', json({ evidence: check })).fact;
  const result = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success', value: 'artifact', capacity: { kind: 'none' } }, f.ctx.decode));
  const resultFact = f.append('result-record', json({ result })).fact;
  const exit = { type: 'RunExit', schemaVersion: 1, id: 'exit:1', run: f.id, expected: ready.head, proposer: f.owner,
    standing: ref(f.opening), frontier: ready.source.foldedThrough, at: f.now, kind: 'completed', exitTest: f.run.exitTest,
    check: ref(checkFact), evidence: [{ type: 'Evidence', id: check.id, fact: ref(checkFact), field: 'evidence' }],
    result: { type: 'Result', id: 'result:1', fact: ref(resultFact), field: 'result' }, settledOperations: ['operation:1'] };
  const transition = { type: 'RunTransition', schemaVersion: 1, id: 'propose-exit:1', run: f.id, expected: ready.head,
    trigger: ref(checkFact), kind: 'propose-exit', from: 'ready', to: 'closing', responsible: f.owner, standing: ref(f.opening), ownership: f.lease,
    generation: f.run.generation, at: f.now, blockedOn: { kind: 'nothing' }, nextWake: f.run.nextWake, exit };
  for (const changed of [{ ...exit, evidence: [] }, { ...exit, exitTest: { ...exit.exitTest, acceptance: f.artifact } }, { ...exit, settledOperations: [] }]) refused(f.graph.transition({ ...transition, exit: changed }));
  const refusedResult = f.append('result-record', json({ result: value(decode('Result', f.refusedInput(), f.ctx.decode)) })).fact;
  refused(f.graph.transition({ ...transition, exit: { ...exit, result: { ...exit.result, fact: ref(refusedResult) } } }), 'refused work');
  const closing = value(f.graph.transition(transition)); expect(closing.state).toBe('closing');
  const completed = value(f.graph.transition({ ...transition, id: 'close:1', expected: closing.head, kind: 'close', from: 'closing', to: 'completed',
    exit: { ...exit, id: 'exit:2', expected: closing.head } }));
  expect(completed.state).toBe('completed');
  refused(f.graph.ground(f.id, 'worker-after-completion', 'h', 'start', f.lease), 'terminal');
  refused(f.graph.transition({ ...transition, id: 'reopen', expected: completed.head, from: 'completed' }), 'state pair');
});
it('P5-NF-15 P5-NF-60 an owner settlement disagreement cannot be hidden during replay', () => {
  const f = fixture(); value(f.graph.transition(f.observed));
  const wrong = value(createRunGraph({ ...f.deps, settlement: { owner: 'part-eight', read: record => f.success({ record, outcome: f.outcome, claimClosed: false, chargeSettled: false }) } }));
  refused(wrong.read(f.id), 'unsettled replay');
});

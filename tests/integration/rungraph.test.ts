import { expect, it } from 'vitest';
import { decode, decodeMeasurement } from '../../src/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { completedRun, setup, value, refused, json, ref } from '../rungraph/fixtures.js';

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
  f.place('w2', 'h'); const ground = value(f.graph.ground(f.id, 'w2', 'h', 'start', f.lease));
  const retry = f.start(ready, ground, 'operation:1');
  refused(f.graph.transition({ ...retry, id: 'retry-same-operation', step: { ...retry.step, id: 'retry-step' }, blockedOn: { ...retry.blockedOn, reference: 'retry-step' } }), 'already admitted');
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
  const foreignExitClock = value(decodeMeasurement('clock', f.clockRaw(100, 'machine-b'), f.ctx.decode));
  refused(f.graph.transition({ ...transition, exit: { ...exit, at: foreignExitClock } }), 'subject, instance, or unit mismatch');
  const refusedResult = f.append('result-record', json({ result: value(decode('Result', f.refusedInput(), f.ctx.decode)) })).fact;
  refused(f.graph.transition({ ...transition, exit: { ...exit, result: { ...exit.result, fact: ref(refusedResult) } } }), 'refused work');
  const closing = value(f.graph.transition(transition)); expect(closing.state).toBe('closing');
  refused(f.graph.transition({ ...transition, id: 'close-reused-exit', expected: closing.head, kind: 'close', from: 'closing', to: 'completed',
    exit: { ...exit, expected: closing.head } }), 'immutable RunExit identity');
  const completed = value(f.graph.transition({ ...transition, id: 'close:1', expected: closing.head, kind: 'close', from: 'closing', to: 'completed',
    exit: { ...exit, id: 'exit:2', expected: closing.head } }));
  expect(completed.state).toBe('completed');
  refused(f.graph.ground(f.id, 'worker-after-completion', 'h', 'start', f.lease), 'terminal');
  refused(f.graph.transition({ ...transition, id: 'reopen', expected: completed.head, from: 'completed' }), 'state pair');
// x64 CI measured 5.809s for this multi-invocation signed-history/exit matrix
// (run 34003580189). Budget the integration fixture, not runtime latency; the
// independent P5-NF-55 fold-latency assertion and global timeout stay unchanged.
}, 15_000);
it('P5-NF-15 P5-NF-60 an owner settlement disagreement cannot be hidden during replay', () => {
  const f = fixture(); value(f.graph.transition(f.observed));
  const wrong = value(createRunGraph({ ...f.deps, settlement: { owner: 'part-eight', read: record => f.success({ record, outcome: f.outcome, claimClosed: false, chargeSettled: false }) } }));
  refused(wrong.read(f.id), 'unsettled replay');
});
it('owner-branded RunExitReadPort integrates terminal lookup and refuses absent neighbors', () => {
  const open = setup(), ready = value(open.graph.open(open.run));
  const before = value(open.store.read()).length;
  refused(open.graph.readExit({ owner: 'part-five', name: 'Run', id: ready.run.id }), 'terminal run exit absent');
  expect(value(open.store.read())).toHaveLength(before);

  const f = completedRun();
  const terminal = value(f.graph.readExit({ owner: 'part-five', name: 'Run', id: f.id }));
  expect(terminal.fact).toEqual(ref(f.closeFact));
  expect(terminal.exit).toEqual(f.terminalExit);
  expect(terminal.exit.result.fact).toEqual(f.terminalExit.result.fact);
  expect(terminal.exit.evidence).toEqual(f.terminalExit.evidence);
  refused(f.graph.readExit({ owner: 'part-five', name: 'Run', id: 'run:absent' }), 'run opening missing');
});
it('P5-NF-02 P5-NF-07 R2 settlement never frees immutable step identities for another operation', () => {
  const f = fixture(), ready = value(f.graph.transition(f.observed));
  const g = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease)), next = f.start(ready, g, 'operation:2');
  const reused = { ...next, step: { ...next.step, id: f.running.pending[0]!.id }, blockedOn: { ...next.blockedOn, reference: f.running.pending[0]!.id } };
  refused(f.graph.transition(reused), 'immutable RunStep identity');
  expect(ready.identities.some(row => row.type === 'RunStep' && row.id === f.running.pending[0]!.id)).toBe(true);
  expect(value(f.graph.transition(next)).state).toBe('running');
});
it('P5-NF-08 P5-NF-17 P5-NF-20 P5-NF-21 R4 authenticated stop cannot be cleared by freshly proposed completion', () => {
  const f = setup(), ready = value(f.graph.open(f.run));
  const graph = value(createRunGraph({ ...f.deps, control: { owner: 'part-four', verify: () => f.success(ref(f.opening)) } }));
  const common = { type: 'RunTransition', schemaVersion: 1, run: f.id, trigger: ref(f.opening), responsible: f.owner,
    standing: ref(f.opening), ownership: f.lease, generation: f.run.generation, at: f.now, nextWake: f.run.nextWake };
  const halted = value(graph.transition({ ...common, id: 'stop-before-completion', expected: ready.head, kind: 'stop', from: 'ready', to: 'halted',
    blockedOn: { kind: 'stop', reference: 'stop', owner: f.owner, nextObservation: f.clock(1000) } }));
  f.setClock(110);
  const check = value(decode('Evidence', f.evidenceInput({ id: 'post-stop-proof', observedAt: f.clock(110), claim: { subject: f.run.exitTest.subject,
    predicate: `exit:${f.run.exitTest.check}:${f.run.exitTest.version}`, value: f.run.exitTest.acceptance }, freshFor: 1000 }), f.ctx.decode));
  const checkFact = f.append('evidence-record', json({ evidence: check })).fact;
  const resultFact = f.append('result-record', json({ result: value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success', value: 'artifact', capacity: { kind: 'none' } }, f.ctx.decode)) })).fact;
  const exit = { type: 'RunExit', schemaVersion: 1, id: 'post-stop-exit', run: f.id, expected: halted.head, proposer: f.owner, standing: ref(f.opening),
    frontier: halted.source.foldedThrough, at: f.clock(110), kind: 'completed', exitTest: f.run.exitTest, check: ref(checkFact),
    evidence: [{ type: 'Evidence', id: check.id, fact: ref(checkFact), field: 'evidence' }], result: { type: 'Result', id: 'result', fact: ref(resultFact), field: 'result' }, settledOperations: [] };
  const proposal = { ...common, id: 'post-stop-proposal', expected: halted.head, kind: 'propose-exit', from: 'halted', to: 'closing', at: f.clock(110), blockedOn: { kind: 'nothing' }, exit };
  refused(graph.transition(proposal), 'stopped run'); expect(value(graph.read(f.id)).state).toBe('halted');
  const resumed = value(graph.transition({ ...common, id: 'authorized-resume', expected: halted.head, kind: 'resume', from: 'halted', to: 'ready', at: f.clock(110), blockedOn: { kind: 'nothing' } }));
  const closing = value(graph.transition({ ...proposal, expected: resumed.head, from: 'ready', exit: { ...exit, expected: resumed.head } }));
  const completed = value(graph.transition({ ...proposal, id: 'close', expected: closing.head, kind: 'close', from: 'closing', to: 'completed', exit: { ...exit, id: 'closing-exit', expected: closing.head } }));
  expect(completed.state).toBe('completed');
  refused(graph.transition({ ...common, id: 'late-stop', expected: completed.head, kind: 'stop', from: 'completed', to: 'halted', at: f.clock(110), blockedOn: { kind: 'stop', reference: 'stop', owner: f.owner, nextObservation: f.clock(1000) } }), 'state pair');
  expect(value(graph.read(f.id)).state).toBe('completed');
}, 15_000);

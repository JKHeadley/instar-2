import { expect, it } from 'vitest';
import { createRunClosureGraph, createRunGraph } from '../../src/rungraph/index.js';
import { avenueSetDecision, closeUnreachable, exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { completedRun, ref, refused, value } from '../rungraph/fixtures.js';

it('P5-SEAM-RC-A-F2-INTEGRATION P5-SEAM-RC-R12-V02 P5-SEAM-RC-R13-INTEGRATION-V02-V04 P5-NF-17 P5-NF-23 P5-NF-24 unreachable closure consumes the owned bounded investigation through real Part Two', () => {
  const f = closeUnreachable();
  expect(f.terminal.exit.type).toBe('UnreachableRunExit');
  const original = value(f.graph.readExit({ owner: 'part-five', name: 'Run', id: f.id }));
  expect(original).toEqual({ fact: ref(f.closeFact), exit: f.terminalExit });
  expect(f.closing.state).toBe('closing');
  expect(value(f.graph.read(f.id)).state).toBe('unreachable');
  refused(f.graph.ground(f.id, 'w', 'h', 'start', f.lease), 'terminal/conflicted run');
  expect(f.exhaustionFact.kind).toBe('run-exhaustion');
  expect(f.admissions.has(f.exhaustionFact.id)).toBe(true);
});

it('P5-SEAM-RC-A-F3-UNSETTLED-INTEGRATION P5-NF-24 an uncertain avenue and a pending effect both prevent unreachable closure', () => {
  const f = exhaustionFixture();
  const ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const running = value(f.graph.transition(f.start(f.ready, ground)));
  const stepFact = value(f.store.read()).at(-1)!;
  const observation = f.observe(running, 'uncertain');
  const unknown = { ...f.exhaustion, id: 'exhaustion:unknown', expected: running.head,
    avenueSetDecisions: [avenueSetDecision(f, ['avenue:unknown'], 'decision:set:unknown')],
    avenues: [{ id: 'avenue:unknown', disposition: 'tried', evidence: [observation.trigger],
      step: { owner: 'part-five', name: 'RunStep', id: running.pending[0]!.id, fact: ref(stepFact) }, outcome: observation.outcome }] };
  refused(f.graph.recordExhaustion(unknown, f.lease), 'unknown or successful avenue');

  const pendingRecord = { ...f.exhaustion, id: 'exhaustion:pending-effect', expected: running.head };
  const pendingFact = value(f.graph.recordExhaustion(pendingRecord, f.lease));
  const pendingExit = { ...f.exit, id: 'exit:pending-effect', expected: running.head,
    exhaustion: { ...f.exit.exhaustion, id: pendingRecord.id, fact: ref(pendingFact) } };
  refused(f.graph.recordUnreachableExit({ ...pendingExit, expected: running.head }, f.lease),
    'unsettled operations');
  expect(value(f.graph.read(f.id)).state).toBe('running');
  refused(f.graph.readExit({ owner: 'part-five', name: 'Run', id: f.id }), 'terminal run exit absent');
});

it('P5-SEAM-RC-A-F6-EQUAL-FRONTIER P5-SEAM-RC-R13-INTEGRATION-V05 P5-NF-51 completed and unreachable exits rebuild identically at equal frontiers and readExit returns each original fact', () => {
  const completed = completedRun();
  const completedGraph = value(createRunGraph(completed.deps));
  expect(value(completedGraph.read(completed.id))).toEqual(value(value(createRunGraph(completed.deps)).read(completed.id)));
  expect(value(completedGraph.readExit({ owner: 'part-five', name: 'Run', id: completed.id })))
    .toEqual({ fact: ref(completed.closeFact), exit: completed.terminalExit });
  const unreachable = closeUnreachable();
  const first = value(value(createRunClosureGraph(unreachable.deps)).readExit({ owner: 'part-five', name: 'Run', id: unreachable.id }));
  const second = value(value(createRunClosureGraph(unreachable.deps)).readExit({ owner: 'part-five', name: 'Run', id: unreachable.id }));
  expect(second).toEqual(first);
  expect(second).toEqual({ fact: ref(unreachable.closeFact), exit: unreachable.terminalExit });
}, 20_000);

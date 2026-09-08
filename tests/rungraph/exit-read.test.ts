import { expect, it } from 'vitest';
import { recordWire } from '../../src/rungraph/index.js';
import { closingRun, completedRun, refused, setup, value, ref, json } from './fixtures.js';

it('RunExitReadPort returns the exact owner-admitted terminal exit without writing', () => {
  const f = completedRun();
  const run = { owner: 'part-five', name: 'Run', id: f.id } as const;
  const before = value(f.store.read()).length;
  const terminal = value(f.graph.readExit(run));

  expect(f.graph.owner).toBe('part-five');
  expect(terminal).toEqual({ fact: ref(f.closeFact), exit: f.terminalExit });
  expect(terminal.exit.result).toEqual(f.terminalExit.result);
  expect(terminal.exit.evidence).toEqual(f.terminalExit.evidence);
  expect(Object.isFrozen(terminal)).toBe(true);
  expect(value(f.store.read())).toHaveLength(before);
});

it('RunExitReadPort refuses absence and a foreign owner without synthesizing closure', () => {
  const f = setup(), ready = value(f.graph.open(f.run));
  const before = value(f.store.read()).length;

  refused(f.graph.readExit({ owner: 'part-five', name: 'Run', id: f.id }), 'terminal run exit absent');
  refused(f.graph.readExit({ owner: 'part-nine', name: 'Run', id: ready.run.id } as never), 'owner/name/id mismatch');
  expect(value(f.store.read())).toHaveLength(before);
  expect(value(f.graph.read(f.id)).state).toBe('ready');
});

it('RunExitReadPort returns the replay-witnessed envelope when duplicate close records differ only by admission witness', () => {
  const f = closingRun();
  const body = json({ run: f.id, record: recordWire(f.close as never) });
  const first = f.append('run-transition', body).fact;
  const last = f.append('run-transition', body).fact;
  f.admissions.add(last.id);

  expect(first.id).not.toBe(last.id);
  expect(() => f.deps.admission.verify(ref(first))).toThrow('not admitted by six');
  expect(value(f.deps.admission.verify(ref(last)))).toEqual(ref(last));
  expect(value(f.graph.read(f.id)).state).toBe('completed');
  const before = value(f.store.read()).length;
  const terminal = value(f.graph.readExit({ owner: 'part-five', name: 'Run', id: f.id }));

  expect(terminal).toEqual({ fact: ref(last), exit: f.terminalExit });
  expect(f.admissions.has(terminal.fact.id)).toBe(true);
  expect(value(f.store.read())).toHaveLength(before);
});

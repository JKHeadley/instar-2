import { expect, it } from 'vitest';
import { completedRun, refused, setup, value, ref } from './fixtures.js';

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

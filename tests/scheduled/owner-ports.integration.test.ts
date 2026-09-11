import { describe, expect, it } from 'vitest';
import { setup, completedRun, value } from '../rungraph/fixtures.js';

describe('Part Fifteen consumes landed owner ports without replacing authority', () => {
  it('P15-NF-06 only a Part Five terminal exit supplies the durable business disposition', () => {
    const f = completedRun();
    expect(f.completed.state).toBe('completed');
    expect(value(f.graph.readExit({ owner: 'part-five', name: 'Run', id: f.id })).exit.kind).toBe('completed');
  });

  it('P15-NF-22 ignores a mutable Run view and reconstructs current state through RunGraphPort', () => {
    const f = setup(); const opened = value(f.graph.open(f.run));
    const forged = JSON.parse(JSON.stringify(opened)) as { state: string; head: string };
    forged.state = 'completed'; forged.head = 'forged:last-run';
    const reread = value(f.graph.read(f.id));
    expect(reread.state).toBe('ready'); expect(reread.head).not.toBe(forged.head);
  });
});

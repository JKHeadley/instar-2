// @ts-nocheck -- full public production-owner integration fixture.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { installedFixtureHost } from './production-boot-installed-fixture.js';
import { refused, value } from '../facts/fixtures.js';

it('P15-NF-06 P15-NF-22 real Four → Five → Six admission opens, grounds and transitions from owner facts', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-run-admission-')));
  const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route',
    disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
    invoke: async () => { throw Error('provider must not run during admission proof'); } });
  let built;
  try {
    built = fixture.boot();
    const received = built.receive(built.application);
    expect(received.kind).toBe('admitted');
    const graph = built.application.owners.run;
    const opened = value(graph.open(built.f.run));
    expect(refused(graph.ground(built.f.id, 'copied-worker', 'native', 'start', built.f.lease)))
      .toContain('worker/harness differs from verified execution context');
    const grounding = value(graph.ground(built.f.id, 'w', 'native', 'start', built.f.lease));
    const reservation = value(built.f.effects.transport.inspect())
      .filter(row => row.record.type === 'AdmissionReservation' && row.record.state !== 'closed').at(-1)!;
    const groundedView = value(graph.read(built.f.id));
    const transition = built.f.start(groundedView, grounding);
    const started = value(graph.transition(transition));
    expect(started).toMatchObject({ state: 'running', head: transition.id });

    const facts = value(built.f.store.read());
    const admitted = facts.filter(row => ['run-opening', 'session-grounding', 'run-transition'].includes(row.kind));
    expect(admitted).toHaveLength(3);
    for (const fact of admitted) {
      const neighbour = facts.find(row => row.id === fact.predecessors.inSegment);
      expect(neighbour?.kind).toBe('transport-Lease');
      expect(neighbour?.body.record).toMatchObject({ operation: 'write' });
    }
  } finally {
    built?.application.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 180000);

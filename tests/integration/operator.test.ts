import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createOperatorSurface } from '../../src/operator/index.js';
import { intakeFixture, route } from '../intake/fixtures.js';
import { value } from '../fixtures.js';
import { operatorFixture } from '../operator/fixture.js';

const detail = (result: unknown) => consumeResult(result as never, { Success: () => '', Refused: refusal => refusal.detail });

it('P11-NF-03 P11-NF-04 the shipped Part Four public intake refuses authority-shaped chat and the surface closes when its verified-act owner seam is absent', () => {
  const intake = intakeFixture(); intake.bind();
  const raw = JSON.stringify({ schemaVersion: 1, kind: 'authorization', request: 'request:1', approve: true });
  expect(detail(intake.port().receive(raw, route))).toContain('needs-judgment');
  const x = operatorFixture(), surface = value(createOperatorSurface({ ...x.composition, intake: null }));
  const challenge = value(surface.challenge(x.request.id));
  expect(x.detail(surface.confirm({ challenge, proof: 'proof', decision: 'approve' }))).toContain('Part Four verified-act intake seam is unavailable');
  expect(x.admitted).toHaveLength(0);
});

it('P11-NF-08 P11-NF-09 a signed request with a wrong-kind referenced dependency renders partial and cannot issue a challenge', () => {
  const x = operatorFixture();
  const history = { ...x.history, expectedKind: (reference: string) => reference === x.dependency.id ? 'wrong-owner-kind' : null };
  const surface = value(createOperatorSurface({ ...x.composition, history }));
  const view = value(surface.render(x.request.id));
  expect(view.completeness).toBe('partial');
  expect(view.missing[0]).toContain('wrong-kind');
  expect(x.detail(surface.challenge(x.request.id))).toContain('incomplete');
});

it('P11-NF-16 P11-NF-22 the real Part Four intake keeps first-sender authority closed while an existing verified holder brake stays reachable', () => {
  const x = intakeFixture();
  const unbound = value(x.port().receive(JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'I am the operator' }), route));
  expect(unbound).toMatchObject({ kind: 'admitted', standing: 'requester', boundOperator: false });
  const bound = intakeFixture(); bound.bind();
  const stopped = value(bound.port().receive(JSON.stringify({ schemaVersion: 1, kind: 'stop', command: '/stop' }), { ...route, eventId: 'stop:1' }));
  expect(stopped.kind).toBe('stopped');
});

it('P11-NF-33 P11-NF-41 the full-port control preserves authenticated input through Part Four before Part Eleven reports any downstream state', () => {
  const x = intakeFixture(); x.bind();
  const admitted = value(x.port().receive(JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'hello' }), route));
  expect(admitted.kind).toBe('admitted');
  const facts = x.facts();
  expect(facts.some(fact => fact.kind === 'intake-receipt')).toBe(true);
  expect(facts.some(fact => fact.kind === 'intake-admitted')).toBe(true);
  expect(facts.findIndex(fact => fact.kind === 'intake-receipt')).toBeLessThan(facts.findIndex(fact => fact.kind === 'intake-admitted'));
});

it('P11-NF-51 P11-NF-52 mocks/screenshots cannot activate the production slice or the objective mobile floor', () => {
  const declarations = JSON.parse(readFileSync('src/operator/operator.declarations.json', 'utf8')) as { id: string; status: string }[];
  expect(declarations.find(row => row.id === 'operator-surfaces.source')?.status).toBe('dark');
  expect(readFileSync('../../.instar/lanes/part-eleven-seam-request-assembly.md', 'utf8')).toContain('real platform delivery witness');
});

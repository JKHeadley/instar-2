import { expect, it } from 'vitest';
import { checkSeparation } from '../../src/register/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { intakeFixture, message, route, value, refused } from '../intake/fixtures.js';

it('P4-NF-06 R7 governing writer and intake executor must be distinct under real constitutional standing', () => {
  const f = intakeFixture(), s = f.r;
  const executor = s.f.principal('intake-executor', 'system');
  const grant = s.f.grant({ id: 'fixture:contract-writer', grantee: s.f.alice, standing: 'operator' });
  const execution = { principal: executor, grants: [grant], revocations: [], scope: s.f.scope, now: s.f.now };
  expect(value(checkSeparation(execution, s.f.alice, s.f.scope, 'write:intake.contract', s.context))).toBe(true);
  refused(checkSeparation({ ...execution, principal: s.f.alice }, s.f.alice, s.f.scope, 'write:intake.contract', s.context), 'executing principal');
  refused(checkSeparation({ ...execution, grants: [] }, s.f.alice, s.f.scope, 'write:intake.contract', s.context), 'writer lacks standing');
});

it('P4-NF-06 P4-NF-02 P4-NF-12 R7 valid governance does not substitute for actual provenance and owner admission checks', () => {
  const f = intakeFixture();
  const evidence = value(f.deps.adapter.authenticate(message(), route, f.f.now));
  const bad = value(createIntakePort({ ...f.deps, adapter: { ...f.deps.adapter,
    authenticate: () => f.f.success({ ...evidence, provenance: { ...evidence.provenance, record: { ...evidence.provenance.record, reference: 'missing' } } }) } }));
  refused(bad.receive(message(), route), 'unresolved-sender');
  expect(f.facts().some(r => r.kind === 'intake-admitted')).toBe(false);
  const good = value(f.port().recover(f.facts().find(r => r.kind === 'intake-receipt')!.id));
  expect(good.kind).toBe('admitted');
  const fact = f.facts().find(r => r.kind === 'intake-admitted')!;
  expect(fact.body).toMatchObject({ work: { owner: f.deps.workOwner, standing: 'requester', blockedOn: 'run-admission' } });
  expect(value(f.port().receive(message(), route)).kind).toBe('duplicate');
  expect(f.facts().filter(r => r.kind === 'intake-admitted')).toHaveLength(1);
});

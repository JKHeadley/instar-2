// @ts-nocheck -- adversarial public-boot RunAdmissionPort provenance matrix.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { bootProductionApplication } from '../../src/assembly/production-application.js';
import { installedFixtureHost } from './production-boot-installed-fixture.js';
import { refused, value } from '../facts/fixtures.js';

const route = { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
  automaticRetries: 0, environment: 'local-test', invoke: () => { throw Error('provider must not execute'); } };

const structural = (mode: 'mock' | 'process-local' | 'no-op') => {
  const admitted = new Set<string>();
  const success = value => ({ type: 'Result', schemaVersion: 1, kind: 'Success', value,
    capacity: { kind: 'none' } });
  if (mode === 'mock') return { owner: 'part-six',
    create: () => { throw Error('mock create must not run'); }, commit: () => { throw Error('mock commit must not run'); },
    verify: () => { throw Error('mock verify must not run'); }, reservation: () => { throw Error('mock reservation must not run'); },
    execution: () => { throw Error('mock execution must not run'); } };
  if (mode === 'process-local') return { owner: 'part-six',
    create: (_opening, _run, append) => { const receipt = value(append()); admitted.add(receipt.fact.id); return success(receipt); },
    commit: (_request, append) => { const receipt = value(append()); admitted.add(receipt.fact.id); return success(receipt); },
    verify: reference => admitted.has(reference.id) ? success(reference) : (() => { throw Error('not locally admitted'); })(),
    reservation: reference => success(reference), execution: () => success({ worker: 'local', harness: 'local' }) };
  return { owner: 'part-six', create: () => undefined, commit: () => undefined, verify: value => success(value),
    reservation: value => success(value), execution: () => success(undefined) };
};

it.each([
  ['null RunAdmissionPort', () => null],
  ['mock RunAdmissionPort', () => structural('mock')],
  ['process-local RunAdmissionPort', () => structural('process-local')],
  ['no-op RunAdmissionPort', () => structural('no-op')],
])('production boot rejects %s by the run-admission binding name', (_name, replacement) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'run-admission-wiring-refusal-')));
  const fixture = installedFixtureHost(root, route);
  fixture.host.runAdmission = replacement();
  try {
    expect(refused(bootProductionApplication(fixture.record, fixture.host))).toContain('run-admission');
    expect(fixture.state()).toBeUndefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);

it('production boot delegates Five through the factory-issued real Six admission', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'run-admission-wiring-delegation-')));
  const fixture = installedFixtureHost(root, route);
  let built;
  try {
    built = fixture.boot();
    built.receive(built.application);
    const opened = value(built.application.owners.run.open(built.f.run));
    const facts = value(built.f.store.read());
    const opening = facts.find(row => row.kind === 'run-opening' && row.body.run === opened.run.id)!;
    const neighbour = facts.find(row => row.id === opening.predecessors.inSegment)!;
    const reference = { owner: 'part-two', name: 'FactEnvelope', id: opening.id } as const;

    expect(built.f.deps.admission).toBe(fixture.host.runAdmission);
    expect(neighbour.kind).toBe('transport-Lease');
    expect(neighbour.body.record).toMatchObject({ operation: 'write' });
    expect(value(fixture.host.runAdmission.verify(reference))).toEqual(reference);
  } finally { built?.application.close(); rmSync(root, { recursive: true, force: true }); }
}, 180000);

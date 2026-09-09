import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { privateKey } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';

it('SLB-E2E-12 P6-NF-18 P6-NF-20 P6-NF-34 P6-NF-36 fresh processes rebuild scheduled, admitted, open and half-open boundaries from Part Two', () => {
  const f = transportFixture();
  const identity = f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity');
  const grantProof = f.proof(f.g.source.authenticated.payload as object, { id: 'alice', kind: 'person' }, 'intent-approval');
  const seed = { register: f.ctx.decode.register, captures: f.captures, preserved: f.c.preserved,
    principal: { ...f.alice, provenance: identity.input }, scope: f.scope, grants: [{ ...f.g, source: grantProof.input }],
    clock: f.now, site: f.c.site, domain: f.host.domain, machine: f.host.machine, budget: f.host.budget,
    maxLeaseTerm: f.host.maxLeaseTerm, keys: f.ctx.keys, genesis: f.ctx.genesis, privateKey };
  const seedPath = join(f.directory, 'loop-boot-seed.json');
  writeFileSync(seedPath, JSON.stringify(seed), { mode: 0o600 });
  const worker = resolve('tests/fixtures/transport-loop-worker.mjs');
  const stage = (mode: string, now: number) => {
    const child = spawnSync(process.execPath, [worker, seedPath, f.directory, mode, String(now)],
      { encoding: 'utf8', timeout: 15000 });
    expect(child.status, child.stderr).toBe(0);
    return JSON.parse(child.stdout) as { state: string; transition: string; attempts: number;
      totalFailures: number; pendingAttempts: string[]; pressureKey: string };
  };

  const scheduled = stage('schedule', 100);
  expect(scheduled).toMatchObject({ state: 'scheduled', transition: 'scheduled', attempts: 0 });
  expect(stage('admit', 101)).toMatchObject({ state: 'running', transition: 'attempt-admitted',
    attempts: 1, pendingAttempts: ['e2e-a'] });
  expect(stage('fail-first', 101)).toMatchObject({ state: 'waiting', transition: 'outcome-recorded',
    attempts: 1, totalFailures: 1, pendingAttempts: [] });
  expect(stage('open', 103)).toMatchObject({ state: 'open-breaker', transition: 'opened',
    attempts: 2, totalFailures: 2, pendingAttempts: [] });
  const halfOpen = stage('half-open', 123);
  expect(halfOpen).toMatchObject({ state: 'half-open', transition: 'half-opened',
    attempts: 3, totalFailures: 2, pendingAttempts: ['e2e-trial'] });
  expect(stage('inspect', 123)).toMatchObject(halfOpen);
  expect(halfOpen.pressureKey).toBe(scheduled.pressureKey);
}, 30000);

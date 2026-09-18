// @ts-nocheck -- U4-G fixture admissions exercise the actual composed boot.
import { chmodSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { bootProductionApplication } from '../../src/assembly/production-application.js';
import { installedFixtureHost, fixtureAdmissionNames } from './production-boot-installed-fixture.js';
import { refused } from '../facts/fixtures.js';
afterEach(async () => { await new Promise(resolve => setImmediate(resolve)); });
const route = { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
  automaticRetries: 0, environment: 'local-test', invoke: () => { throw Error('provider must not execute'); } };
it.each([
  ['null Telegram', o => { o.telegram = null; }, 'telegram'],
  ['copied Telegram facade', o => { o.telegram = { ...o.telegram }; }, 'telegram'],
  ['null harness', o => { o.assembly.harnesses = [null]; }, 'harness'],
  ['mock harness', o => {
    const original = o.grounding.harness;
    const adapter = { ...original, describe: () => ({ ...original.describe(), artifact: 'mock-artifact' }) };
    o.grounding.harness = adapter; o.assembly.harnesses = [adapter];
  }, 'harness'],
  ['foreign signed-store handle', o => { o.run = { ...o.run, store: { ...o.run.store } }; }, 'shared signed store'],
  ['missing harness', o => { o.assembly.harnesses = []; }, 'harness'],
  ['mock model', o => { o.provider.judgment.host.description.provider = 'mock-provider'; o.provider.route = { ...route, provider: 'mock-provider' }; }, 'model: mock'],
  ['test-only model', o => { o.provider.judgment.host.description.provider = 'test-only-provider'; o.provider.route = { ...route, provider: 'test-only-provider' }; }, 'model: mock'],
  ['null provider', o => { o.provider = null; }, 'provider'],
  ['null effect', o => { o.effect = null; }, 'effect'],
  ['null operator', o => { o.operator = null; }, 'operator'],
  ['null run', o => { o.run = null; }, 'run-admission'],
])(`public composition refuses %s before poll/provider; fixture-admitted: ${fixtureAdmissionNames}`, (_name, mutate, detail) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-compose-refusal-')));
  const fixture = installedFixtureHost(root, route, { mutate: (_state, owners) => mutate(owners) });
  try {
    refused(bootProductionApplication(fixture.record, fixture.host), detail);
    expect(fixture.state().calls).toEqual(['getMe']);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);
it.each(['bot', 'provider', 'storage', 'stale generation', 'unwritable root', 'failed fsync'])(
  'public application refuses %s before any network call', kind => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-preflight-refusal-')));
    const fixture = installedFixtureHost(root, route);
    try {
      if (['bot', 'provider', 'storage'].includes(kind)) {
        const resolve = fixture.host.resolveSecret;
        const name = kind === 'bot' ? fixture.record.botCredential.name : kind;
        fixture.host.resolveSecret = reference => { if (reference.name === name) throw Error('secret unavailable'); return resolve(reference); };
      }
      if (kind === 'stale generation') fixture.record.generation = 'stale';
      if (kind === 'unwritable root') chmodSync(root, 0o500);
      if (kind === 'failed fsync') fixture.host.storageIO = { ...fixture.host.storageIO, fsyncSync() { throw Error('fsync unavailable'); } };
      refused(bootProductionApplication(fixture.record, fixture.host));
      expect(fixture.state()).toBeUndefined();
    } finally { chmodSync(root, 0o700); rmSync(root, { recursive: true, force: true }); }
  });
it(`public application refuses a second concurrent installation; fixture-admitted: ${fixtureAdmissionNames}`, () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-exclusive-refusal-')));
  let built;
  try {
    const first = installedFixtureHost(root, route); built = first.boot();
    const second = installedFixtureHost(root, route);
    refused(bootProductionApplication(second.record, second.host), 'second concurrent boot');
    expect(second.state()).toBeUndefined();
  } finally { built?.application.close(); rmSync(root, { recursive: true, force: true }); }
}, 180000);

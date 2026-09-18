// @ts-nocheck -- All admitted installation bindings are labelled below.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { installedFixtureHost, fixtureAdmissionNames } from './production-boot-installed-fixture.js';
import { recordedCheckpoint } from './production-boot-checkpoint.js';
import { value } from '../facts/fixtures.js';
it.each(['intake', 'run-opened'])(`public restart reconstructs the %s prefix without reauthoring; fixture-admitted: ${fixtureAdmissionNames}`, stage => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-recovery-')));
  const route = { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
    automaticRetries: 0, environment: 'local-test', invoke: () => { throw Error('no provider during restart'); } };
  let first, second;
  try {
    first = installedFixtureHost(root, route).boot(); first.receive(first.application);
    if (stage === 'run-opened') value(first.application.owners.run.open(first.f.run));
    const checkpoint = recordedCheckpoint(first, stage); first.application.close();
    second = installedFixtureHost(root, route, { recovery: checkpoint }).boot();
    expect(value(second.f.store.read()).map(row => ({ id: row.id, kind: row.kind, hash: row.contentHash }))).toEqual(checkpoint.facts);
    expect(second.f.id).toBe(checkpoint.run);
    expect(second.calls).toEqual(['getMe']);
  } finally { second?.application.close(); first?.application.close(); rmSync(root, { recursive: true, force: true }); }
}, 240000);

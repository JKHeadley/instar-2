// @ts-nocheck -- explicit U4-G fixture-admitted lifecycle configuration.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { installedFixtureHost, fixtureAdmissionNames } from './production-boot-installed-fixture.js';
it(`boots the public application before Telegram poll; fixture-admitted: ${fixtureAdmissionNames}`, () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-public-entry-')));
  const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
    automaticRetries: 0, environment: 'local-test', invoke: async () => { throw Error('no provider during boot'); } });
  let built;
  try {
    built = fixture.boot();
    expect(built.application.boot.posture.serve).toBe(true);
    expect(built.calls).not.toContain('getUpdates');
    expect(built.application.boot.coordinator.handles.run.port).toBe(built.application.owners.run);
    built.receive(built.application);
    expect(built.f.opening.kind).toBe('intake-admitted');
  } finally { built?.application.close(); rmSync(root, { recursive: true, force: true }); }
}, 180000);

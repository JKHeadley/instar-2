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

// Rule 37 quarantine: see docs/defects/production-boot-public-entry-ctx.md
it.skip(`installed bin boots the same public application and admits Four; fixture-admitted: ${fixtureAdmissionNames}`, async () => {
  const { spawn } = await import('node:child_process');
  const { writeFileSync, readFileSync } = await import('node:fs');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-bin-entry-')));
  try {
    const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route' });
    const record = join(root, 'installation.json'); writeFileSync(record, JSON.stringify(fixture.record));
    const child = spawn(process.execPath, ['--experimental-transform-types', '--import=./tests/assembly/production-boot-source-loader.mjs',
      'bin/instar-production.mjs', record, 'tests/assembly/production-boot-bin-host.ts'],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, INSTAR_U4_RECORDED_ACTION: 'boot-only' } });
    let stderr = ''; child.stderr.on('data', bytes => { stderr += bytes; });
    const code = await new Promise(resolve => child.once('exit', resolve));
    expect(code, stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(root, 'boot-proof.json'), 'utf8'))).toEqual({ admitted: true, calls: ['getMe', 'getUpdates'] });
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);

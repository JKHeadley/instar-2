// @ts-nocheck -- explicit U4-G fixture-admitted lifecycle configuration.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setImmediate as yieldImmediate } from 'node:timers';
import { expect, it } from 'vitest';
import { installedFixtureHost, fixtureAdmissionNames } from './production-boot-installed-fixture.js';
// TEST-INFRASTRUCTURE (Rule 37; docs/defects/production-boot-public-entry-rpc-deadline.md):
// this case's owner work is entirely synchronous and measured ~58s in the six-worker gate,
// so the whole case was one contiguous block with no I/O phase. tests/setup/yield-worker.mjs
// only yields BETWEEN cases, so the interval from the runner's task-update send to the
// worker's next I/O phase exceeded birpc's fixed 60s deadline: the run reported an unhandled
// "Timeout calling onTaskUpdate" and exited non-zero with every assertion passed. The same
// awaited real event-loop turn as yield-worker.mjs (native timer, never Promise.resolve,
// nextTick or an unref'd immediate), taken between the synchronous steps so each block is
// bounded by one public-port call instead of the whole case. Scheduling only: identical
// steps, identical order, identical assertions.
const yieldTurn = () => new Promise(resolve => yieldImmediate(resolve));
it(`boots the public application before Telegram poll; fixture-admitted: ${fixtureAdmissionNames}`, async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-public-entry-')));
  const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
    automaticRetries: 0, environment: 'local-test', invoke: async () => { throw Error('no provider during boot'); } });
  let built;
  try {
    await yieldTurn();
    built = fixture.boot();
    await yieldTurn();
    expect(built.application.boot.posture.serve).toBe(true);
    expect(built.calls).not.toContain('getUpdates');
    expect(built.application.boot.coordinator.handles.run.port).toBe(built.application.owners.run);
    built.receive(built.application);
    await yieldTurn();
    expect(built.f.opening.kind).toBe('intake-admitted');
  } finally { built?.application.close(); rmSync(root, { recursive: true, force: true }); }
}, 180000);

it(`installed bin boots the same public application and admits Four; fixture-admitted: ${fixtureAdmissionNames}`, async () => {
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

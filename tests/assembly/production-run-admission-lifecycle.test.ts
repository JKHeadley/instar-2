// @ts-nocheck -- real SIGKILL cuts at the production admission append boundary.
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { installedFixtureHost } from './production-boot-installed-fixture.js';

function child(root, action) {
  const processChild = spawn(process.execPath, ['--experimental-transform-types',
    '--import=./tests/assembly/production-boot-source-loader.mjs', 'bin/instar-production.mjs',
    join(root, 'installation.json'), 'tests/assembly/production-run-admission-lifecycle-host.ts'],
  { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, INSTAR_U5_ADMISSION_ACTION: action } });
  let stderr = '';
  processChild.stderr.on('data', bytes => { stderr += bytes; });
  return new Promise(resolve => processChild.once('exit', (code, signal) => resolve({ code, signal, stderr })));
}

function installation(root) {
  const route = { provider: 'test-provider', model: 'model', route: 'route' };
  const fixture = installedFixtureHost(root, route);
  writeFileSync(join(root, 'installation.json'), JSON.stringify(fixture.record));
}

it('SIGKILL after Six durable write and before the append callback reconstructs no invented Run', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'run-admission-write-cut-')));
  try {
    installation(root);
    expect(await child(root, 'write-cut')).toMatchObject({ code: null, signal: 'SIGKILL' });
    const recovered = await child(root, 'inspect');
    expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
    const proof = JSON.parse(readFileSync(join(root, 'admission-recovery-proof.json'), 'utf8'));

    expect(proof.stage).toBe('six-write-before-run-append-callback');
    expect(proof.admissionWrites).toBe(1);
    expect(proof.openingFacts).toBe(0);
    expect(proof.runCount).toBe(0);
    expect(proof.readRefusal).toContain('run opening missing');
    expect(proof.reservationCount).toBe(1);
    expect(proof.uncertainReleased).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 240000);

it('terminal Run closure survives its durable callback cut with one Run and one unreleased reservation', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'run-admission-terminal-cut-')));
  try {
    installation(root);
    expect(await child(root, 'terminal-cut')).toMatchObject({ code: null, signal: 'SIGKILL' });
    const recovered = await child(root, 'inspect');
    expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
    const proof = JSON.parse(readFileSync(join(root, 'admission-recovery-proof.json'), 'utf8'));

    expect(proof.stage).toBe('terminal-run-closure-durable-append');
    expect(proof.state).toBe('completed');
    expect(proof.runCount).toBe(1);
    expect(proof.openingFacts).toBe(1);
    expect(proof.admissionFacts).toBe(3);
    expect(proof.verified).toHaveLength(3);
    expect(proof.reservationCount).toBe(1);
    expect(proof.reservationStates).toEqual(['dispatch-claimed']);
    expect(proof.uncertainReleased).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 240000);

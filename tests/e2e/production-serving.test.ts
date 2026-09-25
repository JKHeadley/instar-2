import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Offline Node fixture loaded by the public bin.
import { installedServingFixture } from '../fixtures/production-serving-host.mjs';

const record = (id: string, kind: string, value: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ id, kind, body: { ...extra, record: value } });
const common = () => [
  { id: 'receipt:1', kind: 'intake-receipt', body: { capture: { reference: 'in:1' } } },
  { id: 'opening:1', kind: 'intake-admitted', body: { eventId: '1', receipt: 'receipt:1', binding: 'bound' } },
  record('runfact:1', 'run-opening', { id: 'run:1', opening: { id: 'opening:1' } }, { run: 'run:1' }),
  record('ground:1', 'session-grounding', { run: 'run:1' }),
  record('requestfact:1', 'judgment-provider-ProviderJudgmentRequest', { id: 'request:1', run: 'run:1' }),
];
const reply = () => [...common(),
  record('provider-claim', 'transport-AdmissionReservation', { run: 'run:1', state: 'dispatch-claimed' }),
  record('provider-response', 'judgment-provider-ProviderJudgmentAttemptRecord',
    { request: 'request:1', phase: 'response-observed' }),
  record('acceptance:1', 'judgment-provider-ProviderAnswerAcceptance',
    { request: 'request:1', capture: { reference: 'answer:1' } }),
  record('replyrun:1', 'run-opening', { id: 'reply:1', opening: { id: 'acceptance:1' } }, { run: 'reply:1' }),
  record('replyrequest:1', 'effect-EffectRequest', { id: 'reply-request', run: 'reply:1' }),
];

function withLedger(rows: unknown[], check: (root: string, run: (mode: string) => ReturnType<typeof spawnSync>) => void) {
  const root = mkdtempSync(join(tmpdir(), 'production-serving-'));
  try {
    writeFileSync(join(root, 'facts.json'), JSON.stringify(rows));
    writeFileSync(join(root, 'calls.json'), '[]');
    const run = (mode: string) => spawnSync(process.execPath,
      ['tests/e2e/production-serving-worker.mjs', root, mode],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    check(root, run);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const calls = (root: string): string[] => JSON.parse(readFileSync(join(root, 'calls.json'), 'utf8'));

describe('offline fake process restart at owner dispatch claims', () => {
  it('does not repeat an uncertain provider call', () => withLedger(common(), (root, run) => {
    expect(run('provider-kill').signal).toBe('SIGKILL');
    expect(run('resume').stdout).toBe('idle\n');
    expect(calls(root)).toEqual(['provider']);
  }));
  it('does not repeat an uncertain send', () => withLedger(reply(), (root, run) => {
    expect(run('reply-kill').signal).toBe('SIGKILL');
    expect(run('resume').stdout).toBe('idle\n');
    expect(calls(root)).toEqual(['sendMessage']);
  }));
  it('does not repeat a send after its response was recorded but its acknowledgement was lost', () =>
    withLedger(reply(), (root, run) => {
      expect(run('lost-ack').signal).toBe('SIGKILL');
      expect(run('resume').stdout).toBe('idle\n');
      expect(calls(root)).toEqual(['sendMessage']);
    }));
  it('stops before provider dispatch and refuses exhausted capacity', () => {
    for (const mode of ['stop', 'budget']) withLedger(common(), (root, run) => {
      expect(run(mode).stdout).toBe(`${mode === 'stop' ? 'stopped' : 'bound'}\n`);
      expect(calls(root)).toEqual([]);
    });
  });
});

it('the real bin installs the genuine Six port and host-run binding over two durable Telegram inputs', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-serving-bin-')));
  try {
    const fixture = await installedServingFixture(root, { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('provider must not run'); } });
    const record = join(root, 'installation.json');
    writeFileSync(record, JSON.stringify(fixture.record));
    const child = spawnSync(process.execPath, ['--experimental-transform-types',
      '--import=./tests/assembly/production-boot-source-loader.mjs', 'bin/instar-production.mjs',
      record, 'tests/fixtures/production-serving-host.mjs'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
    expect(child.status, child.stderr).toBe(0);
    const proof = JSON.parse(readFileSync(join(root, 'serving-bin-proof.json'), 'utf8'));
    expect(proof.owner).toBe('part-six');
    expect(proof.serving.binding.profile).toBe('successive-turns-v1');
    expect(proof.serving.pendingAttempt).toBeNull();
    expect(proof.serving.totalErrors).toBe(0);
    expect(proof.intake).toBe(2);
    expect(proof.calls).not.toContain('sendMessage');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);

it('the real bin folds a killed pending poll once through durable Six progress', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-serving-pending-')));
  try {
    const fixture = await installedServingFixture(root, { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('provider must not run'); } });
    const installation = join(root, 'installation.json');
    writeFileSync(installation, JSON.stringify(fixture.record));
    const run = (action: string) => spawnSync(process.execPath, ['--experimental-transform-types',
      '--import=./tests/assembly/production-boot-source-loader.mjs', 'bin/instar-production.mjs',
      installation, 'tests/fixtures/production-serving-host.mjs'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 120000,
      env: { ...process.env, INSTAR_SERVING_TEST_ACTION: action } });
    const killed = run('pending-kill');
    expect(killed.signal, killed.stderr).toBe('SIGKILL');
    const first = run('pending-resume');
    expect(first.status, first.stderr).toBe(0);
    const proof = () => JSON.parse(readFileSync(join(root, 'serving-pending-proof.json'), 'utf8'));
    expect(proof().serving).toMatchObject({ totalErrors: 1, consecutiveErrors: 0, pendingAttempt: null });
    expect(proof().calls).not.toContain('sendMessage');
    const second = run('pending-resume');
    expect(second.status, second.stderr).toBe(0);
    expect(proof().serving).toMatchObject({ totalErrors: 1, consecutiveErrors: 0, pendingAttempt: null });
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);

it('the real bin retains a consumed UNKNOWN provider claim without a repeated call', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-serving-provider-')));
  try {
    const fixture = await installedServingFixture(root, { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('setup provider must not run'); } });
    const installation = join(root, 'installation.json');
    writeFileSync(installation, JSON.stringify(fixture.record));
    const run = (action: string) => spawnSync(process.execPath, ['--experimental-transform-types',
      '--import=./tests/assembly/production-boot-source-loader.mjs', 'bin/instar-production.mjs',
      installation, 'tests/fixtures/production-serving-host.mjs'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 120000,
      env: { ...process.env, INSTAR_SERVING_TEST_ACTION: action } });
    const killed = run('provider-kill');
    expect(killed.signal, killed.stderr).toBe('SIGKILL');
    const resumed = run('provider-resume');
    expect(resumed.status, resumed.stderr).toBe(0);
    const proof = JSON.parse(readFileSync(join(root, 'serving-provider-proof.json'), 'utf8'));
    expect(proof.serving).toMatchObject({ turns: 2, slot: proof.second });
    expect(proof.second).not.toBe(proof.first);
    expect(proof.reservations.some((row: { state: string; charge: number }) =>
      row.state === 'consumed' && row.charge > 0)).toBe(true);
    const latest = new Map(proof.reservations.map((row: { operation: string }) => [row.operation, row]));
    // Both the provider and context-delivery reservations retain their maxima
    // after restart; serialized settlement bytes cannot remint live Eight proof.
    expect([...latest.values()].reduce((sum: number, row: any) => sum + row.charge, 0)).toBe(40);
    expect(proof.calls).not.toContain('sendMessage');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);

it.each(['provider-claim-kill', 'provider-consume-kill'])(
  'the real bin preserves the %s owner record and never repeats provider IO', async action => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-serving-provider-cut-')));
    try {
      const fixture = await installedServingFixture(root, { provider: 'test-provider', model: 'model', route: 'route',
        disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
        invoke: async () => { throw Error('setup provider must not run'); } });
      const installation = join(root, 'installation.json');
      writeFileSync(installation, JSON.stringify(fixture.record));
      const run = (mode: string) => spawnSync(process.execPath, ['--experimental-transform-types',
        '--import=./tests/assembly/production-boot-source-loader.mjs', 'bin/instar-production.mjs',
        installation, 'tests/fixtures/production-serving-host.mjs'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 120000,
        env: { ...process.env, INSTAR_SERVING_TEST_ACTION: mode } });
      const killed = run(action);
      expect(killed.signal, killed.stderr).toBe('SIGKILL');
      const resumed = run('provider-resume');
      expect(resumed.status, resumed.stderr).toBe(0);
      const proof = JSON.parse(readFileSync(join(root, 'serving-provider-proof.json'), 'utf8'));
      expect(proof.serving).toMatchObject({ turns: 2, slot: proof.second });
      expect(proof.calls).not.toContain('sendMessage');
      const latest = new Map(proof.reservations.map((row: { operation: string }) => [row.operation, row]));
      expect([...latest.values()].some((row: any) => row.state ===
        (action === 'provider-claim-kill' ? 'dispatch-claimed' : 'consumed') && row.charge > 0)).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 180000);

// The installed trace still uses the historical single-Run reply shape. These
// process cuts verify Eight/Six physical send behavior while the successive
// profile's exact Five accepted-reply join is exercised separately.
it.each(['reply-claim-kill', 'reply-consume-kill', 'reply-kill-before', 'reply-kill-after'])(
  'the real bin keeps a historical send single-use after %s', async action => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-serving-reply-')));
    try {
      const fixture = await installedServingFixture(root, { provider: 'test-provider', model: 'model', route: 'route',
        disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
        invoke: async () => { throw Error('setup provider must not run'); } }, { singleUpdate: true });
      const installation = join(root, 'installation.json');
      writeFileSync(installation, JSON.stringify(fixture.record));
      const run = (mode: string) => new Promise<{ status: number | null; signal: NodeJS.Signals | null;
        stderr: string; timedOut: boolean }>((resolve, reject) => {
        const child = spawn(process.execPath, ['--experimental-transform-types',
          '--import=./tests/assembly/production-boot-source-loader.mjs', 'bin/instar-production.mjs',
          installation, 'tests/fixtures/production-serving-host.mjs'],
        { cwd: process.cwd(), env: { ...process.env, INSTAR_SERVING_TEST_ACTION: mode },
          stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', bytes => { stderr += bytes; });
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 120000);
        child.once('error', reject);
        child.once('exit', (status, signal) => { clearTimeout(timer); resolve({ status, signal, stderr, timedOut }); });
      });
      const killed = await run(action);
      expect(killed.timedOut, killed.stderr).toBe(false);
      expect(killed.signal, killed.stderr).toBe('SIGKILL');
      const resumed = await run('reply-resume');
      expect(resumed.timedOut, resumed.stderr).toBe(false);
      expect(resumed.status, resumed.stderr).toBe(0);
      const proof = JSON.parse(readFileSync(join(root, 'serving-reply-proof.json'), 'utf8'));
      expect(proof.stage).toBe(action === 'reply-kill-before' ? 'reply-before-response'
        : action === 'reply-kill-after' ? 'reply-after-response' : action);
      expect(proof.reservations.some((row: { state: string }) => row.state === 'consumed')).toBe(true);
      expect(['accepted', 'refused']).toContain(proof.replay);
      expect(proof.calls).not.toContain('sendMessage');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 180000);

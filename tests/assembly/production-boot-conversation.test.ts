// @ts-nocheck -- U4-G permits exactly the named fixture-admitted bindings.
import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync, readdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';
import { installedFixtureHost, fixtureAdmissionNames } from './production-boot-installed-fixture.js';
function child(root, action, snapshots) {
  const processChild = spawn(process.execPath, ['--experimental-transform-types', '--import=./tests/assembly/production-boot-source-loader.mjs',
    'bin/instar-production.mjs', join(root, 'installation.json'), 'tests/assembly/production-boot-bin-host.ts'],
    { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, INSTAR_U4_RECORDED_ACTION: action,
      ...(snapshots ? { INSTAR_U4_RECORDED_SNAPSHOTS: snapshots } : {}) } });
  let errors = ''; processChild.stderr.on('data', bytes => { errors += bytes; });
  const exited = new Promise(resolve => processChild.once('exit', (code, signal) => resolve({ code, signal })));
  return { process: processChild, exited, errors: () => errors };
}
it(`bin + public boot: Telegram → Four → Five → Seven/Eight/Six → Nine → Five → reply; restored adjacent durable prefixes SIGKILL/recovery; fixture-admitted: ${fixtureAdmissionNames}`, async () => {
  const work = realpathSync(mkdtempSync(join(tmpdir(), 'production-public-trace-'))), root = join(work, 'installation'), snapshots = join(work, 'snapshots');
  const { mkdirSync } = await import('node:fs'); mkdirSync(root);
  const fixture = installedFixtureHost(root, { provider: 'test-provider', model: 'model', route: 'route' });
  writeFileSync(join(root, 'installation.json'), JSON.stringify(fixture.record));
  let active, complete = false;
  try {
    active = child(root, 'trace', snapshots);
    expect(await active.exited, active.errors()).toEqual({ code: 0, signal: null });
    const proof = JSON.parse(readFileSync(join(root, 'trace-proof.json'), 'utf8'));
    console.error(`RECORDED-ONLY trace identifiers: ${JSON.stringify(proof)}`);
    expect(proof.update).toBeGreaterThan(0); expect(proof.replyMessage).toBeGreaterThan(0); expect(proof.assessment).toBeTruthy();
    const prefixes = readdirSync(snapshots).sort();
    expect(prefixes.length).toBe(29);
    // Each snapshot is the exact encrypted root after the named owner boundary
    // in the one real bin trace. Restore at the same immutable installation path,
    // boot the real bin to that frontier, kill it with its root lease held, then
    // boot another bin and reconstruct actual owner projections. No trace replay
    // and no second provider/send call can conceal lost or duplicate effects.
    for (const prefix of prefixes) {
      rmSync(root, { recursive: true, force: true }); cpSync(join(snapshots, prefix), root, { recursive: true });
      const checkpoint = JSON.parse(readFileSync(join(root, 'recorded-checkpoint.json'), 'utf8'));
      active = child(root, 'pause');
      const ready = await Promise.race([
        new Promise(resolve => active.process.once('message', resolve)),
        active.exited.then(exit => { throw Error(`prefix ${prefix}: ${JSON.stringify(exit)} ${active.errors()}`); }),
      ]);
      expect(ready.stage).toBe(checkpoint.stage); expect(ready.head).toBe(checkpoint.facts.at(-1).hash);
      active.process.kill('SIGKILL'); expect(await active.exited).toEqual({ code: null, signal: 'SIGKILL' });
      active = child(root, 'inspect');
      expect(await active.exited, `${prefix}: ${active.errors()}`).toEqual({ code: 0, signal: null });
      const recovered = JSON.parse(readFileSync(join(root, 'recovery-proof.json'), 'utf8'));
      expect(recovered.head).toBe(checkpoint.facts.at(-1).hash); expect(recovered.count).toBe(checkpoint.facts.length);
      expect(recovered.calls).toEqual(['getMe']); expect(recovered.providerCalls).toBe(0);
      for (const fact of checkpoint.facts.filter(row => row.kind.startsWith('verification-')))
        expect(recovered.assessments).toContain(fact.id);
      for (const fact of checkpoint.facts.filter(row => row.kind.startsWith('effect-provider-')))
        expect(recovered.provider).toContain(fact.id);
      if (['provider-before-response', 'provider-after-response', 'reply-before-response', 'reply-after-response'].includes(checkpoint.stage)) {
        expect(recovered.run.pending).toHaveLength(1);
        const unaccounted = recovered.accounting.filter(row => row.record.type === 'AdmissionReservation' && row.record.state === 'consumed'
          && !recovered.accounting.some(other => other.record.type === 'SettlementApplication' && other.record.operation === row.record.operation));
        expect(unaccounted.length).toBeGreaterThan(0);
      }
      console.error(`SIGKILL public restart passed: ${prefix}`);
    }
    complete = true;
  } finally { if (active?.process.exitCode === null && active.process.signalCode === null) active.process.kill('SIGKILL'); if (complete) rmSync(work, { recursive: true, force: true }); else console.error(`Recorded fixture evidence retained: ${work}`); }
}, 7200000);

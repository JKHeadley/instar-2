import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { judgmentFixture } from '../judgment/fixture.js';
import { privateKey } from '../facts/fixtures.js';

function boot() {
  const f = judgmentFixture();
  const identity = f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity');
  const grantProof = f.proof(f.g.source.authenticated.payload as object, { id: 'alice', kind: 'person' }, 'intent-approval');
  const seed = { register: f.ctx.decode.register, captures: f.ctx.decode.captures, preserved: f.c.preserved,
    principal: { ...f.alice, provenance: identity.input }, scope: f.scope, grants: [{ ...f.g, source: grantProof.input }], clock: f.now, site: f.c.site,
    domain: f.host.transport.domain, machine: f.host.transport.machine, budget: 100, maxLeaseTerm: 1000,
    keys: f.ctx.keys, genesis: f.ctx.genesis, privateKey, evidence: f.evidence, point: f.host.point, floor: f.floor, description: f.host.description,
    question: f.input, observation: f.observation, policy: f.policy, captureCapacity: 1048576 };
  const directory = mkdtempSync(join(tmpdir(), 'p7-process-')), path = join(directory, 'seed.json');
  writeFileSync(path, JSON.stringify(seed), { mode: 0o600 }); return { directory, args: [resolve('tests/fixtures/judgment-worker.mjs'), path, directory] };
}
it('P7-NF-41 reference production initialization invokes real P1/P2/P6 ports with deterministic provider bytes', () => {
  const b = boot(), run = spawnSync(process.execPath, [...b.args, 'complete', 'none'], { encoding: 'utf8', timeout: 15000 });
  expect(run.status, run.stderr).toBe(0); expect(JSON.parse(run.stdout)).toMatchObject({ recorded: true, answer: { decision: { floor: { chosen: 'work' } } } });
  expect(readFileSync(join(b.directory, 'provider-invocations.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
});
it('P7-NF-14 P7-NF-15 P7-NF-52 real SIGKILL after provider/receipt/resolution never reconstructs a missing answer by another call', async () => {
  for (const cut of ['provider', 'response', 'resolution']) {
    const b = boot(), child = spawn(process.execPath, [...b.args, 'start', cut], { stdio: ['ignore', 'pipe', 'pipe'] });
    let errors = ''; child.stderr.on('data', data => { errors += String(data); });
    try {
      const ready = await new Promise<{ ready: boolean; phase: string }>((done, reject) => {
        let stdout = ''; child.stdout.on('data', data => { stdout += String(data); if (stdout.includes('\n')) done(JSON.parse(stdout.trim()) as { ready: boolean; phase: string }); });
        child.once('exit', code => reject(new Error(`worker ${code}: ${errors}`)));
      });
      expect(ready).toEqual({ ready: true, phase: cut });
      const exited = new Promise(done => child.once('exit', done)); child.kill('SIGKILL'); await exited;
      const resumed = spawnSync(process.execPath, [...b.args, 'resume', cut], { encoding: 'utf8', timeout: 15000 });
      expect(resumed.status, resumed.stderr).toBe(0); const result = JSON.parse(resumed.stdout) as { recorded: boolean; detail?: string };
      expect(result.recorded).toBe(cut !== 'provider'); if (cut === 'provider') expect(result.detail).toContain('receipt missing');
      expect(readFileSync(join(b.directory, 'provider-invocations.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
      const facts = JSON.parse(readFileSync(join(b.directory, 'facts.json'), 'utf8')) as { body: { record?: { type: string; state?: string; charge?: number } } }[];
      expect(facts.map(f => f.body.record).filter(r => r?.type === 'AdmissionReservation').at(-1)).toMatchObject({ state: 'consumed', charge: 20 });
    } finally { child.kill('SIGKILL'); }
  }
}, 30000);
it.skip('P7-NF-41 LIVE-PROVIDER slice fixture requires separately authorized real provider, eight executor and activation evidence', () => {});

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { privateKey } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';

it('P6-NF-11 P6-NF-20 P6-NF-30 P6-NF-34 P6-NF-36 P6-NF-38 fresh-process kill after claim/consume/send/active-observation preserves safe recovery', async () => {
  for (const cut of ['claim', 'consume', 'send', 'observation']) {
    const f = transportFixture();
    const identity = f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity');
    const grantProof = f.proof(f.g.source.authenticated.payload as object, { id: 'alice', kind: 'person' }, 'intent-approval');
    const seed = { register: f.ctx.decode.register, captures: f.captures, preserved: f.c.preserved,
      principal: { ...f.alice, provenance: identity.input }, scope: f.scope, grants: [{ ...f.g, source: grantProof.input }], clock: f.now, site: f.c.site, domain: f.host.domain,
      machine: f.host.machine, budget: f.host.budget, maxLeaseTerm: f.host.maxLeaseTerm,
      keys: f.ctx.keys, genesis: f.ctx.genesis, privateKey };
    const seedPath = join(f.directory, 'boot-seed.json'); writeFileSync(seedPath, JSON.stringify(seed), { mode: 0o600 });
    const args = [resolve('tests/fixtures/transport-worker.mjs'), seedPath, f.directory];
    const child = spawn(process.execPath, [...args, 'start', cut], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', b => { stderr += String(b); });
    try {
      const ready = await new Promise<{ operation: string; ready: boolean }>((resolveReady, reject) => {
        let stdout = '';
        child.stdout.on('data', b => { stdout += String(b); if (stdout.includes('\n')) resolveReady(JSON.parse(stdout.trim()) as { operation: string; ready: boolean }); });
        child.once('exit', code => reject(new Error(`worker exited ${code}: ${stderr}`)));
      });
      expect(ready.ready).toBe(true);
      const exited = new Promise(resolveExit => child.once('exit', resolveExit));
      child.kill('SIGKILL'); await exited;
      const resumed = spawnSync(process.execPath, [...args, 'recover', cut], { encoding: 'utf8', timeout: 15000 });
      expect(resumed.status, resumed.stderr).toBe(0);
      if (cut === 'observation') {
        const blocked = JSON.parse(resumed.stdout) as { detail: string; calls: number; records: { type: string; state?: string; attempts?: number }[] };
        expect(blocked.detail).toContain('already active'); expect(blocked.calls).toBe(0);
        expect(blocked.records.filter(r => r.type === 'LoopRecord').at(-1)).toMatchObject({ state: 'running', attempts: 1 });
        expect(readFileSync(join(f.directory, 'observations.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
        expect(existsSync(join(f.directory, 'external-effects.jsonl'))).toBe(false);
        continue;
      }
      const outcome = JSON.parse(resumed.stdout) as { recovery: { operation: string; disposition: string }; replayRefused: boolean; records: { type: string; operation?: string; charge?: number }[] };
      expect(outcome.recovery.operation).toBe(ready.operation); expect(outcome.replayRefused).toBe(true);
      expect(outcome.recovery.disposition).toBe('stopped-at-bound'); // restored authority clock is conservatively suspect
      const effects = join(f.directory, 'external-effects.jsonl');
      expect(existsSync(effects) ? readFileSync(effects, 'utf8').trim().split('\n').length : 0).toBe(cut === 'send' ? 1 : 0);
      expect(JSON.parse(readFileSync(join(f.directory, 'observations.jsonl'), 'utf8').trim())).toEqual({ operation: ready.operation, method: 'read-only-lookup' });
      expect(outcome.records.filter(r => r.type === 'AdmissionReservation').at(-1)).toMatchObject({ operation: ready.operation, charge: 20 });
    } finally { child.kill('SIGKILL'); }
  }
}, 30000);

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { privateKey } from '../facts/fixtures.js';
import { effectFixture } from '../effects/fixture.js';

for (const cut of ['before-send', 'after-send', 'after-record']) it(`P8-NF-14 P8-NF-22 P8-NF-31 P8-NF-37 P8-NF-39 P8-NF-42 P8-NF-49 SIGKILL ${cut}: real emitted doorway recovers only by observation`, async () => {
  const f = effectFixture();
  const rawProvenance = (p: typeof f.bob.provenance) => f.proof(p.authenticated.payload as object,
    p.authenticated.principal as { id: string; kind: string }, p.authenticated.recordType).input;
  const seed = { register: f.ctx.decode.register, captures: f.captures, preserved: f.c.preserved,
    principals: f.principals.map(p => ({ ...p, provenance: rawProvenance(p.provenance) })),
    grants: f.grants.map(g => ({ ...g, source: rawProvenance(g.source) })),
    authorizations: f.authorizations.map(a => ({ ...a, explicitYes: rawProvenance(a.explicitYes) })),
    versions: f.host.current().versions.map(v => ({ ...v, approvedIn: v.approvedIn.id })),
    clock: f.now, speaker: f.bob.id, scope: f.scope, machine: 'machine-a', site: f.c.site, keys: f.ctx.keys,
    genesis: f.ctx.genesis, privateKey, noteSchema: f.schema, pendingId: f.pending.id,
    definition: f.definition, message: f.message };
  const seedPath = join(f.directory, 'seed.json'); writeFileSync(seedPath, JSON.stringify(seed), { mode: 0o600 });
  const directory = join(f.directory, 'child');
  const args = [resolve('tests/fixtures/effect-worker.mjs'), seedPath, directory];
  const child = spawn(process.execPath, [...args, 'start', cut], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = ''; child.stderr.on('data', bytes => { stderr += String(bytes); });
  try {
    const ready = await new Promise<{ ready: boolean; operation: string }>((resolveReady, reject) => {
      let output = ''; child.stdout.on('data', b => { output += String(b); if (output.includes('\n')) resolveReady(JSON.parse(output.trim()) as { ready: boolean; operation: string }); });
      child.once('exit', code => reject(new Error(`child exited ${code}: ${stderr}`)));
    });
    expect(ready.ready).toBe(true);
    const exit = new Promise(resolveExit => child.once('exit', resolveExit)); child.kill('SIGKILL'); await exit;
    const resumed = spawnSync(process.execPath, [...args, 'recover', cut], { encoding: 'utf8', timeout: 30000 });
    expect(resumed.status, resumed.stderr).toBe(0);
    const recovered = JSON.parse(resumed.stdout) as { operation: string; charge: number; replayRefused: boolean; freshRefused: boolean };
    expect(recovered).toMatchObject({ operation: ready.operation, charge: 20, replayRefused: true, freshRefused: true });
    const service = join(directory, 'external-service.jsonl');
    expect(existsSync(service) ? readFileSync(service, 'utf8').trim().split('\n').length : 0).toBe(cut === 'before-send' ? 0 : 1);
    const queries = readFileSync(join(directory, 'queries.jsonl'), 'utf8').trim().split('\n');
    expect(queries).toHaveLength(1); expect(JSON.parse(queries[0]!)).toMatchObject({ operation: ready.operation });
    expect(readFileSync(join(directory, 'origin', 'facts.json'), 'utf8')).toBe(readFileSync(join(directory, 'peer', 'facts.json'), 'utf8'));
  } finally { child.kill('SIGKILL'); }
}, 30000);

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { judgmentFixture, value } from '../judgment/fixture.js';
import { privateKey } from '../facts/fixtures.js';

// docs/11 step 6 through-eight dispatch, cut by REAL SIGKILL between each pair of
// durable steps: six-reserve|adopt, adopt|dispatch, dispatch|resolution. A fresh
// process restores the same logical worker incarnation (seven's stale-incarnation
// gate refuses a foreign worker by design) and completes through the public
// seams: ONE provider invocation total, resolution recorded, eight's settlement
// applied through six, and the run admits a SECOND operation (the unlock).
function boot() {
  const f = judgmentFixture({ effects: true });
  const identity = f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity');
  const grantProof = f.proof(f.g.source.authenticated.payload as object, { id: 'alice', kind: 'person' }, 'intent-approval');
  const bobIdentity = f.proof({ id: 'bob', kind: 'agent' }, { id: 'bob', kind: 'agent' }, 'identity');
  const bobGrant = f.grants.find(g => g.id === 'model-approver-grant')!;
  const bobGrantProof = f.proof(bobGrant.source.authenticated.payload as object, { id: 'alice', kind: 'person' }, 'intent-approval');
  const authRaw = f.authInput({ id: 'judgment-model-approval-seed', approver: f.bob, under: 'model-approver-grant',
    artifact: f.capture(value(canonical(f.definition)).bytes), base: 'judgment-model-base:1' }).input as { explicitYes: { authenticated: { payload: object } } };
  // Seed the RAW provenance input (like the identity/grant proofs): a decoded
  // Provenance does not JSON-round-trip through a fresh decode.
  const approval = { ...authRaw, explicitYes: f.proof(authRaw.explicitYes.authenticated.payload, { id: 'bob', kind: 'agent' }, 'approval').input };
  const seed = { register: f.ctx.decode.register, captures: f.ctx.decode.captures, preserved: f.c.preserved,
    principal: { ...f.alice, provenance: identity.input }, scope: f.scope,
    grants: [{ ...f.g, source: grantProof.input },
      { ...bobGrant, source: bobGrantProof.input, grantee: { id: 'bob', kind: 'agent', provenance: bobIdentity.input } }],
    clock: f.now, site: f.c.site,
    domain: f.host.transport.domain, machine: f.host.transport.machine, budget: 100, maxLeaseTerm: 1000,
    keys: f.ctx.keys, genesis: f.ctx.genesis, privateKey, evidence: f.evidence, point: f.host.point, floor: f.floor, description: f.host.description,
    question: f.input, observation: f.observation, policy: f.policy, captureCapacity: 1048576,
    effects: { definition: f.definition,
      approval,
      version: { id: f.definition.version, subject: f.definition.feature, supersedes: [], landedIn: null },
      evidenceCapture: { reference: 'capture:evidence', hash: f.capture('observed bytes', 'capture:evidence') } } };
  const directory = mkdtempSync(join(tmpdir(), 'p7-adopt-')), path = join(directory, 'seed.json');
  writeFileSync(path, JSON.stringify(seed), { mode: 0o600 });
  return { directory, args: [resolve('tests/fixtures/judgment-adopt-worker.mjs'), path, directory] };
}
const invocations = (directory: string): number => {
  const path = join(directory, 'provider-invocations.jsonl');
  return existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').length : 0;
};

it('the uninterrupted adopted composition judges through eight, settles, and admits the second operation', () => {
  const b = boot(), run = spawnSync(process.execPath, [...b.args, 'start', 'none'], { encoding: 'utf8', timeout: 30000 });
  expect(run.status, run.stderr).toBe(0);
  expect(JSON.parse(run.stdout)).toMatchObject({ recorded: true });
  expect(invocations(b.directory)).toBe(1);
  const resumed = spawnSync(process.execPath, [...b.args, 'resume', 'none'], { encoding: 'utf8', timeout: 30000 });
  expect(resumed.status, resumed.stderr).toBe(0);
  expect(JSON.parse(resumed.stdout)).toMatchObject({ recorded: true, unresolved: 0, exposure: 3, secondAdmitted: true, modelOperations: 1 });
  expect(invocations(b.directory)).toBe(1);
}, 60_000);

it('real SIGKILL between six-reserve|adopt, adopt|dispatch and dispatch|resolution recovers through public seams with ONE invocation and unlocks the second operation', async () => {
  for (const cut of ['reserve', 'adopt', 'dispatch']) {
    const b = boot(), child = spawn(process.execPath, [...b.args, 'start', cut], { stdio: ['ignore', 'pipe', 'pipe'] });
    let errors = ''; child.stderr.on('data', data => { errors += String(data); });
    try {
      const ready = await new Promise<{ ready: boolean; phase: string }>((done, reject) => {
        let stdout = ''; child.stdout.on('data', data => { stdout += String(data); if (stdout.includes('\n')) done(JSON.parse(stdout.trim()) as { ready: boolean; phase: string }); });
        child.once('exit', code => reject(new Error(`worker ${code}: ${errors}`)));
      });
      expect(ready).toEqual({ ready: true, phase: cut });
      const exited = new Promise(done => child.once('exit', done)); child.kill('SIGKILL'); await exited;
      // The invocation happened IFF the cut lies after the dispatch boundary.
      expect(invocations(b.directory)).toBe(cut === 'dispatch' ? 1 : 0);
      const resumed = spawnSync(process.execPath, [...b.args, 'resume', 'none'], { encoding: 'utf8', timeout: 30000 });
      expect(resumed.status, resumed.stderr).toBe(0);
      expect(JSON.parse(resumed.stdout)).toMatchObject({ recorded: true, unresolved: 0, exposure: 3, secondAdmitted: true, modelOperations: 1 });
      // docs/11 retries rule: exactly ONE provider invocation across both processes.
      expect(invocations(b.directory)).toBe(1);
    } finally { child.kill('SIGKILL'); }
  }
}, 120_000);

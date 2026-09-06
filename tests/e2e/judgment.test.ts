import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
}, 30_000); // Real compiled initialization with fsync; not a model latency SLO.
it('P7-NF-14 P7-NF-15 P7-NF-52 real SIGKILL after handoff/provider/receipt/resolution never reconstructs a missing answer by another call', async () => {
  for (const cut of ['dispatch', 'provider', 'response', 'resolution']) {
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
      expect(result.recorded).toBe(!['dispatch', 'provider'].includes(cut)); if (['dispatch', 'provider'].includes(cut)) expect(result.detail).toContain('receipt missing');
      const calls = join(b.directory, 'provider-invocations.jsonl');
      expect(existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n').length : 0).toBe(cut === 'dispatch' ? 0 : 1);
      const facts = JSON.parse(readFileSync(join(b.directory, 'facts.json'), 'utf8')) as { body: { record?: { type: string; state?: string; charge?: number } } }[];
      expect(facts.map(f => f.body.record).filter(r => r?.type === 'AdmissionReservation').at(-1)).toMatchObject({ state: 'consumed', charge: 20 });
    } finally { child.kill('SIGKILL'); }
  }
}, 60_000); // Four bounded fresh-process cuts, each resumed child capped at 15s.
it.skip('P7-NF-41 LIVE-PROVIDER slice fixture requires separately authorized real provider, eight executor and activation evidence', () => {});
it.each(['capture-empty', 'capture-owner'])('P7-NF-15 P7-NF-22 P7-NF-34 P7-NF-52 N1 real SIGKILL at %s preserves receipt-only reopening and writer exclusion', async cut => {
  const b = boot();
  const children: ReturnType<typeof spawn>[] = [];
  const paused = async (mode: string, phase: string) => {
    const child = spawn(process.execPath, [...b.args, mode, phase], { stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child);
    let errors = ''; child.stderr!.on('data', data => { errors += String(data); });
    const ready = await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(new Error('lock worker readiness timeout: ' + errors)), 10000);
      let output = '', settled = false; child.stdout!.on('data', data => { if (settled) return; output += String(data); if (output.includes('\n')) { settled = true; clearTimeout(timer); done(JSON.parse(output.trim())); } });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`lock worker ${code}: ${errors}`)); });
    });
    expect(ready).toEqual({ ready: true, phase }); return child;
  };
  const kill = async (child: ReturnType<typeof spawn>) => {
    const exit = new Promise(done => child.once('exit', (_code, signal) => done(signal)));
    child.kill('SIGKILL'); expect(await exit).toBe('SIGKILL');
  };
  const run = (mode: string) => {
    const result = spawnSync(process.execPath, [...b.args, mode, 'none'], { encoding: 'utf8', timeout: 15000 });
    expect(result.status, result.stderr).toBe(0); return JSON.parse(result.stdout);
  };
  const commitments = () => Object.fromEntries(readdirSync(join(b.directory, 'captures/capacity')).sort()
    .map(name => [name, readFileSync(join(b.directory, 'captures/capacity', name), 'utf8')]));
  try {
    // Leave an intact real response but no accounting/decode/resolution yet.
    await kill(await paused('start', 'response'));
    const before = commitments();
    const writer = await paused('capture-lock', cut);
    const markerNames = readdirSync(join(b.directory, 'captures/capture.lock'));
    expect(markerNames).toHaveLength(cut === 'capture-owner' ? 1 : 0);
    if (cut === 'capture-owner') expect(JSON.parse(readFileSync(join(b.directory, 'captures/capture.lock', markerNames[0]!), 'utf8')).pid).toBe(writer.pid);
    // A stopped but live writer cannot be stolen. A fresh compiled composition
    // can nevertheless open/read the receipt, with no capacity mutation.
    const live = run('capture-probe'); expect(live.write.ok).toBe(false);
    expect(live.write.detail).toContain(cut === 'capture-owner' ? 'still live' : 'owner unknown');
    expect(commitments()).toEqual(before);
    await kill(writer);
    if (cut === 'capture-owner') {
      // Freeze one stale reaper after its liveness check but before unlink. A
      // competitor reclaims the dead marker and becomes a NEW live owner. The
      // old reaper must lose without removing that replacement directory.
      const reaper = await paused('capture-reaper', 'capture-reaper');
      const replacement = await paused('capture-lock', 'capture-owner');
      const replacementNames = readdirSync(join(b.directory, 'captures/capture.lock'));
      let output = ''; reaper.stdout!.on('data', data => { output += String(data); });
      const exited = new Promise(done => reaper.once('exit', done)); reaper.kill('SIGCONT'); expect(await exited).toBe(0);
      expect(JSON.parse(output)).toMatchObject({ ok: false, detail: expect.stringContaining('ENOENT') });
      expect(readdirSync(join(b.directory, 'captures/capture.lock'))).toEqual(replacementNames);
      expect(run('capture-probe').write.detail).toContain('still live');
      expect(commitments()).toEqual(before);
      await kill(replacement);
    }
    expect(run('resume').recorded).toBe(true);
    expect(commitments()).toEqual(before); // Recovery never releases held bytes.
    const reopened = run('capture-probe'); expect(reopened.bytes).toBe(live.bytes);
    expect(reopened.write.ok).toBe(cut === 'capture-owner'); // ESRCH reclaims only a known dead writer.
    if (cut === 'capture-empty') expect(reopened.write.detail).toContain('owner unknown');
    expect(readFileSync(join(b.directory, 'provider-invocations.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
    const facts = JSON.parse(readFileSync(join(b.directory, 'facts.json'), 'utf8')) as { body: { record?: { type: string; state?: string; charge?: number } } }[];
    expect(facts.map(f => f.body.record).filter(r => r?.type === 'AdmissionReservation').at(-1)).toMatchObject({ state: 'consumed', charge: 20 });
  } finally { for (const child of children) child.kill('SIGKILL'); }
}, 30_000);

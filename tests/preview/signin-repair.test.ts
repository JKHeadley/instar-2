// @ts-nocheck -- production pool + real fsynced record; only the custody helper interface is fake.
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarnessLoginPool } from './harness-login-pool.mjs';
import { NO_HEALTHY_LOGIN, SIGNIN_REPAIR_LIMITS } from './signin-repair.js';
const roots = [];
afterEach(() => { vi.useRealTimers(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'signin-repair-')); roots.push(root);
  let at = 100000, stopped = false, result = 'complete', identity = 'match', use = true, recovery = 'unknown';
  const calls = [], entries = ['a', 'b'].map((name, index) => ({ index, profile: {
    reference: name, expectedAccount: `${name}@example.invalid`, configDirectory: `/fixture/${name}`,
  } }));
  const path = join(root, 'pool.json');
  const lease = { owner: 'owned-run', machine: 'fixture', deadline: 9999999,
    profile: { reference: 'a', account: 'a@example.invalid', registered: true, ownership: 'agent' },
    helper: { account: 'b@example.invalid', healthy: true }, current: () => true,
    normalSignIn: async () => { calls.push('normal'); expect(disk().signinRepairs[0].episode.phase).toBe('attempting'); return result; },
    revalidate: async () => { calls.push('revalidate'); return recovery; },
    verifyIdentity: async () => { calls.push('identity'); return identity; },
    authenticatedUse: async () => { calls.push('use'); return use; },
    publish: async () => { calls.push('publish'); return true; },
    close: () => calls.push('close'),
  };
  const port = { stopped: () => stopped, acquire: async target => {
    calls.push('acquire'); expect(target.account).toBe('a@example.invalid');
    expect(disk().signinRepairs[0].episode.owner).toBeTruthy(); return lease;
  } };
  const settings = { configuration: { entries, identity: 'fixture', threshold: 95, current: () => true }, statePath: path,
    now: () => at, machine: 'fixture', validate: () => {}, signinRepair: port };
  let pool = createHarnessLoginPool(settings);
  function disk() { return JSON.parse(readFileSync(path, 'utf8')); }
  return { get pool() { return pool; }, lease, port, calls, entries, settings, disk,
    signOut() { pool.observeSignedOut(entries[0]); pool.select(); },
    restart() { pool = createHarnessLoginPool(settings); },
    edit(change) { const state = disk(); change(state); writeFileSync(path, JSON.stringify(state)); this.restart(); },
    advance(ms) { at += ms; }, stop() { stopped = true; },
    result(value) { result = value; }, identity(value) { identity = value; }, use(value) { use = value; }, recovery(value) { recovery = value; },
  };
}
it('signed-out item becomes owned; independent identity and use restore eligibility without a notice', async () => {
  const f = fixture(); f.signOut(); expect(f.pool.select().index).toBe(1);
  await f.pool.repairSignins(f.port);
  expect(f.calls).toEqual(['acquire', 'normal', 'identity', 'use', 'publish', 'close']);
  expect(f.disk().signinRepairs[0].episode).toMatchObject({ phase: 'succeeded', owner: 'owned-run', attempts: 1, verifiedAt: 100000 });
  expect(f.pool.state.signedOut).toEqual({}); expect(f.pool.notices()).toEqual([]);
  expect(f.pool.select(false, 0).index).toBe(0);
  f.restart(); await f.pool.repairSignins(f.port); expect(f.calls.filter(x => x === 'normal')).toHaveLength(1);
});
it.each(['credential-needed', 'phone-tap', 'wrong-account', 'fallback-code'])('%s parks once with one specific action across restart', async reason => {
  const f = fixture(); f.signOut(); f.result(reason); await f.pool.repairSignins(f.port);
  const notices = f.pool.notices(); expect(notices).toHaveLength(1);
  expect(notices[0].line).not.toMatch(/desk|run \/subscription/u);
  expect(notices[0].line).toContain('a@example.invalid');
  expect(f.disk().signinRepairs[0].episode).toMatchObject({ phase: 'parked', reason });
  f.restart(); await f.pool.repairSignins(f.port); await f.pool.repairSignins(f.port);
  expect(f.pool.notices()).toEqual(notices); // Same durable journal key, not a new notification.
  expect(f.calls.filter(x => x === 'normal')).toHaveLength(1);
  expect(f.calls).not.toContain('use'); expect(f.pool.select().index).toBe(1);
});
it.each(['mismatch', 'unknown'])('helper completion cannot override independent identity %s', async identity => {
  const f = fixture(); f.signOut(); f.identity(identity); await f.pool.repairSignins(f.port);
  expect(f.pool.state.signinRepairs[0].episode.phase).toBe('parked'); expect(f.calls).not.toContain('use');
  expect(f.pool.state.signedOut[0]).toBeDefined();
});
it('authenticated use is required, and transient helper errors never enter durable state', async () => {
  const f = fixture(); f.signOut(); f.use(false); await f.pool.repairSignins(f.port);
  expect(f.pool.state.signinRepairs[0].episode.reason).toBe('uncertain');
  const g = fixture(); g.signOut(); g.lease.normalSignIn = async () => { throw Error('private adapter diagnostics'); };
  await g.pool.repairSignins(g.port); expect(JSON.stringify(g.disk())).not.toContain('private adapter');
  expect(g.pool.state.signinRepairs[0].episode.reason).toBe('uncertain');
});
it.each(['unknown', 'signed-in', 'not-started'])('restart mid-attempt revalidates %s before any second attempt', async recovery => {
  const f = fixture(); f.signOut();
  f.edit(s => { s.signinRepairs[0].episode = { phase: 'attempting', owner: 'previous-run', attempts: 1, nextAt: 0, startedAt: 100000 }; });
  f.recovery(recovery); await f.pool.repairSignins(f.port);
  expect(f.calls).toContain('revalidate'); expect(f.calls).not.toContain('normal');
  expect(f.pool.state.signinRepairs[0].episode.phase).toBe(recovery === 'signed-in' ? 'succeeded' : recovery === 'unknown' ? 'parked' : 'cooldown');
  if (recovery === 'not-started') {
    await f.pool.repairSignins(f.port); expect(f.calls).not.toContain('normal'); f.advance(5000); await f.pool.repairSignins(f.port);
    expect(f.calls.filter(x => x === 'normal')).toHaveLength(1);
  }
});
it('three attempts and exponential cooldown survive restart', async () => {
  const f = fixture(); f.signOut(); f.result('retryable');
  await f.pool.repairSignins(f.port); await f.pool.repairSignins(f.port); expect(f.calls.filter(x => x === 'normal')).toHaveLength(1);
  f.restart(); f.advance(4999); await f.pool.repairSignins(f.port); expect(f.calls.filter(x => x === 'normal')).toHaveLength(1);
  f.advance(1); await f.pool.repairSignins(f.port); f.advance(9999); await f.pool.repairSignins(f.port); expect(f.calls.filter(x => x === 'normal')).toHaveLength(2);
  f.advance(1); await f.pool.repairSignins(f.port); expect(f.calls.filter(x => x === 'normal')).toHaveLength(3);
  f.restart(); f.advance(1000000); await f.pool.repairSignins(f.port); expect(f.calls.filter(x => x === 'normal')).toHaveLength(3);
  expect(f.pool.state.signinRepairs[0].episode.reason).toBe('attempt-cap');
});
it.each(['person', 'unregistered', 'other-account', 'other-machine', 'same-helper', 'no-helper', 'withdrawn'])('refuses %s before sign-in', async mode => {
  const f = fixture(); f.signOut();
  if (mode === 'person') f.lease.profile.ownership = 'person';
  if (mode === 'unregistered') f.lease.profile.registered = false;
  if (mode === 'other-account') f.lease.profile.account = 'different@example.invalid';
  if (mode === 'other-machine') f.lease.machine = 'elsewhere';
  if (mode === 'same-helper') f.lease.helper.account = 'a@example.invalid';
  if (mode === 'no-helper') f.lease.helper = null;
  if (mode === 'withdrawn') f.lease.current = () => false;
  await f.pool.repairSignins(f.port); expect(f.calls).not.toContain('normal'); expect(f.pool.state.signedOut[0]).toBeDefined();
  if (mode === 'no-helper') {
    expect(f.pool.notices()[0].line).toBe(NO_HEALTHY_LOGIN);
    f.restart(); await f.pool.repairSignins(f.port); expect(f.calls.filter(x => x === 'acquire')).toHaveLength(1);
  }
});
it('stop before admission does nothing; stop during helper aborts it and cannot release the login', async () => {
  const f = fixture(); f.signOut(); f.stop(); await f.pool.repairSignins(f.port); expect(f.calls).toEqual([]);
  vi.useFakeTimers(); const g = fixture(); g.signOut(); let signal;
  g.lease.normalSignIn = async s => { signal = s; return new Promise(() => {}); };
  const run = g.pool.repairSignins(g.port); await vi.advanceTimersByTimeAsync(1); g.stop(); await vi.advanceTimersByTimeAsync(25); await run;
  expect(signal.aborted).toBe(true); expect(g.pool.state.signinRepairs[0].episode.phase).toBe('attempting');
  expect(g.pool.state.signedOut[0]).toBeDefined(); expect(g.calls).toContain('close');
});
it('hung helper expires, late success cannot alter state, and concurrent ticks do not duplicate it', async () => {
  vi.useFakeTimers(); const f = fixture(); f.signOut(); let finish;
  f.lease.normalSignIn = async () => { f.calls.push('normal'); return new Promise(resolve => { finish = resolve; }); };
  const run = f.pool.repairSignins(f.port); await vi.advanceTimersByTimeAsync(1); await f.pool.repairSignins(f.port);
  expect(f.calls.filter(x => x === 'normal')).toHaveLength(1);
  f.advance(SIGNIN_REPAIR_LIMITS.lifetimeMs); await vi.advanceTimersByTimeAsync(25); await run; finish('complete');
  await vi.advanceTimersByTimeAsync(1); expect(f.pool.state.signedOut[0]).toBeDefined(); expect(f.calls).not.toContain('identity');
});
it('repair never changes quota holds or removes the healthy serving login', async () => {
  const f = fixture(); f.signOut(); f.pool.observe(f.entries[0], { failure: { failureClass: 'limit', resetAt: 900000 } });
  const holds = f.pool.state.holds; await f.pool.repairSignins(f.port); expect(f.pool.state.holds).toEqual(holds);
  expect(f.pool.select().index).toBe(1); expect(f.pool.state.active).toBe(1);
});
it('a second real sign-out has its own episode and key even at the same clock tick', async () => {
  const f = fixture(); f.signOut(); await f.pool.repairSignins(f.port); f.signOut(); f.result('phone-tap'); await f.pool.repairSignins(f.port);
  expect(f.pool.state.signinRepairs).toHaveLength(2);
  expect(f.pool.state.signinRepairs.map(x => x.episode.phase)).toEqual(['succeeded', 'parked']);
  expect(f.pool.signinRepairs()[0].key).not.toBe(f.pool.signinRepairs()[1].key);
});
it('admission faults and busy do not produce a false no-helper notice or consume attempts', async () => {
  const f = fixture(); f.signOut(); f.port.acquire = async () => { throw Error('unavailable authority'); };
  await f.pool.repairSignins(f.port); expect(f.pool.state.signinRepairs[0].episode.attempts).toBe(0);
  expect(f.pool.notices()).toEqual([]); expect(f.pool.state.signinRepairs[0].episode.nextAt).toBe(105000);
});
it('a changed custody revision resumes a parked episode only through revalidation', async () => {
  const f = fixture(); f.signOut(); let revision = 'a'.repeat(64); f.port.resumeRevision = () => revision;
  f.result('phone-tap'); await f.pool.repairSignins(f.port); await f.pool.repairSignins(f.port);
  expect(f.calls.filter(x => x === 'normal')).toHaveLength(1);
  revision = 'b'.repeat(64); f.recovery('signed-in'); f.restart(); await f.pool.repairSignins(f.port);
  expect(f.calls.filter(x => x === 'normal')).toHaveLength(1);
  expect(f.calls).toContain('revalidate'); expect(f.pool.state.signinRepairs[0].episode.phase).toBe('succeeded');
});
it('a newer signed-out observation during verification survives successful publication', async () => {
  const f = fixture(); f.signOut(); f.lease.authenticatedUse = async () => { f.pool.observeSignedOut(f.entries[0]); return true; };
  await f.pool.repairSignins(f.port); expect(f.pool.state.signedOut[0].observation).toBe(1);
  expect(f.pool.state.signinRepairs[0].episode.phase).toBe('verifying');
});
it('old auth snapshot alone is superseded; new undated auth evidence still holds selection', async () => {
  const f = fixture(); let document = { version: 1, accounts: [{ email: 'a@example.invalid', configHome: '/fixture/a', status: 'needs-reauth' }] };
  f.settings.usage = () => document; f.restart(); f.pool.select(); await f.pool.repairSignins(f.port);
  expect(f.pool.select(false, 0).index).toBe(0);
  document = { version: 1, accounts: [{ ...document.accounts[0], observation: 2 }] };
  expect(f.pool.select(false, 0).index).toBe(1);
});
it('pool refresh and healthy selection stay available while the repair helper is running', async () => {
  vi.useFakeTimers(); const f = fixture(); f.signOut();
  f.lease.normalSignIn = async () => new Promise(() => {});
  const run = f.pool.repairSignins(f.port); await vi.advanceTimersByTimeAsync(1);
  await f.pool.refresh(); expect(f.pool.select().index).toBe(1);
  f.stop(); await vi.advanceTimersByTimeAsync(25); await run;
});
it.each(['duplicate', 'unknown-state', 'bad-attempts', 'secret-field'])('corrupt %s episode is preserved and refused', kind => {
  const f = fixture(); f.signOut(); const state = f.disk();
  state.signinRepairs[0].episode = { phase: 'owned', owner: 'run', attempts: 0, startedAt: 100000, nextAt: 0 };
  if (kind === 'duplicate') state.signinRepairs.push({ ...state.signinRepairs[0] });
  if (kind === 'unknown-state') state.signinRepairs[0].episode.phase = 'made-up';
  if (kind === 'bad-attempts') state.signinRepairs[0].episode.attempts = 9;
  if (kind === 'secret-field') state.signinRepairs[0].episode.unexpected = 'untrusted-output';
  writeFileSync(f.settings.statePath, JSON.stringify(state)); expect(() => f.restart()).toThrow(/sign-in repair/u);
  expect(f.disk()).toEqual(state);
});
it('resume snapshots the validated revision and clears the old parked action', async () => {
  const f = fixture(); f.signOut(); f.result('phone-tap'); await f.pool.repairSignins(f.port);
  let reads = 0; f.port.resumeRevision = () => ++reads === 1 ? 'a'.repeat(64) : undefined;
  f.recovery('signed-in'); await f.pool.repairSignins(f.port); f.restart();
  expect(f.pool.state.signinRepairs[0].episode.phase).toBe('succeeded'); expect(f.pool.signinRepairs()[0].action).toBe('succeeded');
});
it('a later fresh verification can finish after a newer hold prevented earlier completion', async () => {
  const f = fixture(); f.signOut(); f.lease.authenticatedUse = async () => { f.pool.observeSignedOut(f.entries[0]); return true; };
  await f.pool.repairSignins(f.port); expect(f.pool.state.signedOut[0]).toBeDefined();
  f.lease.authenticatedUse = async () => true; f.recovery('signed-in'); await f.pool.repairSignins(f.port);
  expect(f.pool.state.signinRepairs[0].episode.phase).toBe('succeeded'); expect(f.pool.state.signedOut[0]).toBeUndefined();
});

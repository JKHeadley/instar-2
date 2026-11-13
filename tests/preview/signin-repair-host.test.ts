// @ts-nocheck -- only owner ports are fake; the custody-side composition is the production module.
import { expect, it } from 'vitest';
import { createAdmittedSigninRepairPort } from './signin-repair-host.js';
function fixture() {
  const calls = [], target = { key: 'episode', account: 'a@example.invalid', profile: 'a', machine: 'fixture' };
  const profile = { reference: 'a', account: target.account, machine: 'fixture', ownership: 'agent', registered: true, revision: 'profile-1' };
  let stopped = false;
  const candidate = { reference: 'opaque-candidate', account: target.account, current: () => true,
    identity: async () => { calls.push('identity'); return 'match'; },
    use: async () => { calls.push('use'); return true; },
    publish: async () => { calls.push('publish'); return true; }, close: () => calls.push('candidate-close') };
  const run = { owner: 'child-run', machine: 'fixture', account: target.account, profileRevision: 'profile-1', deadline: 600000,
    helper: { account: 'b@example.invalid', healthy: true }, current: () => true,
    runNormal: async input => { calls.push(input); return 'complete'; }, quiescent: async () => true, close: () => calls.push('run-close') };
  const host = { now: () => 1000, machine: 'fixture', stopped: () => stopped,
    profile: () => profile, resumeRevision: () => undefined,
    admit: async (_target, _profile, bounds) => { calls.push(bounds); return run; },
    candidate: async () => candidate };
  return { target, calls, profile, candidate, run, host, stop() { stopped = true; }, port: createAdmittedSigninRepairPort(host) };
}
it('one admitted normal-only child and isolated candidate, publish only after both independent proofs', async () => {
  const f = fixture(), signal = new AbortController().signal, lease = await f.port.acquire(f.target, signal);
  expect(await f.port.acquire(f.target, signal)).toBe('busy');
  expect(await lease.publish(signal)).toBe(false); expect(f.calls).not.toContain('publish');
  expect(await lease.normalSignIn(signal)).toBe('complete');
  expect(f.calls.at(-1)).toEqual({ target: f.target, candidate: 'opaque-candidate', method: 'normal', fallbackCodes: 'forbidden', deadline: 600000 });
  expect(await lease.authenticatedUse(signal)).toBe(false);
  expect(await lease.verifyIdentity(signal)).toBe('match'); expect(await lease.publish(signal)).toBe(false);
  expect(await lease.authenticatedUse(signal)).toBe(true); expect(await lease.publish(signal)).toBe(true);
  lease.close(); lease.close(); expect(f.calls.filter(x => x === 'run-close')).toHaveLength(1);
  expect(f.calls.filter(x => x === 'candidate-close')).toHaveLength(1);
});
it.each(['person', 'unregistered', 'account', 'machine'])('does not admit a %s profile', async mode => {
  const f = fixture();
  if (mode === 'person') f.profile.ownership = 'person';
  if (mode === 'unregistered') f.profile.registered = false;
  if (mode === 'account') f.profile.account = 'other@example.invalid';
  if (mode === 'machine') f.profile.machine = 'elsewhere';
  expect(await f.port.acquire(f.target, new AbortController().signal)).toBe('unavailable'); expect(f.calls).toEqual([]);
});
it.each(['stop', 'profile', 'candidate', 'run'])('withdrawal of %s prevents publication', async mode => {
  const f = fixture(), signal = new AbortController().signal, lease = await f.port.acquire(f.target, signal);
  await lease.verifyIdentity(signal); await lease.authenticatedUse(signal);
  if (mode === 'stop') f.stop();
  if (mode === 'profile') f.host.profile = () => ({ ...f.profile, revision: 'profile-2' });
  if (mode === 'candidate') f.candidate.current = () => false;
  if (mode === 'run') f.run.current = () => false;
  expect(await lease.publish(signal)).toBe(false); expect(f.calls).not.toContain('publish'); lease.close();
});
it('recovery requires quiescence plus identity and use; unknown never means not-started', async () => {
  const f = fixture(), signal = new AbortController().signal, lease = await f.port.acquire(f.target, signal);
  f.run.quiescent = async () => false; expect(await lease.revalidate(signal)).toBe('unknown');
  expect(f.calls).not.toContain('identity');
  f.run.quiescent = async () => true; f.candidate.identity = async () => 'unknown';
  expect(await lease.revalidate(signal)).toBe('unknown');
  f.candidate.identity = async () => 'match'; expect(await lease.revalidate(signal)).toBe('signed-in'); lease.close();
});
it('failed admission does not claim all helper logins are unhealthy', async () => {
  const f = fixture(); f.host.admit = async () => { throw Error('private diagnostics'); };
  expect(await f.port.acquire(f.target, new AbortController().signal)).toBe('unavailable');
  expect(await f.port.acquire(f.target, new AbortController().signal)).toBe('unavailable');
});
it('late admission after stop is closed without opening custody', async () => {
  const f = fixture(); f.host.admit = async () => { f.stop(); return f.run; };
  expect(await f.port.acquire(f.target, new AbortController().signal)).toBe('unavailable');
  expect(f.calls).toEqual(['run-close']);
});
it('mutating the registry object in place still withdraws the admitted profile', async () => {
  const f = fixture(), signal = new AbortController().signal, lease = await f.port.acquire(f.target, signal);
  f.profile.ownership = 'person'; expect(lease.current()).toBe(false); expect(await lease.normalSignIn(signal)).toBe('uncertain'); lease.close();
});

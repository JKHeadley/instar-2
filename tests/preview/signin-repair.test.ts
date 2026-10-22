// @ts-nocheck -- physical adapter contract: disposable state, no real account access.
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseClaudeSigninUrl, repairHarnessSignin } from '../../scripts/claude-signin-repair.mjs';
import { inspectSignin, verifySigninIdentity, verifySigninUse, readSigninCandidate } from '../../scripts/claude-signin-io.mjs';

const captured = readFileSync(new URL('./fixtures/signin/claude-login.txt', import.meta.url), 'utf8');
const usage = JSON.parse(readFileSync(new URL('./fixtures/claude-usage-2026-10-22.json', import.meta.url), 'utf8'));
const refusal = JSON.parse(readFileSync(new URL('./fixtures/signin/profile-refused.json', import.meta.url), 'utf8'));
it('replays the real provider 401 captured with a deliberately invalid synthetic credential', async () => {
  const f = fixture();
  f.ports.inspect.mockImplementation(() => inspectSignin('synthetic-test-credential', {
    fetchImpl: async () => new Response(refusal.body, { status: refusal.status }),
  }));
  expect((await repairHarnessSignin(f.ports)).phase).toBe('succeeded');
  expect(f.ports.login).toHaveBeenCalledTimes(1);
});
it('ports the real 1.x Mac Mini auth-login capture, including a URL split inside code=true', () => {
  const url = new URL(parseClaudeSigninUrl(captured));
  expect(url.origin).toBe('https://claude.com');
  expect(url.searchParams.get('code')).toBe('true');
  expect(url.searchParams.get('redirect_uri')).toBe('https://platform.claude.com/oauth/code/callback');
});

function fixture() {
  let state = null, stopped = false, clock = 1000;
  const ports = {
    now: () => clock, stopped: () => stopped, current: () => true,
    read: () => state, write: next => { state = structuredClone(next); },
    inspect: vi.fn(async () => ({ kind: 'auth-refused' })),
    login: vi.fn(async () => ({ kind: 'complete' })),
    identity: vi.fn(async () => ({ kind: 'match' })),
    authenticatedUse: vi.fn(async () => ({ kind: 'verified', quota: usage })),
    promote: vi.fn(async () => {}),
  };
  return { ports, state: () => state, stop: () => { stopped = true; }, advance: ms => { clock += ms; } };
}
it('requires provider failure, durable preparation, identity, and a real authenticated read before promotion', async () => {
  const f = fixture();
  f.ports.login.mockImplementation(async () => {
    expect(f.state().phase).toBe('browser-driving'); return { kind: 'complete' };
  });
  expect((await repairHarnessSignin(f.ports)).phase).toBe('succeeded');
  expect(f.ports.promote).toHaveBeenCalledTimes(1);
  expect(f.state().events.map(e => e.phase)).toEqual(['detected', 'browser-driving', 'identity-verifying', 'auth-verifying', 'promoting', 'succeeded']);
  await repairHarnessSignin(f.ports);
  expect(f.ports.login).toHaveBeenCalledTimes(1);
});
it.each(['unknown', 'healthy'])('does not start a browser from %s evidence', async kind => {
  const f = fixture(); f.ports.inspect.mockResolvedValue({ kind });
  expect((await repairHarnessSignin(f.ports)).phase).toBe(kind);
  expect(f.ports.login).not.toHaveBeenCalled();
});
it('quarantines a wrong existing identity without launching a repair for another account', async () => {
  const f = fixture(); f.ports.inspect.mockResolvedValue({ kind: 'mismatch' });
  expect((await repairHarnessSignin(f.ports)).reason).toBe('wrong-existing-identity');
  expect(f.ports.login).not.toHaveBeenCalled();
});
it.each(['mismatch', 'unknown'])('cannot promote an identity %s', async kind => {
  const f = fixture(); f.ports.identity.mockResolvedValue({ kind });
  expect((await repairHarnessSignin(f.ports)).phase).toBe(kind === 'mismatch' ? 'refused' : 'waiting');
  expect(f.ports.authenticatedUse).not.toHaveBeenCalled(); expect(f.ports.promote).not.toHaveBeenCalled();
});
it('retains a refused authenticated-use result without promoting', async () => {
  const f = fixture(); f.ports.authenticatedUse.mockResolvedValue({ kind: 'unknown' });
  expect((await repairHarnessSignin(f.ports)).phase).toBe('waiting');
  expect(f.ports.promote).not.toHaveBeenCalled();
});
it('a stop during identity verification prevents the authenticated call and promotion', async () => {
  const f = fixture(); f.ports.identity.mockImplementation(async () => { f.stop(); return { kind: 'match' }; });
  expect((await repairHarnessSignin(f.ports)).phase).toBe('stopped');
  expect(f.ports.authenticatedUse).not.toHaveBeenCalled(); expect(f.ports.promote).not.toHaveBeenCalled();
});
it('a slow path uses its wall-clock bound without a CPU load test', async () => {
  const f = fixture(); f.ports.login.mockImplementation(async () => { f.advance(600001); return { kind: 'complete' }; });
  expect((await repairHarnessSignin(f.ports)).phase).toBe('waiting');
  expect(f.ports.identity).not.toHaveBeenCalled();
});

it('re-observes an interrupted browser attempt without opening another browser', async () => {
  const f = fixture();
  f.ports.write({ version: 1, phase: 'browser-driving', startedAt: 0, events: [] });
  expect((await repairHarnessSignin(f.ports)).phase).toBe('succeeded');
  expect(f.ports.login).not.toHaveBeenCalled();
});
it('an uncertain interrupted sign-in stays visible without repeating it', async () => {
  const f = fixture();
  f.ports.write({ version: 1, phase: 'browser-driving', startedAt: 0, events: [] });
  f.ports.identity.mockResolvedValue({ kind: 'unknown' });
  expect((await repairHarnessSignin(f.ports)).reason).toBe('identity-unavailable');
  await repairHarnessSignin(f.ports);
  expect(f.ports.login).not.toHaveBeenCalled(); expect(f.ports.promote).not.toHaveBeenCalled();
});
it('a failed durable preparation opens neither CLI nor browser', async () => {
  const f = fixture(); f.ports.write = () => { throw Error('disk unavailable'); };
  await expect(repairHarnessSignin(f.ports)).rejects.toThrow('disk unavailable');
  expect(f.ports.login).not.toHaveBeenCalled();
});
it('retains refusal on re-entry and never promotes after an operation throws secret text', async () => {
  const f = fixture(); f.ports.identity.mockRejectedValue(Error('synthetic-secret'));
  expect(JSON.stringify(await repairHarnessSignin(f.ports))).not.toContain('synthetic-secret');
  f.ports.write({ phase: 'refused', events: [] });
  await repairHarnessSignin(f.ports); expect(f.ports.login).toHaveBeenCalledTimes(1);
  expect(f.ports.promote).not.toHaveBeenCalled();
});
it.each(['https://claude.com.evil.invalid/cai/oauth/authorize?response_type=code&state=s',
  'http://claude.com/cai/oauth/authorize?response_type=code&state=s',
  'https://claude.com/not-auth?response_type=code&state=s',
  'https://user:password@claude.com/cai/oauth/authorize?response_type=code&state=s',
  'https://claude.com/cai/oauth/authorize?response_type=code'])('refuses an unbound login URL', url => {
  expect(parseClaudeSigninUrl(url)).toBeNull();
});
it.each([401, 403, 429, 500])('only the profile endpoint HTTP 401 admits repair, HTTP %s is distinct', async status => {
  const fetchImpl = vi.fn(async () => new Response('', { status }));
  const result = await inspectSignin('synthetic-test-credential', { fetchImpl });
  expect(result.kind).toBe(status === 401 ? 'auth-refused' : 'unknown');
  expect(JSON.stringify(result)).not.toContain('synthetic-test-credential');
  expect(fetchImpl.mock.calls[0][1].redirect).toBe('error');
});
it('verifies authenticated use with the real captured OAuth usage bytes', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(usage)));
  expect(await verifySigninUse('synthetic-test-credential', { fetchImpl })).toEqual({ kind: 'verified' });
  expect(fetchImpl.mock.calls[0][0]).toBe('https://api.anthropic.com/api/oauth/usage');
});
it.each([{}, { five_hour: { utilization: 0 } }, { five_hour: null, seven_day: null }])('a partial response does not verify authenticated use', async body => {
  expect(await verifySigninUse('synthetic-test-credential', { fetchImpl: async () => new Response(JSON.stringify(body)) }))
    .toEqual({ kind: 'unknown' });
});
it.each(['wrong-account', 'wrong-organization', 'matching', 'missing'])('identity binds both account and organization: %s', async shape => {
  const body = shape === 'missing' ? {} : { account: { email: shape === 'wrong-account' ? 'other@example.invalid' : 'a@example.invalid' },
    organization: { uuid: shape === 'wrong-organization' ? 'other' : 'org' } };
  const result = await verifySigninIdentity('synthetic-test-credential', { expectedAccount: 'a@example.invalid', organization: 'org' },
    { fetchImpl: async () => new Response(JSON.stringify(body)) });
  expect(result.kind).toBe(shape === 'matching' ? 'match' : shape === 'missing' ? 'unknown' : 'mismatch');
});
it('reads only the dedicated native Keychain service after CLI custody, never an ambient service', async () => {
  const execute = vi.fn(async () => JSON.stringify({ claudeAiOauth: { accessToken: 'synthetic-test-credential', expiresAt: 99999 } }));
  expect(await readSigninCandidate('/private/test-repair', execute)).toEqual({ token: 'synthetic-test-credential', expiresAt: 99999 });
  expect(execute.mock.calls[0][1][2]).toMatch(/^Claude Code-credentials-[a-f0-9]{8}$/);
  expect(await readSigninCandidate('/private/test-repair', async () => '{')).toBeNull();
});

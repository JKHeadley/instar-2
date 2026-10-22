// @ts-nocheck -- disposable adapter transport; no live account or operator approval.
import { afterEach, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSigninService, observeSigninService, waitForSigninService } from '../../scripts/claude-signin-service.mjs';

const binding = { accountId: 'account-a', machineId: 'machine-a', profileId: 'browser-a' };
const episode = { id: 'episode-a', ...binding, sourceEpisodeId: 17, inputDigest: `sha256:${'a'.repeat(64)}`,
  mode: 'approval', state: 'suggested', createdAt: '2026-10-22T20:00:00Z',
  approvedAt: null, approvalExpiresAt: null };
it('leaves the repair at the existing phone cell until its operator approves; never approves on their behalf', async () => {
  const get = vi.fn(async () => ({ enabled: true, episodes: [episode] }));
  const result = await observeSigninService({ binding, get, since: Date.parse(episode.createdAt), previous: null });
  expect(result.kind).toBe('pending');
  expect(result.reason).toBe('phone-approval-required');
  expect(result.receipt.id).toBe('episode-a');
  expect(get.mock.calls).toEqual([['/subscription-relogin?accountId=account-a&limit=100']]);
});

const observe = (value, previous = null, since = Date.parse(episode.createdAt)) => observeSigninService({
  binding, since, previous, get: async () => previous ? { enabled: true, episode: value }
    : { enabled: true, episodes: Array.isArray(value) ? value : [value] } });
const success = { ...episode, state: 'succeeded', approvedAt: '2026-10-22T20:01:00Z',
  approvalExpiresAt: '2026-10-22T20:16:00Z', finishedAt: '2026-10-22T20:03:00Z' };
it('replays the real Studio repair failure without presenting it as repaired or issuing another approval', async () => {
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/signin/relogin-failed-studio.json', import.meta.url), 'utf8'));
  expect(await observe(recorded.episode, null, 0)).toEqual({ kind: 'held', reason: 'repair-service-refused' });
});
it.each(['approval', 'unattended'])('accepts %s service completion only as permission for independent verification', async mode => {
  const pending = await observe(episode);
  expect((await observe({ ...success, mode }, pending.receipt)).kind).toBe('complete');
});
it.each(['accountId', 'machineId', 'profileId', 'inputDigest', 'sourceEpisodeId'])('refuses a changed %s after the phone request', async key => {
  const pending = await observe(episode);
  const value = key === 'sourceEpisodeId' ? 18 : key === 'inputDigest' ? `sha256:${'b'.repeat(64)}` : 'different';
  expect((await observe({ ...success, [key]: value }, pending.receipt)).kind).toBe('held');
});
it('preserves an already-open suggestion, but does not adopt a historical success or ambiguous incident', async () => {
  expect((await observe(episode, null, Date.parse(episode.createdAt) + 1)).kind).toBe('pending');
  expect((await observe(success, null, Date.parse(success.finishedAt) + 1)).kind).toBe('held');
  expect((await observe([episode, { ...episode, id: 'second' }])).kind).toBe('held');
});
it.each([
  { mode: 'observe' }, { approvedAt: null }, { approvalExpiresAt: null },
  { finishedAt: '2026-10-22T21:00:00Z' }, { finishedAt: '2026-10-22T20:00:00Z' },
  { state: 'refused' }, { state: 'cancelled' }, { state: 'failed' }, { state: 'unknown' },
])('keeps unapproved, expired, failed or uncertain outcomes held: %j', async patch => {
  expect((await observe({ ...success, ...patch })).kind).toBe('held');
});
it('does not turn a phone check or an unavailable service into success', async () => {
  expect(await observe({ ...success, state: 'waiting-operator-only' })).toMatchObject({ kind: 'pending', reason: 'phone-action-required' });
  const result = await observeSigninService({ binding, since: 0, previous: null,
    get: async () => { throw Error('synthetic-service-secret'); } });
  expect(result).toEqual({ kind: 'held', reason: 'repair-service-unavailable' });
});
it('continues the same foreground command after a phone approval, with one notice and one durable receipt', async () => {
  const pending = await observe(episode), complete = await observe(success, pending.receipt);
  const source = vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(pending).mockResolvedValue(complete);
  const save = vi.fn(), notice = vi.fn();
  const result = await waitForSigninService({ observe: source, save, notice, stopped: () => false,
    now: () => 1, pause: async () => {}, receipt: null, since: 0 });
  expect(result.kind).toBe('complete'); expect(save).toHaveBeenCalledTimes(1); expect(notice).toHaveBeenCalledTimes(1);
  expect(source.mock.calls[1][0]).toEqual(pending.receipt);
});
it('has both a clock ceiling and an iteration ceiling; stop never consumes a later completion', async () => {
  const pending = await observe(episode), source = vi.fn(async () => pending);
  let clock = 0, stopped = false;
  const f = { observe: source, save: vi.fn(), notice: vi.fn(), stopped: () => stopped,
    now: () => clock, pause: async () => { clock += 600_001; }, receipt: null, since: 0 };
  expect((await waitForSigninService(f)).kind).toBe('pending'); expect(source).toHaveBeenCalledTimes(1);
  source.mockClear(); clock = 0;
  await waitForSigninService({ ...f, pause: async () => {} }); expect(source).toHaveBeenCalledTimes(300);
  source.mockClear(); stopped = true;
  await waitForSigninService(f); expect(source).not.toHaveBeenCalled();
});

const roots = [];
afterEach(() => { roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })); });
function disk() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'signin-service-'))); roots.push(root); chmodSync(root, 0o700);
  const configDirectory = join(root, 'config'); mkdirSync(configDirectory, { mode: 0o700 });
  const tokenFile = join(root, 'api-token'); writeFileSync(tokenFile, 'synthetic-service-token', { mode: 0o600 });
  return { profile: { expectedAccount: 'a@example.invalid', configDirectory },
    binding: { ...binding, account: 'a@example.invalid', tokenFile, url: 'http://127.0.0.1:4042/',
      dashboardUrl: 'https://operator.example.invalid/dashboard#subscriptions' } };
}
it('uses the real loopback HTTP boundary, rechecks config-home identity, and makes GET requests only', async () => {
  const f = disk(), requests = [];
  let changed = false;
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, auth: req.headers.authorization });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.url === '/subscription-pool' ? { accounts: [{ id: binding.accountId,
      email: changed ? 'other@example.invalid' : f.profile.expectedAccount, configHome: f.profile.configDirectory }] }
      : { enabled: true, episodes: [episode] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    f.binding.url = `http://127.0.0.1:${server.address().port}/`;
    const service = createSigninService(f.binding, f.profile);
    expect(service.link).toBe(f.binding.dashboardUrl);
    expect((await service.observe(null, 0)).reason).toBe('phone-approval-required');
    expect(requests.map(r => r.method)).toEqual(['GET', 'GET']);
    expect(requests.every(r => r.auth === 'Bearer synthetic-service-token')).toBe(true);
    changed = true;
    expect((await service.observe(null, 0)).reason).toBe('repair-service-binding-differs');
    expect(requests).toHaveLength(3); // no episode read after the account changes
    writeFileSync(f.binding.tokenFile, 'withdrawn-service-token');
    expect(service.current()).toBe(false);
    expect(await service.candidate()).toBeNull();
    expect((await service.observe(null, 0)).kind).toBe('held'); expect(requests).toHaveLength(3);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
it.each([
  ['url', 'https://elsewhere.example.invalid/'], ['url', 'http://127.0.0.1:4042/other'],
  ['dashboardUrl', 'http://operator.example.invalid/'], ['dashboardUrl', 'https://localhost/'],
  ['account', 'other@example.invalid'], ['profileId', '../escape'],
])('refuses unsafe service binding %s', (key, value) => {
  const f = disk(); expect(() => createSigninService({ ...f.binding, [key]: value }, f.profile)).toThrow();
});
it('refuses public token custody, bounds responses, and does not leak a transport error', async () => {
  const f = disk(); chmodSync(f.binding.tokenFile, 0o644);
  expect(() => createSigninService(f.binding, f.profile)).toThrow();
  chmodSync(f.binding.tokenFile, 0o600);
  for (const fetchImpl of [async () => new Response('x'.repeat(262145)),
    async () => { throw Error('synthetic-service-token'); }]) {
    const result = await createSigninService(f.binding, f.profile, { fetchImpl }).observe(null, 0);
    expect(result).toEqual({ kind: 'held', reason: 'repair-service-unavailable' });
  }
});

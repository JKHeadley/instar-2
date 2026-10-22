// @ts-nocheck -- bounded physical adapter with fake clock/network; no live custody.
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createClaudePoolQuota, mapClaudeUsage } from '../../scripts/claude-pool-quota.mjs';
const at = Date.parse('2026-10-21T18:43:40.701Z');
const body = { five_hour: { utilization: 9, resets_at: '2026-10-21T22:39:59.632528+00:00' },
  seven_day: { utilization: 31, resets_at: '2026-10-28T01:59:59.632594+00:00' } };
// Endpoint-key translation neighbors are synthetic. The pool suite separately
// replays unmodified recorded SubscriptionPool snapshot bytes (R36).
const entries = ['a', 'b'].map((id, index) => ({ index, usageAccount: id,
  profile: { reference: id, expectedAccount: `${id}@example.invalid`, configDirectory: `/test/${id}` } }));
function fixture() {
  let clock = at, stopped = false, status = 200;
  const credentials = vi.fn(entry => `synthetic-${entry.index}`), validate = vi.fn();
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  const quota = createClaudePoolQuota({ entries, now: () => clock, stopped: () => stopped,
    validate, credential: credentials, fetchImpl });
  return { quota, fetchImpl, credentials, validate, advance: ms => { clock += ms; }, stop: () => { stopped = true; }, status: s => { status = s; } };
}
it('reads every member once, coalesces concurrent requests, never returns tokens and retains the original observation clock', async () => {
  const f = fixture(); await Promise.all([f.quota.refresh(), f.quota.refresh()]);
  expect(f.fetchImpl).toHaveBeenCalledTimes(2);
  const doc = f.quota.read(); expect(doc.accounts.map(a => a.email)).toEqual(entries.map(e => e.profile.expectedAccount));
  expect(doc.accounts[0].lastQuota).toEqual(mapClaudeUsage(body, at));
  expect(JSON.stringify(doc)).not.toContain('synthetic-');
  f.advance(59000); await f.quota.refresh(); expect(f.fetchImpl).toHaveBeenCalledTimes(2);
  expect(f.quota.read().accounts[0].lastQuota.measuredAt).toBe(new Date(at).toISOString());
  f.advance(1000); await f.quota.refresh(); expect(f.fetchImpl).toHaveBeenCalledTimes(4);
  for (const [url, init] of f.fetchImpl.mock.calls) {
    expect(url).toBe('https://api.anthropic.com/api/oauth/usage'); expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  }
});
it.each([401, 403, 429, 500])('keeps HTTP %s unknown, with bounded retries and no invented sign-in failure', async status => {
  const f = fixture(); f.status(status); await f.quota.refresh();
  expect(f.quota.read().accounts.every(a => a.lastQuota === null && a.status === 'unknown')).toBe(true);
  expect(f.quota.read().accounts[0].observation).toBe(`http-${status}`);
  f.advance(59000); await f.quota.refresh(); expect(f.fetchImpl).toHaveBeenCalledTimes(2);
  f.advance(1000); await f.quota.refresh(); expect(f.fetchImpl).toHaveBeenCalledTimes(4);
  f.advance(120000); await f.quota.refresh(); expect(f.fetchImpl).toHaveBeenCalledTimes(6);
  f.advance(60000); await f.quota.refresh(); expect(f.fetchImpl).toHaveBeenCalledTimes(6);
  f.status(200); f.advance(30 * 60000); await f.quota.refresh(); expect(f.fetchImpl).toHaveBeenCalledTimes(8);
});
it('honors stop and admission before opening custody', async () => {
  const f = fixture(); f.stop(); await f.quota.refresh(); expect(f.credentials).not.toHaveBeenCalled();
  const g = fixture(); g.validate.mockImplementation(() => { throw Error('secret-bearing exception'); });
  await g.quota.refresh(); expect(g.credentials).not.toHaveBeenCalled();
  expect(JSON.stringify(g.quota.read())).not.toContain('secret-bearing');
});
it.each([null, {}, { five_hour: { utilization: null, resets_at: body.five_hour.resets_at } },
  { five_hour: { utilization: '9', resets_at: body.five_hour.resets_at } },
  { five_hour: { utilization: 9, resets_at: 'invalid' } }])('never invents room from missing or malformed windows %j', input => {
  const result = mapClaudeUsage(input, at);
  expect(result.fiveHour).toBeUndefined(); expect(result.sevenDay).toBeUndefined();
});
it('bounds response bytes and keeps failed observations out of quota data', async () => {
  const f = fixture(); f.fetchImpl.mockResolvedValue(new Response('x'.repeat(65537)));
  await f.quota.refresh(); expect(f.quota.read().accounts[0].lastQuota).toBeNull();
});
it('preserves the measured-at time of the request start when the network is slow', async () => {
  const f = fixture(); f.fetchImpl.mockImplementation(async () => { f.advance(4000); return new Response(JSON.stringify(body)); });
  await f.quota.refresh(); expect(f.quota.read().accounts[0].lastQuota.measuredAt).toBe(new Date(at).toISOString());
});

it('replays the permitted justin-gmail OAuth response captured 2026-10-22T07:23:27.439Z', async () => {
  const bytes = readFileSync(new URL('./fixtures/claude-usage-2026-10-22.json', import.meta.url), 'utf8');
  const f = fixture(); f.fetchImpl.mockImplementation(async () => new Response(bytes));
  await f.quota.refresh();
  expect(f.quota.read().accounts[0].lastQuota).toMatchObject({ fiveHour: { utilizationPct: 2 }, sevenDay: { utilizationPct: 38 } });
  expect(f.quota.read().accounts[0].observation).toBe('measured');
});

it('a stalled request hits the deadline without blocking on a load burner', async () => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    f.fetchImpl.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Error('deadline')), { once: true });
    }));
    const pending = f.quota.refresh();
    await vi.advanceTimersByTimeAsync(8001); await pending;
    expect(f.fetchImpl).toHaveBeenCalledTimes(2);
    expect(f.quota.read().accounts.every(a => a.lastQuota === null)).toBe(true);
  } finally { vi.useRealTimers(); }
});
it('stop during a response prevents the next member read and prevents publishing new quota', async () => {
  const f = fixture();
  f.fetchImpl.mockImplementation(async () => { f.stop(); return new Response(JSON.stringify(body)); });
  await f.quota.refresh();
  expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  expect(f.quota.read().accounts.every(a => a.lastQuota === null)).toBe(true);
});

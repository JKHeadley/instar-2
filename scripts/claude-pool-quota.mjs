// Port of Instar 1.x QuotaPoller.mapUsageResponse/readUsage and SubscriptionPool's
// AccountQuotaSnapshot. Physical Claude adapter only: no model invocation, refresh-token
// exchange or credential persistence. 401/403 may mean insufficient telemetry scope,
// not a broken inference login (sign-in repair is a separate capability).
const ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';
const INTERVAL = 60_000, BREAKER = 30 * 60_000;
export function mapClaudeUsage(body, measuredAt) {
  const snapshot = { source: 'oauth-usage-endpoint-fallback', measuredAt: new Date(measuredAt).toISOString() };
  for (const [wire, field] of [['five_hour', 'fiveHour'], ['seven_day', 'sevenDay']]) {
    const window = body?.[wire];
    // Unlike 1.x's Number(undefined ?? 0), missing/partial windows stay unknown.
    if (typeof window?.utilization !== 'number' || !Number.isFinite(window.utilization)
      || window.utilization < 0 || window.utilization > 100 || typeof window.resets_at !== 'string'
      || !Number.isFinite(Date.parse(window.resets_at))) continue;
    snapshot[field] = { utilizationPct: window.utilization, resetsAt: window.resets_at };
  }
  return snapshot;
}
async function readBody(response) {
  const reader = response.body?.getReader();
  if (!reader) throw Error('no quota body');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 65_536 || chunks.length >= 1024) throw Error('quota body bound');
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}

/** At most eight reviewed members, one outstanding request, one read/member/minute.
 * Called by existing work/idle boundaries, not an independent polling daemon. Three
 * consecutive failures open a 30-minute breaker; retry remains a bounded half-open probe.
 * Caller supplies existing custody/admission and owner/stop/deadline checks. */
export function createClaudePoolQuota({ entries, now, stopped, validate, credential, fetchImpl = fetch }) {
  if (!entries.length || entries.length > 8) throw Error('quota member bound');
  const records = new Map(), attempts = new Map();
  let pending = null;
  const read = () => ({ version: 1, accounts: entries.map(entry => ({
    id: entry.usageAccount, email: entry.profile.expectedAccount, configHome: entry.profile.configDirectory,
    status: 'unknown', lastQuota: null, observation: 'not-read', ...records.get(entry.index),
  })) });
  const collect = async () => {
    for (const entry of entries) {
      if (stopped()) return;
      const start = now(), prior = attempts.get(entry.index);
      if (prior && start < prior.next) continue;
      let snapshot = null, observation = 'unavailable';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        await validate(entry);
        if (stopped()) return;
        const token = await credential(entry);
        if (stopped()) return;
        const response = await fetchImpl(ENDPOINT, { headers: {
          Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20', 'anthropic-version': '2023-06-01',
        }, redirect: 'error', signal: controller.signal });
        if (response.ok) {
          snapshot = mapClaudeUsage(await readBody(response), start);
          observation = snapshot.fiveHour && snapshot.sevenDay ? 'measured' : 'partial';
        } else {
          observation = `http-${response.status}`;
          await response.body?.cancel().catch(() => {});
        }
      } catch { /* Never include credential-bearing errors or response bodies in diagnostics. */ }
      finally { clearTimeout(timer); }
      if (stopped()) return;
      const failures = observation === 'measured' ? 0 : (prior?.failures ?? 0) + 1;
      attempts.set(entry.index, { failures, next: now() + (failures >= 3 ? BREAKER : INTERVAL * 2 ** Math.max(0, failures - 1)) });
      // A failure invalidates this observation; it never refreshes the age of old data.
      records.set(entry.index, { lastQuota: snapshot, observation, observedAt: start,
        status: observation === 'measured' ? 'active' : 'unknown' });
    }
  };
  return Object.freeze({ read, refresh() {
    if (!pending) pending = collect().finally(() => { pending = null; });
    return pending;
  } });
}

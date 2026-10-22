// Narrow port of Instar 1.x SubscriptionRelogin{Policy,Orchestrator,Service,Store},
// SubscriptionLoginLedger and FrameworkLoginDriver. Physical operations are supplied
// by the Claude adapter; this controller never accepts a helper's success claim.

/** 1.x captured terminal hard-wrap repair. Only the provider's HTTPS authorize
 * origins/path are accepted, never a URL supplied by arbitrary page prose. */
export function parseClaudeSigninUrl(text) {
  const lines = text.replace(/\x1b\[[0-9;]*[A-Za-z]/gu, '').split('\n');
  const start = lines.findIndex(line => /https:\/\//u.test(line));
  if (start < 0) return null;
  let joined = lines[start].trimEnd();
  for (let i = start + 1; i < lines.length && lines[i].trim() && !/\s/u.test(lines[i].trim()); i++) joined += lines[i].trim();
  const raw = joined.match(/https:\/\/[^\s<>"']+/u)?.[0];
  try {
    const url = new URL(raw);
    if (!['https://claude.ai', 'https://claude.com'].includes(url.origin)
      || !['/oauth/authorize', '/cai/oauth/authorize'].includes(url.pathname)
      || url.username || url.password || url.hash) return null;
    if (url.searchParams.get('response_type') !== 'code' || !url.searchParams.get('state')) return null;
    return url.href;
  } catch { return null; }
}

/** One browser attempt per observed incident. Interrupted browser work is re-observed,
 * never blindly replayed. The caller serializes the account's durable record. */
export async function repairHarnessSignin(ports) {
  let state = ports.read();
  const deadline = ports.now() + 600_000;
  const record = (phase, reason = phase) => {
    state = { ...state, phase, reason, updatedAt: ports.now(),
      events: [...(state?.events ?? []), { phase, reason, at: ports.now() }] };
    ports.write(state); // A failed durable write prevents the next effect.
    return state;
  };
  const guard = () => {
    if (ports.stopped() || !ports.current()) return record('stopped', 'stop-or-binding-withdrawn');
    if (ports.now() >= deadline)
      return record('waiting', 'repair-time-budget-exhausted');
    return null;
  };
  if (guard()) return state;
  if (state && ['refused', 'stopped'].includes(state.phase)) return state;
  if (!state || state.phase === 'succeeded') {
    const observed = await ports.inspect();
    if (guard()) return state;
    if (observed.kind === 'mismatch') {
      state = { version: 1, startedAt: ports.now(), source: observed.source ?? null, events: state?.events ?? [] };
      return record('refused', 'wrong-existing-identity');
    }
    if (observed.kind !== 'auth-refused') return { phase: observed.kind === 'healthy' ? 'healthy' : 'unknown' };
    if (state && state.source === (observed.source ?? null)) return state;
    state = { version: 1, startedAt: ports.now(), source: observed.source ?? null, events: state?.events ?? [] };
    record('detected', 'provider-auth-refused');
  }
  try {
    if (state.phase === 'detected' || state.phase === 'service-waiting') {
      if (guard()) return state;
      record(ports.externalRepair ? 'service-waiting' : 'browser-driving');
      const result = await ports.login();
      if (guard()) return state;
      if (result.kind === 'pending') return record('service-waiting', result.reason);
      if (result.kind === 'held') return record('service-waiting', result.reason);
      if (result.kind !== 'complete') return record('waiting', 'sign-in-unfinished');
    }
    // 1.x recoverUncertain: only credential observation can advance an interrupted
    // attempt. No new browser or CLI is started here, including after a crash.
    if (guard()) return state;
    record('identity-verifying');
    const identity = await ports.identity();
    if (guard()) return state;
    if (identity.kind === 'mismatch') return record('refused', 'wrong-identity');
    if (identity.kind !== 'match') return record('waiting', 'identity-unavailable');
    record('auth-verifying');
    const use = await ports.authenticatedUse();
    if (guard()) return state;
    if (use.kind !== 'verified') return record('waiting', 'authenticated-use-unavailable');
    record('promoting');
    const promoted = await ports.promote();
    if (guard()) return state;
    if (promoted) state = { ...state, expiresAt: promoted.expiresAt, credentialDigest: promoted.credentialDigest, reminders: promoted.reminders };
    return record('succeeded', 'identity-and-authenticated-use-verified');
  } catch {
    // Native CLI/keychain/fetch errors may contain credentials. Fixed tokens only.
    return record('waiting', 'repair-operation-unavailable');
  }
}

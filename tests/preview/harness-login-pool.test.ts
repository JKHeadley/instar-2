// @ts-nocheck -- host composition and real on-disk custody, without touching Shared or live runners.
import { afterEach, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarnessLoginPool, loadHarnessLogins, harnessQuotaLimit, observeHarnessSessionLimit, harnessPoolPreviouslyLaunched } from './harness-login-pool.mjs';
import { harnessGate, harnessLoginPath, migrateHarnessLogin, readHarnessLogin, storeHarnessLogin } from './harness-user.mjs';
import { createClaudePoolQuota } from '../../scripts/claude-pool-quota.mjs';
import { classifyProviderFailure } from '../../src/assembly/provider-failure.js';
import { loginOutageReply } from './journal.js';
import { openReplyNotices } from './credential-reminders.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const fresh = () => { const root = realpathSync(mkdtempSync(join(tmpdir(), 'harness-logins-'))); roots.push(root); return root; };
const profile = (name: string) => ({ reference: name, expectedAccount: `${name}@example.invalid`, organization: 'org', plan: 'max',
  home: `/profile/${name}/home`, configDirectory: `/profile/${name}/config`, workingDirectory: `/profile/${name}/work` });
function fixture(names = ['serving-a', 'serving-b'], changes = {}) {
  const root = fresh();
  const logins = names.map(name => {
    const path = join(root, `${name}.json`); writeFileSync(path, JSON.stringify(profile(name)));
    return { profile: path, activation: join(root, `${name}-activation.json`), authority: join(root, `${name}-authority.json`) };
  });
  const path = join(root, 'pool.json');
  const manifest = { version: 1, thresholdPercent: 95, logins, ...changes };
  writeFileSync(path, JSON.stringify(manifest));
  const options = { 'login-pool': path, 'harness-user': '_instarharness', 'login-profile': logins[0].profile, 'activation-record': logins[0].activation };
  const configuration = loadHarnessLogins(options);
  const checked = [], clock = { at: 1790308860000 };
  const settings = { configuration, statePath: join(root, 'selection.json'), now: () => clock.at,
    validate: (entry, tools) => checked.push([entry.profile.reference, tools]) };
  return { root, options, manifest, configuration, checked, clock, settings, pool: createHarnessLoginPool(settings) };
}
const limit = { state: 'uncertain', failure: { failureClass: 'limit', resetAt: null } };

it('replays the captured weekly limit: A fails, next call uses B, switch is durable and status-only (no reply line)', () => {
  const f = fixture(), calls = [];
  const a = f.pool.select(); calls.push(a.profile.reference);
  const stdout = readFileSync(new URL('../fixtures/provider-failure/claude-limit-result.json', import.meta.url), 'utf8');
  const failure = classifyProviderFailure({ stdout, code: 1, limited: false, now: f.clock.at });
  expect(failure.failureClass).toBe('limit');
  const result = { state: 'uncertain', bytes: null, failure };
  f.pool.observe(a, result);
  expect(result.state).toBe('uncertain'); // No retry or success laundering.
  expect(calls).toEqual(['serving-a']);
  const reopened = createHarnessLoginPool(f.settings);
  const b = reopened.select(); calls.push(b.profile.reference);
  reopened.observe(b, { state: 'complete', bytes: 'answer' });
  expect(reopened.select()).toBe(b);
  expect(calls).toEqual(['serving-a', 'serving-b']);
  expect(reopened.state.switches).toEqual([{ from: 'serving-a', to: 'serving-b', reason: 'provider-limit', at: f.clock.at, sequence: 1 }]);
  expect(JSON.parse(readFileSync(f.settings.statePath, 'utf8')).active).toBe(1);
  // stale-login-line-1107 (Rules 87/88): a successful switch needs no operator action, so no reply carries it;
  // it stays in durable history and on the status pull surface.
  expect(reopened.notices()).toEqual([]);
  expect(openReplyNotices([], reopened.notices(), 'turn:2')).toEqual([]);
  expect(reopened.status()).toContain(`Last switch: serving-a to serving-b, provider-limit, at ${f.clock.at}.`);
  expect(createHarnessLoginPool(f.settings).state.switches).toHaveLength(1);
});

// stale-login-line-1107: live reply on 11-07 carried this line about 36 hours after switch 28 of 11-05 19:43 PST.
const SWITCH_28 = Date.UTC(2026, 10, 6, 3, 43);
const LINE = 'The model login reached its configured usage threshold. I switched to the next approved login for this runner.';
const switchHistory = (f, count, last) => {
  const refs = ['serving-a', 'serving-b'];
  return { ...f.pool.state, active: count % 2, switches: Array.from({ length: count }, (_, index) => ({ from: refs[index % 2], to: refs[(index + 1) % 2],
    reason: 'usage-threshold', at: last - (count - 1 - index) * 3_600_000, sequence: index + 1 })) };
};

it('adds no reply line for a switch long ago, whether or not an old line was ever spent, and keeps old records unchanged', () => {
  const f = fixture();
  const old = switchHistory(f, 28, SWITCH_28);
  writeFileSync(f.settings.statePath, JSON.stringify(old));
  const pool = createHarnessLoginPool(f.settings);
  expect(pool.state).toEqual(old); // An old record loads as written; nothing is migrated.
  const key = sequence => `doorway:harness-login:${old.identity}:${sequence}`;
  // A reply went out after the switch and spent an older key from the backlog: switch 28 itself is still unspent.
  const turns = [{ id: 'after', intent: `Done.\n\n${LINE}`, sent: 700, sentAt: SWITCH_28 + 3_600_000, answerNotices: [{ key: key(27), line: LINE }] }];
  expect(openReplyNotices(turns, pool.notices(), 'task-on-11-07')).toEqual([]);
  expect(openReplyNotices([], pool.notices(), 'first-ever')).toEqual([]);
  expect(pool.status()).toContain(`Last switch: serving-b to serving-a, usage-threshold, at ${SWITCH_28}.`);
  expect(pool.state).toEqual(old);
});

it('adds no reply line for a fresh switch either, while switch history and status keep it', () => {
  const f = fixture();
  const old = switchHistory(f, 3, SWITCH_28);
  writeFileSync(f.settings.statePath, JSON.stringify(old));
  const pool = createHarnessLoginPool(f.settings);
  const before = [{ id: 'before', intent: 'Earlier.', sent: 1, sentAt: SWITCH_28 - 1 }];
  expect(openReplyNotices(before, pool.notices(), 'following')).toEqual([]);
  // A later switch is recorded as a new event, and still adds no line.
  writeFileSync(f.settings.statePath, JSON.stringify(switchHistory(f, 4, SWITCH_28 + 2)));
  const reopened = createHarnessLoginPool(f.settings);
  expect(reopened.state.switches.map(event => event.sequence)).toEqual([1, 2, 3, 4]);
  expect(openReplyNotices(before, reopened.notices(), 'later')).toEqual([]);
  expect(reopened.status()).toContain(`Last switch: serving-b to serving-a, usage-threshold, at ${SWITCH_28 + 2}.`);
});

it('replays the recorded live replies that each repeated the line: none of them is offered it now', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/session-result-notice-969390679.json', import.meta.url), 'utf8'));
  const carrying = capture.neighbors.filter(turn => turn.intent.includes(LINE));
  expect(carrying.map(turn => turn.update)).toEqual([969390675, 969390676, 969390677, 969390678]);
  const f = fixture();
  writeFileSync(f.settings.statePath, JSON.stringify(switchHistory(f, 4, carrying[0].at + 1)));
  const pool = createHarnessLoginPool(f.settings);
  expect(carrying.map((turn, index) => openReplyNotices(carrying.slice(0, index), pool.notices(), turn.id).length)).toEqual([0, 0, 0, 0]);
});

it('binds every custody record to its profile reference, account, org and plan, with no singleton fallback', () => {
  const root = fresh(), a = profile('serving'), b = profile('proofroom');
  const tokenA = 'sk-ant-oat01-synthetic-serving-only', tokenB = 'sk-ant-oat01-synthetic-proof-only';
  const pathA = harnessLoginPath(a, root), pathB = harnessLoginPath(b, root);
  storeHarnessLogin(a, tokenA, pathA); storeHarnessLogin(b, tokenB, pathB);
  expect(readHarnessLogin(a, pathA)).toBe(tokenA); expect(readHarnessLogin(b, pathB)).toBe(tokenB);
  for (const altered of [{ ...a, reference: 'other' }, { ...a, expectedAccount: b.expectedAccount },
    { ...a, organization: 'elsewhere' }, { ...a, plan: 'pro' }])
    expect(() => readHarnessLogin(altered, pathA)).toThrow(/another account/);
  expect(() => harnessLoginPath({ reference: '../serving' }, root)).toThrow(/reference/);
  storeHarnessLogin(b, tokenB, join(root, 'login.json'));
  rmSync(pathB);
  expect(() => readHarnessLogin(b, harnessLoginPath(b, root))).toThrow(/ENOENT/);
});

const legacyCustody = () => {
  const root = fresh(), selected = profile('installed'), token = 'sk-ant-oat01-synthetic-installed-only';
  const legacy = join(root, 'login.json');
  writeFileSync(legacy, JSON.stringify({ v: 1, token, account: selected.expectedAccount,
    organization: selected.organization, plan: selected.plan }), { mode: 0o600 });
  return { root, selected, token, legacy, target: harnessLoginPath(selected, root) };
};

it('migrates legacy single-login custody once, preserves the old bytes and binds dispatch to the profile', () => {
  const f = legacyCustody(), before = readFileSync(f.legacy);
  expect(() => readHarnessLogin(f.selected, f.target)).toThrow(/ENOENT/);
  expect(migrateHarnessLogin(f.selected, f.root)).toBe(true);
  expect(readHarnessLogin(f.selected, f.target)).toBe(f.token);
  expect(readFileSync(f.legacy)).toEqual(before);
  expect(migrateHarnessLogin(f.selected, f.root)).toBe(false);
  expect(() => readHarnessLogin({ ...f.selected, reference: 'other' }, f.target)).toThrow(/another account/);
});

it.each(['expectedAccount', 'organization', 'plan', 'reference'])('refuses legacy identity mismatch: %s', field => {
  const f = legacyCustody();
  if (field === 'reference') {
    const record = JSON.parse(readFileSync(f.legacy, 'utf8'));
    writeFileSync(f.legacy, JSON.stringify({ ...record, reference: 'another-profile' }));
  } else f.selected[field] = 'another';
  expect(() => migrateHarnessLogin(f.selected, f.root)).toThrow(/another account/);
  expect(existsSync(f.target)).toBe(false);
});

it.each(['directory-mode', 'file-mode', 'link', 'malformed', 'missing'])('refuses unsafe legacy custody: %s', shape => {
  const f = legacyCustody();
  if (shape === 'directory-mode') chmodSync(f.root, 0o755);
  if (shape === 'file-mode') chmodSync(f.legacy, 0o644);
  if (shape === 'link') { const source = join(f.root, 'token.json'); writeFileSync(source, readFileSync(f.legacy)); rmSync(f.legacy); symlinkSync(source, f.legacy); }
  if (shape === 'malformed') writeFileSync(f.legacy, '{}');
  if (shape === 'missing') rmSync(f.legacy);
  expect(() => migrateHarnessLogin(f.selected, f.root)).toThrow();
  expect(existsSync(f.target)).toBe(false);
});

it.each(['valid', 'malformed', 'dangling-link'])('never replaces existing profile custody: %s', shape => {
  const f = legacyCustody();
  if (shape === 'valid') storeHarnessLogin(f.selected, 'sk-ant-oat01-synthetic-newer-login', f.target);
  if (shape === 'malformed') writeFileSync(f.target, '{}', { mode: 0o600 });
  if (shape === 'dangling-link') symlinkSync(join(f.root, 'missing'), f.target);
  expect(migrateHarnessLogin(f.selected, f.root)).toBe(false);
  if (shape === 'valid') expect(readHarnessLogin(f.selected, f.target)).toBe('sk-ant-oat01-synthetic-newer-login');
  else expect(() => readHarnessLogin(f.selected, f.target)).toThrow();
});

it.each([true, false])('readiness migrates only an explicitly enabled single-login runner: %s', migrateLegacy => {
  const f = legacyCustody();
  const gate = harnessGate({ profile: f.selected, denied: [], clock: () => 1, runner: () => 'fixture', migrateLegacy,
    migrate: p => migrateHarnessLogin(p, f.root), login: p => readHarnessLogin(p, f.target),
    check: ({ profile: p }) => { try { readHarnessLogin(p, f.target); return { ready: true }; } catch { return { ready: false, reason: 'missing login' }; } } });
  expect(gate.state.ready).toBe(migrateLegacy);
  if (migrateLegacy) expect(gate.current().login()).toBe(f.token);
  else expect(() => gate.current()).toThrow();
});

it('a proof-room call only opens the proof-room custody, even when serving is exhausted', () => {
  const serving = fixture(), proof = fixture(['proofroom-2']), touched = [];
  serving.pool.observe(serving.pool.select(), limit);
  const selected = proof.pool.select();
  const path = harnessLoginPath(selected.profile, proof.root);
  storeHarnessLogin(selected.profile, 'sk-ant-oat01-synthetic-proofroom-2', path);
  const call = entry => { touched.push(entry.profile.reference); return readHarnessLogin(entry.profile, harnessLoginPath(entry.profile, proof.root)); };
  expect(call(selected)).toContain('proofroom-2');
  expect(touched).toEqual(['proofroom-2']);
  expect(proof.pool.state.switches).toEqual([]);
  proof.pool.observe(selected, limit);
  expect(() => proof.pool.select()).toThrow(/no reviewed login/);
  expect(touched).toEqual(['proofroom-2']);
});

it('never chooses an unlisted or withdrawn account and never consults custody after all reviewed capacity is exhausted', () => {
  const f = fixture();
  expect(() => f.pool.observe({ index: 0, profile: profile('outside') }, limit)).toThrow(/unreviewed/);
  f.pool.observe(f.pool.select(), limit);
  const refused = createHarnessLoginPool({ ...f.settings, validate: entry => { if (entry.index === 1) throw Error('activation withdrawn'); } });
  expect(() => refused.select()).toThrow('activation withdrawn');
  expect(refused.state.switches).toEqual([]);
  f.pool.observe(f.pool.select(), limit);
  expect(() => f.pool.select()).toThrow(/no reviewed login/);
  expect(f.pool.state.switches).toHaveLength(1);
});

it('at the configured quota threshold switches before dispatch; below, stale or another account reading does not', () => {
  const f = fixture(), a = f.configuration.entries[0].profile;
  const document = (percent = 95, extra = {}) => ({ version: 1, accounts: [{ email: a.expectedAccount, configHome: a.configDirectory,
    lastQuota: { measuredAt: new Date(f.clock.at).toISOString(), fiveHour: { utilizationPct: percent,
      resetsAt: new Date(f.clock.at + 1000).toISOString() } }, ...extra }] });
  expect(harnessQuotaLimit(document(94.99), a, 95, f.clock.at)).toBeNull();
  expect(harnessQuotaLimit(document(), a, 95, f.clock.at)).toMatchObject({ reason: 'usage-threshold' });
  expect(harnessQuotaLimit(document(95, { email: 'outside@example.invalid' }), a, 95, f.clock.at)).toBeNull();
  expect(harnessQuotaLimit(document(95, { configHome: '/another/config' }), a, 95, f.clock.at)).toBeNull();
  expect(harnessQuotaLimit(document(), a, 95, f.clock.at + 300001)).toBeNull();
  const originalHome = document(95, { id: 'reviewed-account', configHome: '/pool/original/config' });
  expect(harnessQuotaLimit(originalHome, a, 95, f.clock.at, 'reviewed-account')).not.toBeNull();
  expect(harnessQuotaLimit(originalHome, a, 95, f.clock.at, 'unreviewed-account')).toBeNull();
  originalHome.accounts[0].identityDrifted = true;
  expect(harnessQuotaLimit(originalHome, a, 95, f.clock.at, 'reviewed-account')).toBeNull();
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => ({ version: 1, accounts: [...document().accounts, capacity(f).accounts[1]] }) });
  expect(pool.select().index).toBe(1);
  expect(pool.state.switches[0].reason).toBe('usage-threshold');
  // Once A's observed window resets, exhausted B can select A again without widening the list.
  pool.observe(pool.select(), limit); f.clock.at += 1001;
  expect(createHarnessLoginPool(f.settings).select().index).toBe(0);
});

const capacity = (f, measuredAt = f.clock.at) => ({ version: 1, accounts: f.configuration.entries.map(({ profile }) => ({
  email: profile.expectedAccount, configHome: profile.configDirectory,
  lastQuota: { measuredAt: new Date(measuredAt).toISOString(),
    fiveHour: { utilizationPct: 0, resetsAt: new Date(f.clock.at + 5 * 3600_000).toISOString() },
    sevenDay: { utilizationPct: 0, resetsAt: new Date(f.clock.at + 7 * 86400_000).toISOString() } },
})) });
it('admits a fresh 1.x weekly-only fallback without a 2.0 marker', () => {
  const f = fixture();
  const reading = capacity(f);
  reading.accounts[0].lastQuota.sevenDay.utilizationPct = 99;
  delete reading.accounts[1].lastQuota.fiveHour;
  reading.accounts[1].lastQuota.sevenDay.utilizationPct = 8;
  const weeklyOnly = createHarnessLoginPool({ ...f.settings, usage: () => reading });
  expect(weeklyOnly.selectSession(0)?.index).toBe(1);
  expect(weeklyOnly.status()).toContain('five-hour unreported');
  reading.accounts[1].lastQuota.sevenDay.utilizationPct = 80;
  expect(weeklyOnly.selectSession(0)).toBeNull();
  reading.accounts[1].lastQuota.sevenDay.utilizationPct = 8;
  reading.accounts[1].lastQuota.measuredAt = new Date(f.clock.at - 300001).toISOString();
  expect(weeklyOnly.selectSession(0)).toBeNull();
});
it('uses the 1.x weekly snapshot when the live quota endpoint has no reading', () => {
  const f = fixture(); const fallback = capacity(f);
  fallback.accounts[0].lastQuota.sevenDay.utilizationPct = 99;
  delete fallback.accounts[1].lastQuota.fiveHour;
  fallback.accounts[1].lastQuota.sevenDay.utilizationPct = 11;
  const live = { version: 1, accounts: f.configuration.entries.map(({ profile }) => ({
    email: profile.expectedAccount, configHome: profile.configDirectory,
    status: 'unknown', lastQuota: null,
  })) };
  const pool = createHarnessLoginPool({ ...f.settings, quotaReader: { read: () => live }, usage: () => fallback });
  expect(pool.selectSession(0)?.index).toBe(1);
});
it('uses weekly-only capacity but refuses an active scoped weekly cap', () => {
  const f = fixture(); const reading = capacity(f);
  reading.accounts[0].lastQuota.sevenDay.utilizationPct = 99;
  const target = reading.accounts[1].lastQuota;
  delete target.fiveHour; target.fiveHourUnreported = true; target.sevenDay.utilizationPct = 9;
  target.scopedWeekly = [{ utilizationPct: 100, resetsAt: target.sevenDay.resetsAt, model: 'claude-opus-5-5' }];
  expect(createHarnessLoginPool({ ...f.settings, usage: () => reading }).selectSession(0)).toBeNull();
});
it('does not erase an unknown provider refusal from weekly-only telemetry', () => {
  const f = fixture(['serving-a']); const entry = f.pool.select();
  f.pool.observe(entry, { failure: { failureClass: 'limit' } });
  const reading = capacity(f); const q = reading.accounts[0].lastQuota;
  delete q.fiveHour; q.fiveHourUnreported = true; q.sevenDay.utilizationPct = 9;
  f.clock.at += 1000; q.measuredAt = new Date(f.clock.at).toISOString();
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => reading });
  expect(() => pool.select()).toThrow(/no reviewed login/);
  expect(pool.state.holds[0].reason).toBe('provider-limit');
});
it('rejects contradictory unreported and malformed short-window snapshots', () => {
  const f = fixture(); const reading = capacity(f);
  reading.accounts[0].lastQuota.sevenDay.utilizationPct = 99;
  const q = reading.accounts[1].lastQuota;
  q.fiveHourUnreported = true; q.fiveHour = { utilizationPct: -1, resetsAt: q.sevenDay.resetsAt };
  expect(createHarnessLoginPool({ ...f.settings, usage: () => reading }).selectSession(0)).toBeNull();
});
const exhaustSessions = pool => {
  const observation = { kind: 'Success', value: { phase: 'pause-observed', detail: 'rate-limited' } };
  for (let n = 0; n < 2; n++) expect(observeHarnessSessionLimit(pool, pool.select('session'), observation)).toBe(observation);
  expect(() => pool.select('session')).toThrow(/no reviewed login/);
};

it.each([false, true])('recovers both unknown session holds from newer complete capacity and persists it (reopened=%s)', reopened => {
  const f = fixture(); let reading = null;
  let pool = createHarnessLoginPool({ ...f.settings, usage: () => reading });
  exhaustSessions(pool);
  f.clock.at += 8 * 86400_000;
  reading = capacity(f);
  if (reopened) pool = createHarnessLoginPool({ ...f.settings, usage: () => reading });
  expect(pool.select('session').index).toBe(1);
  expect(f.checked.at(-1)).toEqual(['serving-b', 'session']);
  expect(pool.state.holds).toEqual({});
  expect(createHarnessLoginPool(f.settings).state.holds).toEqual({});
  // A new limit still holds: the same pre-limit measurement cannot release it again.
  pool.observe(pool.select(), limit);
  expect(pool.select().index).toBe(0);
  expect(pool.state.holds[1].resetAt).toBeNull();
});

it.each(['stale', 'same-time', 'future', 'partial', 'malformed-window', 'expired-reset', 'wrong-email', 'wrong-home', 'drifted', 'duplicate', 'weekly-exhausted'])(
  'preserves unknown holds when capacity evidence is %s', kind => {
    const f = fixture(); exhaustSessions(f.pool); const heldAt = f.clock.at;
    f.clock.at += 1000; const reading = capacity(f);
    for (const row of reading.accounts) {
      if (kind === 'stale') row.lastQuota.measuredAt = new Date(f.clock.at - 300001).toISOString();
      if (kind === 'same-time') row.lastQuota.measuredAt = new Date(heldAt).toISOString();
      if (kind === 'future') row.lastQuota.measuredAt = new Date(f.clock.at + 1).toISOString();
      if (kind === 'partial') delete row.lastQuota.sevenDay;
      if (kind === 'malformed-window') row.lastQuota.sevenDay.utilizationPct = -1;
      if (kind === 'expired-reset') row.lastQuota.sevenDay.resetsAt = new Date(f.clock.at).toISOString();
      if (kind === 'wrong-email') row.email = 'other@example.invalid';
      if (kind === 'wrong-home') row.configHome = '/elsewhere';
      if (kind === 'drifted') row.identityDrifted = true;
      if (kind === 'weekly-exhausted') row.lastQuota.sevenDay.utilizationPct = 95;
    }
    if (kind === 'duplicate') reading.accounts.push(...structuredClone(reading.accounts));
    const pool = createHarnessLoginPool({ ...f.settings, usage: () => reading });
    expect(() => pool.select()).toThrow(/no reviewed login/);
    expect(Object.values(pool.state.holds).every(hold => hold.resetAt === null)).toBe(true);
    expect(() => createHarnessLoginPool(f.settings).select()).toThrow(/no reviewed login/);
  });

it('complete low readings preserve an active known weekly hold; legacy unknown holds recover after a durable freshness boundary', () => {
  const f = fixture(['serving-a']); const a = f.pool.select();
  f.pool.observe(a, { failure: { failureClass: 'limit', resetAt: f.clock.at + 7 * 86400_000 } });
  f.clock.at += 1000;
  expect(() => createHarnessLoginPool({ ...f.settings, usage: () => capacity(f) }).select()).toThrow(/no reviewed login/);
  const legacy = f.pool.state; legacy.holds[0] = { reason: 'provider-limit', resetAt: null };
  writeFileSync(f.settings.statePath, JSON.stringify(legacy));
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => capacity(f) });
  expect(() => pool.select()).toThrow(/no reviewed login/);
  expect(createHarnessLoginPool(f.settings).state.holds[0].observedAt).toBe(f.clock.at);
  f.clock.at += 1000;
  expect(createHarnessLoginPool({ ...f.settings, usage: () => capacity(f) }).select().index).toBe(0);
});

it.each([null, false, 42, 'row', [], {}, { email: 'serving-a@example.invalid', lastQuota: null }])(
  'malformed optional quota rows are unavailable and preserve existing holds: %j', row => {
    const f = fixture(); const settings = { ...f.settings, usage: () => ({ version: 1, accounts: [row] }) };
    expect(createHarnessLoginPool(settings).select().index).toBe(0);
    f.pool.observe(f.pool.select(), limit);
    const pool = createHarnessLoginPool(settings);
    expect(pool.select().index).toBe(1);
    expect(pool.state.holds).toEqual(f.pool.state.holds);
    pool.observe(pool.select(), limit);
    expect(() => pool.select()).toThrow(/no reviewed login/);
  });

it('quota unavailability never swallows authority failures and recovery never swallows persistence failures', () => {
  const f = fixture(['serving-a']);
  expect(createHarnessLoginPool({ ...f.settings, usage: () => { throw Error('reader failed'); } }).select().index).toBe(0);
  expect(() => createHarnessLoginPool({ ...f.settings, usage: () => ({ version: 1, accounts: [null] }),
    validate: () => { throw Error('activation withdrawn'); } }).select()).toThrow('activation withdrawn');
  f.pool.observe(f.pool.select(), limit); f.clock.at += 1000;
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => capacity(f), write: () => { throw Error('disk unavailable'); } });
  expect(() => pool.select()).toThrow('disk unavailable');
  expect(pool.state.holds).toEqual(f.pool.state.holds);
  expect(createHarnessLoginPool(f.settings).state.holds).toEqual(f.pool.state.holds);
  expect(() => createHarnessLoginPool({ ...f.settings, usage: () => capacity(f),
    validate: () => { throw Error('stop active'); } }).select()).toThrow('stop active');
});

it('transport, policy, local timeout, uncertain judgment and empty answers do not exhaust a login', () => {
  const f = fixture(), selected = f.pool.select();
  for (const failureClass of ['timeout', 'transport', 'policy', 'unknown']) f.pool.observe(selected, { state: 'uncertain', failure: { failureClass } });
  for (const state of ['uncertain', 'rejected', 'complete']) f.pool.observe(selected, { state, bytes: '' });
  expect(f.pool.select()).toBe(selected); expect(f.pool.notices()).toEqual([]);
});

it('a short quota window cannot shorten a provider weekly hold or clear an unknown reset', () => {
  for (const resetAt of [null, 1790308860000 + 7000]) {
    const f = fixture(), a = f.pool.select();
    f.pool.observe(a, { failure: { failureClass: 'limit', resetAt } });
    const pool = createHarnessLoginPool({ ...f.settings, usage: () => ({ version: 1, accounts: [{
      email: a.profile.expectedAccount, configHome: a.profile.configDirectory,
      lastQuota: { measuredAt: new Date(f.clock.at).toISOString(), fiveHour: {
        utilizationPct: 99, resetsAt: new Date(f.clock.at + 1000).toISOString() } },
    }] }) });
    const b = pool.select(); expect(b.index).toBe(1);
    expect(pool.state.holds[0]).toMatchObject({ reason: 'provider-limit', resetAt });
    pool.observe(b, limit); f.clock.at += 1001;
    expect(() => createHarnessLoginPool(f.settings).select()).toThrow(/no reviewed login/);
    f.clock.at += 7000;
    if (resetAt === null) expect(() => createHarnessLoginPool(f.settings).select()).toThrow(/no reviewed login/);
    else expect(createHarnessLoginPool(f.settings).select().index).toBe(0);
  }
});

it('rejects changed manifests, corrupted state and duplicate accounts/config homes; a failed durable write never switches', () => {
  const f = fixture();
  f.pool.observe(f.pool.select(), limit);
  const failed = createHarnessLoginPool({ ...f.settings, write: () => { throw Error('disk unavailable'); } });
  expect(() => failed.select()).toThrow('disk unavailable'); expect(failed.state.active).toBe(0);
  writeFileSync(f.options['login-pool'], JSON.stringify({ ...f.manifest, thresholdPercent: 90 }));
  expect(() => f.pool.select()).toThrow(/manifest changed/);
  writeFileSync(f.settings.statePath, '{'); expect(() => createHarnessLoginPool(f.settings)).toThrow();
  const duplicate = fixture();
  writeFileSync(duplicate.manifest.logins[1].profile, JSON.stringify({ ...profile('serving-b'), expectedAccount: 'serving-a@example.invalid' }));
  expect(() => loadHarnessLogins(duplicate.options)).toThrow(/duplicates expectedAccount/);
  for (const thresholdPercent of [0, 101, '95']) expect(() => fixture(['a', 'b'], { thresholdPercent })).toThrow(/threshold/);
});

it('replays recorded summary/Jev/review/delivered/empty-context shapes unchanged through selection after a real limit', () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  expect(corpus.otherShapes.map(row => row.kind)).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided',
    'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  const stdout = readFileSync(new URL('../fixtures/provider-failure/claude-limit-result.json', import.meta.url), 'utf8');
  for (const row of corpus.otherShapes) {
    const installed = legacyCustody();
    expect(migrateHarnessLogin(installed.selected, installed.root), row.id).toBe(true);
    expect(readHarnessLogin(installed.selected, installed.target), row.id).toBe(installed.token);
    const f = fixture();
    f.pool.observe(f.pool.select(), { state: 'rejected', failure: classifyProviderFailure({ code: 1, limited: false, stdout, now: f.clock.at }) });
    f.pool.observe(f.pool.select(), limit);
    f.clock.at += 8 * 86400_000;
    writeFileSync(f.settings.statePath, JSON.stringify({ ...f.pool.state, identity: f.configuration.legacyIdentity }));
    const recovered = createHarnessLoginPool({ ...f.settings, usage: () => capacity(f) });
    expect(recovered.state.migrations, row.id).toHaveLength(1);
    const next = recovered.select(); expect(next.profile.reference, row.kind).toBe('serving-b');
    expect(recovered.state.holds).toEqual({});
    // The pool has no judgment parser: recorded uncertainty is not provider capacity evidence.
    const returned = { state: row.kind === 'summary-uncertain' ? 'uncertain' : 'complete', bytes: row.raw };
    const before = JSON.stringify(returned);
    recovered.observe(next, returned);
    expect(JSON.stringify(returned), row.id).toBe(before);
    expect(recovered.select()).toBe(next); expect(recovered.state.switches).toHaveLength(1);
    const soft = fixture(); let reading = capacity(soft);
    for (const account of reading.accounts) account.lastQuota.fiveHour.utilizationPct = 80;
    const continuing = createHarnessLoginPool({ ...soft.settings, usage: () => reading });
    expect(continuing.selectSession(0)?.index, row.id).toBe(0);
    reading = null; soft.clock.at += 60000;
    const current = continuing.selectSession(0);
    expect(current?.index, row.id).toBe(0);
    continuing.observe(current, returned);
    expect(JSON.stringify(returned), row.id).toBe(before);
    expect(continuing.state.holds, row.id).toEqual({});
    expect(continuing.state.handoffAttempts ?? [], row.id).toEqual([]);
  }
});

it('a delegated session rate-limit observation selects B for the next step; other pauses do not', () => {
  const f = fixture(), a = f.pool.select('session');
  for (const observation of [{ kind: 'Refused' }, { kind: 'Success', value: { phase: 'launched', detail: 'rate-limited' } },
    { kind: 'Success', value: { phase: 'pause-observed', detail: 'context-wedge' } },
    { kind: 'Success', value: { phase: 'pause-observed', detail: 'provider-throttled' } }]) {
    expect(observeHarnessSessionLimit(f.pool, a, observation)).toBe(observation);
    expect(f.pool.select('session')).toBe(a);
  }
  const limited = { kind: 'Success', value: { phase: 'pause-observed', detail: 'rate-limited' } };
  expect(observeHarnessSessionLimit(f.pool, a, limited)).toBe(limited);
  expect(f.pool.select('session').profile.reference).toBe('serving-b');
  expect(f.checked.at(-1)).toEqual(['serving-b', 'session']);
});

it('the existing launch log detects a deleted pool sidecar instead of retrying A and reissuing notices', () => {
  const f = fixture(), runs = join(f.root, 'runs.jsonl');
  expect(harnessPoolPreviouslyLaunched(runs, f.configuration.identity)).toBe(false);
  writeFileSync(runs, JSON.stringify({ v: 1, launch: 1, pid: 1, harnessLoginPool: f.configuration.identity }) + '\n');
  expect(harnessPoolPreviouslyLaunched(runs, f.configuration.identity)).toBe(true);
  expect(harnessPoolPreviouslyLaunched(runs, 'another-configuration')).toBe(false);
  rmSync(f.settings.statePath);
  expect(() => createHarnessLoginPool({ ...f.settings, previouslyLaunched: () => harnessPoolPreviouslyLaunched(runs, f.configuration.identity) }))
    .toThrow(/state was lost/);
  writeFileSync(runs, '{'); expect(() => harnessPoolPreviouslyLaunched(runs, f.configuration.identity)).toThrow(/unreadable/);
});

it('build B keeps build A selection, holds, history and spent notice keys with different record paths', () => {
  const f = fixture();
  f.pool.observe(f.pool.select(), limit); f.pool.select();
  const before = f.pool.state, notices = f.pool.notices();
  const next = join(f.root, 'build-b.json');
  writeFileSync(next, JSON.stringify({ ...f.manifest, logins: f.manifest.logins.map(row => ({ ...row,
    activation: `${row.activation}-build-b`, authority: `${row.authority}-build-b` })) }));
  const configuration = loadHarnessLogins({ ...f.options, 'login-pool': next,
    'activation-record': `${f.manifest.logins[0].activation}-build-b` });
  expect(configuration.identity).toBe(f.configuration.identity);
  const reopened = createHarnessLoginPool({ ...f.settings, configuration });
  expect(reopened.state).toEqual(before); expect(reopened.notices()).toEqual(notices);
  expect(openReplyNotices([{ id: 'sent', answerNotices: notices, sent: 2 }], reopened.notices(), 'next')).toEqual([]);
});

it.each([false, true])('adopts old path-hashed state losslessly, keeping its historic notice identity (new paths=%s)', newPaths => {
  const f = fixture(); f.pool.observe(f.pool.select(), limit); f.pool.select();
  const old = { ...f.pool.state, identity: f.configuration.legacyIdentity };
  writeFileSync(f.settings.statePath, JSON.stringify(old));
  let configuration = f.configuration;
  if (newPaths) {
    const next = join(f.root, 'new-build.json');
    writeFileSync(next, JSON.stringify({ ...f.manifest, previousManifest: f.options['login-pool'],
      logins: f.manifest.logins.map(row => ({ ...row, activation: `${row.activation}-new`, authority: `${row.authority}-new` })) }));
    configuration = loadHarnessLogins({ ...f.options, 'login-pool': next, 'activation-record': `${f.manifest.logins[0].activation}-new` });
  }
  const pool = createHarnessLoginPool({ ...f.settings, configuration });
  expect(pool.state).toMatchObject({ active: old.active, holds: old.holds, switches: old.switches,
    identity: configuration.identity, noticeIdentity: old.identity });
  expect(pool.state.migrations).toHaveLength(1);
  expect(pool.notices()).toEqual([]); // stale-login-line-1107: an adopted switch adds no reply line either.
  expect(createHarnessLoginPool({ ...f.settings, configuration }).state).toEqual(pool.state);
});

it('refuses a real ordered member change and an unproven legacy identity without writing state', () => {
  const f = fixture(); const before = readFileSync(f.settings.statePath, 'utf8');
  const changed = fixture(['serving-a', 'different-account']);
  expect(() => createHarnessLoginPool({ ...f.settings, configuration: changed.configuration })).toThrow(/state differs/);
  expect(readFileSync(f.settings.statePath, 'utf8')).toBe(before);
  writeFileSync(f.settings.statePath, JSON.stringify({ ...f.pool.state, identity: 'unknown-old-hash' }));
  expect(() => createHarnessLoginPool(f.settings)).toThrow(/state differs/);
});

it('excludes an unavailable member without renumbering holds/history, records one notice and reports stale quota honestly', () => {
  const f = fixture(); f.pool.observe(f.pool.select(), limit); f.pool.select();
  const pool = createHarnessLoginPool({ ...f.settings, unavailable: new Map([[1, 'missing authority']]) });
  expect(pool.state.active).toBe(1); expect(pool.state.holds).toEqual(f.pool.state.holds);
  expect(() => pool.select()).toThrow(/no reviewed login/);
  expect(pool.status()).toContain('serving-b (active); unavailable (missing authority)');
  expect(pool.status()).toContain('switching only after a typed limit reply');
  expect(pool.status()).toContain('Last switch: serving-a to serving-b, provider-limit');
  // reply-noise-1108: login 1 is unavailable but login 0 is only on a timed hold, which the outage notice tells; the
  // exclusion itself and the earlier successful switch add no reply line. Status keeps both.
  expect(pool.notices()).toEqual([]);
  f.clock.at += 1;
  const reading = capacity(f);
  const recovered = createHarnessLoginPool({ ...f.settings, usage: () => reading });
  expect(recovered.status()).toContain('fresh usage, switches at 80%');
});

it('a threshold observed while A is in flight affects only the next dispatch, with one result per accepted message', async () => {
  const f = fixture(); let reading = capacity(f), finish;
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => reading });
  const delivered = [], dispatched = [];
  const dispatch = async (id, wait) => {
    const selected = pool.select(); dispatched.push([id, selected.profile.reference]);
    await wait;
    pool.observe(selected, { state: 'complete', bytes: id });
    delivered.push([id, selected.profile.reference]);
  };
  const first = dispatch('message-1', new Promise(resolve => { finish = resolve; }));
  reading.accounts[0].lastQuota.fiveHour.utilizationPct = 95;
  await dispatch('message-2', Promise.resolve());
  finish(); await first;
  expect(dispatched).toEqual([['message-1', 'serving-a'], ['message-2', 'serving-b']]);
  expect(delivered).toEqual([['message-2', 'serving-b'], ['message-1', 'serving-a']]);
  expect(pool.state.switches).toHaveLength(1);
  expect(pool.state.switches[0].reason).toBe('usage-threshold');
});


it('retained admission profiles cannot replace live profiles for dispatchable members', () => {
  const f = fixture();
  const retained = { ...f.manifest, logins: f.manifest.logins.map(row => ({ ...row,
    admittedProfile: JSON.parse(readFileSync(row.profile, 'utf8')) })) };
  writeFileSync(f.options['login-pool'], JSON.stringify(retained));
  expect(loadHarnessLogins(f.options).identity).toBe(f.configuration.identity);
  rmSync(retained.logins[1].profile);
  expect(() => loadHarnessLogins(f.options)).toThrow(/ENOENT/);
  retained.logins[1].unavailable = 'profile missing';
  writeFileSync(f.options['login-pool'], JSON.stringify(retained));
  expect(loadHarnessLogins(f.options).identity).toBe(f.configuration.identity);
});

// R36: the snapshot comes from the recorded 1.x endpoint; mutations below are
// explicit boundary neighbors, never represented as additional live captures.
it.each(['fiveHour', 'sevenDay'])('ports the 1.x lag-aware 80% ceiling before the old 95% wall (%s)', window => {
  const f = fixture();
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/pool-quota-2026-10-21.json', import.meta.url), 'utf8'));
  f.clock.at = Date.parse(recorded.snapshot.measuredAt);
  let pct = 79.99;
  const usage = () => ({ version: 1, accounts: f.configuration.entries.map((entry, index) => ({
    email: entry.profile.expectedAccount, configHome: entry.profile.configDirectory,
    lastQuota: { ...recorded.snapshot, [window]: { ...recorded.snapshot[window], utilizationPct: index === 0 ? pct : 20 } },
  })) });
  const pool = createHarnessLoginPool({ ...f.settings, usage });
  expect(pool.selectSession(0).index).toBe(0);
  pct = 80;
  expect(pool.selectSession(0).index).toBe(1);
  expect(pool.state.handoffAttempts).toHaveLength(1);
  expect(pool.state.switches).toHaveLength(0); // Prepared is not completed.
});

it.each([65, 65.01, 79, null])('requires the 1.x destination headroom; all-hot stays on a still-usable source (target=%s)', target => {
  const f = fixture(); let source = 80;
  const reading = () => ({ version: 1, accounts: capacity(f).accounts.map((account, index) => ({ ...account,
    lastQuota: index === 1 && target === null ? null : { ...account.lastQuota,
      fiveHour: { ...account.lastQuota.fiveHour, utilizationPct: index === 0 ? source : target },
      sevenDay: { ...account.lastQuota.sevenDay, utilizationPct: index === 0 ? source : target } },
  })) });
  const pool = createHarnessLoginPool({ ...f.settings, usage: reading });
  expect(pool.selectSession(0)?.index).toBe(target === 65 ? 1 : 0);
  if (target !== 65) {
    expect(pool.state.handoffAttempts ?? []).toHaveLength(0);
    source = 95; expect(pool.selectSession(0)).toBeNull();
    pool.observe(f.configuration.entries[0], limit); source = 10;
    expect(pool.selectSession(0)).toBeNull(); // Unknown provider hold never becomes an all-hot exception.
  }
});

it.each(['http-500', 'stale'])('soft all-hot pressure preserves current dispatch after %s telemetry', async failure => {
  const f = fixture(); let failing = false, calls = 0;
  const reader = createClaudePoolQuota({ entries: f.configuration.entries, now: f.settings.now,
    stopped: () => false, validate: () => {}, credential: () => 'synthetic-quota-only',
    fetchImpl: async () => {
      calls++;
      return failing ? new Response('', { status: 500 }) : new Response(JSON.stringify({
        five_hour: { utilization: 80, resets_at: new Date(f.clock.at + 3600000).toISOString() },
        seven_day: { utilization: 80, resets_at: new Date(f.clock.at + 86400000).toISOString() },
      }));
    } });
  const settings = { ...f.settings, quotaReader: reader };
  const pool = createHarnessLoginPool(settings);
  await pool.refresh(); expect(pool.selectSession(0)?.index).toBe(0);
  failing = true;
  f.clock.at += failure === 'stale' ? 300001 : 60000;
  if (failure === 'http-500') await pool.refresh();
  expect(pool.selectSession(0)?.index).toBe(0);
  expect(pool.state.holds).toEqual({});
  expect(pool.state.handoffAttempts ?? []).toEqual([]);
  expect(pool.readySession(1)).toBeNull(); // Unknown is never destination capacity.
  expect(createHarnessLoginPool(settings).selectSession(0)?.index).toBe(0);
  if (failure === 'http-500') {
    for (const elapsed of [60000, 120000]) {
      f.clock.at += elapsed; await pool.refresh();
      expect(pool.selectSession(0)?.index).toBe(0);
    }
    const before = calls;
    f.clock.at += 60000; await pool.refresh();
    expect(calls).toBe(before); // Collector breaker does not become a dispatch breaker.
    expect(pool.selectSession(0)?.index).toBe(0);
  }
  expect(createHarnessLoginPool({ ...settings, validate: () => { throw Error('stop or authority withdrawn'); } })
    .selectSession(0)).toBeNull();
  pool.observe(f.configuration.entries[0], limit);
  expect(pool.selectSession(0)).toBeNull(); // Real provider limits still bind.
});

it.each(['fiveHour', 'sevenDay'])('fresh partial live %s outranks older complete compatibility capacity', window => {
  const f = fixture(), live = capacity(f), fallback = capacity(f, f.clock.at - 60000);
  for (const document of [live, fallback]) document.accounts[0].lastQuota.fiveHour.utilizationPct = 99;
  for (const part of ['fiveHour', 'sevenDay']) fallback.accounts[1].lastQuota[part].utilizationPct = 20;
  delete live.accounts[1].lastQuota[window === 'fiveHour' ? 'sevenDay' : 'fiveHour'];
  live.accounts[1].lastQuota[window].utilizationPct = 100;
  const settings = { ...f.settings, quotaReader: { read: () => live }, usage: () => fallback };
  const pool = createHarnessLoginPool(settings);
  expect(pool.selectSession(0)).toBeNull();
  expect(pool.state.handoffAttempts ?? []).toEqual([]);
  expect(pool.state.holds[1]).toMatchObject({ reason: 'usage-threshold', observedAt: f.clock.at });
  // A missing weekly window still cannot admit; a missing short window uses
  // the fresh weekly reading, as the shipped 1.x pool does.
  live.accounts[1].lastQuota[window].utilizationPct = 20;
  const low = fixture();
  const partial = createHarnessLoginPool({ ...settings, statePath: low.settings.statePath });
  expect(partial.selectSession(0)?.index ?? null).toBe(window === 'sevenDay' ? 1 : null);
  expect(partial.state.holds[1]).toBeUndefined();
  expect(partial.state.handoffAttempts?.length ?? 0).toBe(window === 'sevenDay' ? 1 : 0);
});

it.each([70, 95])('configured cutoff %s remains held after telemetry disappears', thresholdPercent => {
  const f = fixture(['serving-a', 'serving-b'], { thresholdPercent });
  let reading = capacity(f);
  for (const account of reading.accounts) account.lastQuota.fiveHour.utilizationPct = thresholdPercent;
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => reading });
  expect(pool.selectSession(0)).toBeNull();
  reading = null; f.clock.at += 60000;
  expect(pool.selectSession(0)).toBeNull();
  expect(createHarnessLoginPool(f.settings).selectSession(0)).toBeNull();
});

it.each([80, 95])('five prepared attempts bound moves while preserving usable source at %s', source => {
  const f = fixture(), reading = capacity(f);
  reading.accounts[0].lastQuota.fiveHour.utilizationPct = source;
  const settings = { ...f.settings, usage: () => reading };
  const pool = createHarnessLoginPool(settings);
  for (let count = 0; count < 5; count++) expect(pool.selectSession(0)?.index).toBe(1);
  const reopened = createHarnessLoginPool(settings);
  expect(reopened.selectSession(0)?.index ?? null).toBe(source === 80 ? 0 : null);
  expect(reopened.state.handoffAttempts).toHaveLength(5);
  f.clock.at += 600000;
  reading.accounts[0].lastQuota.measuredAt = new Date(f.clock.at).toISOString();
  reading.accounts[1].lastQuota.measuredAt = new Date(f.clock.at).toISOString();
  expect(reopened.selectSession(0)?.index).toBe(1);
  expect(reopened.state.handoffAttempts).toHaveLength(6);
});

it('rechecks the cooler-target margin for a prepared move without another attempt', () => {
  const f = fixture(); let target = 65;
  const reading = () => ({ version: 1, accounts: capacity(f).accounts.map((account, index) => ({ ...account,
    lastQuota: { ...account.lastQuota, sevenDay: { ...account.lastQuota.sevenDay, utilizationPct: index === 0 ? 80 : target } },
  })) });
  const pool = createHarnessLoginPool({ ...f.settings, usage: reading });
  expect(pool.selectSession(0).index).toBe(1);
  expect(pool.readySession(1).index).toBe(1);
  target = 65.01; expect(pool.readySession(1)).toBeNull();
  expect(pool.state.handoffAttempts).toHaveLength(1);
});

it('ports use-before-reset scoring and tries the next admitted cooler member if the winner withdraws', () => {
  const f = fixture(['a', 'b', 'c']);
  const reading = { version: 1, accounts: capacity(f).accounts.map((account, index) => ({ ...account,
    lastQuota: { ...account.lastQuota,
      fiveHour: { utilizationPct: index === 0 ? 80 : 60, resetsAt: new Date(f.clock.at + (index === 2 ? 1800000 : 3600000)).toISOString() },
      sevenDay: { utilizationPct: 10, resetsAt: new Date(f.clock.at + 86400000).toISOString() } },
  })) };
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => reading });
  expect(pool.selectSession(0).index).toBe(2);
  const next = createHarnessLoginPool({ ...f.settings, usage: () => reading, validate: entry => {
    if (entry.index === 2) throw Error('withdrawn');
  } });
  expect(next.selectSession(0).index).toBe(1);
});

it('prefers fresh live quota and preserves a legacy snapshot age when telemetry cannot be read', async () => {
  const f = fixture(); let live = capacity(f);
  const file = capacity(f); file.accounts[0].lastQuota.sevenDay.utilizationPct = 80;
  const reader = { read: () => live, refresh: async () => {} };
  let pool = createHarnessLoginPool({ ...f.settings, quotaReader: reader, usage: () => file });
  await pool.refresh(); expect(pool.selectSession(0).index).toBe(0);
  live = { version: 1, accounts: [] };
  expect(pool.selectSession(0).index).toBe(1);
  // An unavailable collector never turns a five-minute-old file into current room.
  f.clock.at += 300001;
  pool = createHarnessLoginPool({ ...f.settings, quotaReader: reader, usage: () => file });
  expect(pool.readySession(1)).toBeNull();
});

// limit-notice-1020: the live 2026-10-20 outage shape — login A at the 95% threshold (weekly reset known),
// login B excluded at 100% — read without changing selection, so the journal can tell the operator once.
it('outage() reports no capacity with the earliest known reset, reads only, and is null whenever a login has room', () => {
  const f = fixture(), [a, b] = f.configuration.entries.map(entry => entry.profile);
  const week = f.clock.at + 2 * 86400_000, later = f.clock.at + 4 * 86400_000;
  const reading = (aPct, bPct) => ({ version: 1, accounts: [[a, aPct, week], [b, bPct, later]].map(([p, pct, reset]) => ({
    email: p.expectedAccount, configHome: p.configDirectory, lastQuota: { measuredAt: new Date(f.clock.at).toISOString(),
      fiveHour: { utilizationPct: 10, resetsAt: new Date(f.clock.at + 3600_000).toISOString() },
      sevenDay: { utilizationPct: pct, resetsAt: new Date(reset).toISOString() } } })) });
  let document = reading(95, 100);
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => document });
  const before = JSON.stringify(pool.state);
  expect(pool.outage()).toEqual({ resetAt: week });
  expect(JSON.stringify(pool.state)).toBe(before); // a read, never a hold or switch
  document = reading(94, 100); expect(pool.outage()).toBeNull();
  document = reading(95, 50); expect(pool.outage()).toBeNull();
  // A stale or missing reading is not evidence of exhaustion (same as select()).
  document = null; expect(pool.outage()).toBeNull();
  // Stored holds count: both held, one with an unknown reset, the other known.
  pool.observe(f.configuration.entries[0], limit);
  pool.observe(f.configuration.entries[1], { state: 'uncertain', failure: { failureClass: 'limit', resetAt: later } });
  expect(pool.outage()).toEqual({ resetAt: later });
  expect(() => pool.select()).toThrow(/no reviewed login/);
  // Unavailable members are out with no known reset.
  const excluded = createHarnessLoginPool({ ...f.settings, statePath: join(f.root, 'other.json'),
    unavailable: new Map([[0, 'withdrawn'], [1, 'withdrawn']]), usage: () => null });
  expect(excluded.outage()).toEqual({ resetAt: null });
  // After the known reset passes, the login has room again.
  f.clock.at = later + 1; document = null;
  expect(createHarnessLoginPool(f.settings).outage()).toBeNull();
});

it('signed-out logins with fresh room report unavailable, never exhaustion or a reset promise', () => {
  const f = fixture();
  const document = { version: 1, accounts: f.configuration.entries.map(({ profile }) => ({
    email: profile.expectedAccount, configHome: profile.configDirectory, status: 'needs-reauth',
    lastQuota: { measuredAt: new Date(f.clock.at).toISOString(),
      fiveHour: { utilizationPct: 1, resetsAt: new Date(f.clock.at + 3600_000).toISOString() },
      sevenDay: { utilizationPct: 1, resetsAt: new Date(f.clock.at + 86400_000).toISOString() } } })) };
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => document });
  expect(pool.readySession()).toBeNull();
  expect(pool.outage()).toEqual({ resetAt: null });
  const text = loginOutageReply(pool.outage().resetAt);
  expect(text).toContain('My model is unavailable right now');
  expect(text).toContain("I don't know yet when it will be available");
  expect(text).not.toMatch(/used up|allowance|resets/);
  document.accounts.forEach(account => { account.status = 'active'; });
  expect(pool.outage()).toBeNull();
});

// Integration: outage observation shares live selection telemetry without making a placement move.
it('outage uses fresh live quota and keeps soft pressure distinct from a held outage', () => {
  const f = fixture();
  const fallback = capacity(f);
  let live = capacity(f);
  for (const account of live.accounts) account.lastQuota.fiveHour.utilizationPct = 100;
  const pool = createHarnessLoginPool({ ...f.settings, quotaReader: { read: () => live }, usage: () => fallback });
  const before = JSON.stringify(pool.state);
  expect(pool.outage()).toEqual({ resetAt: Date.parse(live.accounts[0].lastQuota.fiveHour.resetsAt) });
  expect(JSON.stringify(pool.state)).toBe(before);
  for (const account of live.accounts) account.lastQuota.fiveHour.utilizationPct = 80;
  expect(pool.outage()).toBeNull(); // Soft placement pressure alone leaves the current login usable.
  pool.observe(f.configuration.entries[0], limit);
  pool.observe(f.configuration.entries[1], limit);
  f.clock.at += 1;
  for (const account of live.accounts) account.lastQuota.measuredAt = new Date(f.clock.at).toISOString();
  expect(pool.outage()).toEqual({ resetAt: null }); // A held login needs the same recovery margin as select.
  expect(pool.selectSession(0)).toBeNull();
  for (const account of live.accounts) account.lastQuota.fiveHour.utilizationPct = 20;
  expect(pool.outage()).toBeNull();
  expect(pool.selectSession(0)?.index).toBe(0);
  live = { version: 1, accounts: [] };
  expect(pool.outage()).toBeNull(); // Missing live observation uses the unchanged compatibility source.
});

// reply-noise-1108: the live 217 reply of 2026-11-08 11:54 PST ended with this line about a login that was dropped while
// the other approved login kept serving. The person's work was not affected, so the reply carries nothing about it.
const LIVE_LINE_1108 = 'Approved model login 2 was unavailable and was removed from selection. See status for current login availability.';
it('reply-noise-1108: a login dropped while another serves adds no reply line, on this run or any later one', () => {
  const f = fixture();
  const pool = createHarnessLoginPool({ ...f.settings, unavailable: new Map([[1, 'missing authority']]) });
  expect(pool.select().profile.reference).toBe('serving-a'); // The person's work runs on the other approved login.
  expect(pool.state.exclusions.map(item => item.index)).toEqual([1]); // Durable record kept.
  expect(pool.notices()).toEqual([]);
  expect(openReplyNotices([], pool.notices(), 'real-task-1154')).toEqual([]);
  expect(JSON.stringify(pool.notices())).not.toContain(LIVE_LINE_1108);
  expect(pool.status()).toContain('serving-b; unavailable (missing authority)'); // The pull surface still says it.
  // A later launch where the member is back reads only the durable exclusion history: still no line.
  expect(createHarnessLoginPool(f.settings).notices()).toEqual([]);
});
it('reply-noise-1108: with no approved login usable, one plain line with no numbering, offered once', () => {
  const f = fixture();
  const pool = createHarnessLoginPool({ ...f.settings, unavailable: new Map([[0, 'missing authority'], [1, 'missing authority']]) });
  const notices = pool.notices();
  expect(notices).toHaveLength(1);
  expect(notices[0].line).toBe('None of my approved model logins can be used right now, so new work will wait until one is working again.');
  expect(notices[0].line).not.toMatch(/[0-9]/u);
  const sent = [{ id: 'sent', intent: `Done.\n\n${notices[0].line}`, answerNotices: notices, sent: 2 }];
  expect(openReplyNotices(sent, createHarnessLoginPool({ ...f.settings, unavailable: new Map([[0, 'x'], [1, 'y']]) }).notices(), 'next')).toEqual([]);
});

it('briefs six neutral logins, current holds and reset times without disclosing profiles', () => {
  // Shape supplied by observer a8793994, 2026-11-12 16:52 PST; reconstruct durable selection state.
  const f = fixture(['private-a', 'private-b', 'private-c', 'private-d', 'private-e', 'private-f']);
  const firstReset = f.clock.at + 3600000, secondReset = f.clock.at + 7200000;
  writeFileSync(f.settings.statePath, JSON.stringify({ ...f.pool.state, active: 3, holds: {
    1: { reason: 'usage-threshold', observedAt: f.clock.at - 1000, resetAt: firstReset },
    4: { reason: 'usage-threshold', observedAt: f.clock.at - 1000, resetAt: secondReset },
    0: { reason: 'usage-threshold', observedAt: f.clock.at - 2000, resetAt: f.clock.at - 1 },
  } }));
  const pool = createHarnessLoginPool(f.settings), text = pool.brief();
  expect(text).toContain('6 logins, 4 usable');
  expect(text).toContain(new Date(firstReset).toISOString().slice(0, 10) + ' UTC');
  expect(text).toContain(`2=${new Date(firstReset).toISOString().slice(11, 19)}`);
  expect(text).toContain(`5=${new Date(secondReset).toISOString().slice(11, 19)}`);
  expect(text).toContain('no hold: 1,3,4,6');
  expect(text).toContain('Work can continue');
  expect(text).not.toMatch(/private-|@|\/profile\//);
  f.clock.at = secondReset;
  expect(pool.brief()).toContain('6 logins, 6 usable');
  expect(pool.brief()).toContain('None are currently held or limited');
});

it('briefs unknown resets and total unavailability without claiming zero usage', () => {
  const f = fixture();
  for (const entry of f.configuration.entries) f.pool.observe(entry, limit);
  expect(f.pool.brief()).toContain('2 logins, 0 usable');
  expect(f.pool.brief()).toContain('new model work unavailable now');
  expect(f.pool.brief()).toContain('1=unknown');
  expect(f.pool.brief()).toContain('Other quotas unknown');
});

it('brief agrees with current recovery evidence and combines competing reset bounds', () => {
  const f = fixture();
  f.pool.observe(f.configuration.entries[0], limit);
  f.clock.at += 1000;
  const reading = capacity(f);
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => reading });
  expect(pool.brief()).toContain('2 logins, 2 usable');
  expect(pool.outage()).toBeNull();
  pool.select(); // The selection owner durably clears the recovered hold.
  pool.observe(f.configuration.entries[0], { failure: { failureClass: 'limit', resetAt: f.clock.at + 1000 } });
  reading.accounts[0].lastQuota.fiveHour.utilizationPct = 100;
  expect(pool.brief()).toContain(`1=${reading.accounts[0].lastQuota.fiveHour.resetsAt.slice(11, 19)}`);
  expect(pool.brief()).toContain('2 logins, 1 usable');
});

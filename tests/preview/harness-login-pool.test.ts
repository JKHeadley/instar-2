// @ts-nocheck -- host composition and real on-disk custody, without touching Shared or live runners.
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarnessLoginPool, loadHarnessLogins, harnessQuotaLimit, observeHarnessSessionLimit, harnessPoolPreviouslyLaunched } from './harness-login-pool.mjs';
import { harnessLoginPath, readHarnessLogin, storeHarnessLogin } from './harness-user.mjs';
import { classifyProviderFailure } from '../../src/assembly/provider-failure.js';
import { openReplyNotices, validAnswerNotices } from './credential-reminders.js';

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

it('replays the captured weekly limit: A fails, next call uses B, switch is durable and notice is offered once', () => {
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
  const notices = reopened.notices(); expect(notices).toHaveLength(1);
  expect(notices[0].line).toContain('next approved login');
  expect(validAnswerNotices(notices, notices[0].line)).toBe(true);
  expect(openReplyNotices([], notices, 'turn:2')).toEqual(notices);
  expect(openReplyNotices([{ id: 'turn:2', answerNotices: notices, sent: 2 }], notices, 'turn:3')).toEqual([]);
  expect(createHarnessLoginPool(f.settings).state.switches).toHaveLength(1);
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
  const pool = createHarnessLoginPool({ ...f.settings, usage: () => document() });
  expect(pool.select().index).toBe(1);
  expect(pool.state.switches[0].reason).toBe('usage-threshold');
  // Once A's observed window resets, exhausted B can select A again without widening the list.
  pool.observe(pool.select(), limit); f.clock.at += 1001;
  expect(createHarnessLoginPool(f.settings).select().index).toBe(0);
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
    expect(pool.state.holds[0]).toEqual({ reason: 'provider-limit', resetAt });
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
    const f = fixture();
    f.pool.observe(f.pool.select(), { state: 'rejected', failure: classifyProviderFailure({ code: 1, limited: false, stdout, now: f.clock.at }) });
    const next = f.pool.select(); expect(next.profile.reference, row.kind).toBe('serving-b');
    // The pool has no judgment parser: recorded uncertainty is not provider capacity evidence.
    const returned = { state: row.kind === 'summary-uncertain' ? 'uncertain' : 'complete', bytes: row.raw };
    const before = JSON.stringify(returned);
    f.pool.observe(next, returned);
    expect(JSON.stringify(returned), row.id).toBe(before);
    expect(f.pool.select()).toBe(next); expect(f.pool.state.switches).toHaveLength(1);
  }
});

it('a delegated session rate-limit observation selects B for the next step; other pauses do not', () => {
  const f = fixture(), a = f.pool.select('session');
  for (const observation of [{ kind: 'Refused' }, { kind: 'Success', value: { phase: 'launched', detail: 'rate-limited' } },
    { kind: 'Success', value: { phase: 'pause-observed', detail: 'context-wedge' } }]) {
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

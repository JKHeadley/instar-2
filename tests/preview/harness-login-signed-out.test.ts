// @ts-nocheck -- real pool selection and durable state; only the CLI process is replaced.
// login-pool-swap-1107: a login the harness CLI reports signed out is held, so the next turn runs on another
// approved login with room, without a restart, and the person is given no extra line (1.x QuotaPoller parity).
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarnessLoginPool, loadHarnessLogins, observeHarnessSignIn, SIGNED_OUT_HOLD_MAX_MS } from './harness-login-pool.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const profile = (name: string) => ({ reference: name, expectedAccount: `${name}@example.invalid`, organization: 'org', plan: 'max',
  home: `/profile/${name}/home`, configDirectory: `/profile/${name}/config`, workingDirectory: `/profile/${name}/work` });
function fixture(names = ['serving-a', 'serving-b']) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'harness-signed-out-'))); roots.push(root);
  const logins = names.map(name => {
    const path = join(root, `${name}.json`); writeFileSync(path, JSON.stringify(profile(name)));
    return { profile: path, activation: join(root, `${name}-activation.json`), authority: join(root, `${name}-authority.json`) };
  });
  const path = join(root, 'pool.json'); writeFileSync(path, JSON.stringify({ version: 1, thresholdPercent: 95, logins }));
  const configuration = loadHarnessLogins({ 'login-pool': path, 'harness-user': '_instarharness',
    'login-profile': logins[0].profile, 'activation-record': logins[0].activation });
  const clock = { at: 1790308860000 };
  // Fingerprints only (16 hex), as journal-agent derives them from custody; never a credential.
  const credentials = Object.fromEntries(names.map((name, index) => [name, String(index + 1).repeat(16)]));
  const usage = { document: null };
  const settings = { configuration, statePath: join(root, 'selection.json'), now: () => clock.at, validate: () => {},
    credential: entry => credentials[entry.profile.reference], usage: () => usage.document };
  return { configuration, clock, credentials, usage, settings, pool: createHarnessLoginPool(settings) };
}
/** The CLI, as journal-agent's provider IO sees it: `auth status --json` and the prompt-carrying model command. */
const cli = (signedOut: Set<string>, launches: string[]) => (account: string) => ({ execute: async input => {
  if (input.args[0] === 'auth') {
    const stdout = signedOut.has(account) ? JSON.stringify({ loggedIn: false, authMethod: 'none', apiProvider: 'firstParty' })
      : JSON.stringify({ loggedIn: true, authMethod: 'oauth_token', apiProvider: 'firstParty' });
    return { code: signedOut.has(account) ? 1 : 0, limited: false, stdout, stdoutBytes: Buffer.from(stdout) };
  }
  launches.push(account);
  return { code: 0, limited: false, stdout: '{}', stdoutBytes: Buffer.from('{}') };
} });
/** One turn as the one-shot route runs it: select, the auth preflight, then the model command only when signed in. */
async function turn(pool, io) {
  const entry = pool.select();
  const observed = observeHarnessSignIn(pool, entry, io(entry.profile.reference));
  const status = await observed.execute({ args: ['auth', 'status', '--json'], stdin: '' });
  if (JSON.parse(status.stdout).loggedIn !== true) return { entry, answered: false };
  await observed.execute({ args: ['-p'], stdin: 'prompt' });
  return { entry, answered: true };
}

it('A signed out: the next turn runs on B, durably, with no restart and no extra line for the person', async () => {
  const f = fixture(), launches = [], io = cli(new Set(['serving-a']), launches);
  const first = await turn(f.pool, io);
  expect(first).toEqual({ entry: f.configuration.entries[0], answered: false });
  expect(launches).toEqual([]); // Nothing reached the model on the signed-out login.
  const second = await turn(f.pool, io);
  expect(second.entry.profile.reference).toBe('serving-b'); expect(second.answered).toBe(true);
  expect(launches).toEqual(['serving-b']);
  expect(f.pool.state.switches).toEqual([{ from: 'serving-a', to: 'serving-b', reason: 'member-unavailable', at: f.clock.at, sequence: 1 }]);
  // The hold records only a truncated fingerprint; no credential, path or CLI text.
  expect(f.pool.state.holds[0]).toEqual({ reason: 'signed-out', observedAt: f.clock.at, resetAt: f.clock.at + SIGNED_OUT_HOLD_MAX_MS,
    credential: f.credentials['serving-a'] });
  expect(f.pool.notices()).toEqual([]); // At most one plain line: here none, as for any member-unavailable move.
  expect(f.pool.signinRepairs()).toEqual([expect.objectContaining({ account: 'serving-a@example.invalid', profile: 'serving-a' })]);
  expect(f.pool.outage()).toBeNull(); // B has room, so no outage notice is due.
  // Durable across a host restart: a reopened pool keeps B and the hold.
  const reopened = createHarnessLoginPool(f.settings);
  expect((await turn(reopened, io)).entry.profile.reference).toBe('serving-b');
  expect(reopened.state.switches).toHaveLength(1);
  expect(JSON.parse(readFileSync(f.settings.statePath, 'utf8')).holds['0'].reason).toBe('signed-out');
});

it('the hold stays for the same credential and is released by a fresh sign-in or its ceiling', async () => {
  for (const release of ['credential', 'ceiling']) {
    const f = fixture(), launches = [], signedOut = new Set(['serving-a']), io = cli(signedOut, launches);
    await turn(f.pool, io);
    expect(f.pool.state.holds[0]?.reason).toBe('signed-out');
    // B later reports signed out too; A is still held for the SAME credential, so nothing is selectable.
    f.clock.at += 60_000; signedOut.add('serving-b');
    expect((await turn(f.pool, io)).entry.profile.reference).toBe('serving-b');
    expect(() => f.pool.select()).toThrow(/no reviewed login with available capacity/u);
    expect(f.pool.outage()).toEqual({ resetAt: null }); // The one fixed outage notice; no reset is claimed.
    signedOut.clear();
    if (release === 'credential') f.credentials['serving-b'] = 'f'.repeat(16);
    else f.clock.at += SIGNED_OUT_HOLD_MAX_MS;
    const next = f.pool.select();
    expect(next.profile.reference).toBe('serving-b');
    expect(f.pool.state.holds[1]).toBeUndefined();
    if (release === 'credential') expect(f.pool.state.holds[0]?.reason).toBe('signed-out'); // A's own credential is unchanged.
  }
});

it('signed in, unparseable or absent status creates no hold, and no pool leaves the IO untouched', async () => {
  const f = fixture(), launches = [];
  for (const stdout of [JSON.stringify({ loggedIn: true }), 'Not logged in', '', JSON.stringify(['loggedIn', false])]) {
    const io = { execute: async () => ({ code: 1, limited: false, stdout, stdoutBytes: Buffer.from(stdout) }) };
    await observeHarnessSignIn(f.pool, f.configuration.entries[0], io).execute({ args: ['auth', 'status', '--json'], stdin: '' });
  }
  // A model command's output is never read as a login check.
  const model = { execute: async () => ({ code: 0, limited: false, stdout: JSON.stringify({ loggedIn: false }), stdoutBytes: Buffer.from('') }) };
  await observeHarnessSignIn(f.pool, f.configuration.entries[0], model).execute({ args: ['-p'], stdin: 'prompt' });
  expect(f.pool.state.holds).toEqual({});
  expect(f.pool.select().profile.reference).toBe('serving-a');
  const io = cli(new Set(), launches)('serving-a');
  expect(observeHarnessSignIn(null, f.configuration.entries[0], io)).toBe(io);
  expect(() => f.pool.observeSignedOut({ ...f.configuration.entries[1] })).toThrow(/unreviewed login/u);
});

it('the continuing-session handoff moves a signed-out topic login to B when B has measured room', async () => {
  const f = fixture(), measuredAt = new Date(f.clock.at).toISOString(), resetsAt = new Date(f.clock.at + 3_600_000).toISOString();
  f.usage.document = { version: 1, accounts: ['serving-a', 'serving-b'].map(name => ({ email: `${name}@example.invalid`,
    configHome: `/profile/${name}/config`, lastQuota: { measuredAt, fiveHour: { utilizationPct: 10, resetsAt }, sevenDay: { utilizationPct: 10, resetsAt } } })) };
  expect(f.pool.selectSession(0).index).toBe(0);
  await observeHarnessSignIn(f.pool, f.configuration.entries[0], cli(new Set(['serving-a']), [])('serving-a'))
    .execute({ args: ['auth', 'status', '--json'], stdin: '' });
  expect(f.pool.readySession(0)).toBeNull();
  expect(f.pool.selectSession(0).profile.reference).toBe('serving-b');
  expect(f.pool.state.handoffAttempts.at(-1)).toMatchObject({ from: 'serving-a', to: 'serving-b', reason: 'member-unavailable', phase: 'prepared' });
});

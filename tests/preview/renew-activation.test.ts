// @ts-nocheck -- desk renewal script and journal CLI are exercised as shipped JavaScript.
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  subscriptionInvocationPolicy, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { encoded } from './stage2-provider.js';
import { renewActivation } from './renew-activation.mjs';
import { activationMatchesJournal, openPreviewJournal, renewJournalExpiry } from './journal.js';

const PRIOR_EXPIRY = 1790628000000; // 2026-09-28T20:40:00Z, the record being renewed.
const PRIOR_COMMIT = '89d5ee35'; // live frozen13 build: int10 + thinking off.
const NOW = 1790520000000; // 2026-09-27T14:40:00Z, fixed so no assertion reads the host clock.
const model = 'claude-sonnet-5';
const profile = Object.freeze({ type: 'ProviderSubscriptionProfile', schemaVersion: 1, reference: 'preview-s2-profile-test',
  home: '/tmp/h', configDirectory: '/tmp/c', workingDirectory: '/tmp/w', expectedAccount: 'luna@example.invalid',
  organization: 'org', plan: 'max', loginProfileIdentity: 'sha256:identity', executable: '/tmp/claude.exe',
  artifact: 'sha256:artifact', version: '2.1.280', activationReference: 'preview-s2-activation-v2-2026-09-23',
  managedConfigurationDigest: 'sha256:managed' });
const current = { type: 'SubscriptionActivationRecord', schemaVersion: 1, reference: profile.activationReference,
  waiver: 'waiver', p11: 'p11', reviewedHead: 'old head', trial: 'preview-trial:test', baseConfigurationDigest: 'sha256:config',
  profileDigest: encoded(profile).hash, executable: profile.executable, artifact: profile.artifact, version: '2.1.280', model,
  invocationPolicyDigest: encoded(subscriptionConversationPolicy(model)).hash, expectedAccount: profile.expectedAccount,
  observedAccount: profile.expectedAccount, authSource: 'claude.ai', operatorAssertion: 'operator OAuth 2026-09-23',
  assertedAt: 1790211900000, observer: 'old observer', observedAt: 1790218397444, method: 'auth status', safeCaptureReference: 'capture',
  extraUsage: 'observed-disabled', extraUsageReason: 'disabled', subscriptionLimit: 'available', subscriptionLimitReason: 'old reading',
  acceptedResiduals: ['charge and quiescence remain UNKNOWN by design'], expiresAt: PRIOR_EXPIRY };
const currentBytes = JSON.stringify(current, null, 2);
const observation = { reference: profile.activationReference, reviewedHead: 'bl-activation-renewal head', assertedAt: 1790512000000,
  observedAt: 1790512740000, method: 'journal call-outcome diagnostics + pool quota reading', observer: 'echo desk',
  safeCaptureReference: 'status capture', observedAccount: profile.expectedAccount, subscriptionLimit: 'available',
  subscriptionLimitReason: 'pool quota reading: not exhausted' };
const conversation = (record, p = profile, now = NOW) =>
  validateSubscriptionActivation(record, p, model, now, SUBSCRIPTION_CONVERSATION_FRAMING);

it('pins the renewed expiry and leaves every invocation policy digest unchanged', () => {
  expect(SUBSCRIPTION_PREVIEW_EXPIRY).toBe(Date.UTC(2026, 9, 5, 20, 40));
  expect(SUBSCRIPTION_PREVIEW_EXPIRY - PRIOR_EXPIRY).toBe(7 * 24 * 3600 * 1000);
  // The int11 conversation policy digest for claude-sonnet-5; the policy never carries the expiry.
  expect(encoded(subscriptionConversationPolicy(model)).hash)
    .toBe('sha256:efe698761d91114749594313b2bde1e2c21a855901f539c5a3afc4a16998cea7');
  expect(JSON.stringify([subscriptionConversationPolicy(model), subscriptionInvocationPolicy(model)]))
    .not.toMatch(new RegExp(`${PRIOR_EXPIRY}|${SUBSCRIPTION_PREVIEW_EXPIRY}`));
});

it('renews into a record this build accepts and refuses the old record', () => {
  const { record, profile: successor } = renewActivation({ current, currentBytes, profile, observation, now: NOW });
  expect(successor).toBeNull();
  expect(() => conversation(record)).not.toThrow();
  expect(record).toMatchObject({ ...observation, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY, profileDigest: current.profileDigest,
    invocationPolicyDigest: current.invocationPolicyDigest, waiver: current.waiver, acceptedResiduals: current.acceptedResiduals,
    predecessor: { reference: current.reference, digest: `sha256:${createHash('sha256').update(currentBytes).digest('hex')}` } });
  expect(() => conversation(current)).toThrow('subscription activation expired or clock differs');
  expect(() => conversation(record, profile, SUBSCRIPTION_PREVIEW_EXPIRY)).toThrow('expired or clock differs');
});

it('writes a profile successor only for a new reference and refuses a different account or stale observation', () => {
  const next = { ...observation, reference: 'preview-s2-activation-v3-2026-09-27' };
  const { record, profile: successor } = renewActivation({ current, currentBytes, profile, observation: next, now: NOW });
  expect(successor).toEqual({ ...profile, activationReference: next.reference });
  expect(record.profileDigest).toBe(encoded(successor).hash);
  expect(() => conversation(record, successor)).not.toThrow();
  expect(() => conversation(record, profile)).toThrow('artifact or policy differs');
  for (const [changed, message] of [[{ observedAccount: 'other@example.invalid' }, 'observed account differs'],
    [{ subscriptionLimit: 'exhausted' }, 'not available'], [{ expiresAt: 1 }, 'not renewable'],
    [{ observedAt: NOW + 1 }, 'expired or clock differs'], [{ assertedAt: observation.observedAt + 1 }, 'expired or clock differs']])
    expect(() => renewActivation({ current, currentBytes, profile, observation: { ...observation, ...changed }, now: NOW }))
      .toThrow(message);
  const { method: _omitted, ...missing } = observation;
  expect(() => renewActivation({ current, currentBytes, profile, observation: missing, now: NOW })).toThrow('missing method');
  expect(() => renewActivation({ current: { ...current, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY }, currentBytes, profile,
    observation, now: NOW })).toThrow('not older');
});

const OLD_POLICY_DIGEST = 'sha256:557a62fa7c65c0a8a5982f34f8d96236231d21082bef4b441ea7847be58cb833';
const policyPredecessor = { ...current, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY,
  invocationPolicyDigest: OLD_POLICY_DIGEST };
const policyPredecessorBytes = JSON.stringify(policyPredecessor, null, 2);
const policySuccessor = (input: object = {}) => renewActivation({ current: policyPredecessor,
  currentBytes: policyPredecessorBytes, profile, observation, now: NOW, policySuccessor: true, ...input });

it('issues a policy successor with only the fresh observation and policy evidence changed', () => {
  const { record, profile: nextProfile } = policySuccessor();
  expect(nextProfile).toBeNull();
  expect(record).toEqual({ ...policyPredecessor, ...observation,
    invocationPolicyDigest: encoded(subscriptionConversationPolicy(model)).hash,
    previousInvocationPolicyDigest: OLD_POLICY_DIGEST,
    predecessor: { reference: policyPredecessor.reference,
      digest: `sha256:${createHash('sha256').update(policyPredecessorBytes).digest('hex')}` } });
  expect(record.expiresAt).toBe(policyPredecessor.expiresAt);
  expect(() => conversation(record)).not.toThrow();
  expect(() => conversation(policyPredecessor)).toThrow('artifact or policy differs');
});

it('refuses a policy successor without a policy change or with a changed binding', () => {
  const sameDigest = { ...policyPredecessor, invocationPolicyDigest: encoded(subscriptionConversationPolicy(model)).hash };
  expect(() => policySuccessor({ current: sameDigest })).toThrow('digest unchanged');
  expect(() => policySuccessor({ observation: { ...observation, observedAccount: 'other@example.invalid' } }))
    .toThrow('observed account differs');
  expect(() => policySuccessor({ observation: { ...observation, model: 'claude-haiku-5' } }))
    .toThrow('field model not renewable');
  expect(() => policySuccessor({ observation: { ...observation, reference: 'another-activation' } }))
    .toThrow('would change profile');
  expect(() => policySuccessor({ profile: { ...profile, executable: '/tmp/other.exe' } }))
    .toThrow('artifact or policy differs');
  expect(() => policySuccessor({ current: { ...policyPredecessor, expiresAt: PRIOR_EXPIRY } }))
    .toThrow('would change expiry');
  expect(() => policySuccessor({ current: { ...policyPredecessor, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY + 1 } }))
    .toThrow('would change expiry');
});

const key = new Uint8Array(32).fill(9);
const genesis = (expires: number) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: current.trial, configurationDigest: current.baseConfigurationDigest, expires,
  maxCalls: 4, maxReplies: 4, maxTurns: 4, maxBytes: 32768, cursor: 0 });
const digest = 'sha256:' + 'a'.repeat(64);

it('extends a live journal once to exactly the reviewed expiry and survives replay and compaction', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-renew-'))), path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis(PRIOR_EXPIRY));
    const renew = (input: object) => renewJournalExpiry(journal, { expires: SUBSCRIPTION_PREVIEW_EXPIRY, activation: digest,
      authority: 'status-quo renewal; standing preapproval note #30', at: NOW, ...input });
    for (const refused of [{ expires: SUBSCRIPTION_PREVIEW_EXPIRY + 1 }, { expires: PRIOR_EXPIRY }, { at: PRIOR_EXPIRY },
      { authority: ' ' }, { activation: 'not-a-digest' }])
      expect(() => renew(refused)).toThrow('expiry renewal refused');
    expect(journal.view.expires).toBe(PRIOR_EXPIRY);
    const { record } = renewActivation({ current, currentBytes, profile, observation, now: NOW });
    // The runner admits only the activation whose expiry equals the journal's effective expiry.
    expect([activationMatchesJournal(journal.view, current), activationMatchesJournal(journal.view, record)]).toEqual([true, false]);
    renew({});
    expect(journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    expect([activationMatchesJournal(journal.view, current), activationMatchesJournal(journal.view, record)]).toEqual([false, true]);
    expect(activationMatchesJournal(journal.view, { ...record, trial: 'other' })).toBe(false);
    expect(activationMatchesJournal(journal.view, { ...record, baseConfigurationDigest: 'sha256:other' })).toBe(false);
    expect(() => renew({})).toThrow('expiry renewal refused');
    journal.close();
    const replayed = openPreviewJournal(path, key);
    expect([replayed.view.expires, replayed.view.genesis.expires, replayed.view.expiryAuthority])
      .toEqual([SUBSCRIPTION_PREVIEW_EXPIRY, PRIOR_EXPIRY, 'status-quo renewal; standing preapproval note #30']);
    replayed.compact(); replayed.close();
    expect(openPreviewJournal(path, key).view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses renewal of a stopped or already expired trial', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-renew-stop-')));
  try {
    const expired = openPreviewJournal(join(root, 'expired.encrypted'), key, genesis(NOW - 1));
    expect(() => renewJournalExpiry(expired, { expires: SUBSCRIPTION_PREVIEW_EXPIRY, activation: digest, authority: 'a', at: NOW }))
      .toThrow('expiry renewal refused');
    expired.close();
    const stopped = openPreviewJournal(join(root, 'stopped.encrypted'), key, genesis(PRIOR_EXPIRY));
    stopped.append({ kind: 'stop', reason: 'operator', at: NOW - 1 });
    expect(() => renewJournalExpiry(stopped, { expires: SUBSCRIPTION_PREVIEW_EXPIRY, activation: digest, authority: 'a', at: NOW }))
      .toThrow('expiry renewal refused');
    stopped.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const clock = ['--import', `data:text/javascript,Date.now=()=>${String(NOW)}`];
const node = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath,
  ['--no-warnings', ...clock, '--loader', './scripts/slice-ts-loader.mjs', ...args],
  { cwd: process.cwd(), env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 });

it('the desk script writes new files only and the renew-expiry command binds that exact record', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-renew-cli-')));
  const file = (name: string, value?: unknown) => { const path = join(root, name);
    if (value !== undefined) writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); return path; };
  const currentPath = file('activation-talk.json', currentBytes), profilePath = file('profile-v2.json', profile);
  const observationPath = file('observation.json', observation), out = file('activation-talk-v3.json');
  const env = { INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') };
  try {
    const script = (extra: string[] = []) => node(['tests/preview/renew-activation.mjs', '--current', currentPath,
      '--profile', profilePath, '--observation', observationPath, '--out', out, ...extra]);
    expect(script(['--profile-out', file('profile-v3.json')]).stderr).toContain('no profile successor is needed');
    expect(existsSync(out)).toBe(false);
    const written = script();
    expect(written.status, written.stderr).toBe(0);
    expect(script().stderr).toContain('EEXIST'); // exclusive create: never overwrites
    expect(node(['tests/preview/renew-activation.mjs', '--current', currentPath, '--profile', profilePath,
      '--observation', observationPath, '--out', currentPath]).stderr).toContain('outputs must be new paths');
    expect(readFileSync(currentPath, 'utf8')).toBe(currentBytes);
    const renewed = JSON.parse(readFileSync(out, 'utf8'));
    expect(() => conversation(renewed)).not.toThrow();

    openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(PRIOR_EXPIRY)).close();
    const agent = (command: string, activation: string, expiresAt: string) => node(['tests/preview/journal-agent.mjs', command,
      '--root', root, '--activation-record', activation, '--login-profile', profilePath, '--model', model,
      '--expires-at', expiresAt, '--authority', 'status-quo renewal; preapproval note #30'], env);
    // The launcher suppresses error details by design; each refusal differs from the success below
    // in exactly one input, and none of them moves the journal's expiry.
    const expires = () => JSON.parse(node(['tests/preview/journal-agent.mjs', 'status', '--root', root], env).stdout).expires;
    expect(agent('renew-expiry', currentPath, '2026-09-28T20:40:00Z').status).toBe(1); // old record
    expect(agent('renew-expiry', out, '2026-09-28T20:40:00Z').status).toBe(1); // flag disagrees with record
    // Rules 94/98/103/104: the renewal is exercised under the recorded standing grant (the earlier
    // yes to bounded status-quo renewals), never under its reference strings. No record refuses;
    // a grant that does not cover this subject refuses; the in-scope grant renews with no new yes.
    // The launcher suppresses details; each reason is proven by activation-authority.test.ts.
    const refusedWith = (_reason: string) => { expect(agent('renew-expiry', out, '2026-10-05T20:40:00Z').status).toBe(1);
      expect(expires()).toBe(PRIOR_EXPIRY); };
    refusedWith('activation authority record absent');
    const grant = { id: 'observer-note-30', grantor: '7654321', grantee: 'echo-desk', words: 'status-quo renewals are preapproved',
      source: 'verified operator message (observer note #30)', issuedAt: 1790500000000, actions: ['renew-subscription-activation'],
      scope: { trial: renewed.trial, model, expectedAccount: renewed.expectedAccount, executable: renewed.executable,
        artifact: renewed.artifact, version: renewed.version, invocationPolicyDigest: renewed.invocationPolicyDigest, profileDigest: renewed.profileDigest },
      renewal: { maxExtensionMs: 604_800_000, latestExpiresAt: SUBSCRIPTION_PREVIEW_EXPIRY } };
    const authority = (g = grant) => file('activation-authority.json', { type: 'PreviewActivationAuthority', schemaVersion: 1, grants: [g],
      waivers: [{ reference: renewed.waiver, rules: ['rule:38'], grantor: '7654321', recordedAt: 1790000000000,
        source: 'verified operator message', words: 'trial waiver approved' }], revocations: [] });
    authority({ ...grant, scope: { ...grant.scope, model: 'claude-other-1' } });
    refusedWith('does not cover');
    expect(expires()).toBe(PRIOR_EXPIRY);
    authority();
    const ok = agent('renew-expiry', out, '2026-10-05T20:40:00Z');
    expect(ok.status, ok.stderr).toBe(0);
    const status = node(['tests/preview/journal-agent.mjs', 'status', '--root', root], env);
    expect(JSON.parse(status.stdout)).toMatchObject({ expires: SUBSCRIPTION_PREVIEW_EXPIRY,
      expiryAuthority: expect.stringMatching(/^status-quo renewal; preapproval note #30 \[grant observer-note-30; waiver waiver; record sha256:[a-f0-9]{64}\]$/u) });
    expect(agent('renew-expiry', out, '2026-10-05T20:40:00Z').status).toBe(1); // one renewal per expiry
    expect(expires()).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 90_000);

it('the policy-successor flag creates only a new valid record and never replaces an output', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-policy-successor-')));
  const file = (name: string, value: unknown) => { const path = join(root, name);
    writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); return path; };
  const currentPath = file('current.json', policyPredecessorBytes);
  const profilePath = file('profile.json', profile);
  const observationPath = file('observation.json', observation);
  const out = join(root, 'successor.json');
  const run = (args: string[] = []) => node(['tests/preview/renew-activation.mjs', '--policy-successor',
    '--current', currentPath, '--profile', profilePath, '--observation', observationPath, '--out', out, ...args]);
  try {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(() => conversation(JSON.parse(readFileSync(out, 'utf8')))).not.toThrow();
    expect(run().stderr).toContain('EEXIST');
    expect(readFileSync(currentPath, 'utf8')).toBe(policyPredecessorBytes);
    expect(run(['--profile-out', join(root, 'unused-profile.json')]).stderr).toContain('no profile successor is needed');
    expect(existsSync(join(root, 'unused-profile.json'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('the build with the previous conversation policy refuses the policy successor', async () => {
  const oldSource = spawnSync('git', ['show', '0a61aaf8:src/assembly/production-provider.ts'],
    { cwd: process.cwd(), encoding: 'utf8' });
  expect(oldSource.status, oldSource.stderr).toBe(0);
  const provider = join(process.cwd(), `src/assembly/.old-policy-provider-${String(process.pid)}.ts`);
  try {
    writeFileSync(provider, oldSource.stdout);
    const old = await import(provider);
    expect(encoded(old.subscriptionConversationPolicy(model)).hash).toBe(OLD_POLICY_DIGEST);
    expect(old.SUBSCRIPTION_PREVIEW_EXPIRY).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    expect(() => old.validateSubscriptionActivation(policyPredecessor, profile, model, NOW,
      SUBSCRIPTION_CONVERSATION_FRAMING)).not.toThrow();
    const { record } = policySuccessor();
    expect(() => old.validateSubscriptionActivation(record, profile, model, NOW,
      SUBSCRIPTION_CONVERSATION_FRAMING)).toThrow('artifact or policy differs');
  } finally { if (existsSync(provider)) unlinkSync(provider); }
}, 30_000);

const prior = spawnSync('git', ['cat-file', '-e', `${PRIOR_COMMIT}^{commit}`], { cwd: process.cwd() }).status === 0;
it.runIf(prior)('the prior live build refuses the renewed record (unconditional) and an uncompacted renewed journal; after compaction the prior reader accepts the snapshot with the genesis expiry (accepted residue)', async () => {
  const show = (path: string) => spawnSync('git', ['show', `${PRIOR_COMMIT}:${path}`], { cwd: process.cwd(), encoding: 'utf8' }).stdout;
  const provider = join(process.cwd(), `src/assembly/.prior-production-provider-${String(process.pid)}.ts`);
  const journalModule = join(process.cwd(), `tests/preview/.prior-journal-${String(process.pid)}.ts`);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-renew-prior-'))), path = join(root, 'journal.encrypted');
  try {
    writeFileSync(provider, show('src/assembly/production-provider.ts'));
    writeFileSync(journalModule, show('tests/preview/journal.ts'));
    const old = await import(provider), oldJournal = await import(journalModule);
    expect(old.SUBSCRIPTION_PREVIEW_EXPIRY).toBe(PRIOR_EXPIRY);
    const { record } = renewActivation({ current, currentBytes, profile, observation, now: NOW });
    const priorDigest = encoded(old.subscriptionConversationPolicy(model)).hash;
    expect(() => old.validateSubscriptionActivation({ ...current, invocationPolicyDigest: priorDigest }, profile, model, NOW,
      SUBSCRIPTION_CONVERSATION_FRAMING)).not.toThrow();
    expect(() => old.validateSubscriptionActivation({ ...record, invocationPolicyDigest: priorDigest }, profile, model, NOW,
      SUBSCRIPTION_CONVERSATION_FRAMING))
      .toThrow('subscription activation expired or clock differs');
    const journal = openPreviewJournal(path, key, genesis(PRIOR_EXPIRY));
    renewJournalExpiry(journal, { expires: SUBSCRIPTION_PREVIEW_EXPIRY, activation: digest, authority: 'a', at: NOW });
    journal.close();
    expect(() => oldJournal.openPreviewJournal(path, key)).toThrow('orphan effect');
  } finally {
    for (const temp of [provider, journalModule]) if (existsSync(temp)) unlinkSync(temp);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

// Plan #449 (w4-toolsclass): the operator's standing full-tools grant (121996) recorded once for a policy CLASS covers every
// build whose tools policy keeps the class's checkpoints. Replayed on the REAL recorded shapes: the tools policies of the
// three builds the live authority granted one digest at a time (cint-L42, cint-L43, cint-L44; their digests are the ones the
// live sealed authority names). One class grant covers L43 and L44 (the full tool set); L42's narrower six-tool policy
// predates the subagent caps the class requires, so it stays covered only by its own exact-digest grant. Both sides: a policy with a checkpoint removed or a
// cap raised is outside the class and refuses, naming why; the conversation policy is never covered by a tools class.
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { authoritySealKey, PREVIEW_DESK, resolveActivationAuthority, sealAuthorityRecord, type ActivationAuthorityRecord,
  type ActivationFacts, type OperatorMessageRecords } from './activation-authority.js';
import { claudeSettingsCheckpoints, codexDispatchCheckpoint, FULL_TOOLS_CLASS, toolsPolicyClassVerdict } from './tools-policy-class.js';
import { encoded } from '../../src/assembly/boundary.js';
import { subscriptionConversationPolicy, subscriptionToolSettings, subscriptionToolsPolicy } from '../../src/assembly/production-provider.js';
import { codexToolHookArgs, codexToolsPolicy } from '../../src/assembly/production-codex-provider.js';

const recorded = JSON.parse(readFileSync('tests/preview/fixtures/tools-policies-L42-L44-2026-10-03.json', 'utf8')) as
  { builds: { build: string; grant: string; model: string; digest: string; policy: Record<string, unknown> }[] };
const digestOf = (policy: unknown) => (encoded(policy) as { hash: string }).hash;
const MODEL = 'claude-sonnet-5', BASE = 1_791_400_000_000, NOW = 1_791_050_000_000, OPERATOR = '7812716706';
const WORDS = 'the full tool set on by default', WAIVER_WORDS = 'trial waiver approved';
const facts = (invocationPolicyDigest: string): ActivationFacts => ({ trial: 'trial:justin', profileDigest: 'sha256:p',
  invocationPolicyDigest, model: MODEL, expiresAt: BASE, executable: '/bin/claude', artifact: 'sha256:a', version: '2.1.280',
  expectedAccount: 'luna@example.test', observedAt: NOW - 1000, waiver: 'trial-waiver' });
const { expiresAt: _e, observedAt: _o, waiver: _w, invocationPolicyDigest: _d, ...subject } = facts('sha256:x');
/** One standing grant citing 121996, recorded for the class (or, for the old shape, for one digest). */
const authority = (scopePolicy: Record<string, string>): ActivationAuthorityRecord => sealAuthorityRecord({
  type: 'PreviewActivationAuthority', schemaVersion: 1,
  grants: [{ id: 'justin-121996-tools-class', grantor: OPERATOR, grantee: PREVIEW_DESK, words: WORDS,
    source: { kind: 'telegram-message', topicId: 102965, messageId: 121996 }, issuedAt: NOW - 5000,
    actions: ['activate-subscription-preview'], scope: { ...subject, ...scopePolicy } }],
  waivers: [{ reference: 'trial-waiver', rules: ['rule:38'], grantor: OPERATOR, recordedAt: NOW - 9000,
    source: { kind: 'telegram-message', topicId: 102965, messageId: 2 }, words: WAIVER_WORDS }],
  revocations: [] }, KEY);
const KEY = authoritySealKey(new Uint8Array(32).fill(7));
const message = (messageId: number, text: string, at: number) => ({ messageId, topicId: 102965, text, fromUser: true,
  timestamp: new Date(at).toISOString(), telegramUserId: Number(OPERATOR), forwarded: false, provenance: 'user' });
const classified = (messageId: number, text: string) => ({ topicId: 102965, messageId, classification: 'human',
  bodyHash: createHash('sha256').update(text, 'utf8').digest('hex'), topicBound: true });
const owner: OperatorMessageRecords = { messages: [message(121996, WORDS, NOW - 5000), message(2, WAIVER_WORDS, NOW - 9000)],
  provenance: [classified(121996, WORDS), classified(2, WAIVER_WORDS)],
  bindings: { 102965: { platform: 'telegram', uid: OPERATOR, boundFrom: 'authenticated-inbound', establishmentEvidence: {
    kind: 'authenticated-inbound', authorization: 'telegram-is-authorized-sender', ingress: 'telegram-polling', senderUid: OPERATOR, messageId: '1' } } } };
const resolve = (record: unknown, policy: unknown, digest = digestOf(policy)) =>
  resolveActivationAuthority(facts(digest), record, OPERATOR, BASE, NOW, owner, KEY, policy);
const CLASS_GRANT = authority({ invocationPolicyClass: FULL_TOOLS_CLASS });
/** A copy of `policy` with its launch arguments changed by `edit`. */
const withArgs = (policy: Record<string, unknown>, edit: (args: string[]) => string[]) => ({ ...policy, args: edit([...policy.args as string[]]) });
const setFlag = (flag: string, value: string) => (args: string[]) => { args[args.indexOf(flag) + 1] = value; return args; };

it('the recorded L43 and L44 tools policies are real (their digests are the live grants\') and one class grant covers both', () => {
  expect(recorded.builds.map(b => b.build)).toEqual(['cint-L42-a9e565b2', 'cint-L43-383c1094', 'cint-L44-9ee1c2bd']);
  expect(new Set(recorded.builds.map(b => b.digest)).size).toBe(3);
  for (const build of recorded.builds) expect(digestOf(build.policy)).toBe(build.digest);
  for (const build of recorded.builds.slice(1)) {
    expect(toolsPolicyClassVerdict(FULL_TOOLS_CLASS, build.policy, build.digest)).toEqual({ kind: 'covered', policyClass: FULL_TOOLS_CLASS,
      framing: 'preview-tools-v1', digest: build.digest });
    expect(resolve(CLASS_GRANT, build.policy)).toMatchObject({ kind: 'resolved', action: 'activate-subscription-preview',
      grant: 'justin-121996-tools-class', policyClass: { name: FULL_TOOLS_CLASS, policyDigest: build.digest } });
  }
  // This build's own tools policy (cint-L45 onward) and the Codex doorway's tools policy are in the class too.
  expect(resolve(CLASS_GRANT, subscriptionToolsPolicy(MODEL)).kind).toBe('resolved');
  expect(toolsPolicyClassVerdict(FULL_TOOLS_CLASS, codexToolsPolicy(MODEL), digestOf(codexToolsPolicy(MODEL))).kind).toBe('covered');
  // L42 (six tools, no subagent caps) is outside the class; its own exact-digest grant still covers it, so a rollback keeps tools.
  const l42 = recorded.builds[0]!;
  expect(toolsPolicyClassVerdict(FULL_TOOLS_CLASS, l42.policy, l42.digest)).toMatchObject({ kind: 'outside', reason: expect.stringMatching(/maxChildren/u) });
  expect(resolve(authority({ invocationPolicyDigest: l42.digest }), l42.policy)).toMatchObject({ kind: 'resolved' });
  // The old per-digest grant still covers exactly its own build and no other (the shape that failed at cint-L44).
  const [l43, l44] = [recorded.builds[1]!, recorded.builds[2]!];
  const l43Only = authority({ invocationPolicyDigest: l43.digest });
  expect(resolve(l43Only, l43.policy)).toMatchObject({ kind: 'resolved' });
  expect(resolve(l43Only, l43.policy)).not.toHaveProperty('policyClass');
  expect(resolve(l43Only, l44.policy)).toMatchObject({ kind: 'refused', reason: expect.stringMatching(/does not cover/u) });
});

it('a policy that removes a checkpoint or raises a cap is outside the class and refuses, naming why', () => {
  const l44 = recorded.builds[2]!.policy;
  const outside = (policy: unknown, why: RegExp) => {
    expect(toolsPolicyClassVerdict(FULL_TOOLS_CLASS, policy, digestOf(policy))).toMatchObject({ kind: 'outside', reason: expect.stringMatching(why) });
    expect(resolve(CLASS_GRANT, policy)).toMatchObject({ kind: 'refused',
      reason: expect.stringMatching(new RegExp(`outside the granted class ${FULL_TOOLS_CLASS}: .*a new verified approval is required`, 'u')) });
  };
  outside(withArgs(l44, setFlag('--permission-mode', 'bypassPermissions')), /permission mode/u);       // permission checks off
  outside(withArgs(l44, args => [...args, '--dangerously-skip-permissions']), /dangerously-skip-permissions/u);
  outside(withArgs(l44, args => ['--safe-mode', ...args]), /--safe-mode/u);                              // skips settings hooks: no admission hook
  outside(withArgs(l44, args => ['--bare', ...args]), /--bare/u);
  outside(withArgs(l44, args => [...args, '--settings', '{"disableAllHooks":true}']), /--settings/u);   // replaces the sandbox + hook settings
  outside(withArgs(l44, setFlag('--setting-sources', 'user,project')), /settings sources/u);           // another settings source could
  outside(withArgs(l44, args => args.filter(arg => arg !== '--strict-mcp-config')), /MCP/u);
  outside(withArgs(l44, setFlag('--max-turns', '9')), /turn cap/u);                                     // caps above the reviewed ceilings
  outside(withArgs(l44, setFlag('--max-budget-usd', '5')), /budget cap/u);
  outside({ ...l44, limits: { ...(l44.limits as object), maxChildren: 3 } }, /maxChildren/u);
  outside({ ...l44, limits: { ...(l44.limits as object), maxToolCalls: 33 } }, /maxToolCalls/u);
  outside({ ...l44, retries: 1 }, /retries/u);
  outside(withArgs(codexToolsPolicy(MODEL), args => args.filter(arg => arg !== '--ephemeral')), /session outside the journal/u);
  outside({ ...codexToolsPolicy(MODEL), limits: { maxTurns: 20, timeout: 300000, maxWriteBytes: 1048576 } }, /maxTurns/u);
  // The conversation policy (text only, no tools framing) is never covered by a tools class: the class cannot stand in for
  // the conversation grant.
  outside(subscriptionConversationPolicy(MODEL), /not a tools framing/u);
  // A policy that is not the one the activation names, an unknown class, and a class grant with no presented policy cover nothing.
  expect(toolsPolicyClassVerdict(FULL_TOOLS_CLASS, l44, recorded.builds[1]!.digest)).toMatchObject({ kind: 'outside', reason: expect.stringMatching(/not the one the activation names/u) });
  expect(toolsPolicyClassVerdict('full-tools-anything', l44, digestOf(l44))).toMatchObject({ kind: 'outside', reason: expect.stringMatching(/not known/u) });
  expect(resolveActivationAuthority(facts(digestOf(l44)), CLASS_GRANT, OPERATOR, BASE, NOW, owner, KEY))
    .toMatchObject({ kind: 'refused', reason: expect.stringMatching(/no policy was presented/u) });
  // A grant naming both a class and a digest is ambiguous and covers nothing.
  expect(resolve(authority({ invocationPolicyClass: FULL_TOOLS_CLASS, invocationPolicyDigest: digestOf(l44) }), l44).kind).toBe('refused');
});

it('a class grant keeps every other floor: the operator\'s exact words, the subject, liveness and the seal', () => {
  const l44 = recorded.builds[2]!.policy;
  // Unsealed, or sealed under another trial's key: nothing resolves.
  const { seal: _seal, ...unsealed } = CLASS_GRANT;
  expect(resolve(unsealed, l44).kind).toBe('refused');
  expect(resolveActivationAuthority(facts(digestOf(l44)), CLASS_GRANT, OPERATOR, BASE, NOW, owner, authoritySealKey(new Uint8Array(32).fill(8)), l44).kind).toBe('refused');
  // Words the operator never sent, or a changed subject (another model), refuse.
  const reworded = sealAuthorityRecord({ ...unsealed, grants: [{ ...unsealed.grants[0]!, words: 'all tools, no checkpoints' }] }, KEY);
  expect(resolve(reworded, l44)).toMatchObject({ kind: 'refused', reason: expect.stringMatching(/authenticated operator message/u) });
  expect(resolveActivationAuthority({ ...facts(digestOf(l44)), model: 'claude-other' }, CLASS_GRANT, OPERATOR, BASE, NOW, owner, KEY, l44).kind).toBe('refused');
  // Revoked: refuses.
  const revoked = sealAuthorityRecord({ ...unsealed, revocations: [{ grantId: 'justin-121996-tools-class', at: NOW - 10, by: OPERATOR, source: 'telegram 3' }] }, KEY);
  expect(resolve(revoked, l44)).toMatchObject({ kind: 'refused', reason: expect.stringMatching(/revoked or expired/u) });
});

it('the class reads the effective checkpoints, not labels: a reopened read or a direct Codex provider is outside (review round 1)', () => {
  // The same probe turn the class reads; the passing neighbour is each build's own generated output, unchanged.
  const turn = { scratch: '/private/var/x/s', workspace: '/private/var/x/s/w', stateDirectory: '/Users/p/state',
    hook: { node: '/Users/p/node', script: '/Users/p/tool-admission.mjs' }, deniedRoots: ['/Users/p/root'] };
  const egress = { port: 4321, reads: ['/opt/probe/node'] };
  const gate = 'http://127.0.0.1:4321/0123456789abcdef0123456789abcdef/probe';
  for (const e of [undefined, egress]) {
    const settings = JSON.parse(subscriptionToolSettings({ ...turn, ...(e ? { egress: e } : {}) }, '/Users/p/home'));
    expect(claudeSettingsCheckpoints(JSON.stringify(settings), e)).toBeNull();
    const reopen = (allowRead: unknown) => JSON.stringify({ ...settings, sandbox: { ...settings.sandbox,
      filesystem: { ...settings.sandbox.filesystem, allowRead } } });
    // Astra's probe: the root denial stays, but its exception reopens everything (or the login home, the state, a denied root).
    expect(claudeSettingsCheckpoints(reopen(['/']), e)).toMatch(/the shell reads \/, outside/u);
    expect(claudeSettingsCheckpoints(reopen([...settings.sandbox.filesystem.allowRead, '/Users']), e)).toMatch(/outside its workspace and the reviewed runtime list/u);
    expect(claudeSettingsCheckpoints(reopen([...settings.sandbox.filesystem.allowRead, '/Users/p/home']), e)).toMatch(/outside its workspace/u);
    expect(claudeSettingsCheckpoints(reopen([...settings.sandbox.filesystem.allowRead, '/Users/p/root/x']), e)).toMatch(/outside its workspace/u);
    expect(claudeSettingsCheckpoints(reopen(['/private/var/x/s/../../../Users']), e)).toMatch(/not plain absolute/u);
    expect(claudeSettingsCheckpoints(reopen(['/private/var/x/s/w']), e)).toBeNull();          // narrower reads stay in the class
    // w4-toolpaths: the build's own reads include the /etc and /var link entries (each reopens the link node alone); another
    // root link, or a path under one of them, is still outside the class.
    expect(settings.sandbox.filesystem.allowRead).toEqual(expect.arrayContaining(['/etc', '/var']));
    expect(claudeSettingsCheckpoints(reopen([...settings.sandbox.filesystem.allowRead, '/tmp']), e)).toMatch(/the shell reads \/tmp, outside/u);
    expect(claudeSettingsCheckpoints(reopen([...settings.sandbox.filesystem.allowRead, '/var/log']), e)).toMatch(/the shell reads \/var\/log, outside/u);
  }
  const policyArgs = codexToolsPolicy(MODEL).args;
  const hookArgs = codexToolHookArgs({ ...turn, gate });
  expect(codexDispatchCheckpoint([...policyArgs, ...hookArgs])).toBeNull();
  const at = hookArgs.findIndex(arg => arg.startsWith('model_provider='));
  const replaced = (extra: string[]) => [...hookArgs.slice(0, at - 1), ...extra, ...hookArgs.slice(at + 3)];
  // Astra's probe: the gate arguments replaced by a bare provider label, hooks and limits intact.
  expect(codexDispatchCheckpoint([...policyArgs, ...replaced(['-c', 'model_provider=openai'])])).toMatch(/not defined exactly once/u);
  expect(codexDispatchCheckpoint([...policyArgs, ...replaced(['-c', 'model_provider=instar-gate', '-c',
    'model_providers.instar-gate={name="OpenAI",base_url="https://api.openai.com/v1",wire_api="responses",requires_openai_auth=true}'])]))
    .toMatch(/does not target the turn's checkpoint/u);
  expect(codexDispatchCheckpoint([...policyArgs, ...hookArgs, '-c', 'model_provider=openai'])).toMatch(/no single selected provider/u);
  expect(codexDispatchCheckpoint([...policyArgs, ...hookArgs, '-c', 'model_providers.instar-gate.base_url="https://x"'])).toMatch(/another provider or base URL/u);
  expect(codexDispatchCheckpoint([...policyArgs, ...hookArgs, '-c', 'openai_base_url="https://x"'])).toMatch(/another provider or base URL/u);
  expect(codexDispatchCheckpoint([...policyArgs, '--profile', 'direct', ...hookArgs])).toMatch(/profile or local provider/u);
  // A policy whose own arguments select a direct provider is outside the class through the full verdict too.
  const direct = withArgs(codexToolsPolicy(MODEL) as unknown as Record<string, unknown>, args => [...args, '-c', 'model_provider=openai']);
  expect(toolsPolicyClassVerdict(FULL_TOOLS_CLASS, direct, digestOf(direct))).toMatchObject({ kind: 'outside', reason: expect.stringMatching(/dispatch checkpoint/u) });
});

// Rule 36 (observer note #106) for the scoped-tool turn (Part Thirteen §9, docs/17-harness-adapters): the new path replayed on REAL recorded shapes, not
// stubs alone. (1) The five live tool turns of 2026-10-03 (fixtures/tool-turn/live-2026-10-03, recorded verbatim
// by tests/integration/tool-turn-live.test.ts against the pinned 2.1.280): their tool calls replay through the
// real hook to the recorded decisions, their traces pair, and their multi-turn result frames parse through the
// tools route to the recorded answers. (2) Earlier real outputs (live-declarations-2026-09-28 answers, the
// spike's error_max_turns and error_max_budget_usd frames, the first live refusal frame) return through the
// tools route exactly as through the text-only route, so the existing answer, review and send handling applies.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionConversationPolicy, subscriptionToolsPolicy, SUBSCRIPTION_CONVERSATION_FRAMING,
  SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_TOOLS_FRAMING } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
// @ts-expect-error Plain JavaScript.
import { toolTrace } from './tool-admission.mjs';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const LIVE = join(__dirname, 'fixtures/tool-turn/live-2026-10-03');
const SPIKE = join(__dirname, 'fixtures/tool-turn/spike-cab6b51d');
const HOOK = join(__dirname, 'tool-admission-hook.mjs');
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const hash = (v: unknown) => (canonical(v) as { kind: 'Success'; value: { hash: string } }).value.hash;
type LiveRecord = { name: string; state: string | null; raw: string | null; answer: string | null; admission: string; error: string | null;
  stopToSettledMs: number | null };
const live = (name: string): LiveRecord => JSON.parse(readFileSync(join(LIVE, `${name}.json`), 'utf8'));
const rows = (admission: string) => admission.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

/** A route over a synthetic CLI that prints whatever frame was last placed in `frame.txt`. */
function routeFixture() {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-replay-route-'))); roots.push(root);
  const home = join(root, 'home'), configDirectory = join(root, 'config'), workingDirectory = join(root, 'work');
  const scratch = realpathSync(mkdtempSync('/private/tmp/itt-')); roots.push(scratch);
  const workspace = join(scratch, 'ws'), stateDirectory = join(root, 'turn/state'), frame = join(root, 'frame.txt');
  for (const path of [home, configDirectory, workingDirectory, workspace, stateDirectory]) mkdirSync(path, { recursive: true, mode: 0o700 });
  const status = { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', analyticsDisabled: true,
    projectsDirectory: `${configDirectory}/projects`, configDirectory, email: 'synthetic@example.invalid', orgId: 'org', orgName: 'o', subscriptionType: 'max' };
  const executable = join(root, 'cli.mjs');
  const source = `#!${process.execPath}\nimport {readFileSync} from 'node:fs';let s='';for await(const c of process.stdin)s+=c;
if(process.argv[2]==='--version')process.stdout.write('2.1.280 (Claude Code)\\n');
else if(process.argv[2]==='auth')process.stdout.write(${JSON.stringify(JSON.stringify(status))});
else { const t=readFileSync(${JSON.stringify(frame)},'utf8'); process.stdout.write(t); if(JSON.parse(t).is_error===true) process.exitCode=1; }\n`;
  writeFileSync(executable, source); chmodSync(executable, 0o700);
  const physical = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false });
  const io = { ...physical, managedHooksDisabled: () => false };
  const seed = { type: 'ProviderSubscriptionProfile' as const, schemaVersion: 1 as const, reference: 'subscription-login', home, configDirectory,
    workingDirectory, expectedAccount: status.email, organization: status.orgId, plan: 'max' as const, executable,
    artifact: `sha256:${createHash('sha256').update(source).digest('hex')}`, version: '2.1.280', activationReference: 'activation:replay',
    loginProfileIdentity: '', managedConfigurationDigest: '' };
  const profile: ProviderSubscriptionProfile = Object.freeze({ ...seed, ...physical.inspectSubscriptionProfile(seed) });
  const model = 'claude-sonnet-5', ctx = { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] } };
  const route = (framing: typeof SUBSCRIPTION_TOOLS_FRAMING | typeof SUBSCRIPTION_CONVERSATION_FRAMING) => {
    const policy = framing === SUBSCRIPTION_TOOLS_FRAMING ? subscriptionToolsPolicy(model) : subscriptionConversationPolicy(model);
    const activation: SubscriptionActivationRecord = { type: 'SubscriptionActivationRecord', schemaVersion: 1, reference: profile.activationReference,
      waiver: 'replay', p11: 'replay', reviewedHead: 'replay', trial: 'replay', baseConfigurationDigest: hash('replay'), profileDigest: hash(profile),
      executable, artifact: profile.artifact, version: '2.1.280', model, invocationPolicyDigest: hash(policy), expectedAccount: status.email,
      observedAccount: status.email, authSource: 'claude.ai', operatorAssertion: 'replay', assertedAt: 1, observer: 'replay', observedAt: 2,
      method: 'replay', safeCaptureReference: 'replay', extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'offline replay only',
      subscriptionLimit: 'unobservable', subscriptionLimitReason: 'offline replay only', acceptedResiduals: ['replay'], expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY };
    return { policy, route: value(createClaudeCodeSubscriptionRoute({ provider: 'anthropic', model, route: 'preview-subscription', disclosure: 'replay',
      credential: value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: profile.reference }, ctx)),
      context: { ...ctx, site: f.c.site, preserved: f.c.preserved }, profile, resolveProfile: () => profile, activation, io, now: () => 1000,
      active: () => true, framing, ...(framing === SUBSCRIPTION_TOOLS_FRAMING ? { toolTurn: { scratch, workspace, stateDirectory, deniedRoots: [root],
        hook: { node: process.execPath, script: HOOK } } } : {}),
      adapterEvidenceContract: { reference: profile.activationReference, version: hash(profile), parserReference: 'claude-code-json-result', parserVersion: '1',
        endpoint: profile.loginProfileIdentity, account: status.email, credentialReference: profile.reference, controller: 'replay',
        sourceEvidence: ['replay'], terminalEvidence: 'replay', terminalReasonField: 'subtype', successfulFinalReplyReasons: ['success'],
        strength: 'observation' as const, maxMetadataBytes: 8192, maxRawTerminalBytes: 65536, maxCaptureBytes: 1048576 } })) };
  };
  const invoke = async (framing: Parameters<typeof route>[0], raw: string) => {
    writeFileSync(frame, raw);
    const { policy, route: r } = route(framing);
    return r.invoke('{"replay":true}', { operation: 'replay', deadline: 10_000_000, timeout: 20000, maxOutputBytes: policy.maxOutputBytes,
      maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 });
  };
  return { invoke };
}
const answerOf = (bytes: string | null | undefined) => {
  if (!bytes) return null;
  const parsed = parseModelJson(bytes, { wrapped: 'accept' });
  return parsed.ok ? conclusionText((parsed.value as { conclusion: { value: unknown } }).conclusion.value as never) : 'malformed';
};

it('replays the five live tool turns: hook decisions, trace pairing, and the recorded answers through the tools route', async () => {
  const route = routeFixture();
  const expected: Record<string, string[][]> = { 'r6-fixed': [['Bash', 'allow']], task: [['Write', 'allow'], ['Read', 'allow'], ['Bash', 'allow']],
    // Re-recorded after review round 1: the hook admits the network command and the sandbox refuses it (scope).
    scope: [['Read', 'deny'], ['Bash', 'allow']], stop: [['Bash', 'allow']],
    'call-cap': [['Bash', 'allow'], ['Bash', 'allow'], ['Bash', 'deny'], ['Bash', 'deny'], ['Bash', 'deny'], ['Bash', 'deny']] };
  for (const name of Object.keys(expected)) {
    const record = live(name), recorded = rows(record.admission);
    expect([name, recorded.filter(row => row.phase === 'pre').map(row => [row.tool, row.decision])]).toEqual([name, expected[name]]);
    // The recorded tool inputs, re-admitted by the real hook in a fresh workspace, reach the same decisions.
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-live-replay-'))); roots.push(root);
    const ws = join(root, 'ws'), state = join(root, 'state'); mkdirSync(ws); mkdirSync(state);
    writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, tmp: join(root, 'tmp'), maxCalls: name === 'call-cap' ? 2 : 16, maxWriteBytes: 1048576,
      operations: [...SINGLE_MACHINE_PROFILE.operations] }));
    for (const row of recorded.filter(item => item.phase === 'pre')) {
      const original = JSON.parse(row.input), path = original.file_path as string | undefined;
      const workspacePrefix = path?.includes('/ws/') ? path.slice(0, path.indexOf('/ws/') + 3) : null;
      const input = workspacePrefix ? JSON.parse(JSON.stringify(original).split(workspacePrefix).join(ws)) : original;
      const r = spawnSync(process.execPath, [HOOK, 'pre', state], { input: JSON.stringify({ tool_name: row.tool, tool_input: input, tool_use_id: row.id }), encoding: 'utf8' });
      expect([name, row.n, /"permissionDecision":"(\w+)"/u.exec(r.stdout)?.[1] ?? 'allow']).toEqual([name, row.n, row.decision]);
    }
    const trace = toolTrace(record.admission.trim().split('\n'));
    expect([name, trace.consistent]).toEqual([name, true]);
    if (record.raw === null) { expect([name, record.state]).toEqual(['stop', 'uncertain']); continue; }
    const frame = JSON.parse(record.raw);
    expect(frame.num_turns).toBeGreaterThan(1);
    const observed = await route.invoke(SUBSCRIPTION_TOOLS_FRAMING, record.raw);
    expect([name, observed.state, answerOf(observed.bytes)]).toEqual([name, 'complete', record.answer]);
  }
  expect(live('task').answer).toMatch(/\b11\b/u);
  expect(live('stop').stopToSettledMs).toBeLessThan(3000);
});

it('returns earlier real outputs through the tools route exactly as through the text-only route', { timeout: 120000 }, async () => {
  const route = routeFixture();
  const declarations = JSON.parse(readFileSync(join(__dirname, 'fixtures/live-declarations-2026-09-28.json'), 'utf8'));
  const outputs: string[] = [...declarations.current.answers, ...declarations.fixed.answers, ...declarations.current.reviews, ''];
  const frameFor = (result: string) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result, num_turns: 3,
    session_id: 'replay', usage: { input_tokens: 5, output_tokens: 400, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
  for (const output of outputs) {
    const tools = await route.invoke(SUBSCRIPTION_TOOLS_FRAMING, frameFor(output));
    const plain = await route.invoke(SUBSCRIPTION_CONVERSATION_FRAMING, frameFor(output));
    expect([tools.state, tools.bytes, answerOf(tools.bytes)]).toEqual([plain.state, plain.bytes, answerOf(plain.bytes)]);
  }
  // The fenced live answers are tolerated, not refused, and an empty result stays empty (the runner's 'empty' class).
  expect(answerOf((await route.invoke(SUBSCRIPTION_TOOLS_FRAMING, frameFor(declarations.current.answers[0]))).bytes)).toMatch(/^PREVIEW/u);
  expect((await route.invoke(SUBSCRIPTION_TOOLS_FRAMING, frameFor(''))).bytes).toBe('');
  // Real cap frames from the spike: the turn cap and the budget backstop end the call as rejected, never as an answer.
  for (const run of ['d1-turncap', 'd3-budget']) {
    const result = readFileSync(join(SPIKE, run, 'out.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)).find(row => row.type === 'result');
    expect(result.is_error).toBe(true);
    expect([run, (await route.invoke(SUBSCRIPTION_TOOLS_FRAMING, JSON.stringify(result))).state]).toEqual([run, 'rejected']);
  }
  // The first live refusal frame keeps the outcome the text-only route gives it.
  const refusal = Buffer.from(JSON.parse(readFileSync(join(__dirname, 'fixtures/stage2-first-live-refusal.json'), 'utf8')).rawBase64, 'base64').toString('utf8');
  expect((await route.invoke(SUBSCRIPTION_TOOLS_FRAMING, refusal)).state).toBe((await route.invoke(SUBSCRIPTION_CONVERSATION_FRAMING, refusal)).state);
});

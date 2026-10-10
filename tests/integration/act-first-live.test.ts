// Opt-in real model replay through the shipped scoped tool route; no messages are sent.
// Captured input and output stay in the absolute desk evidence directory. The compact,
// redacted fixture is replayed by tests/preview/act-first.test.ts in the ordinary gate.
import { replyReviewContext, replyReviewQuestion, parseReplyReviewVerdict, REVIEW_FORMAT_REMINDER, guidanceReviewRules, sharedAudience } from '../preview/reply-check.js';
import { ANSWER_INSTRUCTIONS } from '../preview/briefing.js';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionToolsPolicy, subscriptionConversationPolicy, SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, SUBSCRIPTION_PREVIEW_EXPIRY,
  SUBSCRIPTION_TOOLS_FRAMING } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord, SubscriptionToolTurn } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { openPreviewJournal } from '../preview/journal.js';
import { prepareJournalEnvelope } from '../preview/journal-envelope.js';
import { readAnswer } from '../preview/answer-reading.js';
import { SINGLE_MACHINE_PROFILE } from '../preview/activation-authority.js';
import { redact } from '../../src/recall/redact.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { runToolTurn, scratchMounted } from '../preview/tool-turn.mjs';

// @ts-expect-error Physical host JavaScript.
import { harnessGate } from '../preview/harness-user.mjs';
// @ts-expect-error Physical host JavaScript.
import { hostResources } from '../../scripts/resource-owner.mjs';

let attached = false;
const LIVE = process.env.INSTAR_ACT_FIRST_LIVE === '1';
const PROFILE = process.env.INSTAR_ACT_FIRST_PROFILE ?? '';
const MODEL = 'claude-sonnet-5';
const RECORD = process.env.INSTAR_ACT_FIRST_RECORD ?? '';
const CAPTURE = process.env.INSTAR_ACT_FIRST_CAPTURE ?? '';
if (LIVE && (!PROFILE || !RECORD.startsWith('/') || !CAPTURE.startsWith('/')))
  throw Error('Live replay requires an explicit harness profile and absolute capture/evidence paths');
const scratch = LIVE ? realpathSync(mkdtempSync('/private/tmp/act-first-live-')) : '';
afterAll(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); });
/** The register's own irreversible term, read from the committed shape as the runner reads it. */
const IRREVERSIBLE = JSON.parse(readFileSync(join(__dirname, '../../register-source/bootstrap-shape.json'), 'utf8')).derivedFrom.irreversible;
const hash = (v: unknown) => (canonical(v) as { kind: 'Success'; value: { hash: string } }).value.hash;

/** One case: a fresh scratch root and journal, one prepared answer envelope, one tool turn through the real route. */
async function liveCase(name: string, question: string, options: { prepared?: string; review?: boolean } = {}) {
  const f = factsFixture(), root = join(scratch, name); mkdirSync(root, { mode: 0o700 });
  const profile: ProviderSubscriptionProfile = Object.freeze(JSON.parse(readFileSync(PROFILE, 'utf8')));
  const gate = harnessGate({ profile, denied: [realpathSync(root), homedir(), process.cwd()], clock: () => performance.now() });
  expect(gate.state, gate.state.reason).toMatchObject({ ready: true });
  const harness = gate.current();
  if (!attached) { await hostResources.attach({ harnessUid: harness.uid }); attached = true; }
  const stop = false;
  const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => stop,
    runAs: { user: harness.user, launcher: harness.launcher, login: harness.login, plan: harness.plan } });
  const now = Date.now();
  const policy = options.review ? subscriptionConversationPolicy(MODEL) : subscriptionToolsPolicy(MODEL);
  // A scratch activation bound to the tools policy digest, for this test's own route only (no live file changes).
  const activation: SubscriptionActivationRecord = { type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: profile.activationReference, waiver: 'w4-act-first integration test', p11: 'scratch', reviewedHead: 'w4-act-first',
    trial: 'scratch', baseConfigurationDigest: hash('scratch'), profileDigest: hash(profile), executable: profile.executable,
    artifact: profile.artifact, version: profile.version, model: MODEL, invocationPolicyDigest: hash(policy),
    expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount, authSource: 'claude.ai',
    operatorAssertion: 'scratch test', assertedAt: now - 2000, observer: 'w4-act-first', observedAt: now - 1000, method: 'scratch',
    safeCaptureReference: 'scratch', extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'scratch integration test',
    subscriptionLimit: 'unobservable', subscriptionLimitReason: 'scratch integration test', acceptedResiduals: ['scratch test'],
    expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY };
  const ctx = { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(3), { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:scratch', configurationDigest: 'sha256:scratch', expires: SUBSCRIPTION_PREVIEW_EXPIRY,
    maxCalls: 40, maxReplies: 10, maxTurns: 10, maxBytes: 131072, cursor: 0 });
  const id = 'telegram:12345678:update:1';
  const packet = { now: new Date(now).toISOString(), audience: 'operator', sources: [], history: [] };
  const prepared = options.prepared ?? prepareJournalEnvelope({ question, context: JSON.stringify(packet), id }, MODEL, 'grant:scratch', now, 131072);
  const seen: { stateDirectory: string; raw: string | null; observed: { state: string; bytes?: string | null } | null }
    = { stateDirectory: '', raw: null, observed: null };
  const started = performance.now();
  const outcome = await runToolTurn({ journal, root, id, prepared, promptLimit: 131072, deniedRoots: [root, profile.home, profile.configDirectory,
    profile.workingDirectory], operations: SINGLE_MACHINE_PROFILE.operations, irreversibleTerm: IRREVERSIBLE,
    harness, stopped: () => stop, now: () => Date.now(), redactText: (t: string) => redact(t).text,
    fallback: async () => ({ result: 'fallback' }),
    invoke: async (turn: SubscriptionToolTurn) => {
      seen.stateDirectory = turn.stateDirectory;
      const route = value(createClaudeCodeSubscriptionRoute({ provider: 'anthropic', model: MODEL, route: 'preview-subscription',
        disclosure: 'scratch integration test', credential: value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1,
          vault: 'preview', name: profile.reference }, ctx)), context: { ...ctx, site: f.c.site, preserved: f.c.preserved },
        profile, resolveProfile: () => profile, activation, io, now: () => Date.now(), active: () => !stop,
        framing: options.review ? SUBSCRIPTION_CONVERSATION_FRAMING : SUBSCRIPTION_TOOLS_FRAMING, ...(options.review ? {} : { toolTurn: turn }), raisedPromptBytes: 131072, promptAuthority: 'scratch replay', adapterEvidenceContract: { reference: activation.reference,
          version: activation.profileDigest, parserReference: 'claude-code-json-result', parserVersion: '1',
          endpoint: profile.loginProfileIdentity, account: profile.expectedAccount, credentialReference: profile.reference,
          controller: 'w4-act-first-live', sourceEvidence: ['scratch'], terminalEvidence: 'scratch', terminalReasonField: 'subtype',
          successfulFinalReplyReasons: ['success'], strength: 'observation', maxMetadataBytes: policy.maxMetadataBytes,
          maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes } }));
      const result = await route.invoke(prepared, { operation: id, deadline: Date.now() + policy.timeout + 30000, timeout: policy.timeout,
          maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 });
      seen.raw = result.responseEvidenceDraft ? Buffer.from(result.responseEvidenceDraft.terminal.rawBase64, 'base64').toString('utf8') : null;
      seen.observed = { state: result.state, bytes: result.bytes };
      writeFileSync(join(RECORD, name + '-route.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
      return result;
    } }).catch((error: Error) => ({ error: error.message }));
  const settled = performance.now();
  const { stateDirectory, raw, observed } = seen;
  const admission = existsSync(join(stateDirectory, 'admission.jsonl')) ? readFileSync(join(stateDirectory, 'admission.jsonl'), 'utf8') : '';
  const reading = observed?.bytes ? readAnswer(observed.bytes, { wrapped: 'accept' }) : null;
  const answer = reading?.ok ? reading.value : null;
  const mountedAfter = stateDirectory ? scratchMounted(dirname(stateDirectory)) : null;
  const record = { name, question, prepared, system: options.review ? SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT : SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, state: observed?.state ?? null, raw, answer, mountedAfter,
    reason: reading?.ok ? reading.reason : null, admission, error: 'error' in outcome ? outcome.error : null,
    elapsedMs: Math.round(settled - started),
    toolTurns: journal.view.toolTurns, calls: journal.view.calls, ...(journal.view.effectDoorway ? { effectDoorway: journal.view.effectDoorway } : {}) };
  mkdirSync(RECORD, { recursive: true });
  writeFileSync(join(RECORD, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

const toolCalls = (record: Awaited<ReturnType<typeof liveCase>>) => record.admission.trim().split('\n').filter(Boolean)
  .map(line => JSON.parse(line)).filter(row => row.phase === 'pre');

it.runIf(LIVE)('replays the recorded comparison through web reads before a cited answer', { timeout: 400000 }, async () => {
  const captured = JSON.parse(readFileSync(CAPTURE, 'utf8')).turns.find((turn: { update: number }) => turn.update === 969390343);
  const envelope = JSON.parse(captured.prompt);
  envelope.messages.find((message: { role: string }) => message.role === 'instructions').content = ANSWER_INSTRUCTIONS;
  const record = await liveCase('compare', captured.text, { prepared: JSON.stringify(envelope) });
  expect(record.error).toBeNull();
  expect(toolCalls(record).some(row => ['WebSearch', 'WebFetch'].includes(row.tool) && row.decision === 'allow')).toBe(true);
  expect(record.answer, 'The real answer must pass the shipped parser').toBeTypeOf('string');
  expect(record.answer).toMatch(/https:\/\//u);
  expect(record.answer).not.toMatch(/if you want.{0,40}(search|look)|shall I (search|look)|just say so/iu);
  expect(record.mountedAfter).toBe(false);
});

it.runIf(LIVE)('a plain read runs without a second ask', { timeout: 400000 }, async () => {
  const record = await liveCase('plain-read', 'Look up the purpose of example.com and tell me, with its source.');
  expect(record.error).toBeNull();
  expect(toolCalls(record).some(row => ['WebSearch', 'WebFetch', 'Bash'].includes(row.tool) && row.decision === 'allow')).toBe(true);
  expect(record.answer).toMatch(/https:\/\/(?:[^\s]*example\.com|www\.iana\.org\/help\/example-domains)/u);
  expect(record.answer).not.toMatch(/if you want|shall I|need your permission|would you like/iu);
});

it.runIf(LIVE)('an unsuccessful read reports the actual attempt and uncertainty', { timeout: 400000 }, async () => {
  const record = await liveCase('failed-read', 'Read https://instar-act-first-missing.invalid/report and tell me what the report says.');
  expect(record.error).toBeNull();
  expect(toolCalls(record).some(row => ['WebFetch', 'Bash'].includes(row.tool))).toBe(true);
  expect(record.answer).toMatch(/tried|attempt|fetch|reach|access/iu);
  expect(record.answer).toMatch(/couldn.t|cannot|can.t|fail|unable|no report|did not/iu);
  expect(record.answer).not.toMatch(/shall I|if you want.{0,40}(fetch|try|read)/iu);
});

it.runIf(LIVE)('the real reviewer flags the recorded offer and accepts completed and failed reads', { timeout: 400000 }, async () => {
  const original = JSON.parse(readFileSync(CAPTURE, 'utf8')).turns.find((turn: { update: number }) => turn.update === 969390343);
  for (const name of ['original', 'compare', 'failed-read']) {
    const candidate = name === 'original' ? original : JSON.parse(readFileSync(join(RECORD, name + '.json'), 'utf8'));
    const answer = candidate.answer;
    const prompt = candidate.prepared ?? candidate.prompt;
    const selected = guidanceReviewRules(['parks_on_user', 'defers_work', 'unrecorded_blocker'], sharedAudience(prompt));
    const question = replyReviewQuestion(selected);
    const context = replyReviewContext(prompt, answer, selected);
    const prepared = (retry: boolean) => prepareJournalEnvelope({ question,
      context: retry ? JSON.stringify({ ...JSON.parse(context), formatReminder: REVIEW_FORMAT_REMINDER }) : context,
      id: original.id + ':reply-review' }, MODEL, 'grant:scratch-review', Date.now(), 131072);
    let record = await liveCase(name + '-review', question, { prepared: prepared(false), review: true });
    expect(record.error).toBeNull();
    let verdict;
    try { verdict = parseReplyReviewVerdict(record.answer!, selected); }
    catch {
      // The shipped review allows exactly one format repair, never a semantic retry.
      writeFileSync(join(RECORD, name + '-review-format-miss.json'), JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
      record = await liveCase(name + '-review-retry', question, { prepared: prepared(true), review: true });
      verdict = parseReplyReviewVerdict(record.answer!, selected);
      writeFileSync(join(RECORD, name + '-review.json'), JSON.stringify({ ...record, name: name + '-review' }, null, 2) + '\n', { mode: 0o600 });
    }
    expect(verdict.findings?.find(row => row.rule === 'parks_on_user')?.verdict, record.answer ?? '').toBe(name === 'original' ? 'violation' : 'pass');
  }
});

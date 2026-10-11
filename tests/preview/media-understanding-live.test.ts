import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionToolsPolicy, SUBSCRIPTION_PREVIEW_EXPIRY,
  SUBSCRIPTION_TOOLS_FRAMING } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord, SubscriptionToolTurn } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope, withWorkspaceNotice } from './journal-envelope.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { createSecretCustody } from './secret-custody.js';
import { redact } from '../../src/recall/redact.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { hostResources } from '../../scripts/resource-owner.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { runToolTurn } from './tool-turn.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { harnessGate, HARNESS_USER, plaintextLogins } from './harness-user.mjs';

// @ts-expect-error Host media bridge.
import { prepareMediaInput, invokeMediaTurn, protectMediaBytes } from './media-understanding.mjs';
// @ts-expect-error Offline host transcriber.
import { createLocalTranscriber } from '../../scripts/local-transcriber.mjs';
const LIVE = process.env.INSTAR_MEDIA_LIVE_TEST === '1';
const PROFILE = process.env.INSTAR_MEDIA_HARNESS_PROFILE ?? '/Users/Shared/instar-harness/profile.json';
const RECORD = join(__dirname, 'fixtures/media-understanding/recorded');
const MODEL = 'claude-sonnet-5';
const scratch = LIVE ? realpathSync(mkdtempSync('/private/tmp/media-understanding-live-')) : '';
afterAll(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); });
const hash = (v: unknown) => (canonical(v) as { kind: 'Success'; value: { hash: string } }).value.hash;
const harnessProcesses = () => 'Not sampled globally: other live runners share this user.';
let attached: { uid: number } | null = null;
async function liveTurn(name: string, question: string, stopWhen?: (rows: Record<string, unknown>[]) => boolean,
  mcp: { servers: Record<string, unknown>; reads: string[]; digest: string } | null = null, attachment: unknown = null) {
  const profile: ProviderSubscriptionProfile = Object.freeze(JSON.parse(readFileSync(PROFILE, 'utf8')));
  const root = join(scratch, name); mkdirSync(root, { mode: 0o700 });
  const gate = harnessGate({ profile, denied: [realpathSync(root), homedir(), process.cwd()], clock: () => performance.now() });
  expect(gate.state, gate.state.reason).toMatchObject({ ready: true, user: HARNESS_USER });
  const harness = gate.current();
  if (!attached) { await hostResources.attach(); attached = { uid: harness.uid }; }
  const f = factsFixture();
  let stop = false;
  const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => stop,
    runAs: { user: harness.user, launcher: harness.launcher, login: harness.login, plan: harness.plan } });
  const now = Date.now();
  const policy = subscriptionToolsPolicy(MODEL);
  const activation: SubscriptionActivationRecord = { type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: profile.activationReference, waiver: 'harness-user integration test', p11: 'scratch', reviewedHead: 'w4-harnessuser',
    trial: 'scratch', baseConfigurationDigest: hash('scratch'), profileDigest: hash(profile), executable: profile.executable,
    artifact: profile.artifact, version: profile.version, model: MODEL, invocationPolicyDigest: hash(policy),
    expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount, authSource: 'claude.ai',
    operatorAssertion: 'scratch test', assertedAt: now - 2000, observer: 'harness-user', observedAt: now - 1000, method: 'scratch',
    safeCaptureReference: 'scratch', extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'scratch integration test',
    subscriptionLimit: 'unobservable', subscriptionLimitReason: 'scratch integration test', acceptedResiduals: ['scratch test'],
    expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY };
  const ctx = { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(3), { kind: 'genesis', bot: '12345678',
    chat: '7654321', operator: '7654321', grant: 'grant:scratch', configurationDigest: 'sha256:scratch', expires: SUBSCRIPTION_PREVIEW_EXPIRY,
    maxCalls: 40, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  const id = 'telegram:12345678:update:1';
  const lookup = (source: string) => source === id ? attachment : null;
  const prepared = prepareJournalEnvelope(prepareMediaInput({ question, context: JSON.stringify({ now: new Date(now).toISOString(), audience: 'operator', sources: [], history: [] }), id }, lookup, (text: string) => redact(text).text),
    MODEL, 'grant:scratch', now, 32768);
  const appended: unknown[] = [];
  const recorder = { get view() { return journal.view; }, append: (row: never) => { appended.push(row); return journal.append(row); } };
  let stateDirectory = '', mcpConfig: string | null = null, stoppedAt: number | null = null;
  const rowsOf = (state: string) => { try { return readFileSync(join(state, 'admission.jsonl'), 'utf8').trim().split('\n').filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>); } catch { return []; } };
  const outcome = await runToolTurn({ journal: recorder, root, id, prepared, promptLimit: 32768, deniedRoots: [root, profile.home, profile.configDirectory,
    profile.workingDirectory], operations: SINGLE_MACHINE_PROFILE.operations, now: () => Date.now(), redactText: (t: string) => redact(t).text,
    authority: `${activation.reference} ${activation.invocationPolicyDigest}`, mcp, stopped: () => stop, harness,
    fallback: async () => ({ result: 'fallback' }),
    invoke: async (turn: SubscriptionToolTurn) => {
      stateDirectory = turn.stateDirectory; mcpConfig = turn.mcp?.config ?? null;
      const route = value(createClaudeCodeSubscriptionRoute({ provider: 'anthropic', model: MODEL, route: 'preview-subscription',
        disclosure: 'scratch integration test', credential: value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1,
          vault: 'preview', name: profile.reference }, ctx)), context: { ...ctx, site: f.c.site, preserved: f.c.preserved },
        profile, resolveProfile: () => profile, activation, io, now: () => Date.now(), active: () => !stop,
        framing: SUBSCRIPTION_TOOLS_FRAMING, toolTurn: turn, adapterEvidenceContract: { reference: activation.reference,
          version: activation.profileDigest, parserReference: 'claude-code-json-result', parserVersion: '1',
          endpoint: profile.loginProfileIdentity, account: profile.expectedAccount, credentialReference: profile.reference,
          controller: 'harness-user-live', sourceEvidence: ['scratch'], terminalEvidence: 'scratch', terminalReasonField: 'subtype',
          successfulFinalReplyReasons: ['success'], strength: 'observation', maxMetadataBytes: policy.maxMetadataBytes,
          maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes } }));
      const watcher = stopWhen ? setInterval(() => { if (!stop && stopWhen(rowsOf(turn.stateDirectory))) { stop = true; stoppedAt = performance.now(); } }, 20) : undefined;
      try {
        return await invokeMediaTurn(id, turn, lookup, (notice: string) => route.invoke(withWorkspaceNotice(prepared, notice), { operation: id, deadline: Date.now() + policy.timeout + 30000, timeout: policy.timeout,
          maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 }),
          (bytes: Buffer, source: string) => protectMediaBytes(bytes, source,
            createSecretCustody(root, new Uint8Array(32).fill(3), () => Date.now()), () => ({ values: [], unavailable: null })));
      } finally { clearInterval(watcher); }
    } }).catch((error: Error) => ({ error: error.message }));
  const settled = performance.now();
  const rows = rowsOf(stateDirectory);
  const trace = appended.find(row => (row as { phase?: string }).phase === 'trace') as { harness?: unknown } | undefined;
  const response = (outcome as { result?: { bytes?: string; state?: string } }).result;
  const answer = 'error' in outcome ? null : response?.bytes ?? null;
  const record = { name, question, error: 'error' in outcome ? outcome.error : null, answer,
    state: response?.state, rows, trace, toolTurns: journal.view.toolTurns,
    plaintextLoginsAfter: plaintextLogins(profile),
    provenance: '2026-10-10 real Claude Code confined tool route on synthetic media; no Telegram send or live media copy' };
  mkdirSync(RECORD, { recursive: true });
  writeFileSync(join(RECORD, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  journal.close();
  return record;
}

it.runIf(LIVE)('real confined harness answers from a synthetic image, local OGG transcript and unreadable file', { timeout: 400000 }, async () => {
  const image = await liveTurn('image', 'What shapes and colors are in the photo? Describe their positions.', undefined, null,
    { media: { kind: 'photo', name: 'photo.jpg' }, saved: { bytes: readFileSync(new URL('./fixtures/media-understanding/shapes.jpg', import.meta.url)) } });
  expect(image.error).toBeNull();
  expect(image.answer).toMatch(/green/i); expect(image.answer).toMatch(/circle/i);
  expect(image.answer).toMatch(/blue/i); expect(image.answer).toMatch(/square/i);
  expect(image.rows.some((row: Record<string, unknown>) => JSON.stringify(row).includes('attachment.jpg'))).toBe(true);
  const transcript = await createLocalTranscriber()(readFileSync(new URL('./fixtures/media-understanding/meeting.ogg', import.meta.url)));
  expect(transcript).toMatch(/Tuesday.*9|Tuesday.*nine/i);
  const voice = await liveTurn('voice', 'When is the meeting mentioned in my voice note?', undefined, null,
    { media: { kind: 'voice', name: 'voice.ogg' }, saved: { transcription: { state: 'complete', text: transcript } } });
  expect(voice.error).toBeNull(); expect(voice.answer).toMatch(/Tuesday/i); expect(voice.answer).toMatch(/9|nine/i);
  const unreadable = await liveTurn('unreadable', 'What is in this photo?', undefined, null,
    { media: { kind: 'photo', name: 'photo.jpg' }, saved: { bytes: Buffer.from('synthetic corrupt image') } });
  expect(unreadable.error).toBeNull(); expect(unreadable.answer).toMatch(/unreadable|couldn.t|cannot|can.t|not.*valid|corrupt/i);
});

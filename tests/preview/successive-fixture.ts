// @ts-nocheck -- offline substitutes for the successive adapter; never imported by the launcher.
// Only physical IO is substituted: a file-backed Telegram Bot API and a synthetic
// subscription CLI. Every owner, the driver, recall and the context packet are real.
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionProviderIO, productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { canonical } from '../../src/index.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { conversationFixture } from '../conversation/fixture.js';
import { value } from '../facts/fixtures.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { HOST_OUTAGE_TEXT, initializeSuccessiveRoot, openPreviewState } from './state.js';
import { createSuccessiveComposition } from './successive.js';
import { encoded } from './stage2-provider.js';

export const OPERATOR = 7812716706;
const START = 1790000000000;
const base = Object.freeze({ machine: 'preview-test-machine', botId: '8820318295', botUsername: '@echo_mmtest_seam_b27x_bot',
  operatorSenderId: String(OPERATOR), chatId: String(OPERATOR), chatKind: 'private', forum: false, messageThreadId: null,
  maxPollSeconds: 1, maxBatchItems: 8, maxContextTurns: 8, maxContextBytes: 65536 });
const stateConfiguration = (root: string) => ({ ...base, root, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY, replyLimit: 6,
  replyWindowMs: 60000, errorLimit: 20, maxPendingTurns: 16, maxTrialTurns: 128 });
const artifactBytes = Buffer.from('offline executable bytes');
const model = 'claude-offline-exact-1';
export const offlineProfile = Object.freeze({ type: 'ProviderSubscriptionProfile', schemaVersion: 1, reference: 'offline-login',
  home: '/offline/home', configDirectory: '/offline/config', workingDirectory: '/offline/work',
  expectedAccount: 'offline@example.invalid', organization: 'offline-org', plan: 'max', loginProfileIdentity: 'offline-profile',
  executable: '/offline/cli', artifact: `sha256:${createHash('sha256').update(artifactBytes).digest('hex')}`,
  version: '2.1.280', activationReference: 'offline-successive-activation', managedConfigurationDigest: encoded({}).hash });
export const offlineAuthorization = (approvedAt: number) => ({ type: 'SuccessiveTrialAuthorization', schemaVersion: 1,
  reference: 'offline-successive-authorization', waiverRecord: 'offline-waiver-record',
  addendumDigest: `sha256:${'0'.repeat(64)}`, operator: String(OPERATOR), words: 'offline approval stand-in',
  approvedAt, providerAttempts: 16, dailyUsd: 5, totalUsd: 25, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY,
  framing: 'preview-conversation-v1' });

/** A shared offline world under `directory`: predecessor root, successor root and
 * append-only logs, so a restarted child process observes the same physical history. */
export const OFFLINE_STORAGE_KEY = new Uint8Array(32).fill(19);

/** A latched predecessor that had polled through `cursor`, with the durable cursor
 * journal its Part Ten custodian leaves in its own encrypted store (the stage-1
 * store names, same bot credential scope). The bytes are written through the
 * real production storage; the journal row has the custodian's exact shape. */
function writePredecessorCursor(root: string, machine: string, cursor: number) {
  const t = conversationFixture({ botId: base.botId, skipInitialAdmission: true });
  const context = { ...t.intake.context.decode, site: t.intake.f.c.site, preserved: t.intake.f.c.preserved };
  const storage = value(openProductionStorage({ root, machine, key: OFFLINE_STORAGE_KEY,
    policy: 'preview-stage-1-isolated-local-custody', store: 'preview-stage-1-facts', context, io: productionStorageIO }));
  try {
    const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
    const scope = value(canonical({ token: { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: 'telegram-bot-token' },
      apiVersion: t.declaration.apiVersion, bot: { id: base.botId, username: base.botUsername, identityEpoch: 'preview-stage-1' } })).hash;
    const update = JSON.stringify({ update_id: cursor - 1, message: { message_id: 1, from: { id: OPERATOR, is_bot: false,
      first_name: 'Justin' }, chat: { id: OPERATOR, type: 'private' }, date: 1790000000, text: 'A predecessor turn.' } });
    const response = JSON.stringify({ ok: true, result: [JSON.parse(update)] });
    const updateRef = `capture:telegram:update-${cursor - 1}:${sha(update)}`;
    const responseRef = `capture:telegram:poll-${cursor - 1}:${sha(response)}`;
    const entry = JSON.stringify({ scope, next: cursor, update: updateRef, updateHash: `sha256:${sha(update)}`,
      response: responseRef, responseHash: `sha256:${sha(response)}` });
    for (const [reference, bytes] of [[updateRef, update], [responseRef, response], [`capture:telegram:cursor:${scope}:0`, entry]])
      if (!storage.captures.preserve(reference, bytes)) throw Error('offline predecessor capture failed');
  } finally { storage.close(); }
}

/** The offline stand-in for the messaging owner's records: the operator's two authenticated messages
 * (the grant and the waiver), in the owner's formats. Launchers read them through --operator-records. */
const OFFLINE_GRANT_WORDS = 'offline approval stand-in', OFFLINE_WAIVER_WORDS = 'offline waiver stand-in';
export const offlineOperatorMessage = (topicId: number, messageId: number, text: string, at = START, operator = OPERATOR) => ({
  message: { messageId, topicId, text, fromUser: true, timestamp: new Date(at).toISOString(), sessionName: 'offline',
    senderName: 'Justin', telegramUserId: operator, forwarded: false, provenance: 'user' },
  classification: { ts: new Date(at + 1000).toISOString(), topicId, messageId, classification: 'human', reason: null, agentId: null,
    bodyHash: createHash('sha256').update(text, 'utf8').digest('hex'), bodyBytes: Buffer.byteLength(text), topicBound: true, replayChecked: true } });
export function writeOperatorRecords(directory: string, messages = [offlineOperatorMessage(1, 1, OFFLINE_GRANT_WORDS),
  offlineOperatorMessage(1, 2, OFFLINE_WAIVER_WORDS)], operator = OPERATOR) {
  mkdirSync(join(directory, 'state'), { recursive: true });
  writeFileSync(join(directory, 'telegram-messages.jsonl'), messages.map(m => `${JSON.stringify(m.message)}\n`).join(''));
  writeFileSync(join(directory, 'asp-classifications.jsonl'), messages.map(m => `${JSON.stringify(m.classification)}\n`).join(''));
  writeFileSync(join(directory, 'state', 'topic-operators.json'), JSON.stringify(Object.fromEntries([...new Set(messages.map(m => m.message.topicId))]
    .map(topic => [String(topic), { platform: 'telegram', uid: String(operator), names: ['justin'], boundAt: '', boundFrom: 'authenticated-inbound',
      establishmentEvidence: { kind: 'authenticated-inbound', senderUid: String(operator), messageId: '1' } }]))));
  return directory;
}

/** The recorded operator authority the offline launchers resolve an activation against: an
 * activation grant plus a bounded one-week renewal grant, and the waiver of the departed rules. */
export const offlineActivationAuthority = (activation: Record<string, any>) => ({ type: 'PreviewActivationAuthority', schemaVersion: 1,
  grants: [{ id: 'offline-standing-grant', grantor: String(OPERATOR), grantee: 'echo-desk', words: OFFLINE_GRANT_WORDS,
    source: { kind: 'telegram-message', topicId: 1, messageId: 1 }, issuedAt: START, actions: ['activate-subscription-preview', 'renew-subscription-activation'],
    scope: { trial: activation.trial, model: activation.model, expectedAccount: activation.expectedAccount,
      executable: activation.executable, artifact: activation.artifact, version: activation.version,
      invocationPolicyDigest: activation.invocationPolicyDigest, profileDigest: activation.profileDigest },
    renewal: { maxExtensionMs: 604_800_000, latestExpiresAt: activation.expiresAt } }],
  waivers: [{ reference: activation.waiver, rules: ['rule:38'], grantor: String(OPERATOR), recordedAt: START,
    source: { kind: 'telegram-message', topicId: 1, messageId: 2 }, words: OFFLINE_WAIVER_WORDS }],
  revocations: [] });

export function successiveWorld(directory = realpathSync(mkdtempSync(join(tmpdir(), 'preview-successive-'))),
  options: { predecessorCursor?: number } = {}) {
  const source = join(directory, 'trial-a'), root = join(directory, 'trial-b');
  const worldPath = join(directory, 'world.json');
  const read = () => JSON.parse(readFileSync(worldPath, 'utf8'));
  const write = world => writeFileSync(worldPath, JSON.stringify(world));
  const log = (name: string, row: unknown) => appendFileSync(join(directory, `${name}.jsonl`), `${JSON.stringify(row)}\n`);
  const rows = (name: string) => existsSync(join(directory, `${name}.jsonl`))
    ? readFileSync(join(directory, `${name}.jsonl`), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  const initialize = () => {
    mkdirSync(source, { mode: 0o700 }); mkdirSync(root, { mode: 0o700 });
    const opts = r => ({ root: r, configuration: stateConfiguration(r), expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY, now: () => START,
      replyLimit: 6, replyWindowMs: 60000, errorLimit: 20, totalErrorLimit: 1000, maxPendingTurns: 16, maxTrialTurns: 128,
      hostNotice: { botId: base.botId, chatId: base.chatId, message: HOST_OUTAGE_TEXT } });
    const predecessor = openPreviewState({ ...opts(source), create: true });
    if (options.predecessorCursor) {
      predecessor.completePoll(options.predecessorCursor);
      writePredecessorCursor(source, base.machine, options.predecessorCursor);
    }
    predecessor.latchStop('operator');
    initializeSuccessiveRoot({ predecessorRoot: source, root, predecessorConfiguration: stateConfiguration(source),
      configuration: stateConfiguration(root), authorization: offlineAuthorization(START + 500),
      quiescenceReference: 'offline predecessor quiesced', cutoff: START + 900, now: () => START + 1000 });
    write({ clock: START + 2000, nextUpdate: options.predecessorCursor ?? 100, nextMessage: 2000, updates: [], answers: [] });
  };
  if (!existsSync(worldPath)) initialize();
  const say = (text: string, from = OPERATOR, chat = OPERATOR) => {
    const world = read(), update = { update_id: world.nextUpdate, message: { message_id: world.nextUpdate + 500,
      from: { id: from, is_bot: false, first_name: from === OPERATOR ? 'Justin' : 'Someone' },
      chat: { id: chat, type: 'private' }, date: Math.floor(world.clock / 1000), text } };
    write({ ...world, nextUpdate: world.nextUpdate + 1, updates: [...world.updates, update] });
    return update.update_id;
  };
  /** Queue the next synthetic model answer (Decision conclusion value). */
  const answer = (text: string) => { const world = read(); write({ ...world, answers: [...world.answers, text] }); };
  const state = () => openPreviewState({ root, configuration: stateConfiguration(root), expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY,
    now: () => read().clock, replyLimit: 6, replyWindowMs: 60000, errorLimit: 20, totalErrorLimit: 1000,
    maxPendingTurns: 16, maxTrialTurns: 128, hostNotice: { botId: base.botId, chatId: base.chatId, message: HOST_OUTAGE_TEXT } });
  const telegramIO = { invoke(request) {
    log('telegram', { method: request.method, body: request.method === 'sendMessage' ? request.body : { offset: request.body?.offset } });
    const body = request.body, world = read();
    const response = result => ({ kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result }) });
    if (request.method === 'getMe') return response({ id: Number(base.botId), is_bot: true, username: 'echo_mmtest_seam_b27x_bot', first_name: 'Offline' });
    if (request.method === 'getUpdates') return response(world.updates.filter(row => row.update_id >= Number(body.offset))
      .slice(0, Number(body.limit)));
    write({ ...world, nextMessage: world.nextMessage + 1 });
    // The Bot API returns the decoded text of an HTML-mode message.
    return response({ message_id: world.nextMessage, chat: { id: Number(body.chat_id), type: 'private' },
      text: body.text.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&') });
  } };
  const io = { ...productionProviderIO, realpath: (p: string) => p, executableBytes: () => artifactBytes,
    inspectSubscriptionProfile: profile => ({ loginProfileIdentity: profile.loginProfileIdentity,
      managedConfigurationDigest: profile.managedConfigurationDigest }),
    execute: async command => {
      let text;
      if (command.args[0] === '--version') text = '2.1.280 (Claude Code)';
      else if (command.args[0] === 'auth') text = JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty',
        analyticsDisabled: true, projectsDirectory: `${offlineProfile.configDirectory}/projects`,
        configDirectory: offlineProfile.configDirectory, email: offlineProfile.expectedAccount, orgId: offlineProfile.organization,
        orgName: 'Offline', subscriptionType: 'max' });
      else {
        log('model', { args: command.args, stdin: command.stdin });
        const world = read(), value = world.answers[0] ?? 'An offline synthetic answer.';
        write({ ...world, answers: world.answers.slice(1) });
        const binding = JSON.parse(JSON.parse(command.stdin).messages[1].content).bindings;
        const decision = { type: 'Decision', schemaVersion: 1, id: `offline-answer-${rows('model').length}`, at: binding.at,
          by: binding.by, conclusion: { subject: 'preview-stage2-answer', predicate: 'answer-text', value, evidence: binding.evidence },
          reason: { subject: 'question', predicate: 'answered', value: true, evidence: binding.evidence },
          floor: { allowed: binding.floor, chosen: binding.floor.default } };
        text = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: JSON.stringify(decision),
          session_id: `offline-call-${rows('model').length}`, usage: { input_tokens: 1, output_tokens: 20 }, total_cost_usd: 1.25 });
      }
      return { code: 0, stdout: text, stdoutBytes: new Uint8Array(Buffer.from(text)), limited: false };
    } };
  const activation = (outer) => ({ type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: offlineProfile.activationReference, waiver: 'offline-waiver', p11: 'offline-p11', reviewedHead: 'offline-head',
    trial: outer.trial.id, baseConfigurationDigest: outer.trial.configurationDigest, profileDigest: encoded(offlineProfile).hash,
    executable: offlineProfile.executable, artifact: offlineProfile.artifact, version: offlineProfile.version, model,
    invocationPolicyDigest: encoded(subscriptionConversationPolicy(model)).hash, expectedAccount: offlineProfile.expectedAccount,
    observedAccount: offlineProfile.expectedAccount, authSource: 'claude.ai', operatorAssertion: 'offline assertion',
    assertedAt: START + 1100, observer: 'offline-desk', observedAt: START + 1200, method: 'offline',
    safeCaptureReference: 'offline-capture', extraUsage: 'operator-asserted/unobservable',
    extraUsageReason: 'Offline account datum unavailable', subscriptionLimit: 'unobservable',
    subscriptionLimitReason: 'Offline limit unavailable', acceptedResiduals: ['unconfined preview', 'UNKNOWN charge/quiescence'],
    expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY });
  const authorityPath = join(directory, 'activation-authority.json');
  if (!existsSync(authorityPath)) writeFileSync(authorityPath, JSON.stringify(offlineActivationAuthority(activation(state().read()))));
  if (!existsSync(join(directory, 'operator-records'))) writeOperatorRecords(join(directory, 'operator-records'));
  const compose = (options: any = {}) => {
    const outerState = state();
    return createSuccessiveComposition({ configuration: { ...base, root }, state: outerState, root,
      storageKey: OFFLINE_STORAGE_KEY, resolveSecret: () => '8820318295:synthetic_recorded_test_only_value',
      telegramIO: () => options.telegramIO?.(telegramIO) ?? telegramIO, provider: {
        activation: options.activation ?? activation(outerState.read()), profile: options.profile ?? offlineProfile, model,
        io: options.providerIO?.(io) ?? io,
        active: options.active ?? (() => true) },
      now: () => read().clock, stopped: () => outerState.read().stop !== null,
      readSource: path => readFileSync(join(process.cwd(), path), 'utf8'), limits: options.limits,
      hostFileArtifact: options.hostFileArtifact,
      hooks: options.hooks, diagnostic: options.diagnostic });
  };
  /** Driver backoff advances the shared world clock, never real time. */
  const sleep = async (milliseconds: number) => { const world = read(); write({ ...world, clock: world.clock + milliseconds }); };
  return { directory, source, root, model, configuration: { ...base, root }, stateConfiguration: stateConfiguration(root),
    say, answer, state, compose, sleep, activation: () => activation(state().read()), telegram: () => rows('telegram'),
    models: () => rows('model'), sends: () => rows('telegram').filter(row => row.method === 'sendMessage') };
}

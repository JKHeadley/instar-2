import { canonical, consumeResult } from '../index.js';
import type { BoundaryContext, Clock, Json, Result } from '../index.js';
import type { FactEnvelope } from '../facts/index.js';
import { hashBytes, walkVersions } from '../facts/index.js';
import type { AdapterConformance } from '../assembly/index.js';
import type { InboundRoute, IntakeAdapterPort, IntakeDisposition } from '../intake/index.js';
import { constructGoverned } from '../register/index.js';
import type { EffectValidation, OperationAdapterPort, OperationDefinition, EffectHost, EffectSpine } from '../effects/index.js';
import { installOperationDefinition } from '../effects/index.js';
import { boundary, ensure, freeze, json, take } from './boundary.js';
import type {
  AdmittedTelegramAdapter, TelegramAdmissionDependencies, TelegramBotApiCustodianPort,
  TelegramBotDeclaration, TelegramConversationTarget, TelegramExtractedUpdate,
  TelegramIngressDependencies, TelegramIntakeOutcome, TelegramPollCycle,
  TelegramUpdateKind, TelegramWebhookOutcome,
} from './contracts.js';

const admittedInstances = new WeakSet<object>();
const admissionContexts = new WeakMap<object, BoundaryContext>();
const admissionCustodians = new WeakMap<object, TelegramBotApiCustodianPort>();
const activePolls = new Set<string>();
const replyInvocations = new WeakMap<object, Set<string>>();
const replyOperationBindings = new WeakMap<object, Array<Readonly<{
  definition: OperationDefinition; host: EffectHost; spine: EffectSpine;
  inhibitedOperations: ReadonlySet<string>;
}>>>();
const serviceKeys = Object.freeze([
  'new_chat_members', 'left_chat_member', 'new_chat_title', 'new_chat_photo', 'delete_chat_photo',
  'group_chat_created', 'supergroup_chat_created', 'channel_chat_created', 'message_auto_delete_timer_changed',
  'migrate_to_chat_id', 'migrate_from_chat_id', 'pinned_message', 'forum_topic_created',
  'forum_topic_closed', 'forum_topic_reopened', 'general_forum_topic_hidden',
  'general_forum_topic_unhidden', 'write_access_allowed', 'users_shared', 'chat_shared',
]);
const mediaKeys = Object.freeze([
  'animation', 'audio', 'document', 'paid_media', 'photo', 'sticker', 'story', 'video', 'video_note', 'voice',
]);

type RecordValue = Readonly<Record<string, unknown>>;
const record = (value: unknown, name: string): RecordValue => {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value as RecordValue;
};
const integer = (value: unknown, name: string): number => {
  ensure(Number.isSafeInteger(value), `${name} must be a safe integer`);
  return value as number;
};
const positiveInteger = (value: unknown, name: string): number => {
  const output = integer(value, name); ensure(output > 0, `${name} must be positive`); return output;
};
const nonempty = (value: unknown, name: string): string => {
  ensure(typeof value === 'string' && value.trim().length > 0, `${name} must be nonempty`); return value;
};
const bytes = (value: string) => new TextEncoder().encode(value).length;
const encode = (value: unknown) => take(canonical(value)).bytes;

export const telegramParserDeclarationId = 'telegram-intake-v1';
export const telegramFeatureDeclarationId = 'telegram-conversation-adapter';

export function telegramAccount(botId: string): string {
  ensure(/^[1-9][0-9]*$/.test(botId), 'bot id must be the canonical positive numeric Telegram id');
  return `telegram:v1:bot:${botId}`;
}

export function normalizeTelegramTopic(forum: boolean, messageThreadId: number | null): string {
  if (!forum) {
    ensure(messageThreadId === null, 'a non-forum conversation cannot carry a topic id');
    return 'direct';
  }
  if (messageThreadId === null || messageThreadId === 1) return 'general';
  ensure(Number.isSafeInteger(messageThreadId) && messageThreadId > 1, 'forum topic id must be a positive provider id');
  return `topic:${messageThreadId}`;
}

export function telegramConversation(botId: string, target: TelegramConversationTarget): string {
  ensure(/^-?[1-9][0-9]*$/.test(target.chatId),
    'chat id must be the canonical authenticated numeric Telegram id');
  return `${telegramAccount(botId)}:chat:${target.chatId}:${normalizeTelegramTopic(target.forum, target.messageThreadId)}`;
}

function updateEvent(update: RecordValue): { event: RecordValue; kind: TelegramUpdateKind; sender: RecordValue | null } {
  const variants = Object.entries(update).filter(([key]) => key !== 'update_id');
  ensure(variants.length === 1, 'Telegram update must contain exactly one routed variant');
  const supported = ['callback_query', 'edited_message', 'edited_channel_post', 'channel_post', 'message',
    'chat_join_request', 'chat_member', 'my_chat_member', 'message_reaction', 'message_reaction_count']
    .filter(key => update[key] !== undefined);
  const unsupportedRouted = Object.entries(update).filter(([key, value]) => key !== 'update_id'
    && !supported.includes(key) && value !== null && typeof value === 'object' && !Array.isArray(value)
    && (value as Readonly<Record<string, unknown>>).chat !== undefined);
  if (supported.length === 0) {
    ensure(unsupportedRouted.length === 1, 'unsupported Telegram update has no unambiguous authenticated chat route');
    const event = record(unsupportedRouted[0]![1], `unsupported ${unsupportedRouted[0]![0]}`);
    const sender = event.sender_chat !== undefined || event.from === undefined
      ? null : record(event.from, 'unsupported sender');
    return { event, kind: 'unsupported', sender };
  }
  if (update.callback_query !== undefined) {
    const callback = record(update.callback_query, 'callback query');
    return { event: record(callback.message, 'callback message'), kind: 'callback', sender: record(callback.from, 'callback sender') };
  }
  if (update.edited_message !== undefined || update.edited_channel_post !== undefined) {
    const event = record(update.edited_message ?? update.edited_channel_post, 'edited message');
    return { event, kind: 'edit', sender: update.edited_message !== undefined
      && event.sender_chat === undefined && event.from !== undefined ? record(event.from, 'edited sender') : null };
  }
  if (update.channel_post !== undefined) {
    return { event: record(update.channel_post, 'channel post'), kind: 'channel-post', sender: null };
  }
  if (update.message !== undefined) {
    const event = record(update.message, 'message');
    const kind: TelegramUpdateKind = serviceKeys.some(key => event[key] !== undefined) ? 'service-event'
      : mediaKeys.some(key => event[key] !== undefined) ? 'media-metadata' : 'reply';
    return { event, kind, sender: event.sender_chat !== undefined || event.from === undefined
      ? null : record(event.from, 'message sender') };
  }
  for (const key of ['chat_join_request', 'chat_member', 'my_chat_member', 'message_reaction', 'message_reaction_count'] as const) {
    if (update[key] !== undefined) {
      const event = record(update[key], `unsupported ${key}`);
      const sender = event.from === undefined ? null : record(event.from, 'unsupported sender');
      return { event, kind: 'unsupported', sender };
    }
  }
  throw new Error('unsupported Telegram update has no authenticated chat route; it remains unacknowledged');
}

function extractTelegramUpdateUnchecked(raw: string, declaration: TelegramBotDeclaration): TelegramExtractedUpdate {
  const update = record(JSON.parse(raw) as unknown, 'Telegram update');
  const updateId = integer(update.update_id, 'provider update_id'); ensure(updateId >= 0, 'provider update_id must be nonnegative');
  const selected = updateEvent(update);
  const chat = record(selected.event.chat, 'authenticated chat');
  const chatId = String(integer(chat.id, 'authenticated chat id'));
  const forum = chat.is_forum === true;
  const threadValue = selected.event.message_thread_id;
  const thread = threadValue === undefined ? null : positiveInteger(threadValue, 'message_thread_id');
  const messageThreadId = forum ? thread : null;
  if (!forum) ensure(thread === null, 'non-forum update carries a topic id');
  const senderChat = selected.event.sender_chat === undefined ? null : record(selected.event.sender_chat, 'sender chat');
  if (selected.sender !== null) ensure(typeof selected.sender.is_bot === 'boolean',
    'Telegram sender must carry a boolean is_bot discriminator');
  const botSender = selected.sender?.is_bot === true;
  const senderId = selected.sender === null
    ? `telegram:v1:channel:${String(integer(senderChat?.id ?? chat.id, 'channel sender id'))}`
    : botSender
      ? `telegram:v1:bot-sender:${String(positiveInteger(selected.sender.id, 'sender id'))}`
      : `telegram:v1:user:${String(positiveInteger(selected.sender.id, 'sender id'))}`;
  const principal = selected.sender === null || botSender
    ? { id: senderId, kind: 'system' as const }
    : { id: senderId, kind: 'person' as const };
  const target = { chatId, forum, messageThreadId };
  const conversation = telegramConversation(declaration.bot.id, target);
  const route: InboundRoute = {
    channel: conversation,
    sender: senderId,
    identityEpoch: `telegram:v1:bot:${declaration.bot.id}:epoch:${declaration.bot.identityEpoch}`,
    eventId: String(updateId),
  };
  return freeze({ updateId, kind: selected.kind, route, conversation, target, principal });
}

export function extractTelegramUpdate(raw: string, declaration: TelegramBotDeclaration): TelegramExtractedUpdate {
  ensure(bytes(raw) <= declaration.limits.maxUpdateBytes, 'Telegram update exceeds declared capture bound');
  return extractTelegramUpdateUnchecked(raw, declaration);
}

function partFourPayload(raw: string, declaration: TelegramBotDeclaration): Json {
  const extracted = extractTelegramUpdate(raw, declaration);
  const update = record(JSON.parse(raw) as unknown, 'Telegram update');
  const selected = updateEvent(update);
  if (extracted.kind === 'reply') {
    const text = selected.event.text;
    if (text === '/stop') return { schemaVersion: 1, kind: 'stop', command: '/stop' };
    if (typeof text === 'string' && text.length > 0) return { schemaVersion: 1, kind: 'message', text };
  }
  return {
    schemaVersion: 1,
    kind: `telegram-${extracted.kind}`,
    updateId: extracted.updateId,
    conversation: extracted.conversation,
    disposition: 'intake-held',
  };
}

function selectedMode(declaration: TelegramBotDeclaration) {
  return declaration.recordedEndpointChoice?.mode ?? 'long-poll';
}

function validateDeclaration(declaration: TelegramBotDeclaration): void {
  ensure(declaration.schemaVersion === 1, 'Telegram declaration version unsupported');
  ensure(/^[1-9][0-9]*$/.test(declaration.bot.id), 'declared bot id must be a positive numeric Telegram id');
  ensure(/^@[A-Za-z0-9_]{5,}$/.test(declaration.bot.username), 'declared bot username must use canonical @name form');
  nonempty(declaration.bot.identityEpoch, 'bot identity epoch'); nonempty(declaration.apiVersion, 'Bot API version');
  ensure(declaration.token !== null && typeof declaration.token === 'object' && !Array.isArray(declaration.token)
    && Object.keys(declaration.token).length === 4
    && ['type', 'schemaVersion', 'vault', 'name'].every(key => Object.hasOwn(declaration.token, key))
    && declaration.token.type === 'SecretRef' && declaration.token.schemaVersion === 1,
  'Telegram token reference must be the closed owned SecretRef shape');
  nonempty(declaration.token.vault, 'vault reference'); nonempty(declaration.token.name, 'token reference name');
  ensure(![declaration.token.vault, declaration.token.name].some(value => /^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(value)),
    'credential field appears to contain token bytes instead of a vault reference');
  const mode = selectedMode(declaration);
  ensure(mode === 'long-poll' || mode === 'webhook', 'Telegram intake mode must be long-poll or webhook');
  if (mode === 'webhook') {
    const choice = declaration.recordedEndpointChoice!;
    ensure(choice.signedChoice.owner === 'part-two' && choice.signedChoice.name === 'FactEnvelope' && choice.signedChoice.id,
      'webhook requires a recorded signed endpoint choice');
    ensure(choice.endpointAvailabilityEvidence.length > 0 && choice.captureBeforeResponseEvidence.length > 0,
      'webhook requires endpoint availability and capture-before-response evidence');
  }
  ensure(declaration.cursor.contractVersion === 'telegram-update-offset:v1',
    'Telegram cursor contract must be telegram-update-offset:v1');
  for (const value of [declaration.cursor.initialOffset, declaration.cursor.maxBatchItems,
    declaration.cursor.maxPollSeconds, declaration.limits.maxUpdateBytes, declaration.limits.maxReplyBytes,
    declaration.limits.maxEntities, declaration.limits.maxCharge, declaration.limits.timeout])
    ensure(Number.isSafeInteger(value) && value >= 0, 'Telegram bounds must be finite nonnegative integers');
  ensure(declaration.cursor.maxBatchItems > 0 && declaration.cursor.maxBatchItems <= 100,
    'Telegram poll batch must be in the declared provider range');
  ensure(declaration.cursor.maxPollSeconds > 0 && declaration.limits.maxUpdateBytes > 0
    && declaration.limits.maxReplyBytes > 0 && declaration.limits.timeout > 0, 'Telegram operational bounds must be positive');
  ensure(declaration.limits.maxReplyCharacters === 4096 && declaration.limits.maxConcurrentPolls === 1,
    'landed Telegram reply/poll limits are exact');
  ensure(declaration.limits.maxReplyBytes <= 4096,
    'landed Part Eight ordinary-reply contract supports at most 4096 rendered bytes');
  ensure(declaration.supportedOperations.length === 1 && declaration.supportedOperations[0] === 'ordinary-reply',
    'only the landed ordinary-reply operation is supported');
}

function resolvedHistory(deps: TelegramAdmissionDependencies, reference: string, label: string) {
  ensure(deps.history.owner === 'part-ten', 'Telegram admission history must remain in Part Ten custody');
  const row = take(deps.history.lookup(nonempty(reference, label)));
  ensure(row && row.taint.length === 0 && row.conflicts.length === 0 && row.completeness === 'complete',
    `${label} does not resolve to complete uncontested signed history`);
  return row;
}

function validateWebhookChoice(declaration: TelegramBotDeclaration, deps: TelegramAdmissionDependencies): void {
  if (selectedMode(declaration) !== 'webhook') return;
  const choice = declaration.recordedEndpointChoice!;
  const signed = resolvedHistory(deps, choice.signedChoice.id, 'webhook endpoint choice');
  ensure(signed.fact.kind === 'assembly-reference-evidence' && signed.fact.principal.provenance.class === 'verified'
    && signed.fact.provenance.class === 'verified', 'webhook endpoint choice is not a signed verified fact');
  const body = record(signed.fact.body, 'webhook endpoint choice body');
  const expected = encode({ type: 'telegram-endpoint-choice', schemaVersion: 1,
    botId: declaration.bot.id, mode: 'webhook',
    endpointAvailabilityEvidence: [...choice.endpointAvailabilityEvidence],
    captureBeforeResponseEvidence: [...choice.captureBeforeResponseEvidence] });
  ensure(body.id === expected, 'webhook endpoint choice does not bind this bot, mode, and evidence');
  for (const reference of [...choice.endpointAvailabilityEvidence, ...choice.captureBeforeResponseEvidence])
    resolvedHistory(deps, reference, 'webhook endpoint evidence');
}

function validateIdentityProbe(declaration: TelegramBotDeclaration, deps: TelegramAdmissionDependencies,
  probe: AdmittedTelegramAdapter['probe']): void {
  const captureBytes = take(deps.api.readCapture(probe.capture.reference));
  ensure(hashBytes(captureBytes) === probe.capture.hash, 'Telegram identity capture bytes do not match the probe');
  const response = record(JSON.parse(captureBytes) as unknown, 'Telegram getMe capture');
  const bot = record(response.result, 'Telegram getMe result');
  ensure(response.ok === true && bot.is_bot === true && String(integer(bot.id, 'captured bot id')) === declaration.bot.id
    && `@${nonempty(bot.username, 'captured bot username')}` === declaration.bot.username,
  'Telegram identity capture does not match the declared bot');
  const witness = resolvedHistory(deps, probe.reference, 'Telegram identity probe');
  const body = record(witness.fact.body, 'Telegram identity probe fact');
  const recorded = record(body.record, 'Telegram identity ProbeRecord');
  ensure(witness.fact.kind === 'verification-ProbeRecord' && recorded.type === 'ProbeRecord'
    && recorded.id === probe.reference && recorded.disposition === 'passed' && recorded.captureStatus === 'available'
    && recorded.subject === telegramAccount(declaration.bot.id)
    && recorded.operation === `telegram-bot-api:getMe:${declaration.apiVersion}`
    && recorded.challengeDigest === probe.capture.hash && recorded.completedAt === probe.observedAt
    && Array.isArray(recorded.witnesses) && recorded.witnesses.includes(probe.capture.reference),
  'Telegram identity probe record does not bind the exact capture and declared bot');
}

function contractInput(declaration: TelegramBotDeclaration, deps: TelegramAdmissionDependencies,
  mode: 'long-poll' | 'webhook', probe: AdmittedTelegramAdapter['probe'], id: string) {
  const evidence = deps.evidence;
  const evidenceRevision = hashBytes(encode({ reference: probe.reference, capture: probe.capture,
    observedAt: probe.observedAt }));
  const capability = (name: 'application-stage' | 'prerequisite-durability', source: string, predicate: string) => ({
    name, support: 'supported', source, predicate,
    subjectBinding: 'operation+claim+account+conversation+digest', horizon: 'exact captured attempt', budget: 1,
    conformance: evidence.stages[0]!.checkRun, reason: '',
  });
  return {
    type: 'AdapterEvidenceContract', schemaVersion: 1, id,
    predecessors: [], dependencyFacts: [], adapter: `telegram:v1:bot:${declaration.bot.id}`,
    artifact: evidence.artifact, parserDeclaration: evidence.parserDeclaration,
    stimulusClass: mode === 'webhook' ? 'webhook' : 'bot-workspace',
    authenticatedFields: ['verified-bot-id', 'update_id', 'chat.id', 'from.id-or-sender_chat.id', 'message_thread_id'],
    authenticationMethod: `Telegram Bot API ${declaration.apiVersion} ${mode} through the confined token-reference custodian`,
    credentialBinding: `vault:${declaration.token.vault}/name:${declaration.token.name}`,
    senderNamespace: 'telegram:v1:user-or-channel', conversationNamespace: 'telegram:v1:bot+chat+normalized-topic',
    stabilityRules: [
      `bot-id=${declaration.bot.id}`, `bot-username=${declaration.bot.username}`, `identity-epoch=${declaration.bot.identityEpoch}`,
      `api-version=${declaration.apiVersion}`, `mode=${mode}`, `cursor=${declaration.cursor.contractVersion}`,
      `initial-offset=${declaration.cursor.initialOffset}`, `max-batch-items=${declaration.cursor.maxBatchItems}`,
      `max-poll-seconds=${declaration.cursor.maxPollSeconds}`, `max-update-bytes=${declaration.limits.maxUpdateBytes}`,
      `max-reply-characters=${declaration.limits.maxReplyCharacters}`, `max-reply-bytes=${declaration.limits.maxReplyBytes}`,
      `max-entities=${declaration.limits.maxEntities}`, 'supported-operation=ordinary-reply',
    ],
    forwardingTreatment: 'forwarded origin and quoted author remain untrusted captured content',
    impersonationTreatment: 'display names, usernames, forwards and quotes never select a principal',
    churnDetector: 'fresh getMe bot-id/username plus declared identity epoch',
    revocationResponse: 'inhibit exact bot instance and reacquire a fresh probe; never reuse a token value',
    eventIdAuthority: 'provider update_id scoped to verified bot instance and authenticated chat',
    replayPolicy: 'full update capture precedes protocol acknowledgment; offset derives only from durable intake receipts',
    ackPolicy: 'never', disclosureScopes: [telegramAccount(declaration.bot.id)],
    positiveFixtures: [...evidence.positiveFixtures], negativeFixtures: [...evidence.negativeFixtures],
    probes: ['fresh-authenticated-getMe'],
    capabilities: [
      { name: 'stable-lookup', support: 'unsupported', source: '', predicate: '', subjectBinding: '', horizon: '', budget: 0, conformance: '', reason: 'Telegram Bot API send-only reply mode has no authoritative stable receipt lookup' },
      capability('application-stage', 'captured Bot API sendMessage response bytes', 'provider accepted exact post; not human delivery or read'),
      { name: 'decisive-non-occurrence', support: 'unsupported', source: '', predicate: '', subjectBinding: '', horizon: '', budget: 0, conformance: '', reason: 'a timeout or lookup miss cannot prove non-occurrence' },
      { name: 'delayed-execution-exclusion', support: 'unsupported', source: '', predicate: '', subjectBinding: '', horizon: '', budget: 0, conformance: '', reason: 'no destination fence excludes delayed provider execution' },
      { name: 'final-charge', support: 'unsupported', source: '', predicate: '', subjectBinding: '', horizon: '', budget: 0, conformance: '', reason: 'Bot API response does not prove a final charge' },
      capability('prerequisite-durability', 'Part Two append receipts through Part Ten custody', 'exact required facts satisfy the operation durability demand'),
    ],
    contractVersion: `telegram:${declaration.apiVersion}:${mode}:v1:evidence:${evidenceRevision}`,
  };
}

export function admitTelegramAdapter(declaration: TelegramBotDeclaration, deps: TelegramAdmissionDependencies): Result<AdmittedTelegramAdapter> {
  return boundary('TelegramAdapterAdmission', declaration, deps.boundary, () => {
    validateDeclaration(declaration);
    take(constructGoverned('features', telegramFeatureDeclarationId, deps.governance.register, deps.governance.context));
    take(constructGoverned('parsers', telegramParserDeclarationId, deps.governance.register, deps.governance.context));
    ensure(deps.governance.register.entries.some(entry => entry.declaration.id === telegramParserDeclarationId
      && entry.declaration.kind === 'parsers' && entry.declaration.status === 'live'),
    'Telegram parser declaration is not admitted');
    ensure(deps.api.owner === 'part-ten', 'Telegram credential and provider client must remain in Part Ten custody');
    ensure(deps.evidence.stages.length > 0 && deps.evidence.fixtureDigests.length > 0
      && deps.evidence.positiveFixtures.length > 0 && deps.evidence.negativeFixtures.length > 0,
      'Telegram admission requires substantive positive and negative conformance evidence');
    ensure(deps.evidence.parserDeclaration === telegramParserDeclarationId,
      'Telegram evidence parser declaration must match telegram-intake-v1');
    const mode = selectedMode(declaration);
    const id = `telegram:v1:bot:${declaration.bot.id}`;
    const current = take(deps.assembly.inspectCurrent());
    const modes = current.filter(row => row.record.type === 'AdapterConformance' && row.record.adapter === id
      && row.record.disposition === 'passed').map(row => row.record.type === 'AdapterConformance' ? row.record.mode : '');
    ensure(modes.every(existing => existing === mode), 'one Telegram bot cannot admit two intake modes');
    validateWebhookChoice(declaration, deps);
    const now = deps.clock();
    const probe = take(deps.api.identity({ token: declaration.token, apiVersion: declaration.apiVersion }));
    ensure(probe.authenticated === true && probe.botId === declaration.bot.id
      && probe.username === declaration.bot.username && probe.apiVersion === declaration.apiVersion,
      'fresh authenticated Telegram identity probe does not match the declaration');
    ensure(Number.isSafeInteger(probe.observedAt) && Number.isSafeInteger(probe.freshFor) && probe.freshFor > 0
      && probe.observedAt <= now.value && probe.observedAt + probe.freshFor >= now.value,
      'Telegram identity probe is stale or retimestamped');
    ensure(/^sha256:[a-f0-9]{64}$/.test(probe.capture.hash) && probe.capture.reference.length > 0 && probe.reference.length > 0,
      'Telegram identity probe lacks capture-backed evidence');
    validateIdentityProbe(declaration, deps, probe);
    const contractSeed = contractInput(declaration, deps, mode, probe, 'pending');
    const contractId = `telegram-contract:${take(canonical(contractSeed)).hash}`;
    const contract = take(deps.assembly.record('AdapterEvidenceContract', { ...contractSeed, id: contractId }));
    const conformanceSeed = {
      type: 'AdapterConformance', schemaVersion: 1, id: 'pending', predecessors: [], dependencyFacts: [],
      contract: contract.id, adapter: id, package: deps.evidence.package, artifact: deps.evidence.artifact,
      platform: `telegram-bot-api:${declaration.apiVersion}`, mode, portVersion: 'conversation-adapter:v1',
      schemaVersions: ['telegram-update:v1', 'part-four-intake:v1', 'part-eight-ordinary-reply:v1'],
      generation: deps.generation, fixtureDigests: [...deps.evidence.fixtureDigests],
      sourceProvenance: [...deps.evidence.sourceProvenance],
      stageChecks: deps.evidence.stages.map(stage => ({ ...stage })), probes: [probe.reference],
      bars: [...deps.evidence.bars],
      limitations: [
        'provider acceptance is not human delivery or read',
        'media custody beyond metadata is unsupported in Slice A',
        'real-model positive non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md',
        'real-settlement positive non-executable-until-seam-response-effects-followup.md',
        'production assembly non-executable-until-part-eleven-seam-response-assembly.md-is-integrated',
      ],
      testedAt: now.value, validUntil: now.value + deps.evidence.validFor, disposition: 'passed',
    };
    const priorConformance = current.filter((row): row is typeof row & { record: AdapterConformance } => row.record.type === 'AdapterConformance'
      && row.record.contract === contract.id && row.record.artifact === deps.evidence.artifact
      && row.record.platform === `telegram-bot-api:${declaration.apiVersion}` && row.record.mode === mode);
    ensure(priorConformance.length <= 1, 'Telegram conformance identity is ambiguous');
    let conformance;
    if (priorConformance.length === 1) {
      const prior = priorConformance[0]!;
      ensure(prior.taint.length === 0 && prior.conflicts.length === 0,
        'Telegram conformance history is unavailable or contested');
      const expected = { ...conformanceSeed, id: prior.record.id,
        testedAt: prior.record.testedAt, validUntil: prior.record.validUntil };
      ensure(take(canonical(expected)).bytes === take(canonical(prior.record)).bytes
        && prior.record.disposition === 'passed' && prior.record.validUntil >= now.value,
      'existing Telegram conformance does not match the still-fresh admission evidence');
      conformance = prior.record;
    } else {
      const conformanceId = `telegram-conformance:${take(canonical(conformanceSeed)).hash}`;
      conformance = take(deps.assembly.record('AdapterConformance', { ...conformanceSeed, id: conformanceId }));
    }
    const admitted = freeze({ id, account: telegramAccount(declaration.bot.id), mode, declaration, probe, contract, conformance });
    admittedInstances.add(admitted);
    admissionContexts.set(admitted, deps.boundary);
    admissionCustodians.set(admitted, deps.api);
    return admitted;
  });
}

function requireInstance(admitted: AdmittedTelegramAdapter): BoundaryContext {
  ensure(admittedInstances.has(admitted), 'Telegram adapter requires a fresh admitted instance');
  const context = admissionContexts.get(admitted);
  ensure(context, 'Telegram admitted instance has no admission boundary');
  return context;
}

function requireAdmission(admitted: AdmittedTelegramAdapter, api: TelegramBotApiCustodianPort): BoundaryContext {
  const context = requireInstance(admitted);
  ensure(api.owner === 'part-ten', 'Telegram API client must remain in Part Ten custody');
  ensure(admissionCustodians.get(admitted) === api, 'Telegram API custodian differs from the admitted identity-probed instance');
  return context;
}

export function createTelegramIntakeAdapter(admitted: AdmittedTelegramAdapter, api: TelegramBotApiCustodianPort): IntakeAdapterPort {
  const context = requireAdmission(admitted, api);
  return Object.freeze({
    id: telegramParserDeclarationId,
    authenticate(raw: string, route: InboundRoute, at: Clock) {
      return boundary('TelegramInboundAuthentication', { route }, context, () => {
        const extracted = extractTelegramUpdate(raw, admitted.declaration);
        ensure(encode(extracted.route) === encode(route), 'Telegram authenticated route differs from captured update');
        const provenance = take(api.authenticate({ token: admitted.declaration.token,
          apiVersion: admitted.declaration.apiVersion, raw, route, at }));
        return {
          provenance,
          principalId: extracted.principal.id,
          principalKind: extracted.principal.kind,
          channel: route.channel,
          sender: route.sender,
          identityEpoch: route.identityEpoch,
        };
      });
    },
    parse(raw: string) { return partFourPayload(raw, admitted.declaration); },
  });
}

function receiptFor(facts: readonly FactEnvelope[], raw: string, route: InboundRoute,
  adapter: string, observer: string): FactEnvelope | undefined {
  const rawHash = hashBytes(raw), ingress = encode(route);
  return facts.find(fact => {
    if (fact.kind !== 'intake-receipt' || fact.principal.id !== observer || fact.principal.kind !== 'system'
      || fact.principal.provenance.class !== 'verified' || fact.provenance.class !== 'verified') return false;
    const body = fact.body as Readonly<Record<string, Json>>;
    if (body.adapter !== adapter || body.rawHash !== rawHash || body.ingress !== ingress) return false;
    const capture = body.capture as Readonly<Record<string, Json>> | undefined;
    return capture?.hash === rawHash && typeof capture.reference === 'string' && capture.reference.length > 0;
  });
}

function durableUpdateIds(deps: TelegramIngressDependencies): number[] {
  const facts = take(deps.facts.read());
  const ids: number[] = [];
  for (const fact of facts) {
    if (fact.kind !== 'intake-receipt' || fact.principal.id !== deps.observer || fact.principal.kind !== 'system'
      || fact.principal.provenance.class !== 'verified' || fact.provenance.class !== 'verified') continue;
    const body = fact.body as Readonly<Record<string, Json>>;
    if (body.adapter !== telegramParserDeclarationId || typeof body.ingress !== 'string') continue;
    try {
      const route = record(JSON.parse(body.ingress) as unknown, 'receipt route');
      const capture = body.capture as Readonly<Record<string, Json>> | undefined;
      if (typeof route.channel !== 'string' || !route.channel.startsWith(`${deps.admitted.account}:chat:`)
        || route.identityEpoch !== `telegram:v1:bot:${deps.admitted.declaration.bot.id}:epoch:${deps.admitted.declaration.bot.identityEpoch}`
        || typeof route.eventId !== 'string' || !/^(0|[1-9][0-9]*)$/.test(route.eventId)
        || typeof body.rawHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(body.rawHash)
        || capture?.hash !== body.rawHash || typeof capture.reference !== 'string' || capture.reference.length === 0) continue;
      const capturedBytes = take(deps.api.readCapture(capture.reference));
      if (hashBytes(capturedBytes) !== body.rawHash) continue;
      const captured = extractTelegramUpdateUnchecked(capturedBytes, deps.admitted.declaration);
      if (encode(captured.route) !== encode(route)) continue;
      const id = Number(route.eventId); if (Number.isSafeInteger(id)) ids.push(id);
    } catch { /* inert non-Telegram or malformed retained receipt */ }
  }
  return [...new Set(ids)].sort((left, right) => left - right);
}

function intakeLabel(value: IntakeDisposition): TelegramIntakeOutcome['intake'] { return value.kind; }

export function createTelegramIngress(deps: TelegramIngressDependencies) {
  requireAdmission(deps.admitted, deps.api);
  ensure(deps.facts && deps.intake && deps.observer.trim().length > 0, 'Telegram ingress requires the public intake and fact-read ports');
  const currentOffset = () => {
    const ids = durableUpdateIds(deps);
    let next = deps.admitted.declaration.cursor.initialOffset;
    for (const id of ids) {
      if (id < next) continue;
      if (next === 0 && deps.admitted.declaration.cursor.initialOffset === 0 && id > next) { next = id + 1; continue; }
      if (id !== next) break;
      next = id + 1;
    }
    return next;
  };
  const deliver = (raw: string): TelegramIntakeOutcome | null => {
    const extracted = bytes(raw) > deps.admitted.declaration.limits.maxUpdateBytes
      ? extractTelegramUpdateUnchecked(raw, deps.admitted.declaration)
      : extractTelegramUpdate(raw, deps.admitted.declaration);
    const intake = deps.intake.receive(raw, extracted.route);
    const receipt = receiptFor(take(deps.facts.read()), raw, extracted.route, telegramParserDeclarationId, deps.observer);
    if (!receipt) return null;
    return consumeResult<IntakeDisposition, TelegramIntakeOutcome>(intake, {
      Success: value => ({ updateId: extracted.updateId, kind: extracted.kind, route: extracted.route,
        custody: 'durable', receipt: receipt.id, intake: intakeLabel(value), preserved: receipt.id, refusalReason: '' }),
      Refused: refusal => ({ updateId: extracted.updateId, kind: extracted.kind, route: extracted.route,
        custody: 'durable', receipt: receipt.id, intake: 'owned-refusal', preserved: refusal.preserved,
        refusalReason: refusal.reason }),
    });
  };
  return Object.freeze({
    currentOffset(): Result<number> {
      return boundary('TelegramCursorRebuild', null, deps.boundary, currentOffset);
    },
    pollOnce(): Result<TelegramPollCycle> {
      return boundary('TelegramLongPollCycle', null, deps.boundary, () => {
        ensure(deps.admitted.mode === 'long-poll', 'polling is unavailable for an admitted webhook instance');
        const pollIdentity = deps.admitted.account;
        ensure(!activePolls.has(pollIdentity), 'only one long poll may run for an admitted bot');
        activePolls.add(pollIdentity);
        try {
          const requestedOffset = currentOffset();
          const batch = take(deps.api.poll({ token: deps.admitted.declaration.token,
            apiVersion: deps.admitted.declaration.apiVersion, offset: requestedOffset,
            limit: deps.admitted.declaration.cursor.maxBatchItems,
            timeout: deps.admitted.declaration.cursor.maxPollSeconds }));
          ensure(batch.updates.length <= deps.admitted.declaration.cursor.maxBatchItems, 'provider batch exceeds declared item bound');
          ensure(/^sha256:[a-f0-9]{64}$/.test(batch.response.hash) && batch.response.reference.length > 0,
            'poll response lacks capture-backed evidence');
          const captured: TelegramIntakeOutcome[] = [];
          let blockedOnUpdate: number | null = null;
          let previousUpdateId = -1;
          for (const raw of batch.updates) {
            const shape = record(JSON.parse(raw) as unknown, 'Telegram update');
            const updateId = integer(shape.update_id, 'provider update_id');
            ensure(updateId >= 0 && updateId >= previousUpdateId, 'provider batch update ids must be nonnegative and ordered');
            previousUpdateId = updateId;
            const output = deliver(raw);
            if (!output) { blockedOnUpdate = updateId; break; }
            captured.push(output);
          }
          const nextOffset = currentOffset();
          return { requestedOffset, committedThrough: nextOffset === deps.admitted.declaration.cursor.initialOffset
            ? null : nextOffset - 1, nextOffset, captured, blockedOnUpdate };
        } finally { activePolls.delete(pollIdentity); }
      });
    },
    receiveWebhook(raw: string): Result<TelegramWebhookOutcome> {
      return boundary('TelegramWebhookIngress', { bytes: bytes(raw) }, deps.boundary, () => {
        ensure(deps.admitted.mode === 'webhook', 'webhook intake is unavailable for an admitted long-poll instance');
        const captured = deliver(raw);
        ensure(captured, 'Telegram webhook remains unacknowledged because durable intake custody was not proved');
        return { protocolAcknowledgment: 'success', captured };
      });
    },
  });
}

export function renderTelegramHtml(source: string, declaration: TelegramBotDeclaration,
  context: BoundaryContext): Result<string> {
  return boundary('TelegramHtmlRender', { source }, context, () => {
    ensure(typeof source === 'string' && source.length > 0, 'Telegram reply text must be nonempty');
    ensure(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(source),
      'Telegram reply contains unsupported control data');
    const rendered = source.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    ensure(Array.from(rendered).length <= declaration.limits.maxReplyCharacters,
      'Telegram reply exceeds the 4096-character single-message limit; chunking and truncation are unsupported');
    ensure(bytes(rendered) <= declaration.limits.maxReplyBytes,
      'Telegram reply exceeds the declared byte limit; chunking and truncation are unsupported');
    return rendered;
  });
}

export function createTelegramReplyOperationAdapter(admitted: AdmittedTelegramAdapter,
  api: TelegramBotApiCustodianPort, target: TelegramConversationTarget,
  context: BoundaryContext): OperationAdapterPort {
  requireAdmission(admitted, api);
  const boundTarget = freeze({ chatId: target.chatId, forum: target.forum, messageThreadId: target.messageThreadId });
  const conversation = telegramConversation(admitted.declaration.bot.id, boundTarget);
  return Object.freeze({
    owner: 'part-ten' as const,
    id: admitted.id,
    describe: () => ({ contract: admitted.contract.id, account: admitted.account, conversation,
      maxCharge: admitted.declaration.limits.maxCharge, timeout: admitted.declaration.limits.timeout,
      hiddenRetries: 0 as const }),
    invoke(input: Parameters<OperationAdapterPort['invoke']>[0]) {
      return boundary('TelegramReplyInvoke', { operation: input.operation }, context, () => {
        ensure(input.message.account === admitted.account && input.message.conversation === conversation,
          'Telegram reply target differs from admitted account/conversation');
        ensure(input.message.purpose === 'ordinary-reply' && input.message.text.length > 0,
          'Telegram adapter accepts only attributable ordinary replies');
        ensure(Array.from(input.message.text).length <= admitted.declaration.limits.maxReplyCharacters
          && bytes(input.message.text) <= admitted.declaration.limits.maxReplyBytes,
          'Telegram reply exceeds declared platform limits');
        const candidates = (replyOperationBindings.get(admitted) ?? []).filter(binding => {
          const snapshot = take(binding.spine.store.readForProjection());
          return snapshot.entries.some(entry => entry.fact.kind === 'transport-AdmissionReservation'
            && (entry.fact.body as { record?: { operation?: string } }).record?.operation === input.operation);
        });
        ensure(candidates.length === 1, 'Telegram reply operation is not registered for this admitted adapter');
        const binding = candidates[0]!;
        ensure(!binding.inhibitedOperations.has(input.operation),
          'Telegram reply has pre-existing executor acceptance and remains uncertain; observe only');
        const snapshot = take(binding.spine.store.readForProjection());
        ensure(snapshot.entries.every(entry => entry.taint.length === 0 && entry.conflicts.length === 0),
          'Telegram reply claim history is tainted or contested');
        const facts = snapshot.entries.map(entry => entry.fact);
        const effect = (type: string) => facts.filter(fact => fact.kind === `effect-${type}`)
          .map(fact => ({ fact, record: (fact.body as { record: Record<string, unknown> }).record }));
        const reservations = facts.filter(fact => fact.kind === 'transport-AdmissionReservation')
          .map(fact => ({ fact, record: (fact.body as { record: Record<string, unknown> }).record }))
          .filter(row => row.record.operation === input.operation);
        const current = reservations.at(-1), claimed = reservations.find(row => row.fact.id === input.claim);
        ensure(current?.record.state === 'consumed' && current.record.executor === binding.host.incarnation,
          'Telegram reply requires the current consumed dispatch claim');
        ensure(claimed?.record.state === 'dispatch-claimed' && claimed.record.digest === input.digest
          && claimed.record.executor === binding.host.incarnation,
        'Telegram reply claim reference does not resolve to the exact dispatch claim');
        const requests = effect('EffectRequest').filter(row => row.record.id === current.record.request);
        ensure(requests.length === 1, 'Telegram reply request is missing or ambiguous');
        const request = requests[0]!.record;
        ensure(request.definition === binding.definition.id && request.digest === input.digest
          && current.record.digest === input.digest, 'Telegram reply digest or registered definition differs from the claim');
        const messages = effect('OutboundMessage').filter(row => row.record.id === request.message);
        ensure(messages.length === 1 && encode(messages[0]!.record) === encode(input.message)
          && input.digest === take(canonical(input.message)).hash,
        'Telegram reply message is not the exact claim-bound recorded payload');
        const acceptance = effect('OperationObservation').filter(row => row.record.operation === input.operation
          && row.record.request === request.id && row.record.claim === input.claim && row.record.digest === input.digest
          && row.record.account === admitted.account && row.record.conversation === conversation
          && row.record.stage === 'executor-accepted');
        ensure(acceptance.length === 1, 'Telegram reply requires one durable executor-acceptance observation');
        ensure(!effect('OperationObservation').some(row => row.record.operation === input.operation
          && (row.record.stage === 'response' || row.record.stage === 'unknown')),
        'Telegram reply operation already has a conclusive or uncertain invocation observation');
        const state = binding.host.current();
        ensure(!state.stopped, 'stop inhibits Telegram reply');
        const versions = walkVersions(state.versions);
        ensure(versions.conflicts.length === 0, 'Telegram reply operation definition is contested');
        const currentDefinition = versions.current.find(version => version.id === binding.definition.version
          && version.subject === binding.definition.feature);
        ensure(currentDefinition && encode(currentDefinition.content) === encode(binding.definition)
          && state.decode.register.entries.includes(binding.definition.feature)
          && state.decode.register.entries.includes(binding.definition.adapter)
          && binding.definition.generation === state.decode.register.generation.id
          && binding.definition.adapter === admitted.id
          && binding.definition.account === admitted.account
          && binding.definition.conversation === conversation,
        'Telegram reply operation definition or adapter binding is not current');
        const validations = effect('EffectValidation').filter(row => row.record.request === request.id
          && row.record.definition === binding.definition.id && row.record.digest === input.digest
          && row.record.phase === 'dispatch');
        const validation = validations.at(-1)?.record as unknown as EffectValidation | undefined;
        ensure(validation && validation.expires > state.clock.value
          && validation.generation === state.decode.register.generation.id
          && encode(validation.authority) === encode(state.authority),
        'Telegram reply dispatch validation is expired or no longer current');
        const invoked = replyInvocations.get(admitted) ?? new Set<string>();
        ensure(!invoked.has(input.operation), 'Telegram reply claim handoff was already used');
        invoked.add(input.operation); replyInvocations.set(admitted, invoked);
        return take(api.sendMessage({ token: admitted.declaration.token, apiVersion: admitted.declaration.apiVersion,
          chatId: boundTarget.chatId, messageThreadId: boundTarget.messageThreadId, text: input.message.text,
          parseMode: 'HTML', timeout: admitted.declaration.limits.timeout, hiddenRetries: 0 }));
      });
    },
    observe(input: Parameters<OperationAdapterPort['observe']>[0]) {
      return boundary('TelegramReplyObserve', input, context, () => {
        throw new Error('Telegram stable receipt lookup is unsupported; retain the original operation as uncertain');
      });
    },
  });
}

export function installTelegramReplyOperation(input: Readonly<{
  id: string; generation: string; admitted: AdmittedTelegramAdapter; target: TelegramConversationTarget;
  speaker: string; scopeDigest: string; durability: 'replicated' | 'local-durable'; replicas: number;
  lossModel: string; verificationBar: string;
}>, host: EffectHost, spine: EffectSpine): Result<OperationDefinition> {
  return boundary('TelegramReplyOperationInstallation', { id: input.id }, host.boundary, () => {
    requireInstance(input.admitted);
    const definition = {
      type: 'OperationDefinition', schemaVersion: 1, id: input.id,
      feature: 'telegram-ordinary-reply', version: `telegram:${input.admitted.declaration.apiVersion}:ordinary-reply:v1`,
      generation: input.generation, adapter: input.admitted.id, account: input.admitted.account,
      conversation: telegramConversation(input.admitted.declaration.bot.id, input.target), speaker: input.speaker,
      scopeDigest: input.scopeDigest, durability: input.durability, replicas: input.replicas,
      lossModel: input.lossModel, maxBytes: input.admitted.declaration.limits.maxReplyBytes,
      maxCharge: input.admitted.declaration.limits.maxCharge, timeout: input.admitted.declaration.limits.timeout,
      verificationBar: input.verificationBar,
    };
    const snapshot = take(spine.store.readForProjection());
    const recorded = snapshot.entries.filter(entry => entry.fact.kind === 'effect-OperationDefinition'
      && (entry.fact.body as { record?: { id?: string } }).record?.id === definition.id);
    ensure(recorded.length <= 1, 'Telegram reply operation definition is ambiguous');
    let installed: OperationDefinition;
    if (recorded.length === 1) {
      const existing = recorded[0]!;
      ensure(existing.taint.length === 0 && existing.conflicts.length === 0,
        'Telegram reply operation definition is tainted or contested');
      const existingDefinition = (existing.fact.body as unknown as { record: OperationDefinition }).record;
      ensure(encode(existingDefinition) === encode(definition), 'immutable effect identity already exists with different content');
      installed = existingDefinition;
    } else installed = take(installOperationDefinition(definition, host, spine));
    const requestIds = new Set(snapshot.entries.filter(entry => entry.fact.kind === 'effect-EffectRequest'
      && (entry.fact.body as { record?: { definition?: string } }).record?.definition === installed.id)
      .map(entry => (entry.fact.body as { record: { id: string } }).record.id));
    const inhibitedOperations = new Set(snapshot.entries.filter(entry => entry.fact.kind === 'effect-OperationObservation')
      .map(entry => (entry.fact.body as { record: { request?: string; operation?: string; stage?: string } }).record)
      .filter(row => row.stage === 'executor-accepted' && row.request && requestIds.has(row.request))
      .map(row => row.operation!).filter(Boolean));
    const existing = replyOperationBindings.get(input.admitted) ?? [];
    replyOperationBindings.set(input.admitted, [...existing.filter(row => row.definition.id !== installed.id),
      freeze({ definition: installed, host, spine, inhibitedOperations })]);
    return installed;
  });
}

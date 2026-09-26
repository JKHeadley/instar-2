// @ts-nocheck -- waived preview adapter joining the installed owner fixture to real physical IO.
// One adapter over the accepted successive-turn driver: the existing installed
// owner plan runs through createProductionConversationHost with the real
// Telegram custodian IO and the pinned subscription route. No new driver,
// budget or recovery protocol: Six serving, Four intake and the stop latch
// remain the authorities. See README "Successive-turn mode".
import { createDecipheriv, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decode } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { createTelegramIngress, telegramConversation } from '../../src/conversation/index.js';
import { createProductionConversationHost } from '../../src/assembly/production-conversation-host.js';
import { turns as foldTurns, exactTelegramApiAcceptance } from '../../src/assembly/production-conversation-driver.js';
import { acceptedReplyPreviewText } from '../../src/rungraph/index.js';
import { captureExchange, groundTurn, recallExchangeSchema, redact } from '../../src/recall/index.js';
import { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_CONVERSATION_MAX_PROMPT_BYTES,
  SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { installedFixtureHost } from '../assembly/production-boot-installed-fixture.js';
import { createRecordedServingPlan } from '../assembly/production-boot-trace.js';
import { recordedCheckpoint } from '../assembly/production-boot-checkpoint.js';
import { json, privateKey, value } from '../facts/fixtures.js';
import { durablePreviewWrite } from './state.js';
import { STAGE2_DISCLOSURE, STAGE2_ROUTE, encoded, stage2Activation, stage2Description, stage2InvocationBinding,
  stage2RouteFactory } from './stage2-provider.js';

export const SUCCESSIVE_STATE_VERSION = 1 as const;
export const SUCCESSIVE_CONTEXT_VERSION = 'successive-context-v1';
/** Durable per-turn host-clock window, opened when the provider dispatch first
 * builds its route and never reset by restart. Owner steps on this machine take
 * minutes as the store grows, so the model child must still start inside it. */
export const SUCCESSIVE_WINDOW_MS = 900000;
const FIXTURE_CONTEXT_DELIVERY_CHARGE = 20;
/** One provider call reserves receipt + raw base64 + answer + 2 metadata bytes (stage 2 measured 330416). */
export const SUCCESSIVE_PER_CALL_CAPTURE_BYTES = 330416;
/** The capacity journal also charges every judgment capture a turn writes: question, context, submitted
 * stdin and the input evidence packet (each at most one prompt envelope) plus small evidence claims. */
export const successiveTurnCaptureBytes = (maxPromptBytes: number) =>
  SUCCESSIVE_PER_CALL_CAPTURE_BYTES + 4 * maxPromptBytes + 16384;
/** The proposed trial limits. Tests may pass smaller finite values; never larger. */
export const SUCCESSIVE_LIMITS = Object.freeze({
  providerAttempts: 16, replies: 16, maxContextTurns: 64, maxContextBytes: 262144,
  // Five's stock grounding refuses more than 20 admitted inputs without summaries
  // (no skim permitted), so admission ends visibly at 20 rather than stranding a turn.
  maxPromptBytes: SUBSCRIPTION_CONVERSATION_MAX_PROMPT_BYTES, maxAdmittedInputs: 20,
  maxStoreBytes: 64 * 1024 * 1024, recallChars: 1200 });

const telegramSecret = Object.freeze({ type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: 'telegram-bot-token' });
const storageSecret = Object.freeze({ type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: 'storage-key' });
const sha256 = (bytes: string) => `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;
const raw = fact => fact.body.record;

// ---------------------------------------------------------------------------
// Source packet: exact, pinned, versioned excerpts with provenance.

/** Exact selected purpose excerpts. Each is pinned by its SHA-256; a changed
 * source document refuses composition instead of silently shipping drift. */
export const SOURCE_EXCERPTS = Object.freeze([
  Object.freeze({ id: 'purpose:name', path: 'docs/00-the-purpose.md', start: '**Value — the project is called Instar.**',
    end: 'name.', title: 'The name' }),
  Object.freeze({ id: 'purpose:purpose', path: 'docs/00-the-purpose.md', start: 'The organizational purpose is unchanged',
    end: '> **Make coherence something an AI cannot lose.**', title: 'The purpose' }),
  Object.freeze({ id: 'purpose:coherency', path: 'docs/00-the-purpose.md', start: '**Value — coherency is the root,',
    end: 'Alignment held by memory is not alignment.', title: 'Coherency is the root' }),
]);
export const CAPABILITY_NOTE_DATE = '2026-09-25';
export function capabilityNote(limits: { providerAttempts: number; expiresAt: number }) {
  return `As of ${CAPABILITY_NOTE_DATE}: this is a private Instar 2.0 PREVIEW trial in the operator's direct Telegram chat. `
    + 'It keeps this trial\'s complete message history and answers each message once in plain text through a subscription '
    + 'model. It has no tools: it cannot browse, run code, schedule work, send extra messages or act outside this chat. '
    + `This trial allows at most ${limits.providerAttempts} model answers and ends at epoch millisecond ${limits.expiresAt}. `
    + 'Every reply is prefixed PREVIEW. Outcomes the system could not confirm (a model call or a delivery) are marked unknown, '
    + 'and model charges are recorded as unknown, never settled. Production safeguards are incomplete.';
}
/** Reads each excerpt exactly from the repository, verifying the pinned digest. */
export function sourcePacket(readSource: (path: string) => string, pins: Readonly<Record<string, string>>,
  limits: { providerAttempts: number; expiresAt: number }) {
  const sources = SOURCE_EXCERPTS.map(excerpt => {
    const document = readSource(excerpt.path);
    const from = document.indexOf(excerpt.start);
    const to = from < 0 ? -1 : document.indexOf(excerpt.end, from);
    if (from < 0 || to < 0) throw Error(`preview: source excerpt ${excerpt.id} absent`);
    const text = document.slice(from, to + excerpt.end.length);
    const digest = sha256(text);
    if (pins[excerpt.id] !== digest) throw Error(`preview: source excerpt ${excerpt.id} changed`);
    const line = document.slice(0, from).split('\n').length;
    return { id: excerpt.id, title: excerpt.title, text, provenance: { path: excerpt.path, fileSha256: sha256(document),
      firstLine: line, lastLine: line + text.split('\n').length - 1, excerptSha256: digest } };
  });
  const note = capabilityNote(limits);
  sources.push({ id: 'capability-note', title: 'Preview capability and status note', text: note,
    provenance: { path: 'tests/preview/successive.ts#capabilityNote', asOf: CAPABILITY_NOTE_DATE, excerptSha256: sha256(note) } });
  return Object.freeze({ version: SUCCESSIVE_CONTEXT_VERSION, sources });
}
/** The reviewed digests of the exact excerpts above (2.0 main `docs/00-the-purpose.md`). */
export const SOURCE_PINS = Object.freeze({
  'purpose:name': 'sha256:936d4bdf6dc13976f7af73e0d48f9d11b78b9b844fa16beac9e950dbe7bf495e',
  'purpose:purpose': 'sha256:5d4b2142593c5a9569cb90cbffe20242c5ab2cf8d13f6929c888ec4166f87e51',
  'purpose:coherency': 'sha256:9a9e2145435171267cf760bfc34f999f40cbc63afc2fb8ac66caec16ef122ad1',
});

// ---------------------------------------------------------------------------
// Durable successive sidecar: per-turn prepared packet references, holds, cursor.

export function openSuccessiveState(root: string) {
  const path = join(root, 'successive-state.json');
  const read = () => {
    const d = JSON.parse(readFileSync(path, 'utf8'));
    if (d.version !== SUCCESSIVE_STATE_VERSION || typeof d.trial !== 'string' || d.framing !== SUBSCRIPTION_CONVERSATION_FRAMING
      || !Number.isSafeInteger(d.cursor) || typeof d.turns !== 'object' || d.turns === null)
      throw Error('preview: successive state corrupt');
    return d;
  };
  const write = d => { durablePreviewWrite(path, d); return read(); };
  return Object.freeze({ path, read, exists: () => existsSync(path),
    update: (fields: Record<string, unknown>) => write({ ...read(), ...fields }),
    setTurn: (opening: string, fields: Record<string, unknown>) => {
      const d = read(); return write({ ...d, turns: { ...d.turns, [opening]: { ...d.turns[opening], ...fields } } });
    },
    hold: (code: string, opening: string | null, lengths: Record<string, number> = {}) => {
      const d = read(); if (d.hold) return d;
      return write({ ...d, hold: { code, opening, lengths } });
    } });
}

// ---------------------------------------------------------------------------
// Context packet assembly.

function inboundText(bytes: string): string {
  try {
    const update = JSON.parse(bytes), message = update.message ?? update.edited_message ?? {};
    const text = typeof message.text === 'string' ? message.text : typeof message.caption === 'string' ? message.caption : '';
    return text.length ? text : '[a message without text]';
  } catch { return '[an unreadable message]'; }
}
function answerText(bytes: string | null): string | null {
  if (bytes === null) return null;
  try {
    const decision = JSON.parse(bytes);
    const conclusion = decision?.conclusion;
    if (conclusion?.subject === 'preview-stage2-answer' && typeof conclusion.value === 'string') return conclusion.value;
  } catch { /* not a Decision */ }
  return bytes;
}
const OUTCOME = Object.freeze({
  admitted: 'not answered', grounded: 'not answered', 'provider-dispatched-unknown': 'model outcome unknown; no answer was accepted',
  'provider-dispatched-answered': 'answer received, not accepted', accepted: 'answer accepted, reply not sent',
  'reply-dispatched-unknown': 'answer accepted; delivery unknown', 'api-accepted': 'answer accepted; Telegram accepted the reply',
  held: 'held by stop' });

const SETTLED = new Set(['provider-dispatched-unknown', 'reply-dispatched-unknown', 'api-accepted', 'held']);
export function contextPacket(input: { now: number; audience: unknown; sources: unknown;
  history: readonly { update: number; user: string; answer: string | null; outcome: string }[]; recalled: string }) {
  return { version: SUCCESSIVE_CONTEXT_VERSION, now: { epochMs: input.now, utc: new Date(input.now).toISOString() },
    audience: input.audience, sources: input.sources, history: input.history, recalled: input.recalled };
}
/** Exactly the canonical Seven stdin envelope the installed plan and Seven build. */
export function successiveEnvelope(input: { description: any; settings: any; question: string; context: string;
  floor: unknown; evidence: readonly string[]; generation: string }) {
  return encoded({ provider: input.description.provider, model: input.description.model, route: input.description.route,
    messages: [{ role: 'user', content: input.question }, { role: 'context', content: input.context }],
    attachments: [], tools: [], settings: input.settings, outputSchema: { type: 'Decision' }, floor: input.floor,
    evidence: input.evidence, point: 'judgment', generation: input.generation }).bytes;
}
export function measureSuccessive(submitted: string, maxPromptBytes: number) {
  const system = Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, 'utf8');
  const stdin = Buffer.byteLength(submitted, 'utf8');
  return Object.freeze({ system, stdin, prompt: system + stdin, maximum: maxPromptBytes });
}

// ---------------------------------------------------------------------------
// The composition.

export interface SuccessiveInput {
  readonly configuration: any; readonly state: any; readonly root: string;
  readonly storageKey: Uint8Array; readonly resolveSecret: (reference: { vault: string; name: string }) => string;
  /** Physical Bot API IO; the factory receives the installed encrypted storage for sealed identity custody. */
  readonly telegramIO: (storage: any) => { invoke(request: unknown, credential: string): unknown };
  readonly provider: { activation: any; profile: any; model: string; io: any; active: () => boolean };
  readonly now: () => number; readonly stopped: () => boolean;
  readonly readSource: (path: string) => string; readonly sourcePins?: Readonly<Record<string, string>>;
  readonly limits?: Partial<typeof SUCCESSIVE_LIMITS>;
  readonly heartbeat?: () => void;
  readonly diagnostic?: (record: any) => void;
  /** Offline evidence only: observes the turn after genuine Seven preparation, before Eight. */
  readonly hooks?: Readonly<{ beforeProvider?: (opening: string) => void }>;
}

/** Same bot, same credential: the successor keeps the predecessor's bot identity
 * epoch, so its Telegram credential scope is the predecessor's and the durable
 * cursor journal below carries over verbatim. */
const IDENTITY_EPOCH = 'preview-stage-1';
const PREDECESSOR_STORE = 'preview-stage-1-facts';

/** The custodian only polls at an offset its own durable cursor journal backs
 * (the durable-intake floor), and the successor's store starts empty while its
 * declared start is the inherited cursor. The predecessor's journal rows and the
 * exact update and poll-response captures they cite are copied byte-for-byte
 * from the archived predecessor store (read-only; the archive is never opened
 * as storage). The custodian re-verifies every row on read. */
export function carryPredecessorCursor(root: string, machine: string, keyHex: string,
  captures: { preserve(reference: string, bytes: string): boolean }, cursor: number) {
  if (cursor === 0) return 0;
  const file = join(root, '.preview-predecessor', 'captures.encrypted');
  if (!existsSync(file)) throw Error('preview: predecessor cursor evidence absent');
  const sealed = JSON.parse(readFileSync(file, 'utf8'));
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(sealed.nonce, 'hex'));
  decipher.setAAD(Buffer.from(`${machine}:${PREDECESSOR_STORE}:captures`)); decipher.setAuthTag(Buffer.from(sealed.tag, 'hex'));
  const rows: Record<string, string> = JSON.parse(Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
    decipher.final()]).toString('utf8'));
  let maximum = 0;
  for (const [reference, bytes] of Object.entries(rows)) {
    if (!reference.startsWith('capture:telegram:cursor:')) continue;
    const row = JSON.parse(bytes);
    for (const [cited, citedBytes] of [[row.update, rows[row.update]], [row.response, rows[row.response]], [reference, bytes]])
      if (typeof citedBytes !== 'string' || !captures.preserve(cited, citedBytes)) throw Error('preview: predecessor cursor evidence changed');
    maximum = Math.max(maximum, row.next);
  }
  if (maximum !== cursor) throw Error('preview: predecessor cursor evidence does not reach the inherited cursor');
  return maximum;
}

/** A store with no restart checkpoint is a boot that never completed (for
 * example a Telegram identity probe that failed mid-boot). The checkpoint is
 * written before the first poll, so such a store never admitted an input, called
 * the provider or sent. Its capture tables lived only in the dead process, so a
 * fresh boot over it reads poison conflicts. It is retained beside the root,
 * never deleted, and the boot starts clean. A live boot's lease refuses. */
export function retainIncompleteBoot(storageRoot: string, checkpointPath: string) {
  if (existsSync(checkpointPath) || !existsSync(storageRoot) || readdirSync(storageRoot).length === 0) return null;
  const owner = join(storageRoot, '.boot-lease', 'owner.json');
  if (existsSync(owner)) {
    let alive = true;
    try { process.kill(JSON.parse(readFileSync(owner, 'utf8')).pid, 0); }
    catch (error) { alive = (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
    if (alive) throw Error('preview: an incomplete successive boot is still held by a live process');
  }
  let ordinal = 1;
  while (existsSync(`${storageRoot}-incomplete-boot-${ordinal}`)) ordinal += 1;
  const retained = `${storageRoot}-incomplete-boot-${ordinal}`;
  renameSync(storageRoot, retained);
  return retained;
}

export function createSuccessiveComposition(input: SuccessiveInput) {
  const limits = Object.freeze({ ...SUCCESSIVE_LIMITS, ...input.limits });
  for (const [name, bound] of Object.entries(limits)) if (!Number.isSafeInteger(bound) || bound < 1
    || bound > SUCCESSIVE_LIMITS[name]) throw Error(`preview: successive limit ${name} outside the approved envelope`);
  const configuration = input.configuration, outer = input.state.gate('admit');
  const sidecar = openSuccessiveState(input.root);
  if (!sidecar.exists()) throw Error('preview: authorized successive initialization absent');
  const initial = sidecar.read();
  if (initial.trial !== outer.trial.id || initial.configurationDigest !== outer.trial.configurationDigest)
    throw Error('preview: successive state differs from the inherited trial');
  const { activation, profile, model } = input.provider;
  const framing = SUBSCRIPTION_CONVERSATION_FRAMING;
  const activationDigest = stage2Activation({ activation, profile, model, trial: outer.trial.id,
    configurationDigest: outer.trial.configurationDigest, now: input.now(), framing });
  const binding = stage2InvocationBinding({ activation, profile, model, framing });
  if (initial.activationDigest !== null && initial.activationDigest !== activationDigest)
    throw Error('preview: successive activation differs from the recorded activation');
  if (initial.activationDigest === null) sidecar.update({ activationDigest, policyDigest: binding.invocationPolicyDigest });
  if (input.now() + SUCCESSIVE_WINDOW_MS > outer.trial.expiresAt) throw Error('preview: insufficient trial lifetime');
  const packetSources = sourcePacket(input.readSource, input.sourcePins ?? SOURCE_PINS,
    { providerAttempts: limits.providerAttempts, expiresAt: outer.trial.expiresAt });
  const policy = subscriptionConversationPolicy(model);
  const description = stage2Description(model, framing);
  const settings = Object.freeze({ automaticRetries: 0, maxTokens: policy.maxTokens });
  const storageRoot = join(input.root, '.successive');
  const checkpointPath = join(input.root, 'successive-checkpoint.json');
  retainIncompleteBoot(storageRoot, checkpointPath);
  mkdirSync(storageRoot, { recursive: true, mode: 0o700 });
  const recovery = existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : undefined;
  // Boot needs one route handle; this placeholder is never invoked. Each turn
  // selects its own custodied subscription route through the plan.
  const route = Object.freeze({ provider: 'anthropic', model, route: STAGE2_ROUTE, disclosure: STAGE2_DISCLOSURE,
    automaticRetries: 0, environment: 'local-test',
    invoke: async () => { throw Error('preview: installation placeholder route is never invoked'); } });
  const expectedRoute = { channel: telegramConversation(configuration.botId, { chatId: configuration.chatId,
    forum: configuration.forum, messageThreadId: configuration.messageThreadId }),
  sender: `telegram:v1:user:${configuration.operatorSenderId}`, identityEpoch: `telegram:v1:bot:${configuration.botId}:epoch:${IDENTITY_EPOCH}` };
  const target = Object.freeze({ chatId: configuration.chatId, forum: configuration.forum,
    messageThreadId: configuration.messageThreadId });
  const storageKey = Buffer.from(input.storageKey).toString('hex');
  let admissionOpen = () => true;
  const fixture = installedFixtureHost(storageRoot, route, {
    registerEntries: ['preview', 'provider-call', 'telegram-ordinary-reply', model, STAGE2_ROUTE],
    // The fixture native delivery names prior accepted answers by digest; the
    // model's actual complete context is the measured provider packet.
    contextDeliveryText: accepted => ['actual delivered Telegram input',
      ...accepted.map(bytes => `accepted answer ${sha256(bytes)}`)].join('\n'),
    telegramIOFactory: storage => {
      const physical = input.telegramIO(storage);
      return Object.freeze({ invoke(request, credential) {
        // Physical gates: a stopped/expired trial neither polls nor sends, and a
        // poll that could admit an unanswerable input is refused before Telegram
        // can treat any update as delivered.
        if (request.method === 'getUpdates') { input.state.gate('poll'); if (!admissionOpen()) throw Error('preview: admission capacity ended'); }
        if (request.method === 'sendMessage') input.state.gate('dispatch');
        return physical.invoke(request, credential);
      } });
    }, bot: { id: Number(configuration.botId), username: configuration.botUsername.replace(/^@/u, '') },
    ...(recovery ? { recovery } : {}),
    record: { botCredential: telegramSecret, storageCredential: storageSecret, providerRoute: STAGE2_ROUTE,
      providerCredential: { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: 'subscription-profile' } },
    resolveSecret: reference => {
      if (reference.vault !== 'preview') throw Error('preview secret reference refused');
      if (reference.name === 'storage-key') return storageKey;
      // The subscription route holds no credential; this non-secret marker only satisfies boot's resolution.
      if (reference.name === 'subscription-profile') return 'subscription-profile-no-credential';
      return input.resolveSecret(reference);
    },
    declaration: base => Object.freeze({ ...base,
      bot: Object.freeze({ id: configuration.botId, username: configuration.botUsername, identityEpoch: IDENTITY_EPOCH }),
      token: telegramSecret, cursor: Object.freeze({ ...base.cursor, initialOffset: sidecar.read().cursor,
        // One update per poll: the installed per-turn grounding requires the current
        // opening to be the admitted frontier (the accepted serving tests poll
        // sequentially too). Later messages stay unconfirmed in Telegram until the
        // driver has drained the current turn; the configured batch is only a ceiling.
        maxPollSeconds: configuration.maxPollSeconds, maxBatchItems: 1 }) }),
    judgment: { description, settings, maxCaptureBytes: policy.maxCaptureBytes, timeout: policy.timeout,
      disclosure: STAGE2_DISCLOSURE, captureCapacity: limits.providerAttempts * successiveTurnCaptureBytes(limits.maxPromptBytes) },
    mutate: state => {
      const context = state.f.ctx;
      if (!context.schemas.some(schema => schema.kind === 'recall-exchange'))
        Object.assign(context, { schemas: [...context.schemas, recallExchangeSchema(state.f.scope)] });
    } });
  const built = fixture.boot();
  // Only a fresh store needs the carried journal; a checkpointed store already holds it.
  if (!recovery) carryPredecessorCursor(input.root, configuration.machine, storageKey, built.storage.captures, sidecar.read().cursor);
  const application = built.application, f = built.f;
  const rows = () => value(f.store.read());
  const principal = `telegram:v1:user:${configuration.operatorSenderId}`;
  const conversationBinding = bindConfiguredConversation(built, expectedRoute, principal);
  const installation = rows().find(row => row.kind === 'assembly-ProductionInstallation');
  const inherited = sidecar.read().inheritedTotalErrors ?? 0;
  const servingBinding = { installation: installation.id, conversation: conversationBinding.id,
    // Abstract Six charge units (not dollars). Six's reader-side accounting keeps
    // each reservation at its full declared charge: the fixture native context
    // delivery reserves 20 per turn, each reply 1, the subscription provider 0.
    // The ceiling covers every permitted turn plus one admission's maximum.
    ceiling: (FIXTURE_CONTEXT_DELIVERY_CHARGE + 1) * limits.providerAttempts + 1, maxTurns: limits.providerAttempts, maxReplies: Math.min(limits.replies, limits.providerAttempts),
    expires: outer.trial.expiresAt, providerMax: 0, replyMax: 1, errorLimit: outer.trial.errorLimit,
    totalErrorLimit: Math.max(1, outer.trial.totalErrorLimit - inherited) };
  const capture = reference => built.storage.captures.read(reference);
  const audience = Object.freeze({ conversation: expectedRoute.channel, participants: [principal] });
  const writer = { context: f.ctx, store: f.store, machine: 'machine-a', privateKey,
    principal: json(f.bob), provenance: json(f.bob.provenance) };
  const reader = { context: { site: f.c.site, preserved: f.c.preserved, register: f.ctx.decode.register },
    store: f.store, stopped: input.stopped };
  const fold = () => {
    const facts = rows();
    return foldTurns(facts, (observation, request) => exactTelegramApiAcceptance(observation, request, facts, capture,
      { chatId: target.chatId, messageThreadId: target.messageThreadId }), response => {
      try { return JSON.parse(capture(raw(response).receipt.reference)).state === 'complete'; } catch { return false; }
    }, conversationBinding.id);
  };
  const evidence = (subject: string, digest: string, predicate: string, _amount?: number, overrides: any = {}) => {
    const id = overrides.id ?? `proof:${predicate}:${subject}`;
    const existing = rows().find(row => row.kind === 'evidence-record' && row.body.evidence?.id === id);
    if (existing) return existing.body.evidence;
    const claim = overrides.claim ?? { subject, predicate, value: { digest } };
    const captured = overrides.capture ?? value(built.captures.put(encoded(claim.value).bytes, 16384));
    const e = value(decode('Evidence', f.evidenceInput({ id, capture: captured, claim, source: 'probe',
      observedAt: f.deps.clock(), freshFor: SUCCESSIVE_WINDOW_MS, strength: overrides.strength ?? 'attestation' }), f.ctx.decode));
    f.evidence.push(e); f.append('evidence-record', json({ evidence: e })); return e;
  };
  let inFlight = 0;
  const current = (opening: string) => () => {
    if (input.stopped() || !input.provider.active()) return false;
    const view = value(application.owners.serving.inspect());
    const turn = fold().find(candidate => candidate.opening === opening);
    return !view.stopped && view.binding !== null && !!turn?.providerRun && view.slot === turn.providerRun
      && input.now() < outer.trial.expiresAt;
  };
  const routeFor = turn => {
    const opened = sidecar.read().turns[turn.opening];
    if (!opened?.packet) throw Error('preview: turn context packet absent');
    const prepared = opened.deadline ? opened : sidecar.setTurn(turn.opening, {
      deadline: Math.min(input.now() + SUCCESSIVE_WINDOW_MS, outer.trial.expiresAt) }).turns[turn.opening];
    if (input.now() >= prepared.deadline) throw Error('preview: turn window closed');
    const factory = stage2RouteFactory({ activation, profile, model, framing, now: input.now,
      active: () => input.provider.active() && !input.stopped(),
      io: { ...input.provider.io, execute: async command => {
        inFlight++;
        try { return await input.provider.io.execute(command); } finally { inFlight--; }
      } } });
    return factory({ evidence, context: { ...f.ctx.decode, site: f.c.site, preserved: f.c.preserved },
      current: current(turn.opening), deadline: prepared.deadline });
  };
  const bindings = opening => ({ type: 'Decision', schemaVersion: 1, at: f.deps.clock(),
    by: { judgment: 'judgment', model, route: description.route }, floor: f.floor,
    evidence: [`successive-input:${opening}`] });
  const recorded = createRecordedServingPlan(built, target, { live: {
    definition: { id: 'successive-provider-definition', version: 'successive-provider-version',
      adapter: description.route, account: description.provider, conversation: STAGE2_DISCLOSURE,
      maxBytes: limits.maxPromptBytes, maxCharge: 0, timeout: policy.timeout,
      lossModel: 'Local-durable single-machine preview origin; permanent disk loss retains UNKNOWN charge and quiescence.' },
    envelope: { provider: description.provider, model, route: description.route, settings },
    freshness: SUCCESSIVE_WINDOW_MS,
    question: turn => {
      const prepared = sidecar.read().turns[turn.opening];
      if (!prepared?.packet) throw Error('preview: turn context packet absent');
      const bytes = capture(prepared.packet.reference);
      if (bytes === null || sha256(bytes) !== prepared.packet.digest) throw Error('preview: turn context packet changed');
      const packet = JSON.parse(bytes);
      const id = `successive-input:${turn.opening}`;
      if (!rows().some(row => row.kind === 'evidence-record' && row.body.evidence?.id === id)) {
        const inputCapture = value(built.captures.put(bytes, limits.maxPromptBytes + 65536));
        evidence(turn.opening, inputCapture.hash, 'input-preserved', undefined,
          { id, capture: inputCapture, strength: 'observation',
            claim: { subject: turn.opening, predicate: 'input-preserved', value: { digest: inputCapture.hash } } });
      }
      const question = packet.question, context = encoded({ bindings: bindings(turn.opening), packet: packet.packet }).bytes;
      const submitted = successiveEnvelope({ description, settings, question, context, floor: f.floor,
        evidence: [id], generation: f.run.generation.id });
      const measured = measureSuccessive(submitted, limits.maxPromptBytes);
      if (measured.prompt > measured.maximum || measured.stdin > policy.maxInputBytes)
        throw Error('preview: complete input bound');
      // The owner-side fixture clock is a static stand-in, so the Seven deadline
      // carries the trial's absolute host-clock expiry; the turn's durable window
      // is enforced by the physical route before every child command.
      return { question, context, evidence: [id], deadline: outer.trial.expiresAt };
    },
    route: turn => routeFor(turn),
    prepared: (turn, preparedJudgment) => {
      input.hooks?.beforeProvider?.(turn.opening);
      const request = rows().find(row => row.id === preparedJudgment.request.id);
      const claim = { schemaVersion: 1, ...binding, invocationPolicy: undefined,
        request: request.id, submittedDigest: raw(request).inputDigest, run: raw(request).run };
      delete claim.invocationPolicy;
      evidence(request.id, encoded(claim).hash, 'preview-invocation-binding', undefined,
        { id: `proof:preview-invocation-binding:${raw(request).id}`, claim: { subject: raw(request).id,
          predicate: 'preview-invocation-binding', value: claim } });
    },
    observeOccurrence: (operation, digest) => evidence(operation, digest, 'operation-occurred', undefined,
      { strength: 'observation' }),
    replyText: (_turn, facts, replyRun) => acceptedReplyPreviewText(facts, replyRun),
  } });

  // --- Host-boundary preparation: captures, recall, packet, bounds and cursor.
  const ingress = createTelegramIngress({ boundary: application.owners.composition.host.boundary,
    admitted: built.admitted, api: application.owners.telegram, intake: application.owners.intake,
    facts: application.owners.composition.spine.store, observer: built.owners.intake.author.principal.id });
  let lastCheckpointHead = null;
  const checkpoint = () => {
    const head = rows().at(-1)?.contentHash ?? null;
    if (head === lastCheckpointHead) return;
    durablePreviewWrite(checkpointPath, recordedCheckpoint(built, 'successive'));
    lastCheckpointHead = head;
  };
  const storeBytes = () => ['facts.encrypted', 'captures.encrypted', 'exact.encrypted'].reduce((total, name) => {
    const path = join(storageRoot, name); return total + (existsSync(path) ? statSync(path).size : 0);
  }, 0);
  const capacity = () => {
    const admitted = rows().filter(row => row.kind === 'intake-admitted').length;
    const bytes = storeBytes();
    if (admitted >= limits.maxAdmittedInputs || bytes >= limits.maxStoreBytes) {
      sidecar.hold('CAPACITY', null, { admitted, storeBytes: bytes });
      input.state.latchStop('capacity');
      return false;
    }
    const view = value(application.owners.serving.inspect());
    if (view.turns >= limits.providerAttempts && !view.slot) {
      sidecar.hold('ATTEMPTS_EXHAUSTED', null, { attempts: view.turns });
      input.state.latchStop('capacity');
      return false;
    }
    return true;
  };
  const captureExchanges = (all: readonly any[]) => {
    for (const turn of all) {
      const inbound = capture(turn.inboundCapture);
      if (inbound !== null) {
        const update = JSON.parse(inbound);
        value(captureExchange({ conversation: expectedRoute.channel, session: 'preview-successive',
          messageId: `update:${update.update_id}`, speakerId: principal, speakerName: 'Operator', speakerRole: 'user',
          text: inboundText(inbound), visibility: 'participants', audience: [principal] }, json(f.deps.clock()), writer));
      }
      const answer = turn.acceptedReply && answerText(capture(turn.acceptedReply));
      if (answer) value(captureExchange({ conversation: expectedRoute.channel, session: 'preview-successive',
        messageId: `answer:${turn.updateId}`, speakerId: 'instar-preview', speakerName: 'Instar (preview)',
        speakerRole: 'agent', text: answer, visibility: 'participants', audience: [principal] }, json(f.deps.clock()), writer));
    }
  };
  const preparePackets = async () => {
    const all = fold();
    captureExchanges(all);
    for (const turn of all) {
      if (turn.phase !== 'admitted' || sidecar.read().turns[turn.opening]?.packet || sidecar.read().hold) continue;
      const earlier = all.filter(candidate => candidate.updateId < turn.updateId);
      // Only the next turn is prepared, and only once every earlier turn has
      // settled, so its history carries each earlier accepted answer or outcome.
      if (earlier.some(candidate => !SETTLED.has(candidate.phase))) break;
      const history = earlier.map(candidate => ({ update: candidate.updateId,
        user: redact(inboundText(capture(candidate.inboundCapture))).text,
        answer: candidate.acceptedReply ? redact(answerText(capture(candidate.acceptedReply)) ?? '').text || null : null,
        outcome: OUTCOME[candidate.phase] ?? 'unknown' }));
      const current = redact(inboundText(capture(turn.inboundCapture))).text;
      const update = JSON.parse(capture(turn.inboundCapture)).update_id;
      const grounded = await groundTurn({ text: current.slice(0, 4000), exclude: [{ conversation: expectedRoute.channel,
        messageId: `update:${update}` }], audience, bounds: { maxResults: 4, maxChars: limits.recallChars } }, reader);
      const recalled = grounded.kind === 'Success' ? grounded.value.text : '';
      const start = input.now();
      const packet = { question: current, packet: contextPacket({ now: start, audience: { ...audience,
        visibility: 'participants', surface: configuration.chatKind === 'private' ? 'telegram-private-chat' : 'telegram-group-topic' },
      sources: packetSources.sources, history, recalled }) };
      const bytes = encoded(packet).bytes;
      const context = encoded({ bindings: bindings(turn.opening), packet: packet.packet }).bytes;
      const submitted = successiveEnvelope({ description, settings, question: current, context, floor: f.floor,
        evidence: [`successive-input:${turn.opening}`], generation: f.run.generation.id });
      const measured = measureSuccessive(submitted, limits.maxPromptBytes);
      const reference = `successive-packet:${turn.opening}`;
      if (!built.storage.captures.preserve(reference, bytes)) throw Error('preview: packet custody changed');
      sidecar.setTurn(turn.opening, { update, packet: { reference, digest: sha256(bytes) }, start,
        lengths: measured, history: history.length, recall: grounded.kind === 'Success' ? grounded.value.manifest : null });
      if (measured.prompt > measured.maximum || measured.stdin > policy.maxInputBytes) {
        // Overflow never trims: the admitted turn and its packet stay retained.
        sidecar.hold('INPUT_BOUND', turn.opening, measured);
        input.state.latchStop('capacity');
      }
    }
  };
  const boundaryHook = async () => {
    await new Promise(resolve => setImmediate(resolve));
    input.heartbeat?.();
    if (input.stopped()) return;
    const offset = value(ingress.currentOffset());
    if (offset > sidecar.read().cursor) sidecar.update({ cursor: offset });
    await preparePackets();
    checkpoint();
  };
  admissionOpen = capacity;
  let ran = false;
  return Object.freeze({ built, application, sidecar, binding: servingBinding, conversation: conversationBinding.id,
    fold, rows, capture,
    /** The one poller and conversation loop for this process: the accepted
     * driver drains admitted work, then long-polls, for at most maxCycles. */
    run: async (options: { maxCycles: number; baseBackoffMs?: number; maxBackoffMs?: number;
      sleep?: (milliseconds: number) => Promise<void> }) => {
      if (ran) throw Error('preview: one successive loop per process');
      ran = true;
      await boundaryHook();
      // Capacity is enforced at the physical poll, so an admitted turn that is
      // still answerable after a restart is drained before admission ends.
      if (input.stopped() || sidecar.read().hold) return;
      const host = createProductionConversationHost({ binding: servingBinding, fence: () => f.effects.fence,
        admitted: built.admitted, observer: built.owners.intake.author.principal.id,
        target: { chatId: target.chatId, messageThreadId: target.messageThreadId }, plan: recorded.plan,
        capture, now: input.now, stopped: () => input.stopped() || !!sidecar.read().hold,
        executionQuiescent: () => inFlight === 0,
        maxContextTurns: limits.maxContextTurns, maxContextBytes: limits.maxContextBytes,
        maxCycles: options.maxCycles, baseBackoffMs: options.baseBackoffMs ?? 250, maxBackoffMs: options.maxBackoffMs ?? 60000,
        yieldBoundary: boundaryHook,
        sleep: options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))),
        ...(input.diagnostic ? { diagnostic: input.diagnostic } : {}) });
      await host.run(application);
      await boundaryHook();
    },
    status: () => ({ serving: value(application.owners.serving.inspect()), sidecar: sidecar.read(),
      turns: fold().map(turn => ({ update: turn.updateId, phase: turn.phase })) }),
    close: () => application.close() });
}

/** The configured sender binding (fixture authority, waived) for the operator's
 * private chat, authored once; a restart reuses it. */
function bindConfiguredConversation(built, route, principalId) {
  const existing = value(built.f.store.read()).find(row => row.kind === 'conversation-binding'
    && row.body.channel === route.channel && row.body.sender === route.sender);
  const syncCaptures = () => {
    built.t.intake.syncCaptures();
    for (const [reference, captured] of Object.entries(built.t.intake.context.captures))
      if (captured.bytes !== null && captured.bytes !== undefined) built.storage.captures.preserve(reference, captured.bytes);
    Object.assign(built.f.ctx.captures, built.t.intake.context.captures);
    Object.assign(built.f.ctx.decode.captures, built.t.intake.context.decode.captures);
  };
  const principal = built.t.intake.f.principal(principalId, 'person');
  if (existing) {
    syncCaptures();
    if (!built.f.ctx.decode.principals.some(row => row.id === principal.id)) built.f.ctx.decode.principals.push(principal);
    return existing;
  }
  const original = value(built.f.store.read()).find(row => row.kind === 'conversation-binding');
  const owner = original.principal;
  const grant = built.t.intake.f.grant({ id: 'successive-target-grant', grantee: principal, scope: built.f.scope });
  syncCaptures();
  const schema = { ...built.f.ctx.schemas.find(row => row.kind === 'note'), kind: 'genesis-grant',
    fields: { grant: { kind: 'constitutional', type: 'StandingGrant' } } };
  Object.assign(built.f.ctx, { schemas: [...built.f.ctx.schemas, schema],
    decode: { ...built.f.ctx.decode, principals: [...built.f.ctx.decode.principals, principal] } });
  const grantContext = { ...built.f.ctx, decode: { ...built.f.ctx.decode, provenance: grant.source } };
  const targetGrant = value(authorAndAppend({ kind: 'genesis-grant', schemaVersion: 1,
    machine: built.f.host.machine, principal: json(owner), provenance: json(grant.source),
    at: json(built.f.now), required: original.predecessors.required, body: { grant: json(grant) } }, grantContext,
  createFactStore(grantContext, built.storage.segment), privateKey)).fact;
  const context = { ...built.f.ctx, decode: { ...built.f.ctx.decode, provenance: owner.provenance } };
  return value(authorAndAppend({ kind: 'conversation-binding', schemaVersion: 1,
    machine: built.f.host.machine, principal: json(owner), provenance: json(owner.provenance),
    at: json(built.f.now), required: [...original.predecessors.required, targetGrant.id],
    body: { ...original.body, channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch,
      principalId, grantId: grant.id } }, context, createFactStore(context, built.storage.segment), privateKey)).fact;
}


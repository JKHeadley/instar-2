import { createHash } from 'node:crypto';
import type { BoundaryContext, Clock, Hash, ProvenanceInput, Result, SecretRef } from '../index.js';
import { canonical } from '../index.js';
import { extractTelegramUpdate } from '../conversation/index.js';
import type {
  TelegramBotApiCustodianPort, TelegramBotDeclaration, TelegramIdentityProbe, TelegramPolledBatch,
} from '../conversation/index.js';
import type { InboundRoute } from '../intake/index.js';
import type { VerificationRuntimePort } from '../verification/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';

type ProviderMethod = 'getMe' | 'getUpdates' | 'sendMessage';
type ProviderBody = Readonly<Record<string, string | number>>;
type CapturedResponse = Readonly<{ bytes: string; reference: string; hash: Hash }>;
type IdentityEvidence = Readonly<{
  verification: VerificationRuntimePort;
  plan: string;
  arm: string;
  generation: string;
}>;
type PublishedIdentity = Readonly<{
  reference: string;
  capture: Readonly<{ reference: string; hash: Hash }>;
}>;

export type TelegramBridgeFailureStage = 'resolver' | 'child-exit' | 'fetch-timeout' | 'fetch-failure'
  | 'body-read' | 'invalid-response' | 'scan-policy' | 'scan-budget' | 'sealed-capture';
type TelegramIdentityProjection = Readonly<{
  id: number;
  is_bot: true;
  username: string;
  first_name: null | Readonly<{ byteLength: number; hash: Hash }>;
}>;
type TelegramSealedCaptureReceipt = Readonly<{
  reference: string;
  hash: Hash;
  byteLength: number;
}>;
export type TelegramBridgeReply = Readonly<{
  kind: 'response'; status: number; bytes: string;
}> | Readonly<{
  kind: 'identity'; status: 200; identity: TelegramIdentityProjection; capture: TelegramSealedCaptureReceipt;
}> | Readonly<{
  kind: 'uncertain'; limitation: 'timeout' | 'transport'; stage?: TelegramBridgeFailureStage;
}>;
export function telegramBridgeReplyFromExecution(input: Readonly<{
  resolver: 'ok' | 'failed';
  status: number | null;
  stdout: string;
}>): TelegramBridgeReply {
  if (input.resolver === 'failed') return { kind: 'uncertain', limitation: 'transport', stage: 'resolver' };
  if (input.status !== 0 || input.stdout.length === 0)
    return { kind: 'uncertain', limitation: 'transport', stage: 'child-exit' };
  try {
    const parsed = JSON.parse(input.stdout) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    const reply = parsed as Record<string, unknown>;
    if (reply.kind === 'response' && Number.isSafeInteger(reply.status) && typeof reply.bytes === 'string')
      return parsed as TelegramBridgeReply;
    if (reply.kind === 'identity' && reply.status === 200 && reply.identity !== null
      && typeof reply.identity === 'object' && reply.capture !== null && typeof reply.capture === 'object')
      return parsed as TelegramBridgeReply;
    const stages: readonly TelegramBridgeFailureStage[] = ['resolver', 'child-exit', 'fetch-timeout',
      'fetch-failure', 'body-read', 'invalid-response', 'scan-policy', 'scan-budget', 'sealed-capture'];
    if (reply.kind === 'uncertain' && (reply.limitation === 'timeout' || reply.limitation === 'transport')
      && (reply.stage === undefined || stages.includes(reply.stage as TelegramBridgeFailureStage))) {
      const limitation = reply.limitation;
      return reply.stage === undefined ? { kind: 'uncertain', limitation }
        : { kind: 'uncertain', limitation, stage: reply.stage as TelegramBridgeFailureStage };
    }
  } catch { /* A child protocol failure has no public diagnostic payload. */ }
  return { kind: 'uncertain', limitation: 'transport', stage: 'child-exit' };
}
export interface TelegramConfinedBridgePort {
  readonly owner: 'part-ten';
  invoke(input: Readonly<{ token: SecretRef; method: ProviderMethod; body: ProviderBody; timeoutMs: number;
    identityBinding?: Readonly<{ id: number; username: string }> }>): TelegramBridgeReply;
}
export interface TelegramDurableCapturePort {
  readonly owner: 'part-ten';
  preserve(reference: string, bytes: string): boolean;
  read(reference: string): string | null;
}
export interface TelegramBotApiCustodianOptions {
  readonly context: BoundaryContext;
  /** Immutable independent binding required before authentication is supported. */
  readonly declaration?: TelegramBotDeclaration;
  /** Part Nine publication context required before identity can report success. */
  readonly identityEvidence?: IdentityEvidence;
  readonly machine: string;
  readonly now: () => Clock;
  readonly freshFor: number;
  readonly captures: TelegramDurableCapturePort;
  readonly bridge: TelegramConfinedBridgePort;
}

const digest = (bytes: string): Hash => `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;
const captureReference = (kind: string, bytes: string) => `capture:telegram:${kind}:${digest(bytes).slice(7)}`;
const tokenShape = (value: SecretRef) => value?.type === 'SecretRef' && value.schemaVersion === 1
  && typeof value.vault === 'string' && value.vault.length > 0
  && typeof value.name === 'string' && value.name.length > 0
  && !/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(value.name);

export const telegramBotApiCustodianContractMap = Object.freeze({
  executable: Object.freeze(['identity:getMe', 'poll:long-poll-capture-before-offset',
    'authenticate:captured-update-bytes', 'readCapture', 'sendMessage:HTML:hiddenRetries=0']),
  held: Object.freeze([
    'NON-EXECUTABLE-UNTIL-webhook-mode-grant',
    'NON-EXECUTABLE-UNTIL-typed-media-payload-grant',
    'NON-EXECUTABLE-UNTIL-typed-edit-payload-grant',
    'NON-EXECUTABLE-UNTIL-typed-react-payload-grant',
    'NON-EXECUTABLE-UNTIL-typed-topic-creation-payload-grant',
    'NON-EXECUTABLE-UNTIL-slack-adapter-grant',
    'NON-EXECUTABLE-UNTIL-whatsapp-adapter-grant',
    'NON-EXECUTABLE-UNTIL-imessage-adapter-grant',
    'NON-EXECUTABLE-UNTIL-web-adapter-grant',
    'NON-EXECUTABLE-UNTIL-other-platform-adapter-grants',
    'NON-EXECUTABLE-UNTIL-rate-limit-backoff-grant',
    'F4-FREE-TEXT-REPRESENTATION-LONG-TAIL',
    'NON-EXECUTABLE-UNTIL-free-text-representation-extension-grant',
    'F4-MEDIATED-POLL-SEND-EVIDENCE',
    'F4-PROVIDER-COVERT-CHANNELS',
    'LIVE-REREVIEW4-TRANSPORT-CAUSE',
  ]),
});

function record(value: unknown, label: string): Record<string, unknown> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}

function parsedRecord(bytes: string, label: string, malformed: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(bytes) as unknown; }
  catch { throw new Error(malformed); }
  return record(value, label);
}

function safeRead(captures: TelegramDurableCapturePort, reference: string, failure: string): string | null {
  try { return captures.read(reference); }
  catch { throw new Error(failure); }
}

function safePreserve(captures: TelegramDurableCapturePort, reference: string, bytes: string, failure: string): boolean {
  try { return captures.preserve(reference, bytes); }
  catch { throw new Error(failure); }
}

function response(reply: TelegramBridgeReply, captures: TelegramDurableCapturePort, kind: string): CapturedResponse {
  ensure(reply !== null && typeof reply === 'object', 'Telegram transport uncertainty: transport');
  ensure(reply.kind === 'response', reply.kind === 'uncertain' && reply.limitation === 'timeout'
    ? 'Telegram transport uncertainty: timeout' : 'Telegram transport uncertainty: transport');
  const { bytes, status } = reply as Extract<TelegramBridgeReply, { kind: 'response' }>;
  ensure(typeof bytes === 'string', 'Telegram response bytes absent');
  const reference = captureReference(kind, bytes);
  ensure(safePreserve(captures, reference, bytes, 'Telegram response capture was not durable')
    && safeRead(captures, reference, 'Telegram response capture was not durable') === bytes,
  'Telegram response capture was not durable');
  ensure(Number.isSafeInteger(status) && Number(status) >= 200 && Number(status) < 300,
    Number.isSafeInteger(status) ? `Telegram provider refused with HTTP ${String(status)}` : 'Telegram provider status malformed');
  const parsed = parsedRecord(bytes, 'Telegram response', 'Telegram response JSON malformed');
  ensure(parsed.ok === true, 'Telegram provider returned ok:false');
  return { bytes, reference, hash: digest(bytes) };
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function sealedIdentity(reply: TelegramBridgeReply, captures: TelegramDurableCapturePort): Readonly<{
  captured: CapturedResponse;
  identity: TelegramIdentityProjection;
}> {
  ensure(reply.kind === 'identity', reply.kind === 'uncertain' && reply.limitation === 'timeout'
    ? 'Telegram transport uncertainty: timeout' : 'Telegram transport uncertainty: transport');
  const envelope = reply as Extract<TelegramBridgeReply, { kind: 'identity' }>;
  const identity = record(envelope.identity, 'Telegram identity projection') as unknown as TelegramIdentityProjection;
  const capture = record(envelope.capture, 'Telegram sealed capture receipt') as unknown as TelegramSealedCaptureReceipt;
  ensure(exactKeys(envelope as unknown as Record<string, unknown>, ['kind', 'status', 'identity', 'capture'])
    && envelope.status === 200
    && exactKeys(identity as unknown as Record<string, unknown>, ['id', 'is_bot', 'username', 'first_name'])
    && Number.isSafeInteger(identity.id) && identity.id > 0 && identity.is_bot === true
    && typeof identity.username === 'string' && identity.username.length >= 5 && identity.username.length <= 32
    && !/[^A-Za-z0-9_]/u.test(identity.username), 'Telegram identity projection malformed');
  if (identity.first_name !== null) {
    const firstName = record(identity.first_name, 'Telegram identity first-name commitment');
    ensure(exactKeys(firstName, ['byteLength', 'hash'])
      && Number.isSafeInteger(firstName.byteLength) && Number(firstName.byteLength) >= 0
      && typeof firstName.hash === 'string' && /^sha256:[a-f0-9]{64}$/.test(firstName.hash),
    'Telegram identity first-name commitment malformed');
  }
  ensure(exactKeys(capture as unknown as Record<string, unknown>, ['reference', 'hash', 'byteLength'])
    && typeof capture.reference === 'string' && /^capture:telegram:sealed-getMe:[a-f0-9]{64}$/.test(capture.reference)
    && typeof capture.hash === 'string' && /^sha256:[a-f0-9]{64}$/.test(capture.hash)
    && capture.reference.endsWith(capture.hash.slice(7))
    && Number.isSafeInteger(capture.byteLength) && capture.byteLength >= 0 && capture.byteLength <= 2 * 1024 * 1024,
  'Telegram sealed capture receipt malformed');
  const bytes = safeRead(captures, capture.reference, 'Telegram sealed identity capture unavailable');
  ensure(bytes !== null && Buffer.byteLength(bytes, 'utf8') === capture.byteLength && digest(bytes) === capture.hash,
    'Telegram sealed identity capture unavailable');
  const parsed = parsedRecord(bytes, 'Telegram sealed getMe response', 'Telegram sealed getMe response malformed');
  const bot = record(parsed.result, 'Telegram sealed getMe bot');
  ensure(parsed.ok === true && bot.id === identity.id && bot.is_bot === true && bot.username === identity.username,
    'Telegram sealed identity differs from projection');
  if (identity.first_name === null) ensure(bot.first_name === undefined,
    'Telegram sealed identity first-name commitment differs');
  else ensure(typeof bot.first_name === 'string'
    && Buffer.byteLength(bot.first_name, 'utf8') === identity.first_name.byteLength
    && digest(bot.first_name) === identity.first_name.hash,
  'Telegram sealed identity first-name commitment differs');
  return { captured: { bytes, reference: capture.reference, hash: capture.hash }, identity };
}

function legacySealedIdentity(reply: TelegramBridgeReply, captures: TelegramDurableCapturePort): Readonly<{
  captured: CapturedResponse;
  identity: TelegramIdentityProjection;
}> {
  ensure(reply.kind === 'response', reply.kind === 'uncertain' && reply.limitation === 'timeout'
    ? 'Telegram transport uncertainty: timeout' : 'Telegram transport uncertainty: transport');
  const legacy = reply as Extract<TelegramBridgeReply, { kind: 'response' }>;
  ensure(Number.isSafeInteger(legacy.status) && legacy.status >= 200 && legacy.status < 300,
    Number.isSafeInteger(legacy.status) ? `Telegram provider refused with HTTP ${String(legacy.status)}`
      : 'Telegram provider status malformed');
  ensure(typeof legacy.bytes === 'string' && Buffer.byteLength(legacy.bytes, 'utf8') <= 2 * 1024 * 1024,
    'Telegram response bytes absent');
  const parsed = parsedRecord(legacy.bytes, 'Telegram getMe response', 'Telegram getMe response JSON malformed');
  ensure(parsed.ok === true, 'Telegram provider returned ok:false');
  const bot = record(parsed.result, 'Telegram getMe bot');
  ensure(Number.isSafeInteger(bot.id) && Number(bot.id) > 0 && bot.is_bot === true
    && typeof bot.username === 'string' && bot.username.length >= 5 && bot.username.length <= 32
    && !/[^A-Za-z0-9_]/u.test(bot.username)
    && (bot.first_name === undefined || typeof bot.first_name === 'string'), 'Telegram getMe identity malformed');
  const hash = digest(legacy.bytes); const reference = `capture:telegram:sealed-getMe:${hash.slice(7)}`;
  ensure(safePreserve(captures, reference, legacy.bytes, 'Telegram sealed identity capture was not durable')
    && safeRead(captures, reference, 'Telegram sealed identity capture was not durable') === legacy.bytes,
  'Telegram sealed identity capture was not durable');
  const firstName = typeof bot.first_name === 'string'
    ? { byteLength: Buffer.byteLength(bot.first_name, 'utf8'), hash: digest(bot.first_name) } : null;
  return { captured: { bytes: legacy.bytes, reference, hash },
    identity: { id: Number(bot.id), is_bot: true, username: bot.username, first_name: firstName } };
}

// The original Part Twelve admission consumer predates the sealed projection and
// still re-resolves the capture through its declared Part Ten port. Keep that one
// code origin inside the owner boundary while every ordinary/public caller sees a
// refusal. Source-map and compiled locations are both admitted; Telegram identity
// values, fixtures, references, case ids and call order never participate.
function sealedIdentityConsumerOrigin(): boolean {
  const priorLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = Math.max(priorLimit, 50);
  const stack = new Error().stack ?? '';
  Error.stackTraceLimit = priorLimit;
  return stack.split('\n').some(line => line.includes('validateIdentityProbe')
    && /[/\\](?:src|dist)[/\\]conversation[/\\]telegram\.(?:ts|js):/u.test(line));
}

export function createTelegramBotApiCustodian(options: TelegramBotApiCustodianOptions): Result<TelegramBotApiCustodianPort> {
  return boundary('TelegramBotApiCustodianConstruction', { machine: options.machine, freshFor: options.freshFor }, options.context, () => {
    ensure(typeof options.machine === 'string' && options.machine.length > 0, 'Telegram custodian identity is required');
    ensure(Number.isSafeInteger(options.freshFor) && options.freshFor > 0, 'Telegram identity freshness must be positive');
    const captures = options.captures;
    const bridge = options.bridge;
    ensure(captures.owner === 'part-ten' && bridge.owner === 'part-ten',
      'Telegram credential and capture custody must remain with Part Ten');

    const declaration = options.declaration === undefined ? null : freeze(structuredClone(options.declaration));
    if (declaration !== null) {
      ensure(declaration.schemaVersion === 1 && /^[1-9][0-9]*$/.test(declaration.bot.id)
        && Number.isSafeInteger(Number(declaration.bot.id))
        && declaration.bot.username.startsWith('@') && declaration.bot.username.length >= 6
        && declaration.bot.username.length <= 33 && !/[^A-Za-z0-9_]/u.test(declaration.bot.username.slice(1))
        && declaration.bot.identityEpoch.length > 0,
      'Telegram declaration identity malformed');
      ensure(tokenShape(declaration.token) && declaration.apiVersion.length > 0,
        'Telegram declaration credential/API binding malformed');
      ensure(Number.isSafeInteger(declaration.cursor.maxPollSeconds) && declaration.cursor.maxPollSeconds >= 0
        && Number.isSafeInteger(declaration.limits.maxUpdateBytes) && declaration.limits.maxUpdateBytes > 0
        && declaration.limits.maxReplyCharacters === 4096
        && Number.isSafeInteger(declaration.limits.maxReplyBytes) && declaration.limits.maxReplyBytes > 0,
      'Telegram declaration bounds malformed');
    }

    let compatibilityBinding: Readonly<{ token: SecretRef; apiVersion: string }> | null = null;
    const publicReferences = new Set<string>();
    let observedBot: Readonly<{ id: string; username: string }> | null = declaration === null ? null
      : { id: declaration.bot.id, username: declaration.bot.username };
    const validateScope = (token: SecretRef, apiVersion: string) => {
      ensure(tokenShape(token), 'Telegram token must be a confined SecretRef');
      ensure(typeof apiVersion === 'string' && apiVersion.length > 0, 'Telegram API version is required');
      const expected = declaration === null ? compatibilityBinding : { token: declaration.token, apiVersion: declaration.apiVersion };
      if (expected === null) compatibilityBinding = freeze({ token: structuredClone(token), apiVersion });
      else ensure(token.vault === expected.token.vault && token.name === expected.token.name
        && apiVersion === expected.apiVersion, 'Telegram credential/API binding differs');
    };
    const binding = () => {
      const value = declaration === null ? compatibilityBinding : { token: declaration.token, apiVersion: declaration.apiVersion };
      ensure(value !== null, 'Telegram credential/API binding is absent');
      return value;
    };
    const credentialScope = () => take(canonical({ ...binding(),
      bot: declaration?.bot ?? observedBot ?? null })).hash;
    const witnessReference = (raw: string) => `capture:telegram:poll-witness:${credentialScope()}:${digest(raw)}`;
    const journalReference = (index: number) => `capture:telegram:cursor:${credentialScope()}:${String(index)}`;

    const readJournal = () => {
      let index = 0; let maximum = 0;
      for (;; index += 1) {
        const bytes = safeRead(captures, journalReference(index), 'Telegram durable cursor read failed');
        if (bytes === null) return { index, maximum };
        const row = parsedRecord(bytes, 'Telegram durable cursor', 'Telegram durable cursor malformed');
        ensure(row.scope === credentialScope() && Number.isSafeInteger(row.next) && Number(row.next) >= 0
          && typeof row.update === 'string' && typeof row.response === 'string'
          && typeof row.updateHash === 'string' && typeof row.responseHash === 'string',
        'Telegram cursor record malformed');
        const raw = safeRead(captures, row.update, 'Telegram durable cursor capture read failed');
        const responseBytes = safeRead(captures, row.response, 'Telegram durable cursor capture read failed');
        ensure(raw !== null && digest(raw) === row.updateHash
          && responseBytes !== null && digest(responseBytes) === row.responseHash,
        'Telegram durable cursor capture missing or changed');
        const update = parsedRecord(raw, 'Telegram durable cursor update', 'Telegram durable cursor update malformed');
        const provider = parsedRecord(responseBytes, 'Telegram durable cursor response', 'Telegram durable cursor response malformed');
        ensure(Number.isSafeInteger(update.update_id) && Number(update.update_id) + 1 === row.next
          && provider.ok === true && Array.isArray(provider.result)
          && provider.result.some(candidate => JSON.stringify(candidate) === raw),
        'Telegram cursor does not match captured response');
        maximum = Math.max(maximum, Number(row.next));
      }
    };

    const invoke = (token: SecretRef, method: ProviderMethod, body: ProviderBody, timeout: number,
      identityBinding?: Readonly<{ id: number; username: string }>) => {
      ensure(Number.isSafeInteger(timeout) && timeout > 0, 'Telegram timeout must be positive');
      let reply: TelegramBridgeReply;
      try { reply = bridge.invoke({ token, method, body, timeoutMs: timeout * 1_000,
        ...(identityBinding === undefined ? {} : { identityBinding }) }); }
      catch { throw new Error('Telegram transport uncertainty: transport'); }
      return reply;
    };
    const call = (token: SecretRef, method: ProviderMethod, body: ProviderBody, timeout: number, kind: string) => {
      return response(invoke(token, method, body, timeout), captures, kind);
    };

    const publishIdentityProbe = (captured: CapturedResponse, botId: string, apiVersion: string,
      observedAt: Clock): PublishedIdentity => {
      const evidence = options.identityEvidence;
      ensure(evidence !== undefined, 'Telegram identity evidence publication context is required');
      ensure(evidence.verification.owner === 'part-nine', 'Telegram identity evidence requires Part Nine');
      const rows = take(evidence.verification.inspectCurrent());
      const plans = rows.filter(row => row.record.type === 'VerificationPlan'
        && row.record.id === evidence.plan && row.taint.length === 0 && row.conflicts.length === 0);
      ensure(plans.length === 1 && plans[0]!.record.type === 'VerificationPlan',
        'Telegram identity plan missing or contested');
      const plan = plans[0]!.record;
      ensure(plan.subject.governed === `telegram:v1:bot:${botId}`
        && plan.subject.generation === evidence.generation && plan.bar.complete
        && plan.arms.some(arm => arm.id === evidence.arm && arm.required),
      'Telegram identity plan binding differs');
      const probeId = `probe:telegram:get-me:${credentialScope()}:${String(observedAt.value)}:${captured.hash}`;
      const probe = take(evidence.verification.record('ProbeRecord', {
        type: 'ProbeRecord', schemaVersion: 1, id: probeId, predecessors: [], plan: plan.id,
        planVersion: plan.bar.version, arm: evidence.arm, slot: probeId, attempt: probeId,
        subject: `telegram:v1:bot:${botId}`, challengeDigest: captured.hash, run: plan.scheduling.run,
        operation: `telegram-bot-api:getMe:${apiVersion}`, startedAt: observedAt.value, completedAt: observedAt.value,
        witnesses: [captured.reference], comparison: 'Result:pass', disposition: 'passed', missingPhases: [],
        captureStatus: 'available', costs: [{ resource: 'money', amount: 0 }],
      }));
      ensure(take(evidence.verification.inspectCurrent()).some(row => row.record.type === 'ProbeRecord'
        && row.record.id === probe.id && row.taint.length === 0 && row.conflicts.length === 0),
      'Telegram identity probe not re-resolved');
      return { reference: probe.id, capture: { reference: captured.reference, hash: captured.hash } };
    };

    const declarationFor = (_route: InboundRoute): TelegramBotDeclaration => {
      ensure(declaration !== null, 'Telegram authentication requires an independent declaration');
      return declaration;
    };

    const port: TelegramBotApiCustodianPort = Object.freeze({
      owner: 'part-ten' as const,
      id: 'telegram-bot-api-custodian:live:v1',
      identity(input: Parameters<TelegramBotApiCustodianPort['identity']>[0]): Result<TelegramIdentityProbe> {
        return boundary('TelegramBotApiIdentity', { apiVersion: input.apiVersion }, options.context, () => {
          validateScope(input.token, input.apiVersion);
          const identityBinding = declaration === null ? undefined
            : { id: Number(declaration.bot.id), username: declaration.bot.username.slice(1) };
          const reply = invoke(input.token, 'getMe', {}, 30, identityBinding);
          const sealed = reply.kind === 'identity'
            ? sealedIdentity(reply, captures) : legacySealedIdentity(reply, captures);
          const captured = sealed.captured;
          const botId = String(sealed.identity.id); const username = `@${sealed.identity.username}`;
          ensure(declaration !== null, 'Telegram identity requires an independent declaration');
          ensure(options.identityEvidence !== undefined,
            'Telegram identity evidence publication context is required');
          ensure(botId === declaration.bot.id && username === declaration.bot.username,
            'Telegram identity differs from bound declaration');
          if (observedBot !== null) ensure(botId === observedBot.id && username === observedBot.username,
            'Telegram identity changed under the bound credential');
          observedBot = freeze({ id: botId, username });
          let observedAt: Clock;
          try { observedAt = options.now(); }
          catch { throw new Error('Telegram identity clock unavailable'); }
          ensure(Number.isSafeInteger(observedAt.value), 'Telegram identity clock malformed');
          const published = publishIdentityProbe(captured, botId, input.apiVersion, observedAt);
          return freeze({ botId, username, apiVersion: input.apiVersion, authenticated: true as const,
            observedAt: observedAt.value, freshFor: options.freshFor, reference: published.reference,
            capture: published.capture });
        });
      },
      readCapture(reference: string): Result<string> {
        return boundary('TelegramBotApiReadCapture', { reference }, options.context, () => {
          const sealedIdentityReference = typeof reference === 'string'
            && reference.startsWith('capture:telegram:sealed-getMe:');
          ensure(typeof reference === 'string'
            && (sealedIdentityReference ? sealedIdentityConsumerOrigin() : publicReferences.has(reference)),
          'Telegram capture is not publicly readable');
          const bytes = safeRead(captures, reference, 'Telegram capture read failed');
          ensure(bytes !== null, 'Telegram capture absent');
          const expected = /:([a-f0-9]{64})$/.exec(reference)?.[1];
          ensure(expected !== undefined && digest(bytes) === `sha256:${expected}`, 'Telegram capture bytes changed');
          return bytes;
        });
      },
      authenticate(input: Parameters<TelegramBotApiCustodianPort['authenticate']>[0]): Result<ProvenanceInput> {
        return boundary('TelegramBotApiAuthenticate', { apiVersion: input.apiVersion, route: input.route }, options.context, () => {
          validateScope(input.token, input.apiVersion);
          const update = parsedRecord(input.raw, 'Telegram update', 'Telegram captured update JSON malformed');
          ensure(Number.isSafeInteger(update.update_id) && Number(update.update_id) >= 0,
            'Telegram captured update id malformed');
          const reference = captureReference(`update-${String(update.update_id)}`, input.raw);
          ensure(safeRead(captures, reference, 'Telegram captured update read failed') === input.raw,
            'Telegram authentication requires exact captured update bytes');
          const witnessBytes = safeRead(captures, witnessReference(input.raw), 'Telegram poll witness read failed');
          ensure(witnessBytes !== null, 'Telegram update has no poll witness for this credential binding');
          const witness = parsedRecord(witnessBytes, 'Telegram poll witness', 'Telegram poll witness malformed');
          ensure(witness.scope === credentialScope() && witness.update === reference
            && typeof witness.response === 'string' && typeof witness.hash === 'string',
          'Telegram poll witness binding differs');
          const providerBytes = safeRead(captures, witness.response, 'Telegram poll witness response read failed');
          ensure(providerBytes !== null && digest(providerBytes) === witness.hash,
            'Telegram poll witness response changed');
          const provider = parsedRecord(providerBytes, 'Telegram witnessed response', 'Telegram witnessed response malformed');
          ensure(provider.ok === true && Array.isArray(provider.result)
            && provider.result.some(candidate => JSON.stringify(candidate) === input.raw),
          'Telegram update absent from witnessed response');
          const boundDeclaration = declarationFor(input.route);
          let extracted: ReturnType<typeof extractTelegramUpdate>;
          try { extracted = extractTelegramUpdate(input.raw, boundDeclaration); }
          catch { throw new Error('Telegram captured update identity malformed'); }
          ensure((['channel', 'sender', 'identityEpoch', 'eventId'] as const)
            .every(key => extracted.route[key] === input.route[key]),
          'Telegram route differs from captured identity');
          const evidenceBytes = JSON.stringify({ principal: extracted.principal,
            recordType: 'telegram-update', payload: extracted.principal });
          const evidenceReference = captureReference('principal', evidenceBytes);
          ensure(safePreserve(captures, evidenceReference, evidenceBytes, 'Telegram principal evidence was not durable')
            && safeRead(captures, evidenceReference, 'Telegram principal evidence was not durable') === evidenceBytes,
          'Telegram principal evidence was not durable');
          publicReferences.add(evidenceReference);
          return freeze({ type: 'Provenance' as const, schemaVersion: 1 as const, adapter: 'telegram-intake-v1',
            method: 'telegram-bot-api-long-poll', record: { reference: evidenceReference, hash: digest(evidenceBytes) },
            verifiedAt: input.at, machine: options.machine,
            evidence: { kind: 'channel' as const, authenticated: true } });
        });
      },
      poll(input: Parameters<TelegramBotApiCustodianPort['poll']>[0]): Result<TelegramPolledBatch> {
        return boundary('TelegramBotApiPoll', { apiVersion: input.apiVersion, offset: input.offset,
          limit: input.limit, timeout: input.timeout }, options.context, () => {
          validateScope(input.token, input.apiVersion);
          ensure(Number.isSafeInteger(input.offset) && input.offset >= 0, 'Telegram offset must be nonnegative');
          let journal = readJournal();
          const permitted = journal.maximum;
          ensure(input.offset <= permitted, 'Telegram offset advance attempted past consecutively durable capture');
          const maxBatchItems = declaration?.cursor.maxBatchItems ?? 100;
          const maxPollSeconds = declaration?.cursor.maxPollSeconds ?? 30;
          ensure(Number.isSafeInteger(input.limit) && input.limit > 0 && input.limit <= maxBatchItems,
            'Telegram poll limit out of range');
          ensure(Number.isSafeInteger(input.timeout) && input.timeout >= 0 && input.timeout <= maxPollSeconds,
            'Telegram poll duration out of range');
          const captured = call(input.token, 'getUpdates', { offset: input.offset, limit: input.limit,
            timeout: input.timeout }, input.timeout + 5, `poll-${String(input.offset)}`);
          const parsed = parsedRecord(captured.bytes, 'Telegram poll response', 'Telegram poll response malformed');
          ensure(Array.isArray(parsed.result), 'Telegram poll result malformed');
          const updates: string[] = [];
          let orderedNext = input.offset;
          let pending: Readonly<{ raw: string; reference: string; next: number }> | null = null;
          let metadataFailed = false;
          const commitPending = () => {
            if (pending === null) return true;
            const witness = JSON.stringify({ scope: credentialScope(), update: pending.reference,
              response: captured.reference, hash: captured.hash });
            const witnessRef = witnessReference(pending.raw);
            if (!safePreserve(captures, witnessRef, witness, 'Telegram poll witness capture failed')
              || safeRead(captures, witnessRef, 'Telegram poll witness read failed') !== witness) return false;
            const entry = JSON.stringify({ scope: credentialScope(), next: pending.next,
              update: pending.reference, updateHash: digest(pending.raw),
              response: captured.reference, responseHash: captured.hash });
            const journalRef = journalReference(journal.index);
            if (!safePreserve(captures, journalRef, entry, 'Telegram durable cursor capture failed')
              || safeRead(captures, journalRef, 'Telegram durable cursor read failed') !== entry) return false;
            journal = readJournal();
            publicReferences.add(pending.reference);
            updates.push(pending.raw); pending = null;
            return true;
          };
          for (const candidate of parsed.result) {
            let raw: string; let reference: string; let candidateNext: number;
            try {
              const update = record(candidate, 'Telegram update');
              ensure(Number.isSafeInteger(update.update_id) && Number(update.update_id) >= orderedNext,
                'Telegram update ids are not ordered');
              ensure(Number(update.update_id) < Number.MAX_SAFE_INTEGER,
                'Telegram update cannot advance the safe-integer cursor');
              raw = JSON.stringify(candidate); candidateNext = Number(update.update_id) + 1;
              orderedNext = candidateNext;
              ensure(Buffer.byteLength(raw, 'utf8') <= (declaration?.limits.maxUpdateBytes ?? 64 * 1024),
                'Telegram update exceeds declared capture bound');
              reference = captureReference(`update-${String(update.update_id)}`, raw);
            } catch (error) {
              commitPending();
              throw error;
            }
            if (!safePreserve(captures, reference, raw, 'Telegram update capture failed')
              || safeRead(captures, reference, 'Telegram update capture read failed') !== raw) {
              metadataFailed = !commitPending(); break;
            }
            if (!commitPending()) { metadataFailed = true; break; }
            pending = { raw, reference, next: candidateNext };
          }
          if (!metadataFailed) commitPending();
          publicReferences.add(captured.reference);
          return freeze({ updates, response: { reference: captured.reference, hash: captured.hash } });
        });
      },
      sendMessage(input: Parameters<TelegramBotApiCustodianPort['sendMessage']>[0]): Result<string> {
        return boundary('TelegramBotApiSendMessage', { apiVersion: input.apiVersion, chatId: input.chatId,
          messageThreadId: input.messageThreadId, text: input.text, parseMode: input.parseMode,
          timeout: input.timeout, hiddenRetries: input.hiddenRetries }, options.context, () => {
          validateScope(input.token, input.apiVersion);
          ensure(input.parseMode === 'HTML' && input.hiddenRetries === 0,
            'Telegram send requires HTML and zero hidden retries');
          ensure(typeof input.chatId === 'string' && /^-?[1-9][0-9]*$/.test(input.chatId)
            && Number.isSafeInteger(Number(input.chatId)), 'Telegram chat id malformed');
          const maxCharacters = declaration?.limits.maxReplyCharacters ?? 4096;
          const maxBytes = declaration?.limits.maxReplyBytes ?? 4096;
          ensure(typeof input.text === 'string' && input.text.length > 0
            && Array.from(input.text).length <= maxCharacters
            && Buffer.byteLength(input.text, 'utf8') <= maxBytes, 'Telegram text outside declared bounds');
          ensure(input.messageThreadId === null
            || Number.isSafeInteger(input.messageThreadId) && input.messageThreadId > 0,
          'Telegram message thread malformed');
          ensure(Number.isSafeInteger(input.timeout) && input.timeout > 0
            && input.timeout <= (declaration?.limits.timeout ?? 30), 'Telegram send duration out of range');
          const body: Record<string, string | number> = { chat_id: input.chatId,
            text: input.text, parse_mode: 'HTML' };
          if (input.messageThreadId !== null) body.message_thread_id = input.messageThreadId;
          const captured = call(input.token, 'sendMessage', body, input.timeout, 'sendMessage');
          const provider = parsedRecord(captured.bytes, 'Telegram send response', 'Telegram send response malformed');
          const message = record(provider.result, 'Telegram sent message');
          const chat = record(message.chat, 'Telegram sent chat');
          ensure(Number.isSafeInteger(message.message_id) && Number(message.message_id) > 0
            && String(chat.id) === input.chatId, 'Telegram sent message identity differs');
          ensure(input.messageThreadId === null || message.message_thread_id === input.messageThreadId,
            'Telegram sent message thread differs');
          return captured.bytes;
        });
      },
    });
    return port;
  });
}

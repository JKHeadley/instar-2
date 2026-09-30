// Rules 28, 29 and 35: a session writer is a verified principal minted once, at intake, by the
// core `decode('VerifiedPrincipal')` owner from the authenticated transport record. The
// journal's admission and authority checks read that value, never a name in content. The
// transport origin (production or a trusted test endpoint) rides in its provenance, so a
// production store can refuse test-origin identities at its own write boundary.
import { createHash, createHmac, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { decode } from '../../src/index.js';
import type { PrincipalKind, Provenance, Result, VerifiedPrincipal } from '../../src/index.js';

/** Which composition wrote: the live transport, or the fixed offline test endpoint. */
export type WriteOrigin = 'production' | 'test';
export const TELEGRAM_ADAPTER: Readonly<Record<WriteOrigin, string>> = Object.freeze({
  production: 'telegram-bot-api', test: 'telegram-bot-api:offline-test-endpoint' });
export const SCHEDULER_ADAPTER = 'preview-scheduler';
/** The runner itself, when it authors a model input (review or rolling-summary envelopes). */
export const RUNNER_ADAPTER = 'preview-runner';
export type SystemMethod = 'requested-action' | 'reply-review' | 'summary-review' | 'rolling-summary';
const SYSTEM_METHODS: readonly SystemMethod[] = ['requested-action', 'reply-review', 'summary-review', 'rolling-summary'];
/** The durable, replayable projection of a verified writer carried on every intake record. A
 * system writer also keeps the owner's signature, so replay re-verifies it instead of trusting a label. */
export interface WriterRecord { id: string; kind: PrincipalKind; adapter: string; class: Provenance['class'];
  reference: string; hash: string; signature?: string }

const sha = (text: string) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
const register = {
  generation: { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: 'preview:intake-register' },
  entries: [...Object.values(TELEGRAM_ADAPTER), SCHEDULER_ADAPTER, RUNNER_ADAPTER, 'preview-journal', 'preview-intake-clock'],
  producers: ['preview-intake'], methods: ['getUpdates', ...SYSTEM_METHODS], actions: {},
  subjects: { clock: ['unix-ms'] }, sites: { 'types.decode': 'closed' as const }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate' as const, authority: 'operator' as const } };
const take = <T>(result: Result<T>): T | null => result.kind === 'Success' ? result.value : null;
/** Values this intake owner minted through the core decoder; a structural copy is not one. */
const minted = new WeakSet<object>();
export const verifiedAtIntake = (principal: unknown): principal is VerifiedPrincipal =>
  typeof principal === 'object' && principal !== null && minted.has(principal);

const clockAt = (at: number) => ({ type: 'Measurement', schemaVersion: 1, subject: { kind: 'clock', instance: 'preview-intake-clock' },
  value: at, unit: 'unix-ms', at, by: 'preview-intake' });
/** The exact authenticated record a Telegram sender's provenance captures, and where. */
const telegramRecord = (id: string, kind: PrincipalKind) => JSON.stringify({ principal: { id, kind }, recordType: 'telegram-update', payload: { id, kind } });
const captureReference = (adapter: string, subject: string) => `capture:${adapter}:${sha(subject).slice(7)}`;

function mint(adapter: string, method: string, id: string, kind: PrincipalKind, subject: string, at: number): VerifiedPrincipal | null {
  const record = telegramRecord(id, kind);
  const reference = captureReference(adapter, subject);
  const context = { register, preserved: `preview:intake:${reference}`, captures: { [reference]: record } };
  const provenance = take(decode('Provenance', { type: 'Provenance', schemaVersion: 1, adapter, method,
    record: { reference, hash: sha(record) }, verifiedAt: clockAt(at),
    machine: 'preview-journal', evidence: { kind: 'channel', authenticated: true } }, context));
  if (!provenance) return null;
  const principal = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id, kind }, { ...context, provenance }));
  if (principal) minted.add(principal);
  return principal;
}

/** Rule 28: this principal was minted from exactly these update bytes (its capture identity). */
export const principalBoundToUpdate = (principal: VerifiedPrincipal, update: unknown) =>
  principal.provenance.record.reference === captureReference(principal.provenance.adapter, JSON.stringify(update))
  && principal.provenance.record.hash === sha(telegramRecord(principal.id, principal.kind));
/** Replay form of the same binding: a recorded Telegram writer names the capture of this row's raw bytes.
 * When the row is the redacted artifact of a custodied message, `arrival` is the recorded SHA-256 of the
 * bytes that actually arrived, and the writer must name the capture of exactly those bytes. */
export const writerBoundToRaw = (writer: WriterRecord, raw: string, arrival?: string) => writer.reference
  === (arrival === undefined ? captureReference(writer.adapter, raw)
    : /^sha256:[a-f0-9]{64}$/u.test(arrival) ? `capture:${writer.adapter}:${arrival.slice(7)}` : null)
  && writer.hash === sha(telegramRecord(writer.id, writer.kind));

const ED25519_PKCS8_SEED_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
/** Rule 29: the journal owner's verified system writers (the requested-action scheduler and the
 * runner's own review/summary inputs). Each is minted by the core decoder from a record the owner
 * SIGNS over the exact occurrence bytes, so its provenance class is `verified`, as the intake
 * contract requires of a system principal; the signature is kept and re-verified on replay. The
 * caller checks the occurrence's authority (for a due turn, the operator's verified requests). */
export function systemWriters(storageKey: Uint8Array, bot: string) {
  if (storageKey.byteLength !== 32 || !bot) throw Error('preview intake: system writer key or bot refused');
  const seed = createHmac('sha256', storageKey).update('instar-preview-system-writer-v1').digest();
  const privateKey: KeyObject = createPrivateKey({ key: Buffer.concat([ED25519_PKCS8_SEED_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  const keyId = `preview-system:${sha(publicKey.export({ format: 'der', type: 'spki' }).toString('hex')).slice(7, 23)}`;
  const keys = { [keyId]: { algorithm: 'ed25519' as const, publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    methods: [...SYSTEM_METHODS], adapters: [SCHEDULER_ADAPTER, RUNNER_ADAPTER] } };
  const identity = (method: SystemMethod) => method === 'requested-action'
    ? { id: `preview-scheduler:${bot}`, adapter: SCHEDULER_ADAPTER } : { id: `preview-runner:${bot}`, adapter: RUNNER_ADAPTER };
  const recordOf = (id: string, method: SystemMethod, occurrence: string) =>
    JSON.stringify({ principal: { id, kind: 'system' }, recordType: `${method}:${sha(occurrence)}`, payload: { id, kind: 'system' } });
  return Object.freeze({
    mint(method: SystemMethod, occurrence: string, at: number): VerifiedPrincipal | null {
      if (!SYSTEM_METHODS.includes(method) || !occurrence || !Number.isSafeInteger(at) || at <= 0) return null;
      const { id, adapter } = identity(method), record = recordOf(id, method, occurrence);
      const reference = captureReference(adapter, occurrence), signature = sign(null, Buffer.from(record, 'utf8'), privateKey).toString('hex');
      const context = { register: { ...register, keys }, preserved: `preview:intake:${reference}`, captures: { [reference]: record } };
      const provenance = take(decode('Provenance', { type: 'Provenance', schemaVersion: 1, adapter, method,
        record: { reference, hash: sha(record) }, verifiedAt: clockAt(at), machine: 'preview-journal',
        evidence: { kind: 'signature', keyId, signature } }, context));
      if (!provenance || provenance.class !== 'verified') return null;
      const principal = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id, kind: 'system' }, { ...context, provenance }));
      if (principal) { minted.add(principal); signatures.set(principal, signature); }
      return principal;
    },
    /** True only for this owner's signed system writer over exactly this occurrence. */
    check(writer: WriterRecord | undefined, method: SystemMethod, occurrence: string): boolean {
      if (!writer || writer.kind !== 'system' || writer.class !== 'verified' || typeof writer.signature !== 'string'
        || !/^[a-f0-9]{128}$/u.test(writer.signature)) return false;
      const { id, adapter } = identity(method), record = recordOf(id, method, occurrence);
      return writer.id === id && writer.adapter === adapter && writer.reference === captureReference(adapter, occurrence)
        && writer.hash === sha(record) && verify(null, Buffer.from(record, 'utf8'), publicKey, Buffer.from(writer.signature, 'hex'));
    },
  });
}
const signatures = new WeakMap<object, string>();

/** Authenticates the sender of one update the bot's own authenticated `getUpdates` returned.
 * The sender is bound to these exact update bytes; content can never name a principal. */
export function authenticateTelegramSender(update: unknown, origin: WriteOrigin, at: number): VerifiedPrincipal | null {
  const raw = JSON.stringify(update);
  const u = update as { edited_message?: { from?: { id?: unknown; is_bot?: unknown } }; message?: { from?: { id?: unknown; is_bot?: unknown } } };
  const from = (u?.edited_message ?? u?.message)?.from;
  if (!from || !Number.isSafeInteger(from.id) || (from.id as number) <= 0 || !Number.isSafeInteger(at) || at <= 0) return null;
  return mint(TELEGRAM_ADAPTER[origin], 'getUpdates', String(from.id), from.is_bot === true ? 'agent' : 'person', raw, at);
}

export function writerRecord(principal: VerifiedPrincipal): WriterRecord {
  const p: Provenance = principal.provenance;
  const signature = signatures.get(principal);
  return { id: principal.id, kind: principal.kind, adapter: p.adapter, class: p.class, reference: p.record.reference, hash: p.record.hash,
    ...(signature === undefined ? {} : { signature }) };
}

/** Rule 35: a production store refuses a writer whose authenticated transport was the test endpoint. */
export const testOriginWriter = (writer: WriterRecord | undefined) => writer?.adapter === TELEGRAM_ADAPTER.test;

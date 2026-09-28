// Rules 28, 29 and 35: a session writer is a verified principal minted once, at intake, by the
// core `decode('VerifiedPrincipal')` owner from the authenticated transport record. The
// journal's admission and authority checks read that value, never a name in content. The
// transport origin (production or a trusted test endpoint) rides in its provenance, so a
// production store can refuse test-origin identities at its own write boundary.
import { createHash } from 'node:crypto';
import { decode } from '../../src/index.js';
import type { PrincipalKind, Provenance, Result, VerifiedPrincipal } from '../../src/index.js';

/** Which composition wrote: the live transport, or the fixed offline test endpoint. */
export type WriteOrigin = 'production' | 'test';
export const TELEGRAM_ADAPTER: Readonly<Record<WriteOrigin, string>> = Object.freeze({
  production: 'telegram-bot-api', test: 'telegram-bot-api:offline-test-endpoint' });
export const SCHEDULER_ADAPTER = 'preview-scheduler';
/** The durable, replayable projection of a verified writer carried on every intake record. */
export interface WriterRecord { id: string; kind: PrincipalKind; adapter: string; class: 'verified' | 'channel-attested';
  reference: string; hash: string }

const sha = (text: string) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
const register = {
  generation: { owner: 'part-three' as const, name: 'RegisterGeneration' as const, id: 'preview:intake-register' },
  entries: [...Object.values(TELEGRAM_ADAPTER), SCHEDULER_ADAPTER, 'preview-journal', 'preview-intake-clock'],
  producers: ['preview-intake'], methods: ['getUpdates', 'requested-summary-grant'], actions: {},
  subjects: { clock: ['unix-ms'] }, sites: { 'types.decode': 'closed' as const }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate' as const, authority: 'operator' as const } };
const take = <T>(result: Result<T>): T | null => result.kind === 'Success' ? result.value : null;
/** Values this intake owner minted through the core decoder; a structural copy is not one. */
const minted = new WeakSet<object>();
export const verifiedAtIntake = (principal: unknown): principal is VerifiedPrincipal =>
  typeof principal === 'object' && principal !== null && minted.has(principal);

function mint(adapter: string, method: string, id: string, kind: PrincipalKind, subject: string, at: number): VerifiedPrincipal | null {
  const record = JSON.stringify({ principal: { id, kind }, recordType: method === 'getUpdates' ? 'telegram-update' : 'requested-summary-grant',
    payload: { id, kind } });
  const reference = `capture:${adapter}:${sha(subject).slice(7)}`;
  const context = { register, preserved: `preview:intake:${reference}`, captures: { [reference]: record } };
  const provenance = take(decode('Provenance', { type: 'Provenance', schemaVersion: 1, adapter, method,
    record: { reference, hash: sha(record) },
    verifiedAt: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'clock', instance: 'preview-intake-clock' },
      value: at, unit: 'unix-ms', at, by: 'preview-intake' },
    machine: 'preview-journal', evidence: { kind: method === 'getUpdates' ? 'channel' : 'fetched-record', authenticated: true } }, context));
  if (!provenance) return null;
  const principal = take(decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id, kind }, { ...context, provenance }));
  if (principal) minted.add(principal);
  return principal;
}

/** Authenticates the sender of one update the bot's own authenticated `getUpdates` returned.
 * The sender is bound to these exact update bytes; content can never name a principal. */
export function authenticateTelegramSender(update: unknown, origin: WriteOrigin, at: number): VerifiedPrincipal | null {
  const raw = JSON.stringify(update);
  const u = update as { edited_message?: { from?: { id?: unknown; is_bot?: unknown } }; message?: { from?: { id?: unknown; is_bot?: unknown } } };
  const from = (u?.edited_message ?? u?.message)?.from;
  if (!from || !Number.isSafeInteger(from.id) || (from.id as number) <= 0 || !Number.isSafeInteger(at) || at <= 0) return null;
  return mint(TELEGRAM_ADAPTER[origin], 'getUpdates', String(from.id), from.is_bot === true ? 'agent' : 'person', raw, at);
}

/** A requested-summary slot is written by the scheduler, a system principal whose authority
 * is the operator's durable grant record, never the operator's own voice. */
export function authenticateScheduledWriter(bot: string, grantRecord: string, at: number): VerifiedPrincipal | null {
  if (!bot || !grantRecord || !Number.isSafeInteger(at) || at <= 0) return null;
  return mint(SCHEDULER_ADAPTER, 'requested-summary-grant', `preview-scheduler:${bot}`, 'system', grantRecord, at);
}

export function writerRecord(principal: VerifiedPrincipal): WriterRecord {
  const p: Provenance = principal.provenance;
  return { id: principal.id, kind: principal.kind, adapter: p.adapter, class: p.class, reference: p.record.reference, hash: p.record.hash };
}

/** Rule 35: a production store refuses a writer whose authenticated transport was the test endpoint. */
export const testOriginWriter = (writer: WriterRecord | undefined) => writer?.adapter === TELEGRAM_ADAPTER.test;

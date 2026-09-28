// Rule 100 on the live path: a secret handed to the agent is stored before it is
// spent. Intake moves each credential span of a verified operator message into the
// preview vault (encrypted, durably written and read back) BEFORE the message is
// recorded, and only then returns its SecretRef; the recorded message carries the
// reference, never the value. If custody fails the original bytes stay in the
// encrypted journal (never lost) and every consumer still sees them redacted.
//
// A fixed-lifetime credential is a scheduled outage: its identity and known expiry
// are registry facts with an escalating reminder schedule. Build 4 seam:
// `dueCredentialReminders` is the due-work input its reminder driver consumes;
// this module sends nothing and renews nothing on its own.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult, decode } from '../../src/index.js';
import type { DecodeContext, SecretRef } from '../../src/index.js';
import { credentialSpans } from '../../src/recall/redact.js';
import { durablePreviewWrite } from './state.js';
import type { IntakeCustody } from './journal.js';
import { liveMeasurement, renderMeasured } from './measured.js';

export const VAULT = 'preview';
const HOUR = 60 * 60 * 1000, DAY = 24 * HOUR;
/** Escalating reminder offsets before a known fixed expiry. */
export const REMINDER_OFFSETS_MS = Object.freeze([7 * DAY, 3 * DAY, DAY, 6 * HOUR, HOUR]);

export interface CredentialRecord {
  readonly name: string; readonly kind: string;
  readonly custody: 'preview-vault' | 'host-environment' | 'cli-custody' | 'activation-record';
  readonly identity: string; readonly recordedAt: number;
  readonly expiresAt: number | null; readonly expirySource: 'jwt-exp' | 'activation-record' | 'unknown' | 'none';
  readonly reminders: readonly number[];
  /** No standing renewal authority exists here: renewal is the smallest human action. */
  readonly renewal: Readonly<{ standing: 'none'; smallestHumanAction: string }>;
}
export interface DueReminder { readonly name: string; readonly identity: string; readonly stage: number;
  readonly dueAt: number; readonly expiresAt: number; readonly remaining: string; readonly smallestHumanAction: string }

const context: DecodeContext = { preserved: 'preview:secret-custody', captures: {}, register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:secret-custody' },
  entries: [VAULT], producers: [], methods: [], actions: {}, subjects: {}, sites: {}, keys: {},
  allowRedelegation: false, conflictStanding: { ordinary: 'delegate', authority: 'operator' } } };
export const secretRef = (name: string): SecretRef => consumeResult(decode('SecretRef',
  { type: 'SecretRef', schemaVersion: 1, vault: VAULT, name }, context), {
  Success: value => value, Refused: refused => { throw Error(`custody: ${refused.detail}`); } });

/** The schedule is a function of the expiry alone, so stage N always means the same offset
 * and a re-registration (a restart, a repeated token) can never postpone a stage already due. */
export function reminderSchedule(expiresAt: number | null): readonly number[] {
  if (expiresAt === null) return [];
  return [...REMINDER_OFFSETS_MS.map(offset => expiresAt - offset), expiresAt];
}
/** Known fixed expiry of a JSON Web Token, from its own `exp` claim. */
export function jwtExpiry(value: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(value.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isSafeInteger(payload.exp) && payload.exp > 0 ? payload.exp * 1000 : null;
  } catch { return null; }
}
/** The latest due stage per record: each reminder escalates the previous one; none before the first. */
export function dueCredentialReminders(records: readonly CredentialRecord[], now: number): readonly DueReminder[] {
  return records.flatMap(record => {
    if (record.expiresAt === null) return [];
    const stage = record.reminders.filter(at => at <= now).length - 1;
    if (stage < 0) return [];
    return [{ name: record.name, identity: record.identity, stage, dueAt: record.reminders[stage]!, expiresAt: record.expiresAt,
      remaining: renderMeasured(liveMeasurement('credential-remaining', record.name, record.expiresAt - now, now)),
      smallestHumanAction: record.renewal.smallestHumanAction }];
  });
}

export const storedMarker = (ref: SecretRef) => `[credential stored before use: SecretRef ${ref.vault}/${ref.name}]`;

function replaceStrings(value: unknown, secrets: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') { let out = value; for (const [secret, marker] of secrets) out = out.split(secret).join(marker); return out; }
  if (Array.isArray(value)) return value.map(item => replaceStrings(item, secrets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceStrings(v, secrets)]));
  return value;
}

export function createSecretCustody(root: string, key: Uint8Array, now: () => number) {
  if (key.byteLength !== 32) throw Error('custody: key refused');
  const registryPath = join(root, 'credentials.json'), vault = join(root, 'vault');
  const read = (): CredentialRecord[] => {
    if (!existsSync(registryPath)) return [];
    const saved = JSON.parse(readFileSync(registryPath, 'utf8')) as { version: number; records: CredentialRecord[] };
    if (saved.version !== 1 || !Array.isArray(saved.records)) throw Error('custody: registry malformed');
    return saved.records;
  };
  /** Registering the same credential and expiry again keeps its first record and any delivery
   * state a reminder driver added (Build 4); a new or changed expiry replaces it. */
  const register = (record: CredentialRecord): void => {
    const records = read(), prior = records.find(r => r.name === record.name);
    const kept = prior && prior.expiresAt === record.expiresAt
      ? { ...prior, ...record, recordedAt: prior.recordedAt, reminders: reminderSchedule(record.expiresAt) } : record;
    durablePreviewWrite(registryPath, { version: 1, records: [...records.filter(r => r.name !== record.name), kept] });
  };
  const seal = (name: string, value: string) => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(`preview-vault:${name}`));
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  };
  const open = (name: string): string => {
    const sealed = JSON.parse(readFileSync(join(vault, `${name}.sealed`), 'utf8')) as { version: number; iv: string; tag: string; data: string };
    if (sealed.version !== 1) throw Error('custody: sealed record malformed');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
    decipher.setAAD(Buffer.from(`preview-vault:${name}`)); decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]).toString('utf8');
  };
  /** Durable write then read-back: the sealed object exists and opens to exactly `value`. */
  const keep = (name: string, value: string): void => {
    if (!existsSync(join(vault, `${name}.sealed`)) || open(name) !== value) {
      durablePreviewWrite(join(vault, `${name}.sealed`), seal(name, value));
      if (open(name) !== value) throw Error('custody: read-back differs');
    }
  };
  const tag = (value: string) => createHmac('sha256', key).update(value).digest('hex').slice(0, 16);
  /** Durable write, then read-back, then registry: only after all three is a SecretRef returned. */
  const store = (input: { value: string; kind: string; source: string }): SecretRef => {
    const name = `chat-${input.kind}-${tag(input.value)}`;
    const ref = secretRef(name);
    keep(name, input.value);
    const at = now(), expiresAt = input.kind === 'jwt' ? jwtExpiry(input.value) : null;
    register({ name, kind: input.kind, custody: 'preview-vault', identity: `${input.kind} supplied in ${input.source}`,
      recordedAt: at, expiresAt, expirySource: expiresAt === null ? 'unknown' : 'jwt-exp', reminders: reminderSchedule(expiresAt),
      renewal: { standing: 'none', smallestHumanAction: 'send the replacement through the private operator chat; it is stored before use' } });
    return ref;
  };
  return Object.freeze({
    store, register, records: read, resolve: (ref: SecretRef): string => {
      if (ref.vault !== VAULT) throw Error('custody: foreign vault');
      return open(ref.name);
    },
    /** Live loss detection over the referenced custody: each named object must exist and open.
     * Never returns a value; a missing or unreadable object is reported by name only. */
    missing(names: readonly string[]): readonly string[] {
      return [...new Set(names)].filter(name => { try { open(name); return false; } catch { return true; } });
    },
    /** The intake port (docs/08 intake step 2): the credential spans of one verified operator message
     * go to custody before it is recorded. Two artifacts result: the original bytes sealed in custody
     * (`capture`), and the redacted row carrying SecretRef markers plus the true bytes' arrival hash.
     * A failure returns the original with a durable `failed` disposition; nothing is spendable. */
    custody(input: { text: string; raw: string; source: string }): { text: string; raw: string; custody?: IntakeCustody } {
      const found = new Map<string, string>();
      for (const scanned of [input.raw, input.text])
        for (const span of credentialSpans(scanned)) found.set(scanned.slice(span.start, span.end), span.kind);
      if (!found.size) return { text: input.text, raw: input.raw };
      try {
        const markers = new Map<string, string>(), secrets: string[] = [];
        for (const [value, kind] of found) {
          const ref = store({ value, kind, source: input.source });
          markers.set(value, storedMarker(ref)); secrets.push(ref.name);
        }
        const arrival = `sha256:${createHash('sha256').update(input.raw, 'utf8').digest('hex')}`;
        const capture = `capture-${tag(input.raw)}`;
        keep(capture, input.raw);
        return { text: replaceStrings(input.text, markers) as string,
          raw: JSON.stringify(replaceStrings(JSON.parse(input.raw), markers)), custody: { state: 'stored', arrival, capture, secrets } };
      } catch {
        // Durable intake still holds: the encrypted journal keeps the original, redacted for every consumer.
        return { text: input.text, raw: input.raw, custody: { state: 'failed' } };
      }
    },
  });
}

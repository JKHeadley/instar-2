// Part Eight typed payload: `infrastructure-notice` (seam-response-effects-payloads.md, item 3).
// Rules 52, 53, 88, 89 and 106. An internal-issue notice is its own closed record, never an agent
// reply: it speaks as infrastructure, names its causal episode, cites the failed self-heal attempts
// that make it eligible, and addresses only the declared alerts destination. The text is rendered
// from that evidence by a fixed template; no model writes it and no caller supplies free text.
import { hashText, canonicalText } from '../decode/canonical.js';
import { refusal, success } from '../types/internal.js';
import type { Hash, Result } from '../index.js';

/** One failed self-heal attempt: when it ended and how (exit code or signal, and the runner's own reason). */
export type SelfHealFailure = Readonly<{ at: number; code: number | null; signal: string | null;
  runReason: string | null; hung: boolean }>;

export type InfrastructureNotice = Readonly<{
  type: 'InfrastructureNotice'; schemaVersion: 1;
  /** The causal episode joining this outage's observations; one notice per episode (Rule 52). */
  episode: string;
  purpose: 'action-needed';
  /** Infrastructure provenance (Rule 89): never the agent, never the operator. */
  speaker: `infrastructure:${string}`;
  /** Rule 53: the declared alerts destination and the recorded grant that permits speaking there. */
  destination: Readonly<{ kind: 'alerts'; grant: string; chat: string; topic: number | null }>;
  /** Rule 88: the self-heal that was attempted and failed. */
  selfHeal: Readonly<{ subject: string; attempts: number; failures: readonly SelfHealFailure[] }>;
}>;

export const INFRASTRUCTURE_NOTICE_LIMITS = Object.freeze({ failures: 10, reason: 160, text: 3500 });
const FIELDS = ['type', 'schemaVersion', 'episode', 'purpose', 'speaker', 'destination', 'selfHeal'];
const DESTINATION = ['kind', 'grant', 'chat', 'topic'];
const SELF_HEAL = ['subject', 'attempts', 'failures'];
const FAILURE = ['at', 'code', 'signal', 'runReason', 'hung'];

function record(value: unknown, fields: readonly string[], name: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${name} must be a record`);
  const keys = Object.keys(value);
  const extra = keys.find(key => !fields.includes(key));
  if (extra !== undefined) throw Error(`${name} carries undeclared field ${extra}`);
  const missing = fields.find(key => !keys.includes(key));
  if (missing !== undefined) throw Error(`${name} is missing ${missing}`);
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, name: string, max: number, pattern?: RegExp): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || (pattern && !pattern.test(value)))
    throw Error(`${name} invalid`);
  return value;
}
function optionalText(value: unknown, name: string, max: number): string | null {
  return value === null ? null : text(value, name, max);
}
function integer(value: unknown, name: string, min: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) throw Error(`${name} invalid`);
  return value as number;
}

/** The closed decoder: an undeclared field, a wrong kind, a missing self-heal reference, a non-alerts
 * destination or a speaker that is not infrastructure refuses before any driver can act. */
export function decodeInfrastructureNotice(input: unknown): Result<InfrastructureNotice> {
  try {
    const n = record(input, FIELDS, 'infrastructure notice');
    if (n.type !== 'InfrastructureNotice' || n.schemaVersion !== 1) throw Error('infrastructure notice kind or version');
    if (n.purpose !== 'action-needed') throw Error('infrastructure notice purpose must be action-needed');
    const speaker = text(n.speaker, 'speaker', 64, /^infrastructure:[a-z0-9-]+$/u) as `infrastructure:${string}`;
    const d = record(n.destination, DESTINATION, 'destination');
    if (d.kind !== 'alerts') throw Error('an infrastructure notice goes only to the alerts destination');
    const destination = Object.freeze({ kind: 'alerts' as const, grant: text(d.grant, 'destination.grant', 200),
      chat: text(d.chat, 'destination.chat', 32, /^-?[1-9][0-9]*$/u),
      topic: d.topic === null ? null : integer(d.topic, 'destination.topic', 1) });
    const s = record(n.selfHeal, SELF_HEAL, 'selfHeal');
    const attempts = integer(s.attempts, 'selfHeal.attempts', 1);
    if (!Array.isArray(s.failures) || s.failures.length < 1 || s.failures.length > INFRASTRUCTURE_NOTICE_LIMITS.failures
      || s.failures.length > attempts) throw Error('selfHeal.failures must cite the failed attempts');
    const failures = Object.freeze(s.failures.map((value: unknown, index: number) => {
      const f = record(value, FAILURE, `selfHeal.failures[${index}]`);
      if (f.code !== null && !Number.isSafeInteger(f.code)) throw Error('failure code invalid');
      if (typeof f.hung !== 'boolean') throw Error('failure hung invalid');
      return Object.freeze({ at: integer(f.at, 'failure at', 0), code: f.code as number | null,
        signal: optionalText(f.signal, 'failure signal', 32), runReason: optionalText(f.runReason, 'failure reason', INFRASTRUCTURE_NOTICE_LIMITS.reason),
        hung: f.hung });
    }));
    return success(Object.freeze({ type: 'InfrastructureNotice' as const, schemaVersion: 1 as const,
      episode: text(n.episode, 'episode', 128, /^[A-Za-z0-9:_-]+$/u), purpose: 'action-needed' as const, speaker, destination,
      selfHeal: Object.freeze({ subject: text(s.subject, 'selfHeal.subject', 80), attempts, failures }) }));
  } catch (error) {
    return refusal(error instanceof Error ? error.message : 'infrastructure notice malformed', 'input://infrastructure-notice');
  }
}

/** The immutable identity of one notice: a changed rendering is a new request, never a mutation. */
export function infrastructureNoticeDigest(notice: InfrastructureNotice): Hash {
  return hashText(canonicalText(notice));
}

function ending(failure: SelfHealFailure): string {
  if (failure.hung) return 'stopped responding and was restarted';
  if (failure.signal !== null) return `ended by signal ${failure.signal}`;
  return failure.code === null ? 'ended without an exit code' : `exited with code ${failure.code}`;
}

/** The fixed template (no model, no free text). `instant` formats an evidence time for the reader. */
export function renderInfrastructureNotice(notice: InfrastructureNotice, instant: (at: number) => string): string {
  const { subject, attempts, failures } = notice.selfHeal;
  const lines = [
    `Infrastructure notice (${notice.speaker.slice('infrastructure:'.length)}, not the agent): the ${subject} did not recover after ${attempts} restart attempts and is not answering right now.`,
    'Failed attempts:',
    ...failures.map((failure, index) => `${index + 1}. ${instant(failure.at)}: ${ending(failure)}${failure.runReason ? ` (${failure.runReason})` : ''}.`),
    'Messages already received are preserved. Restarts continue with backoff; a clean restart closes this incident without another notice.',
    `Incident ${notice.episode}.`,
  ];
  return lines.join('\n').slice(0, INFRASTRUCTURE_NOTICE_LIMITS.text);
}

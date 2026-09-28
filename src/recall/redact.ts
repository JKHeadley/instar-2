// Secrets floor: a credential is never stored or revealed. Redaction runs on write
// (so a message containing a key is still durably captured, minus the key) and
// again on render (defence against a row written by an older/foreign recorder).
import { secretShape } from '../facts/index.js';

const patterns: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[A-Z0-9]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g,                       // Telegram bot token
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWT
  /\b[Bb]earer\s+[A-Za-z0-9._~+/-]{16,}=*/g,
];
// key = value / key: value for obviously secret-named keys; the key name stays readable.
const assignment = /\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|passwd|private[_-]?key|client[_-]?secret|token)\s*[:=]\s*)(["']?)(?!\[redacted credential\](?=$|[\s,;.!?]))[^\s"']{6,}\2/gi;

// One kind per pattern above, in the same order.
const kinds = ['private-key', 'provider-api-key', 'github-token', 'github-pat', 'aws-access-key', 'slack-token',
  'google-api-key', 'telegram-bot-token', 'jwt', 'bearer-token'] as const;

export interface CredentialSpan { readonly start: number; readonly end: number; readonly kind: string }
/** Rule 100: the exact credential spans redaction would remove, so intake can put each
 * into custody before anything consumes the message. Overlaps keep the earliest, longest span. */
export function credentialSpans(text: string): readonly CredentialSpan[] {
  const found: CredentialSpan[] = [];
  patterns.forEach((pattern, index) => {
    for (const match of text.matchAll(new RegExp(pattern.source, pattern.flags))) {
      const prefix = kinds[index] === 'bearer-token' ? /^[Bb]earer\s+/u.exec(match[0])![0].length : 0;
      found.push({ start: match.index + prefix, end: match.index + match[0].length, kind: kinds[index]! });
    }
  });
  for (const match of text.matchAll(new RegExp(assignment.source, assignment.flags))) {
    const quote = match[2]!.length, start = match.index + match[1]!.length + quote;
    found.push({ start, end: match.index + match[0].length - quote, kind: 'assigned-secret' });
  }
  const spans: CredentialSpan[] = [];
  for (const span of found.sort((a, b) => a.start - b.start || b.end - a.end))
    if (!spans.length || span.start >= spans.at(-1)!.end) spans.push(span);
  return spans;
}

export const redactionMark = '[redacted credential]';
export function redact(text: string): { readonly text: string; readonly count: number } {
  let count = 0;
  let out = text;
  for (const pattern of patterns) out = out.replace(pattern, () => { count++; return redactionMark; });
  out = out.replace(assignment, (_m, key: string) => { count++; return `${key}${redactionMark}`; });
  // Anything the part-two envelope would still refuse is dropped wholesale rather than lost as intake.
  if (secretShape(out)) { count++; out = redactionMark; }
  return { text: out, count };
}

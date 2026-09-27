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

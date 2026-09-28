/** The durable proof log beside the run log: every executed proof attempt and every recorded
 * live-surface proof, append-only and fsynced before it counts (Rules 2, 9, 43, 62). It holds
 * plan ids, counts and update numbers only — never message text. A torn or malformed line is
 * counted as unreadable, never guessed at. */
import { closeSync, constants, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LiveProofRecord, ProofRecord } from './proofs.js';

export interface ProofLog { proofs: ProofRecord[]; liveProofs: LiveProofRecord[]; unreadable: number }

export function appendProof(path: string, record: ProofRecord | LiveProofRecord): void {
  const fresh = !existsSync(path);
  const fd = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const line = Buffer.from(`\n${JSON.stringify(record)}\n`);
    let written = 0; while (written < line.length) written += writeSync(fd, line, written);
    fsyncSync(fd);
  } finally { closeSync(fd); }
  if (fresh) { const dir = openSync(dirname(path), 'r'); try { fsyncSync(dir); } finally { closeSync(dir); } }
}

const scalar = (value: unknown) => value === null || ['string', 'number', 'boolean'].includes(typeof value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const time = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export function readProofs(path: string): ProofLog {
  const log: ProofLog = { proofs: [], liveProofs: [], unreadable: 0 };
  let content = '';
  try { content = readFileSync(path, 'utf8'); } catch { return log; }
  for (const line of content.split('\n')) {
    if (!line) continue;
    let row: Record<string, unknown>;
    try { row = JSON.parse(line) as Record<string, unknown>; } catch { log.unreadable++; continue; }
    if (row === null || typeof row !== 'object' || Array.isArray(row) || row.v !== 1) { log.unreadable++; continue; }
    if (text(row.plan)) {
      const observed = row.observed as Record<string, unknown> | null;
      if (!text(row.planVersion) || !text(row.generation) || !time(row.startedAt) || !time(row.completedAt)
        || (row.completedAt as number) < (row.startedAt as number) || !['passed', 'failed', 'unknown'].includes(row.disposition as string)
        || typeof row.detail !== 'string' || observed === null || typeof observed !== 'object' || Array.isArray(observed)
        || !Object.values(observed).every(scalar)) { log.unreadable++; continue; }
      log.proofs.push(row as unknown as ProofRecord);
    } else if (text(row.liveProof)) {
      if (!text(row.capability) || !text(row.version) || !time(row.update) || !(row.messageId === null || time(row.messageId)) || !time(row.recordedAt)
        || !['reply-accepted', 'held-notice-accepted', 'stop-latched'].includes(row.fact as string)) { log.unreadable++; continue; }
      log.liveProofs.push(row as unknown as LiveProofRecord);
    } else log.unreadable++;
  }
  return log;
}

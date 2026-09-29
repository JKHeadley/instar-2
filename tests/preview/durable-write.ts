import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Atomic, fsynced JSON write shared by the journal runner and the legacy preview. It reads no
 * store, so the live runner uses it without loading the replaced preview-state module (Rule 45). */
export function durablePreviewWrite(path: string, document: unknown): void {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `.preview-state-${randomUUID()}.pending`);
  const descriptor = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(descriptor, JSON.stringify(document), 'utf8'); fsyncSync(descriptor); }
  finally { closeSync(descriptor); }
  renameSync(temporary, path);
  const directoryDescriptor = openSync(directory, 'r');
  try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
}

/** The durable turn identity of one Telegram update; unchanged since the legacy preview. */
export function previewTurnId(botId: string, updateId: number): string {
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new Error('preview state: invalid update id');
  return `telegram:${botId}:update:${String(updateId)}`;
}

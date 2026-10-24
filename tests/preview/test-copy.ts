/** A test copy of an agent (Justin 2026-10-20 08:18: test copies must be REAL copies of his agent).
 *
 * The source root is only read. Its journal's complete frames are copied byte for byte (same offsets, so every
 * sealed frame and every outbound signature stays valid) into a staging file inside a NEW root, then ONE `test-copy`
 * frame is appended there. That frame is the explicit, recorded rebind: it names the test bot, the operator's own
 * private chat on that bot, the source root and the exact journal head it came from. Only after the rebind is durable
 * is the staging file renamed to the launchable name, so a launchable copy bound to the source's bot never exists.
 * The genesis check is unchanged: the copy refuses the source's values, the source refuses the copy's. */
import { closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { openPreviewJournal, projectionDigest } from './journal.js';

export interface TestCopyBinding { bot: string; chat: string; cursor?: number; grant?: string; configurationDigest?: string }
export interface TestCopyResult { root: string; source: string; journal: string; bytes: number; frontier: string;
  bot: string; chat: string; copiedRequests: number; copiedCommitments: number; copiedOpenTurns: number; droppedWaiting: number }

const STAGING = 'journal.encrypted.test-copy-staging';
const frameLimit = 2 * 1024 * 1024;

/** The length of the source's complete frames. A frame a live writer is still appending is left out, never torn into the copy. */
export function completeFrames(bytes: Buffer): number {
  let offset = 0;
  while (bytes.length - offset >= 4) {
    const length = bytes.readUInt32BE(offset);
    if (length < 28 || length > frameLimit) throw Error('test copy: source journal frame corrupt');
    if (bytes.length - offset - 4 < length) break;
    offset += 4 + length;
  }
  return offset;
}

const syncDirectory = (path: string) => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };

export function makeTestCopy(input: { sourceRoot: string; root: string; key: Uint8Array; binding: TestCopyBinding; now: number }): TestCopyResult {
  const sourceRoot = realpathSync(input.sourceRoot), root = resolve(input.root);
  if (sourceRoot !== resolve(input.sourceRoot) || lstatSync(sourceRoot).isSymbolicLink()) throw Error('test copy: source root not canonical');
  if (root === sourceRoot || root.startsWith(`${sourceRoot}/`) || sourceRoot.startsWith(`${root}/`)) throw Error('test copy: copy root overlaps the source');
  if (existsSync(root) && (lstatSync(root).isSymbolicLink() || readdirSync(root).length !== 0)) throw Error('test copy: copy root is not new');
  const binding = input.binding;
  if (!/^[1-9][0-9]*$/u.test(binding.bot) || !/^[1-9][0-9]*$/u.test(binding.chat)
    || binding.cursor !== undefined && (!Number.isSafeInteger(binding.cursor) || binding.cursor < 0))
    throw Error('test copy: binding malformed');
  // The source is read once, as bytes; nothing here opens it as a writer, takes its lease or touches its other files.
  const sourceBytes = readFileSync(join(sourceRoot, 'journal.encrypted'));
  const length = completeFrames(sourceBytes), bytes = sourceBytes.subarray(0, length);
  if (length === 0) throw Error('test copy: source journal empty');
  const journal = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if (realpathSync(root) !== root) throw Error('test copy: copy root not canonical');
  const staging = join(root, STAGING);
  const fd = openSync(staging, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { let written = 0; while (written < bytes.length) written += writeSync(fd, bytes, written); fsyncSync(fd); }
  finally { closeSync(fd); }
  syncDirectory(root);
  // The staged bytes are exactly what the copy holds; they replay strictly, and their frontier is what the copy came from.
  const peek = openPreviewJournal(staging, input.key, undefined, undefined, true, undefined, true);
  let frontier: string;
  try { frontier = projectionDigest(peek.view); } finally { peek.close(); }
  const copy = openPreviewJournal(staging, input.key);
  let result: TestCopyResult;
  try {
    copy.append({ kind: 'test-copy', bot: binding.bot, chat: binding.chat, cursor: binding.cursor ?? 0,
      ...(binding.grant === undefined ? {} : { grant: binding.grant }),
      ...(binding.configurationDigest === undefined ? {} : { configurationDigest: binding.configurationDigest }),
      source: { root: sourceRoot, journal, bytes: length, frontier }, at: input.now });
    const marked = copy.view.testCopy!.copied;
    result = { root, source: sourceRoot, journal, bytes: length, frontier, bot: binding.bot, chat: binding.chat,
      copiedRequests: marked.requests.length, copiedCommitments: marked.commitments, copiedOpenTurns: marked.turns.length,
      droppedWaiting: marked.waiting };
  } finally { copy.close(); }
  renameSync(staging, join(root, 'journal.encrypted'));
  syncDirectory(root);
  return result;
}

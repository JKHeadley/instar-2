/**
 * Rule 63 — ownership-gated side effects for the live journal runner.
 *
 * The root's `.writer` lease only excludes a second process on the SAME root.
 * Two roots could otherwise serve one conversation. This module applies the
 * existing reviewed exclusive lease (`openProductionStorage`'s boot lease: guard
 * directory, durable owner record, conservative dead-PID recovery, owner-changed
 * check) at CONVERSATION scope, keyed by the bot and chat. The runner claims it
 * before its first poll, and every conversation effect re-verifies it
 * immediately before dispatch.
 *
 * Supported topology (Rule 113): SINGLE-MACHINE. The lease directory is
 * host-local, so it is an authority for this host only. A declared multi-machine
 * posture has no shared conversation authority yet (the replication peer that
 * would carry one is a held binding), so the runner refuses to serve it: visibly
 * inhibited, input left with the platform, nothing sent. Independent host-local
 * authorities therefore never both serve a declared multi-machine conversation.
 *
 * Three launch dispositions stay distinct: `owner` serves; `nonowner` is the
 * startup duplicate refusal (another live runner holds the claim, or another
 * machine does); `inhibited` means the ownership authority itself could not be
 * read or written, which is never reported as "served by another runner".
 * Retirement of an EXISTING worker that loses the fence is recorded separately
 * by the runner.
 *
 * Service observations (design 18 §14, P14-NF-68): the owner appends an
 * advancing, sequence-numbered observation of whether it can serve (the Six
 * serving-admission / Ten service observations are conditionally granted and
 * not landed, so the preview supplies its own for its one adapter). A PID that
 * merely exists is not service: an alive owner is `serving` only on fresh,
 * advancing servable observations; `unservable` only on sustained typed
 * non-servable ones; anything else is `cannot-assess`, never green.
 */
import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, openSync, readFileSync, renameSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../src/index.js';
import type { BoundaryContext } from '../../src/index.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import type { ProductionStorage, ProductionStorageIO } from '../../src/assembly/production-storage.js';
import { durablePreviewWrite } from './durable-write.js';

export type MachinePosture = 'single-machine' | 'multi-machine';
export const SUPPORTED_POSTURE: MachinePosture = 'single-machine';
export interface ConversationHolder { machine: string; root: string; pid: number; since: number }
export interface ServiceObservation { pid: number; seq: number; at: number; servable: boolean; reason: string }
export type OwnerClaim =
  | Readonly<{ disposition: 'owner'; owner: true; holder: ConversationHolder; verify(): boolean; release(): void;
    observe(at: number, servable: boolean, reason: string): void }>
  | Readonly<{ disposition: 'nonowner' | 'inhibited'; owner: false; holder: ConversationHolder | null; reason: string }>;
export type OwnerState = 'unowned' | 'serving' | 'unservable' | 'cannot-assess' | 'stale' | 'foreign';
export type OwnerObservation = Readonly<{
  /** unowned: no claim. serving: live holder with fresh, advancing servable observations. unservable: live holder
   * whose own sustained observations say it cannot serve. cannot-assess: live holder without sufficient fresh
   * evidence either way. stale: holder PID is dead on this machine (the next launch recovers it). foreign: held from
   * another machine whose liveness is not observable here. */
  state: OwnerState;
  holder: ConversationHolder | null; observedAt: number; reason: string;
  service: Readonly<{ observations: number; latestAt: number | null; latestServable: boolean | null }>;
}>;
export type StrandedAssessment = Readonly<{ state: 'clear' | 'stranded' | 'cannot-assess'; owner: OwnerState; waiting: number; reason: string }>;

/** A service observation older than this is not current evidence. */
export const SERVICE_FRESH_MS = 180_000;
/** Non-servable observations must span this long before they are called sustained. */
export const SERVICE_MIN_OBSERVATION_MS = 60_000;
const SERVICE_RETAINED = 16;

export const conversationOwnerKey = (bot: string, chat: string): string =>
  `telegram-${createHash('sha256').update(`telegram:${bot}:${chat}`, 'utf8').digest('hex').slice(0, 32)}`;
const claimDirectory = (directory: string, bot: string, chat: string) => join(directory, conversationOwnerKey(bot, chat));

const readHolder = (directory: string): ConversationHolder | null => {
  try {
    const holder = JSON.parse(readFileSync(join(directory, 'holder.json'), 'utf8')) as ConversationHolder;
    return typeof holder.machine === 'string' && typeof holder.root === 'string' && Number.isSafeInteger(holder.pid)
      && Number.isSafeInteger(holder.since) ? holder : null;
  } catch { return null; }
};
const leaseOwner = (directory: string): { pid: number; machine: string } | null => {
  try { return JSON.parse(readFileSync(join(directory, '.boot-lease', 'owner.json'), 'utf8')) as { pid: number; machine: string }; }
  catch { return null; }
};
const readService = (directory: string): ServiceObservation[] | null => {
  try {
    const rows = JSON.parse(readFileSync(join(directory, 'service.json'), 'utf8')) as ServiceObservation[];
    if (!Array.isArray(rows)) return null;
    return rows.filter(row => row && Number.isSafeInteger(row.pid) && Number.isSafeInteger(row.seq) && Number.isSafeInteger(row.at)
      && typeof row.servable === 'boolean' && typeof row.reason === 'string');
  } catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT' ? [] : null; }
};

/** Host-scope record of refused duplicate launches, visible from every root that serves this conversation. */
export function recordRefusal(input: Readonly<{ directory: string; bot: string; chat: string; machine: string; root: string; at: number; reason: string }>): void {
  const path = join(claimDirectory(input.directory, input.bot, input.chat), 'refusals.jsonl');
  const fd = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try { writeSync(fd, `${JSON.stringify({ v: 1, at: input.at, machine: input.machine, root: input.root, reason: input.reason })}\n`); }
  finally { closeSync(fd); }
}
export function refusedLaunches(directory: string, bot: string, chat: string): number {
  try { return readFileSync(join(claimDirectory(directory, bot, chat), 'refusals.jsonl'), 'utf8').split('\n').filter(Boolean).length; }
  catch { return 0; }
}

export function claimConversation(input: Readonly<{ directory: string; bot: string; chat: string; machine: string; root: string;
  key: Uint8Array; context: BoundaryContext; io: ProductionStorageIO; now: number }>): OwnerClaim {
  const directory = claimDirectory(input.directory, input.bot, input.chat);
  let storage: ProductionStorage | null = null, reason = '';
  try {
    storage = consumeResult(openProductionStorage({ root: directory, machine: input.machine, key: input.key,
      policy: 'conversation-owner', store: 'conversation-owner', context: input.context, io: input.io }),
    { Success: value => value, Refused: refused => { reason = refused.detail; return null; } });
  } catch (error) { reason = error instanceof Error ? error.message : 'claim failed'; }
  if (!storage) {
    const holder = readHolder(directory);
    if (reason.includes('owner identity invalid')) return Object.freeze({ disposition: 'nonowner', owner: false, holder, reason: 'held from another machine' });
    if (reason.includes('second concurrent boot')) return Object.freeze({ disposition: 'nonowner', owner: false, holder, reason: 'held by a live runner on this machine' });
    // Unreadable, incomplete or unwritable authority is not evidence that anyone serves.
    return Object.freeze({ disposition: 'inhibited', owner: false, holder, reason: `ownership authority unavailable: ${reason.slice(0, 160) || 'unknown'}` });
  }
  const held = storage;
  const holder = Object.freeze({ machine: input.machine, root: input.root, pid: input.io.pid, since: input.now });
  durablePreviewWrite(join(directory, 'holder.json'), holder);
  let released = false, seq = 0;
  const rows: ServiceObservation[] = [];
  return Object.freeze({ disposition: 'owner', owner: true, holder,
    // The segment read re-checks the durable owner record: a replaced or removed owner is loss of the fence.
    verify: () => { if (released) return false; try { held.segment.read(); return true; } catch { return false; } },
    release: () => { if (released) return; released = true; try { held.close(); } catch { /* an owner-changed lease is not ours to remove */ } },
    // Liveness evidence, not durable state: a lost write only degrades a reader to cannot-assess.
    observe: (at, servable, reason) => {
      if (released) return;
      rows.push({ pid: holder.pid, seq: ++seq, at, servable, reason: reason.slice(0, 120) });
      if (rows.length > SERVICE_RETAINED) rows.shift();
      try {
        const temporary = join(directory, `.service-${holder.pid}.pending`);
        writeFileSync(temporary, JSON.stringify(rows), { mode: 0o600 }); renameSync(temporary, join(directory, 'service.json'));
      } catch { /* the reader sees stale evidence and reports cannot-assess */ }
    } });
}

/** A fresh, read-only observation of who serves the conversation, from ownership plus service evidence. Writes nothing. */
export function observeConversationOwner(input: Readonly<{ directory: string; bot: string; chat: string; machine: string;
  probePid: (pid: number) => void; now: number }>): OwnerObservation {
  const directory = claimDirectory(input.directory, input.bot, input.chat);
  const holder = readHolder(directory), lease = existsSync(join(directory, '.boot-lease')) ? leaseOwner(directory) : null;
  const observation = (state: OwnerState, reason: string, rows: ServiceObservation[] = []) => Object.freeze({ state, holder,
    observedAt: input.now, reason, service: Object.freeze({ observations: rows.length, latestAt: rows.at(-1)?.at ?? null,
      latestServable: rows.at(-1)?.servable ?? null }) });
  if (!lease) return observation(existsSync(join(directory, '.boot-lease')) ? 'cannot-assess' : 'unowned',
    existsSync(join(directory, '.boot-lease')) ? 'claim record unreadable' : 'no runner holds the conversation');
  if (lease.machine !== input.machine) return observation('foreign', 'held from another machine; its service is not observable here');
  let alive = true;
  try { input.probePid(lease.pid); } catch (error) { alive = (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
  if (!alive) return observation('stale', 'the holding process is gone; the next launch recovers the claim');
  const all = readService(directory);
  if (all === null) return observation('cannot-assess', 'service observations unreadable');
  const rows = all.filter(row => row.pid === lease.pid).sort((a, b) => a.seq - b.seq);
  const latest = rows.at(-1);
  if (rows.length < 2 || !latest) return observation('cannot-assess', 'fewer than two service observations from the live holder', rows);
  if (input.now - latest.at > SERVICE_FRESH_MS) return observation('cannot-assess', 'the live holder\'s service observations stopped advancing', rows);
  if (latest.servable) return observation('serving', 'fresh, advancing servable observations', rows);
  // Sustained: every observation across the minimum period is non-servable.
  let start = rows.length - 1;
  while (start > 0 && !rows[start - 1]!.servable) start--;
  if (latest.at - rows[start]!.at < SERVICE_MIN_OBSERVATION_MS || rows.length - start < 2)
    return observation('cannot-assess', `non-servable (${latest.reason}) but not yet sustained`, rows);
  return observation('unservable', latest.reason, rows);
}

/** P14-NF-68 as a signal only: every current ownership record is assessed, with or without waiting input.
 * It grants no takeover, launch or speaking authority. */
export function assessStranded(owner: OwnerObservation, waiting: number): StrandedAssessment {
  const result = (state: StrandedAssessment['state'], reason: string) => Object.freeze({ state, owner: owner.state, waiting, reason });
  switch (owner.state) {
    case 'serving': return result('clear', 'the owner is serving');
    case 'unservable': return result('stranded', `the online owner cannot serve: ${owner.reason}`);
    case 'stale': return result('stranded', 'the owner process is gone; the next launch recovers it');
    case 'unowned': return waiting > 0 ? result('stranded', `${waiting} accepted message(s) wait and no runner holds the conversation`)
      : result('clear', 'no owner and nothing waiting');
    default: return result('cannot-assess', owner.reason);
  }
}

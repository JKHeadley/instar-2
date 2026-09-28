/**
 * Rule 63 — ownership-gated side effects for the live journal runner.
 *
 * The root's `.writer` lease only excludes a second process on the SAME root.
 * Two roots (or two machines sharing an owner directory) could otherwise serve
 * one conversation. This module applies the existing reviewed exclusive lease
 * (`openProductionStorage`'s boot lease: guard directory, durable owner record,
 * conservative dead-PID recovery, owner-changed check) at CONVERSATION scope,
 * keyed by the bot and chat. The runner claims it before its first poll, and
 * every conversation effect re-verifies it immediately before dispatch.
 *
 * A non-owner never polls (the platform retains its input for the owner) and
 * never sends; its launch retires with a durable run-log row. A lease held by
 * another machine is never recovered from here: its liveness cannot be proven
 * from this machine, so release needs that machine or the operator
 * (reachability first; the strict Rule 63 reading of design 10 §9).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../src/index.js';
import type { BoundaryContext } from '../../src/index.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import type { ProductionStorage, ProductionStorageIO } from '../../src/assembly/production-storage.js';
import { durablePreviewWrite } from './state.js';

export interface ConversationHolder { machine: string; root: string; pid: number; since: number }
export type OwnerClaim =
  | Readonly<{ owner: true; holder: ConversationHolder; verify(): boolean; release(): void }>
  | Readonly<{ owner: false; holder: ConversationHolder | null; reason: string }>;
export type OwnerObservation = Readonly<{
  /** unowned: nobody serves; serving: live holder on this machine; stale: holder PID is dead on this machine
   * (the next launch recovers it); foreign: held from another machine whose liveness is not observable here. */
  state: 'unowned' | 'serving' | 'stale' | 'foreign';
  holder: ConversationHolder | null; observedAt: number;
}>;

export const conversationOwnerKey = (bot: string, chat: string): string =>
  `telegram-${createHash('sha256').update(`telegram:${bot}:${chat}`, 'utf8').digest('hex').slice(0, 32)}`;

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

export function claimConversation(input: Readonly<{ directory: string; bot: string; chat: string; machine: string; root: string;
  key: Uint8Array; context: BoundaryContext; io: ProductionStorageIO; now: number }>): OwnerClaim {
  const directory = join(input.directory, conversationOwnerKey(input.bot, input.chat));
  let storage: ProductionStorage | null = null, reason = '';
  try {
    storage = consumeResult(openProductionStorage({ root: directory, machine: input.machine, key: input.key,
      policy: 'conversation-owner', store: 'conversation-owner', context: input.context, io: input.io }),
    { Success: value => value, Refused: refused => { reason = refused.detail; return null; } });
  } catch (error) { reason = error instanceof Error ? error.message : 'claim failed'; }
  if (!storage) return Object.freeze({ owner: false, holder: readHolder(directory),
    reason: reason.includes('owner identity invalid') ? 'held from another machine'
      : reason.includes('second concurrent boot') ? 'held by a live runner on this machine' : `claim refused: ${reason}` });
  const held = storage;
  const holder = Object.freeze({ machine: input.machine, root: input.root, pid: input.io.pid, since: input.now });
  durablePreviewWrite(join(directory, 'holder.json'), holder);
  let released = false;
  return Object.freeze({ owner: true, holder,
    // The segment read re-checks the durable owner record: a replaced or removed owner is loss of the fence.
    verify: () => { if (released) return false; try { held.segment.read(); return true; } catch { return false; } },
    release: () => { if (released) return; released = true; try { held.close(); } catch { /* an owner-changed lease is not ours to remove */ } } });
}

/** A fresh, read-only liveness observation of who serves the conversation. Writes nothing. */
export function observeConversationOwner(input: Readonly<{ directory: string; bot: string; chat: string; machine: string;
  probePid: (pid: number) => void; now: number }>): OwnerObservation {
  const directory = join(input.directory, conversationOwnerKey(input.bot, input.chat));
  const holder = readHolder(directory), lease = existsSync(join(directory, '.boot-lease')) ? leaseOwner(directory) : null;
  if (!lease) return Object.freeze({ state: 'unowned', holder, observedAt: input.now });
  if (lease.machine !== input.machine) return Object.freeze({ state: 'foreign', holder, observedAt: input.now });
  let alive = true;
  try { input.probePid(lease.pid); } catch (error) { alive = (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
  return Object.freeze({ state: alive ? 'serving' : 'stale', holder, observedAt: input.now });
}

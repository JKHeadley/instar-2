/**
 * Rules 31, 63, 95 — one runner's serving step against the shared conversation authority.
 *
 * Each machine runs one of these; at most one holds the conversation lease. The order follows
 * design 10 §4 and §9:
 *   1. hold the lease (acquire, or renew on a third of the term); a refusal means standby;
 *   2. read the shared settled cursor and poll Telegram from exactly that offset, so a poll can
 *      only ever confirm updates that were already settled (a stale poller loses nothing);
 *   3. per update, in order: prepare the reply locally, take the one-use dispatch-claim under the
 *      current fence, send once, record the outcome, then settle the cursor past the update.
 * A non-owner never polls and never sends (Rule 63): Telegram itself keeps the input until the
 * owner settles it. An update another epoch already claimed is never re-sent, even when its outcome
 * is unknown (design 10 §4: absence is not proof); it is settled and reported as unresolved.
 *
 * Local inhibition: the runner stops treating itself as owner one margin before the term it last
 * renewed would end on its OWN monotonic clock, measured from when it asked. Safety never depends
 * on that clock: the authority's claim is the gate on every send.
 */
import type { AuthorityAnswer, AuthorityClient, Fence } from './conversation-authority.js';

export type ServingUpdate = Readonly<{ update_id: number }>;
export type ServingPorts<U extends ServingUpdate> = Readonly<{
  /** getUpdates from this offset; null when the poll failed. */
  poll(offset: number): Promise<readonly U[] | null>;
  /** The local reply work for one update (model, journal): the text to send, or null for no reply. */
  prepare(update: U): Promise<string | null>;
  /** One physical send. `unknown` when the outcome cannot be confirmed; never retried. */
  send(update: U, text: string): Promise<'sent' | 'unknown'>;
}>;
export type ServingRole = 'owner' | 'standby' | 'inhibited';
export type TickReport = Readonly<{ role: ServingRole; reason: string; polled: boolean; sent: readonly number[];
  skipped: readonly number[]; settled: number | null }>;
export interface SharedServing { tick(): Promise<TickReport>; fence(): Fence | null; release(): Promise<void> }

export type LeaseRole = Readonly<{ role: ServingRole; reason: string; retryMs?: number }>;
export interface LeaseHolder {
  /** Acquire when nothing is held, otherwise renew when a third of the term has passed. */
  hold(): Promise<LeaseRole>;
  /** Renew only: a runner that already serves never takes a NEW epoch mid-flight; a lost lease stays lost. */
  renew(): Promise<LeaseRole>;
  /** The current fence, or null once the local term (minus its margin) has run out. */
  fence(): Fence | null;
  /** Forget the fence locally (the authority refused it as stale). */
  drop(): void;
  release(): Promise<void>;
}

/** The lease side of the serving step, shared with the journal runner (Rule 63: one definition of "holds"). */
export function createLeaseHolder(input: Readonly<{ authority: AuthorityClient; machine: string; incarnation: string;
  monotonic: () => number; marginFraction?: number }>): LeaseHolder {
  const margin = input.marginFraction ?? 1 / 3;
  let fence: Fence | null = null, deadline = 0, renewAt = 0, busy: Promise<LeaseRole> | null = null;
  const holds = () => fence !== null && input.monotonic() < deadline;
  const drop = () => { fence = null; };
  const granted = (asked: number, answer: AuthorityAnswer) => {
    if (!answer.ok || !answer.termMs) return false;
    deadline = asked + answer.termMs * (1 - margin); renewAt = asked + answer.termMs / 3;
    return true;
  };
  const renew = async (): Promise<LeaseRole> => {
    if (!fence || !holds()) { drop(); return { role: 'standby', reason: 'lease lost' }; }
    if (input.monotonic() < renewAt) return { role: 'owner', reason: 'lease current' };
    const asked = input.monotonic(), answer = await input.authority.request({ op: 'renew', fence });
    if (granted(asked, answer)) return { role: 'owner', reason: 'lease renewed' };
    if (!answer.ok && answer.reason === 'unreachable') {
      // Keep the remaining local term; it lapses on its own if the authority stays unreachable.
      return holds() ? { role: 'owner', reason: 'renewal unreachable; term still current' } : (drop(), { role: 'inhibited', reason: 'authority unreachable' });
    }
    drop();
    return { role: 'standby', reason: 'lease lost' };
  };
  const hold = async (): Promise<LeaseRole> => {
    if (fence && holds()) return renew();
    drop();
    const asked = input.monotonic();
    const answer = await input.authority.request({ op: 'acquire', machine: input.machine, incarnation: input.incarnation });
    if (granted(asked, answer) && answer.ok && answer.fence) { fence = answer.fence; return { role: 'owner', reason: `acquired epoch ${answer.fence.epoch}` }; }
    if (!answer.ok && answer.reason === 'held') return { role: 'standby', reason: `held by ${answer.holder?.machine ?? 'another runner'}`,
      ...(answer.remainingMs === undefined ? {} : { retryMs: answer.remainingMs }) };
    return { role: 'inhibited', reason: answer.ok ? 'acquire answered without a fence' : `authority ${answer.reason}` };
  };
  /** One request at a time: a timer and a loop may both ask. */
  const once = (run: () => Promise<LeaseRole>) => busy ??= run().finally(() => { busy = null; });
  return Object.freeze({ hold: () => once(hold), renew: () => once(renew), fence: () => (holds() ? fence : null), drop,
    async release() { if (fence) { const owned = fence; drop(); await input.authority.request({ op: 'release', fence: owned }); } } });
}

export function createSharedServing<U extends ServingUpdate>(input: Readonly<{ authority: AuthorityClient; machine: string;
  incarnation: string; monotonic: () => number; marginFraction?: number; ports: ServingPorts<U> }>): SharedServing {
  const lease = createLeaseHolder(input);
  // Outcomes of admitted sends whose recording did not reach the authority yet; retried first every tick.
  const pendingOutcomes: { fence: Fence; key: string; state: 'sent' | 'unknown' }[] = [];
  const holds = () => lease.fence() !== null, drop = lease.drop, hold = lease.hold;
  return Object.freeze({
    fence: lease.fence,
    release: lease.release,
    async tick(): Promise<TickReport> {
      const sent: number[] = [], skipped: number[] = [];
      let settled: number | null = null;
      for (const pending of [...pendingOutcomes]) {
        const answer = await input.authority.request({ op: 'outcome', ...pending });
        if (answer.ok || answer.reason !== 'unreachable') pendingOutcomes.splice(pendingOutcomes.indexOf(pending), 1);
      }
      const role = await hold();
      const report = (reason: string, polled: boolean, current: ServingRole = role.role) =>
        Object.freeze({ role: current, reason, polled, sent: Object.freeze(sent), skipped: Object.freeze(skipped), settled });
      if (role.role !== 'owner') return report(role.reason, false);
      const read = await input.authority.request({ op: 'read' });
      if (!read.ok || !read.view) return report('settled cursor unavailable', false, 'inhibited');
      let cursor = read.view.cursor;
      if (!holds()) return report('lease lapsed before polling', false, 'standby');
      const updates = await input.ports.poll(cursor);
      if (updates === null) return report('poll failed', true);
      for (const update of [...updates].sort((a, b) => a.update_id - b.update_id)) {
        if (update.update_id < cursor) continue;
        const owned = lease.fence();
        if (!owned) return report('lease lapsed mid-batch; the rest waits at Telegram', true, 'standby');
        const text = await input.ports.prepare(update);
        if (text !== null) {
          const key = `update:${update.update_id}`;
          const claim = await input.authority.request({ op: 'claim', fence: owned, key });
          if (claim.ok) {
            const outcome = await input.ports.send(update, text);
            sent.push(update.update_id);
            const recorded = await input.authority.request({ op: 'outcome', fence: owned, key, state: outcome });
            if (!recorded.ok && recorded.reason === 'unreachable') pendingOutcomes.push({ fence: owned, key, state: outcome });
          } else if (claim.reason === 'already-claimed') skipped.push(update.update_id);
          else {
            // Stale fence, unreachable or corrupt authority: nothing is sent and nothing settles past this update.
            if (claim.reason !== 'unreachable') drop();
            return report(`dispatch-claim refused: ${claim.reason}`, true, claim.reason === 'unreachable' ? 'inhibited' : 'standby');
          }
        }
        const settle = await input.authority.request({ op: 'settle', fence: owned, cursor: update.update_id + 1 });
        if (!settle.ok) {
          if (settle.reason !== 'unreachable') drop();
          return report(`settle refused: ${settle.reason}`, true, settle.reason === 'unreachable' ? 'inhibited' : 'standby');
        }
        cursor = update.update_id + 1; settled = cursor;
      }
      return report(role.reason, true);
    } });
}

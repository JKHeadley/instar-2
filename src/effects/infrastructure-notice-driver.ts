// Part Ten confined notice driver (seam-response-assembly-followup.md ledger #9, notice class). It lives
// beside its payload so it mints its Results through the effects module's own constructors; the
// host (scripts/host-watch.mjs) reaches it only through the public effects entry point.
// Rules 42, 52, 53, 55, 88, 89 and 95; D18 §6/§8, D12 §6/§9. The driver is the only path by which an
// infrastructure notice leaves. It owns no process, file or network API: the host hands it a durable
// ledger and the Telegram send port. At the leaving point it re-resolves the route against the
// configured alerts destination, refuses the conversation's own route, records the dispatch durably
// BEFORE the irreversible send, and never sends a second time for an episode whose earlier outcome is
// unknown (a lost answer stays uncertain; a new process is not evidence the first send did not happen).
import { consumeResult, refusal, success } from '../types/internal.js';
import type { Result } from '../index.js';
import { decodeInfrastructureNotice, infrastructureNoticeDigest, renderInfrastructureNotice } from './infrastructure-notice.js';
import type { InfrastructureNotice } from './infrastructure-notice.js';

export type NoticeState = 'dispatching' | 'delivered' | 'refused' | 'uncertain';
export type NoticeLedgerEntry = Readonly<{ episode: string; digest: string; state: NoticeState; at: number;
  messageId?: number; detail?: string }>;
export type NoticeRoute = Readonly<{ chat: string; topic: number | null }>;
/** The physical send observation (the confined Telegram bridge's own reply shape). */
export type NoticeSendObservation = Readonly<{ kind: 'response'; status: number; bytes: string }>
  | Readonly<{ kind: 'uncertain'; limitation?: string; stage?: string }>;
export interface InfrastructureNoticePorts {
  /** The durable ledger entry for an episode, or null when none was ever recorded. Unreadable throws. */
  readLedger(episode: string): NoticeLedgerEntry | null;
  /** Durable before it returns (Rule: an irreversible act follows its durable cause). */
  writeLedger(entry: NoticeLedgerEntry): void;
  send(body: Readonly<{ chat_id: string; text: string; message_thread_id?: number }>): NoticeSendObservation;
  now(): number;
  instant(at: number): string;
}
export type NoticeDispatch = Readonly<{ state: NoticeState; duplicate: boolean; messageId?: number }>;

function classify(observation: NoticeSendObservation): Readonly<{ state: NoticeState; messageId?: number; detail: string }> {
  if (observation.kind !== 'response') return { state: 'uncertain', detail: `transport ${observation.stage ?? 'unknown'}` };
  let parsed: unknown = null;
  try { parsed = JSON.parse(observation.bytes); } catch { /* an unreadable answer is not a delivery */ }
  const body = parsed && typeof parsed === 'object' ? parsed as { ok?: unknown; result?: { message_id?: unknown } } : null;
  if (observation.status === 200 && body?.ok === true && Number.isSafeInteger(body.result?.message_id))
    return { state: 'delivered', messageId: body.result!.message_id as number, detail: 'delivered' };
  // Telegram answered with a definite rejection (bad request, forbidden, not found): nothing was posted.
  if (observation.status >= 400 && observation.status < 500 && observation.status !== 408 && observation.status !== 429 && body?.ok === false)
    return { state: 'refused', detail: `telegram refused (${observation.status})` };
  return { state: 'uncertain', detail: `unclassified answer (${observation.status})` };
}

/** Dispatch one infrastructure notice at most once per causal episode. */
export function dispatchInfrastructureNotice(input: unknown, alerts: Readonly<{ grant: string; chat: string; topic: number | null }>,
  conversation: NoticeRoute, ports: InfrastructureNoticePorts): Result<NoticeDispatch> {
  return consumeResult<InfrastructureNotice, Result<NoticeDispatch>>(decodeInfrastructureNotice(input), {
    Refused: refused => refused,
    Success: (notice: InfrastructureNotice) => {
      const d = notice.destination;
      // Re-resolution where the effect leaves: only the currently configured alerts destination and grant.
      if (d.grant !== alerts.grant || d.chat !== alerts.chat || d.topic !== alerts.topic)
        return refusal('notice destination is not the configured alerts destination', 'input://infrastructure-notice', 'policy', 'assembly.notice-driver');
      // Rule 53: an infrastructure notice never lands in the conversation it is about.
      if (d.chat === conversation.chat && (d.topic === null || d.topic === conversation.topic))
        return refusal('the alerts destination is the conversation route', 'input://infrastructure-notice', 'policy', 'assembly.notice-driver');
      const digest = infrastructureNoticeDigest(notice);
      let prior: NoticeLedgerEntry | null;
      try { prior = ports.readLedger(notice.episode); }
      catch { return refusal('notice ledger unreadable', 'input://infrastructure-notice', 'integrity', 'assembly.notice-driver'); }
      if (prior) {
        if (prior.digest !== digest) return refusal('a different notice is recorded for this episode', 'input://infrastructure-notice', 'integrity', 'assembly.notice-driver');
        // Recorded dispatch without a settled outcome stays uncertain; it is never re-sent.
        return success(Object.freeze({ state: prior.state === 'dispatching' ? 'uncertain' as const : prior.state, duplicate: true,
          ...(prior.messageId === undefined ? {} : { messageId: prior.messageId }) }));
      }
      const text = renderInfrastructureNotice(notice, ports.instant);
      try { ports.writeLedger(Object.freeze({ episode: notice.episode, digest, state: 'dispatching', at: ports.now() })); }
      catch { return refusal('notice dispatch could not be recorded; nothing was sent', 'input://infrastructure-notice', 'integrity', 'assembly.notice-driver'); }
      let observation: NoticeSendObservation;
      try { observation = ports.send(Object.freeze({ chat_id: d.chat, text, ...(d.topic === null ? {} : { message_thread_id: d.topic }) })); }
      catch { observation = { kind: 'uncertain', stage: 'send-threw' }; }
      const outcome = classify(observation);
      // A lost settlement write leaves `dispatching`, which every later read reports as uncertain.
      try { ports.writeLedger(Object.freeze({ episode: notice.episode, digest, state: outcome.state, at: ports.now(), detail: outcome.detail,
        ...(outcome.messageId === undefined ? {} : { messageId: outcome.messageId }) })); } catch { /* stays uncertain */ }
      return success(Object.freeze({ state: outcome.state, duplicate: false, ...(outcome.messageId === undefined ? {} : { messageId: outcome.messageId }) }));
    } });
}

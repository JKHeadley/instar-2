import { createHash } from 'node:crypto';
import { consumeResult, defineDecoder, deriveThrough, type BoundaryContext, type Result } from '../../src/index.js';
import type { InboundRoute } from '../../src/intake/index.js';
import { nextSyntheticUpdate, type openPreviewJournal } from './journal.js';
import { writerRecord } from './intake-principal.js';

export type RecoveryIntakeDisposition = Readonly<{ kind: 'admitted' | 'duplicate'; logicalId: string; source: string }>;

/** Row 03: the host's authenticated observer enters the existing durable topic queue.
 * It never manufactures Telegram provenance or replays the lost worker's effects.
 * Rules 2/8/26/29/42/63/83/116. The conversation fence remains the single writer. */
export function createJournalWorktreeIntake(ports: Readonly<{
  journal: ReturnType<typeof openPreviewJournal>;
  context: BoundaryContext;
  route: Omit<InboundRoute, 'eventId'>;
  machine: string;
  now(): number;
  stopped(): boolean;
  sourceFor(checkout: string): string | null;
  checkText(text: string): void;
}>) {
  return Object.freeze({ receive(raw: string, route: InboundRoute): Result<RecoveryIntakeDisposition> {
    const definition = defineDecoder<RecoveryIntakeDisposition, BoundaryContext>({
      name: 'JournalWorktreeIntake', owner: 'part-ten', currentVersion: 1,
      versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
      decodeCurrent: () => {
        try {
          if (ports.stopped() || route.channel !== ports.route.channel || route.sender !== ports.route.sender
            || route.identityEpoch !== ports.route.identityEpoch || !route.eventId || Buffer.byteLength(raw) > 65536)
            throw Error('observer route unavailable');
          const message: unknown = JSON.parse(raw);
          if (!message || typeof message !== 'object' || !('text' in message) || typeof message.text !== 'string')
            throw Error('recovery request malformed');
          const body = JSON.parse(message.text) as { finding?: { machine?: unknown; path?: unknown; head?: unknown; lastActivity?: unknown } };
          const finding = body.finding;
          if (!finding || finding.machine !== ports.machine || typeof finding.path !== 'string'
            || !finding.path.startsWith('/') || typeof finding.head !== 'string'
            || !/^[a-f0-9]{40,64}$/u.test(finding.head) || !Number.isSafeInteger(finding.lastActivity))
            throw Error('recovery finding malformed');
          const id = `worktree-recovery:${createHash('sha256').update(JSON.stringify([
            finding.machine, finding.path, finding.head, finding.lastActivity,
          ])).digest('hex')}`;
          if (route.eventId !== id) throw Error('recovery identity differs');
          const source = ports.sourceFor(finding.path);
          if (!source) throw Error('checkout topic provenance unavailable');
          const prior = ports.journal.view.turns.get(id);
          if (prior) {
            if (prior.raw !== raw || prior.worktreeRecovery?.source !== source) throw Error('recovery identity conflict');
            return { ok: true, value: { kind: 'duplicate', logicalId: id, source } };
          }
          // The journal, not the observation cache, owns duplicate suppression.
          // A crash between durable intake and cache save must not re-enqueue the
          // same source/checkout when subsequent file activity changes the event id.
          const owned = ports.journal.view.order.find(turn => turn.worktreeRecovery?.source === source
            && (JSON.parse(turn.text) as { finding?: { path?: unknown } }).finding?.path === finding.path);
          if (owned) return { ok: true, value: { kind: 'duplicate', logicalId: owned.id, source } };
          ports.checkText(message.text);
          const at = ports.now(), update = nextSyntheticUpdate(ports.journal.view);
          const principal = ports.journal.systemWriter('worktree-recovery', JSON.stringify([id, source, raw, message.text]), at);
          if (update === null || !principal || ports.stopped()) throw Error('recovery intake unavailable');
          ports.journal.append({ kind: 'worktree-recovery', id, source, raw, text: message.text,
            update, writer: writerRecord(principal), at });
          return { ok: true, value: { kind: 'admitted', logicalId: id, source } };
        } catch (error) {
          return { ok: false, detail: error instanceof Error ? error.message : 'recovery intake failed' };
        }
      },
    }, ports.context.preserved);
    return consumeResult(definition, { Success: decoder => deriveThrough(decoder,
      { type: 'JournalWorktreeIntake', schemaVersion: 1 }, ports.context), Refused: refusal => refusal });
  } });
}

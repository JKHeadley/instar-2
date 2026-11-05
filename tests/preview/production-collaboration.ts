/** Installed journal consumer of the canonical Five/Four Threadline owners.
 * Its only durable writes use the existing journal. It supplies no Run, grant,
 * key, model, effect adapter, or second custody ledger. */
import { canonical, consumeResult } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { telegramAccount, telegramConversation } from '../../src/conversation/index.js';
import type { ProductionOwnerComposition } from '../../src/assembly/production-composition.js';
import { offerEnvelope } from '../../src/rungraph/index.js';
import type { DelegationContract, Run } from '../../src/rungraph/index.js';
import { collaborationTopicForOperation } from './collaboration-hub.js';
import type { CollaborationSurfacer, HubRecord } from './collaboration-hub.js';
import type { JournalView } from './journal.js';

const take = <T>(result: import('../../src/index.js').Result<T>): T => consumeResult(result, {
  Success: value => value, Refused: refusal => { throw Error(refusal.detail); } });
const need = (yes: unknown, reason: string) => { if (!yes) throw Error(`collaboration: ${reason}`); };

export function connectProductionCollaboration(input: {
  owners: ProductionOwnerComposition; hub: CollaborationSurfacer;
  view(): JournalView; append(row: HubRecord): void; now(): number; admitted(): boolean;
}) {
  const { owners, hub } = input, delegation = owners.delegation;
  // bootProductionApplication validates nominal owner provenance in the core
  // module that issued it. This journal consumer projects data only; it must
  // not repeat that check against a second src/dist module's WeakSet. All work
  // goes back through the issued ports and their current authority checks.
  if (!delegation) throw Error('collaboration: delegation not configured');
  const origin = (contract: DelegationContract, parent: Run) => {
    need(input.admitted(), 'current journal owner required');
    const snapshot = take(owners.composition.spine.store.readForProjection());
    const cause = snapshot.entries.find(row => row.fact.id === parent.opening.id);
    need(cause && !cause.taint.length && !cause.conflicts.length && cause.fact.kind === 'intake-admitted',
      'clean actual Four parent required');
    const body = cause!.fact.body as { eventId?: string; rawHash?: string; channel?: string; intent?: { via?: string; ask?: string } };
    const view = input.view();
    const old = view.collaboration?.origins?.find(item => item.edge === contract.id);
    let topic: number | null = null, source: string | undefined;
    if (body.intent?.via === 'threadline-intake-v1') {
      const received = view.collaboration?.inbox.find(item => take(canonical(item.envelope)).bytes === body.intent?.ask);
      if (received) {
        source = `threadline:${received.envelope.key}`;
      }
      // The authenticated source and contract bind the first origin. A later
      // operator move of the parent changes display routing, not this cause.
      if (old) {
        need(old.source === source && old.digest === contract.digest, 'automatic origin cannot redirect a conversation'); return;
      }
      if (source) {
        topic = collaborationTopicForOperation(view.collaboration, source);
      }
      // An authenticated parentless task keeps its ordinary worker path. It
      // gains no topic from a remote wrapper or from model text.
      if (topic === null) return;
    } else {
      const general = telegramConversation(view.genesis.bot, { chatId: view.genesis.chat,
        forum: view.genesis.forum === true, messageThreadId: null });
      const forum = `${telegramAccount(view.genesis.bot)}:chat:${view.genesis.chat}:`;
      // Topic bookkeeping is optional outside this forum; Four/Five/Six still
      // enforce the admitted work's authority, scope, stop and budget.
      if (view.genesis.forum !== true || !body.channel?.startsWith(forum) || body.channel === general) return;
      const turn = [...view.turns.values()].find(item => item.accepted && item.thread !== undefined
        && String(item.update) === body.eventId && hashBytes(item.raw) === body.rawHash);
      if (turn && view.genesis.forum === true && body.channel === telegramConversation(view.genesis.bot, {
        chatId: view.genesis.chat, forum: true, messageThreadId: turn.thread! })) {
        topic = turn.thread!; source = turn.id;
      }
    }
    need(topic !== null && source, 'parent has no exact admitted conversation topic');
    if (old) {
      need(old.topic === topic && old.source === source && old.digest === contract.digest, 'automatic origin cannot redirect a conversation'); return;
    }
    input.append({ kind: 'collaboration', action: 'origin', envelope: offerEnvelope(contract), topic: topic!, source: source!, at: input.now() });
  };
  const consumer = { origin, custody: (envelope: Parameters<CollaborationSurfacer['capture']>[0],
    receipt: Parameters<CollaborationSurfacer['capture']>[1]) => {
      // The 1.x local-agent guard prevents self-delegation from making a noisy
      // conversation loop. Canonical custody remains in the signed ledger.
      if (envelope.sender !== envelope.recipient) hub.capture(envelope, receipt);
    } };
  let connected = false;
  return Object.freeze({
    /** Called by the admitted journal maintenance loop, including restart. */
    async maintain() {
      if (!input.admitted()) return;
      if (!connected) { delegation.connectProjection(consumer); connected = true; }
      delegation.pump();
      delegation.collectDue();
      // These are admitted task offers and checked terminal results. Protocol
      // housekeeping is handled separately below, never inferred from words.
      await hub.drain(async () => ({ warrants: true, parentTopicId: null }));
      for (const edge of delegation.ledger.view().values()) {
        if (!input.admitted()) return;
        if (edge.cancellation !== 'none' && edge.contract.owner !== edge.contract.recipient) await hub.notify({ threadId: edge.contract.transport.conversation,
          id: `cancel:${edge.contract.id}:${edge.result?.digest ?? 'pending'}`, title: 'Delegated work cancellation requested',
          body: edge.result ? 'A checked terminal result is retained.' : 'Completion is still unconfirmed.',
          peerName: edge.contract.recipient });
      }
    },
    /** Existing installed work owner is the only execution route. */
    async work() {
      need(connected && input.admitted(), 'current connected journal owner required');
      return delegation.workAsync();
    },
    delegate(parentRun: string, request: Parameters<typeof delegation.delegate>[1]) {
      need(connected && input.admitted(), 'current connected journal owner required');
      return delegation.delegate(parentRun, request);
    },
  });
}

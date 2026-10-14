/** Physical journal adapter for the core read port. No append or independent store. */
import type { BoundaryContext } from '../../src/index.js';
import type { RecalledExchange } from '../../src/recall/contracts.js';
import { rebuildJournalHistoryReadView } from '../../src/recall/journal-read-view.js';
import { groundingHistory, liveSummaries, projectMemoryText, projectionDigest, commitmentOpen,
  openRequests, openDirectives, openBlockers, openQuestionCandidates, type JournalView } from './journal.js';
import { wholeReplySent } from './reply-parts.js';

export interface JournalOpenWork {
  readonly kind: 'reply' | 'commitment' | 'request' | 'directive' | 'blocker' | 'question';
  readonly id: string;
  readonly source: string;
  readonly detail: unknown;
}
/** One projection shared by producer coverage and the read consumer. */
function journalMessages(view: JournalView, machine: string) {
  const conversation = (thread?: number) => `telegram:${view.genesis.chat}:${thread ?? 'main'}`;
  const turns = groundingHistory(view, Number.MAX_SAFE_INTEGER);
  const messages: RecalledExchange[] = [];
  const byTurn = new Map<string, string[]>();
  for (const turn of turns) {
    const ids: string[] = [];
    const add = (messageId: string, text: string, role: 'user' | 'agent' | 'system', at: number) => {
      ids.push(messageId);
      messages.push({ conversation: conversation(turn.thread), session: 'journal', messageId,
        factId: `journal:${messageId}`, machine, at, text: projectMemoryText(view, text), redactions: 0,
        speakerId: role === 'agent' || messageId !== turn.id ? view.genesis.bot : turn.writer?.id ?? view.genesis.operator,
        speakerName: role, speakerRole: role, visibility: 'participants', audience: [view.genesis.operator] });
    };
    add(turn.id, turn.text, turn.requestedAction ? 'system' : 'user', turn.at);
    // Prepared answers are not conversation history. Each received part is, even
    // when a subsequent part is UNKNOWN. Empty delivered bubbles stay visible.
    if (turn.sent !== undefined && turn.intent !== undefined) {
      const first = turn.replyParts?.length && turn.intentBody !== undefined
        ? turn.intentBody.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&') : turn.intent;
      add(`${turn.id}:reply`, first, 'agent', turn.sentAt ?? turn.at);
    }
    for (const [index, part] of (turn.replyParts ?? []).entries())
      if (part.sent !== undefined) add(`${turn.id}:reply:${index + 2}`, part.text, 'agent', part.sentAt ?? turn.at);
    if (turn.heldNoticeSent !== undefined && turn.heldNoticeIntent !== undefined)
      add(`${turn.id}:ack`, turn.heldNoticeIntent, 'system', turn.heldNoticeSentAt ?? turn.at);
    if (turn.limitedSent !== undefined && turn.limited?.lead === turn.id)
      add(`${turn.id}:limited`, turn.limited.text, 'system', turn.limited.at);
    if (turn.deliveryNotice?.sent !== undefined && turn.deliveryNotice.lead === turn.id)
      add(`${turn.id}:delivery-notice`, turn.deliveryNotice.text, 'system', turn.deliveryNotice.at);
    byTurn.set(turn.id, ids);
  }
  messages.sort((a, b) => a.at - b.at);
  return { conversation, turns, messages, byTurn };
}
/** Caller supplies the authenticated owner view and its machine identity. No disk,
 * credentials or outbound surface is exposed to the consumer. */
export function readJournalHistory(view: JournalView, machine: string, context: BoundaryContext) {
  return rebuildJournalHistoryReadView(() => {
    const { conversation, turns, messages, byTurn } = journalMessages(view, machine);
    const work: { conversation: string; value: JournalOpenWork }[] = [];
    const addWork = (kind: JournalOpenWork['kind'], id: string, source: string, detail: unknown) => {
      const turn = view.turns.get(source);
      if (turn && byTurn.has(source)) work.push({ conversation: conversation(turn.thread), value: { kind, id, source, detail } });
    };
    for (const turn of turns) if (!wholeReplySent(turn) && turn.limitedSent === undefined && turn.deliveryNotice?.sent === undefined)
      addWork('reply', turn.id, turn.id, { state: turn.intent === undefined ? 'pending' : 'unknown', held: turn.held ?? null });
    view.commitments.forEach((note, id) => { if (commitmentOpen(view, id)) addWork('commitment', String(id), note.source,
      { note, work: view.obligationWork[`commitment:${id}`] ?? null }); });
    openRequests(view).forEach((note, id) => addWork('request', String(id), note.source, note));
    openDirectives(view).forEach(({ id, note }) => addWork('directive', String(id), note.source, note));
    openBlockers(view).forEach(({ id, note }) => addWork('blocker', String(id), note.source,
      { note, work: view.obligationWork[`blocker:${id}`] ?? null }));
    openQuestionCandidates(view).forEach(note => addWork('question', note.source, note.source, note));
    // The legacy rolling summary is root-wide. Never assign a mixed-topic summary
    // to one forum conversation: full raw coverage remains available instead.
    const summaries = view.genesis.forum === true ? [] : liveSummaries(view).flatMap((row, index) => {
      const coveredTurns = new Set(turns.filter(turn => turn.update <= row.through).flatMap(turn => byTurn.get(turn.id) ?? []));
      const coveredMessages = messages.filter(message => coveredTurns.has(message.messageId));
      const inferred = coveredMessages.map(message => message.messageId);
      const covers = row.covers ?? inferred;
      if (covers.length !== inferred.length || covers.some((id, i) => id !== inferred[i])) return [];
      const completePrefix = covers.every((id, position) => messages[position]?.messageId === id);
      const laterEdit = turns.some(turn => turn.editOf && turn.at > row.at);
      const lateReceipt = coveredMessages.some(message => message.at > row.at);
      return covers.length && completePrefix && !laterEdit && !lateReceipt ? [{ id: `journal:summary:${index}:${row.through}`, conversation: conversation(),
        text: projectMemoryText(view, row.text), at: row.at, covers,
        ...(row.memoryItems === undefined ? {} : { memoryItems: row.memoryItems.map(item =>
          ({ ...item, quote: projectMemoryText(view, item.quote) })) }),
        ...(row.faithfulness === undefined ? {} : { faithfulness: row.faithfulness }) }] : [];
    });
    return { revision: projectionDigest(view), messages, summaries, work };
  }, context);
}

/** Exact source revision for one producer call. Paid-call accounting is excluded:
 * its own reservation/review frames cannot invalidate the conversation snapshot. */
export function journalSummarySource(view: JournalView, through: number) {
  const { turns, messages, byTurn } = journalMessages(view, 'journal');
  const covered = new Set(turns.filter(turn => turn.update <= through).flatMap(turn => byTurn.get(turn.id) ?? []));
  return { target: turns.find(turn => turn.update === through)?.id ?? '',
    covers: messages.filter(message => covered.has(message.messageId)).map(message => message.messageId),
    revision: JSON.stringify({ turns, memory: view.memory, corrections: view.corrections,
      summaries: liveSummaries(view), retracted: view.retracted, capAuthority: view.capAuthority,
      expiryAuthority: view.expiryAuthority, sourceStop: view.sourceStop,
      commitments: view.commitments, closed: [...view.closed], dated: view.dated,
      reminderCancels: view.reminderCancels, questions: view.questions, questionsReviewed: [...view.questionsReviewed],
      directives: view.directives, blockers: view.blockers, groupCarry: view.groupCarry,
      channelItems: [...view.channelItems], channelSources: [...view.channelSources] }) };
}

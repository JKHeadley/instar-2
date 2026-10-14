/** Rule 96: a disposable read view, never a second history authority. */
import type { BoundaryContext, Result } from '../index.js';
import type { RecalledExchange } from './contracts.js';
import { boundary, ensure, encoded, freeze } from './boundary.js';
import { redact } from './redact.js';

/** The consumer subset of step5-record's ConversationReadView<T>. Neither the
 * journal nor a caller needs a pretend FactStorePort to supply these reads. */
export interface ConversationHistoryReadPort<T> {
  latest(conversation: string, limit: number): Result<readonly RecalledExchange[]>;
  work(conversation: string): readonly T[];
}
export interface AcceptedHistorySummary {
  readonly id: string;
  readonly conversation: string;
  readonly text: string;
  /** Exact chronological prefix this accepted summary replaces. */
  readonly covers: readonly string[];
  readonly at: number;
  readonly memoryItems?: readonly { readonly source: string; readonly quote: string }[];
  readonly faithfulness?: { readonly path: 'exact' | 'jev' | 'subscription';
    readonly verdict: 'pass' | 'lost' | 'undecided'; readonly score: number | null };
}
export interface HistoryCoverage {
  readonly through: string;
  readonly summary: AcceptedHistorySummary | null;
  /** Complete chronological suffix after the summary, never a latest-N skim. */
  readonly messages: readonly RecalledExchange[];
  readonly covered: readonly string[];
}
export interface JournalHistorySnapshot<T> {
  /** Identifies the owner projection read, not a foundation durability receipt. */
  readonly revision: string;
  readonly messages: readonly RecalledExchange[];
  readonly summaries: readonly AcceptedHistorySummary[];
  readonly work: readonly { readonly conversation: string; readonly value: T }[];
}
export interface JournalHistoryReadView<T> extends ConversationHistoryReadPort<T> {
  readonly revision: string;
  summaries(conversation: string): readonly AcceptedHistorySummary[];
  coverage(conversation: string, through: string): Result<HistoryCoverage>;
}

/** The journal owner supplies ONE folded snapshot. In particular it decides
 * acceptance, correction, retraction and open work; this view never infers them
 * from a model's answer. Old readers retain their own immutable revision. */
export function rebuildJournalHistoryReadView<T>(read: () => JournalHistorySnapshot<T>,
  context: BoundaryContext): Result<JournalHistoryReadView<T>> {
  return boundary('JournalHistoryReadView', null, context, () => {
    // Detach before freezing: publishing a read view must not freeze the writer.
    const source = JSON.parse(encoded(read()).bytes) as JournalHistorySnapshot<T>;
    const messages = new Map<string, RecalledExchange[]>();
    const identities = new Map<string, Set<string>>();
    const recent = new Map<string, readonly RecalledExchange[]>();
    const summaries = new Map<string, AcceptedHistorySummary[]>();
    const work = new Map<string, T[]>();
    for (const row of source.messages) {
      ensure([row.conversation, row.messageId, row.factId, row.session, row.machine, row.speakerId, ...row.audience]
        .every(key => redact(key).count === 0), 'credential-shaped history identity', 'floor');
      const rows = messages.get(row.conversation) ?? [];
      const seen = identities.get(row.conversation) ?? new Set<string>();
      ensure(!seen.has(row.messageId), 'duplicate history message identity', 'integrity');
      seen.add(row.messageId); identities.set(row.conversation, seen);
      const text = redact(row.text), name = redact(row.speakerName);
      rows.push({ ...row, text: text.text, speakerName: name.text, redactions: row.redactions + text.count + name.count });
      messages.set(row.conversation, rows);
    }
    for (const [conversation, rows] of messages) {
      rows.sort((a, b) => a.at - b.at);
      recent.set(conversation, [...rows].reverse());
    }
    for (const row of source.summaries) {
      const history = messages.get(row.conversation) ?? [];
      ensure(row.covers.length > 0 && row.covers.length <= history.length
        && row.covers.every((id, index) => id === history[index]!.messageId),
      'summary coverage is not a complete history prefix', 'integrity');
      const rows = summaries.get(row.conversation) ?? [];
      rows.push({ ...row, text: redact(row.text).text,
        ...(row.memoryItems === undefined ? {} : { memoryItems: row.memoryItems.map(item => ({ ...item, quote: redact(item.quote).text })) }) });
      summaries.set(row.conversation, rows);
    }
    for (const row of source.work) {
      const rows = work.get(row.conversation) ?? [];
      const clean = JSON.parse(JSON.stringify(row.value, (_key, value: unknown) =>
        typeof value === 'string' ? redact(value).text : value)) as T;
      rows.push(clean); work.set(row.conversation, rows);
    }
    for (const rows of messages.values()) freeze(rows);
    for (const rows of summaries.values()) freeze(rows);
    for (const rows of work.values()) freeze(rows);
    return {
      revision: source.revision,
      latest: (conversation: string, limit: number) => boundary('JournalHistoryLatest', null, context, () => {
        ensure(Number.isSafeInteger(limit) && limit >= 0 && limit <= 50_000,
          'read limit: integer within 0..50000 required', 'policy');
        // Same timestamp / source-order tie break as the fact-store read view.
        return (recent.get(conversation) ?? []).slice(0, limit);
      }),
      work: (conversation: string): readonly T[] => Object.freeze(work.get(conversation) ?? []),
      summaries: (conversation: string): readonly AcceptedHistorySummary[] => Object.freeze(summaries.get(conversation) ?? []),
      coverage: (conversation: string, through: string) => boundary('JournalHistoryCoverage', null, context, () => {
        const history = messages.get(conversation) ?? [];
        const end = history.findIndex(row => row.messageId === through);
        ensure(end >= 0, 'coverage target absent from conversation', 'integrity');
        const prefix = history.slice(0, end + 1);
        const candidates = (summaries.get(conversation) ?? []).filter(row => row.covers.length <= prefix.length);
        const summary = candidates.sort((a, b) => b.covers.length - a.covers.length || b.at - a.at)[0] ?? null;
        return { through, summary, messages: prefix.slice(summary?.covers.length ?? 0), covered: prefix.map(row => row.messageId) };
      }),
    };
  });
}

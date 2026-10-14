/** Rule 96: one bounded summary transition. The owner retains scheduling, retries,
 * physical admission and source validation; there is no timer or second store. */
import { exactSummaryFaithfulness, interpretSummaryJev as faithfulnessVerdict,
  summaryJevScore, summaryJevUsage } from './summary-faithfulness.js';
import { SUMMARY_QUESTION, interpretSummaryJev, type SummaryCheckResult } from './summary-check.js';

export interface SummaryFaithfulness {
  path: 'exact' | 'jev' | 'subscription'; verdict: 'pass' | 'lost' | 'undecided'; score: number | null;
  usage?: { inputTokens: number | null; outputTokens: number | null; charge: null };
}
export interface SummarySource {
  revision: string;
  /** Exact chronological message prefix, including received replies. */
  covers: readonly string[];
  target: string;
}
export interface SummaryCandidate<T> {
  value: T;
  packet: string;
  textWithItems: string;
  memory: unknown[];
  evidence: string;
  /** Redacted complete packet and proposed notes for the integrity supervisor. */
  supervisedState?: string;
}
export type SummaryPreparation<T> = { kind: 'candidate'; candidate: SummaryCandidate<T> }
  | { kind: 'stop' | 'over-cap' };
export type SummaryAuditEvent =
  | { kind: 'summary-faithfulness-reserve' | 'summary-integrity-reserve' | 'summary-review-reserve' }
  | { kind: 'summary-faithfulness'; result: SummaryFaithfulness }
  | { kind: 'summary-check'; result?: SummaryCheckResult; faithfulness?: SummaryFaithfulness };
export interface RollingSummaryPorts<W, T> {
  /** Atomically reads the already selected source and the current ownership fence. */
  source(): SummarySource;
  /** Throws on stop, expiry or loss of ownership; must not reserve another call. */
  guard(): void;
  reserve(): void;
  write(): Promise<W>;
  /** Synchronous owner decoding/source validation; keeps the existing failure frames. */
  prepare(output: W): SummaryPreparation<T>;
  record(event: SummaryAuditEvent): void;
  reject(failure: { stale?: true; structural?: true; reason?: string; evidence?: string;
    faithfulness?: SummaryFaithfulness }, output?: W): void;
  commit(candidate: T, faithfulness: SummaryFaithfulness, covers: readonly string[]): void;
  evidenceFits(evidence: string): boolean;
  canReview(): boolean;
  faithfulness?(evidence: string): Promise<unknown>;
  supervisor?: {
    elapsedMs(): number;
    jev(state: string, question: typeof SUMMARY_QUESTION, id: string): Promise<{ value: unknown; latencyMs: number }>;
    review?(state: string, through: number): Promise<Omit<SummaryCheckResult, 'path'>>;
  };
}
export type RollingSummaryResult = 'accepted' | 'stop' | 'over-cap' | 'refused' | 'unknown';

/** Reservations precede paid calls. UNKNOWN leaves them charged. A later tick,
 * owned by the caller, is the only retry authority. Every await rechecks source
 * revision and stop before another call or the synchronous commit. */
export async function produceRollingSummary<W, T>(through: number, ports: RollingSummaryPorts<W, T>): Promise<RollingSummaryResult> {
  ports.guard();
  const read = ports.source();
  const source = { ...read, covers: [...read.covers] };
  ports.reserve();
  if (!source.revision || !source.target || !source.covers.length || !source.covers.includes(source.target)
    || source.covers.some(id => !id) || new Set(source.covers).size !== source.covers.length) {
    ports.reject({ structural: true, reason: 'summary coverage missing or malformed' });
    return 'refused';
  }
  let output: W;
  try { output = await ports.write(); } catch { ports.guard(); return 'unknown'; }
  const current = (unknown = false) => {
    ports.guard();
    const next = ports.source();
    if (next.revision === source.revision && next.target === source.target
      && next.covers.length === source.covers.length && next.covers.every((id, i) => id === source.covers[i])) return true;
    if (!unknown) ports.reject({ stale: true, reason: 'summary source revision changed' }, output);
    return false;
  };
  // Preserve completed usage/candidate evidence before honoring stop, as the owner
  // did before extraction. Preparation cannot dispatch or accept a summary.
  const prepared = ports.prepare(output);
  ports.guard();
  if (prepared.kind !== 'candidate') return prepared.kind;
  if (!current()) return 'refused';
  const candidate = prepared.candidate;
  const supervisor = ports.supervisor;
  const state = candidate.supervisedState;
  let packet: { history?: unknown } | null;
  try { packet = JSON.parse(candidate.packet) as { history?: unknown } | null; } catch { packet = null; }
  if (!Array.isArray(packet?.history) || (supervisor && state === undefined)) {
    ports.reject({ structural: true, reason: 'summary coverage missing or malformed' }, output);
    return 'refused';
  }
  let faithfulness: SummaryFaithfulness = { path: 'exact', verdict: 'pass', score: null };
  let escalation: SummaryCheckResult | undefined;
  const review = async (): Promise<SummaryCheckResult> => {
    ports.guard();
    ports.record({ kind: 'summary-review-reserve' });
    const started = supervisor!.elapsedMs();
    let result: SummaryCheckResult;
    try { result = { ...await supervisor!.review!(state!, through), path: 'subscription' }; }
    catch { result = { verdict: 'unavailable', path: 'subscription', latencyMs: Math.max(0, supervisor!.elapsedMs() - started) }; }
    ports.record({ kind: 'summary-check', result });
    return result;
  };
  if (exactSummaryFaithfulness(candidate.packet, candidate.textWithItems, candidate.memory) === 'undecided') {
    let verdict: 'pass' | 'lost' | 'undecided' = 'undecided';
    faithfulness = { path: 'jev', verdict, score: null };
    if (ports.evidenceFits(candidate.evidence) && ports.faithfulness) {
      ports.guard();
      ports.record({ kind: 'summary-faithfulness-reserve' });
      let unknown = false;
      try {
        const result = await ports.faithfulness(candidate.evidence);
        verdict = faithfulnessVerdict(result);
        faithfulness = { path: 'jev', verdict, score: summaryJevScore(result), usage: summaryJevUsage(result) };
        ports.record({ kind: 'summary-faithfulness', result: faithfulness });
      } catch { unknown = true; /* UNKNOWN can use the existing full-context cascade. */ }
      // Preserve the established faithfulness stop disposition: the completed
      // judgment is durable, but cannot authorize the candidate after stop.
      try { ports.guard(); } catch {
        faithfulness = { ...faithfulness, verdict: 'undecided' };
        ports.reject({ reason: 'summary faithfulness: undecided', evidence: candidate.evidence, faithfulness });
        return 'refused';
      }
      if (!current(unknown)) return unknown ? 'unknown' : 'refused';
    }
    if (verdict === 'undecided' && supervisor?.review && state !== undefined && ports.canReview()) {
      ports.record({ kind: 'summary-check', faithfulness });
      escalation = await review();
      const unknown = escalation.verdict === 'unavailable' && !escalation.retryable;
      if (!current(unknown)) return unknown ? 'unknown' : 'refused';
      if (unknown) return 'unknown';
      if (escalation.verdict === 'pass') { verdict = 'pass'; faithfulness = { path: 'subscription', verdict, score: null }; }
    }
    if (verdict !== 'pass') {
      const reason = verdict === 'lost' ? 'summary faithfulness: active memory item lost'
        : escalation?.verdict === 'violation' ? 'summary faithfulness: full-context review found loss'
        : 'summary faithfulness: undecided';
      ports.reject({ reason, evidence: candidate.evidence, faithfulness });
      return 'refused';
    }
  }
  // An escalated pass already checked the same complete proposed notes.
  if (escalation?.verdict !== 'pass' && supervisor) {
    if (faithfulness.path === 'jev') ports.record({ kind: 'summary-check', faithfulness });
    const recorded = { path: faithfulness.path, verdict: faithfulness.verdict, score: faithfulness.score };
    const started = supervisor.elapsedMs();
    let result: SummaryCheckResult;
    ports.guard();
    ports.record({ kind: 'summary-integrity-reserve' });
    try {
      const answer = await supervisor.jev(state!, SUMMARY_QUESTION, `summary:${through}`);
      result = interpretSummaryJev(answer.value, answer.latencyMs);
    } catch { result = { verdict: 'unavailable', path: 'jev', latencyMs: Math.max(0, supervisor.elapsedMs() - started) }; }
    ports.record({ kind: 'summary-check', result, faithfulness: recorded });
    if (!current()) return 'refused';
    if (result.verdict === 'unavailable') { ports.reject({ faithfulness: recorded }); return 'refused'; }
    if (result.verdict !== 'pass') {
      if (!ports.canReview() || !supervisor.review) { ports.reject({ faithfulness: recorded }); return 'refused'; }
      const checked = await review();
      const unknown = checked.verdict === 'unavailable' && !checked.retryable;
      if (!current(unknown)) return unknown ? 'unknown' : 'refused';
      if (unknown) return 'unknown';
      if (checked.verdict !== 'pass') { ports.reject({ faithfulness: recorded }); return 'refused'; }
    }
  }
  if (!current()) return 'refused';
  ports.commit(candidate.value, faithfulness, source.covers);
  return 'accepted';
}

/** The preview's durable promotion record (Rules 38, 72, 73; D18 §12 "a graduated evidence record").
 * A gated capability graduates test agent → development agent → fleet. Each entry is one reviewed decision:
 * a stage reached, named by the durable evidence that shows it, or a new graduation deadline, with its reason,
 * the owner of the next step and the rollback operation. The record is append-only and lands through review,
 * like the declarations it serves; the register's `gate.deadline` for a capability must equal the latest
 * deadline recorded here, so the build check and the operator's status read one fact.
 * An entry is never evidence by itself: a stage names the artifact a reader can open. */

export const STAGES = ['test-agent', 'development-agent', 'fleet'] as const;
export type Stage = typeof STAGES[number];
interface Entry { capability: string; recordedAt: number; by: string }
export interface StageReached extends Entry { decision: 'stage-reached'; stage: Stage; evidence: string }
export interface NewDeadline extends Entry { decision: 'new-deadline'; deadline: number; reason: string; owner: string; rollback: string }
export type PromotionEntry = StageReached | NewDeadline;

const DAY = 86_400_000;
/** 2026-09-28 00:00 UTC. */
const RECORDED_2026_09_28 = 1790553600000;

export const PROMOTION_RECORD: readonly PromotionEntry[] = Object.freeze([
  { capability: 'preview.step-check', decision: 'new-deadline', recordedAt: RECORDED_2026_09_28, by: 'agent (build unit U1)',
    deadline: 1792022400000, // 2026-10-15 00:00 UTC
    reason: 'The original target (2026-09-30) passed its evaluation window without a recorded trace: Justin\'s live private-chat '
      + 'procedure (tests/preview/jev-step-supervisor-live-test.md) has not been run, so no development-agent stage evidence exists '
      + 'and graduation cannot be claimed. The observer stays dark and is reported as dark, never as a guard.',
    owner: 'the desk: run the live procedure with --step-check true, then record development-agent reached with the trace, or retire it',
    rollback: 'relaunch the same reviewed command without --step-check true; no step-check frames are written while off' },
]);

/** The UTC calendar day of an epoch millisecond (civil-from-days), without an ambient clock. */
export function utcDay(ms: number): string {
  const z = Math.floor(ms / DAY) + 719468, era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1, month = mp < 10 ? mp + 3 : mp - 9, year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export interface Promotion {
  /** Each stage's recorded evidence, or null when the record holds none. */
  stages: Record<Stage, { evidence: string; recordedAt: number } | null>;
  /** The latest recorded deadline, or null when the declared one was never moved. */
  deadline: { deadline: number; recordedAt: number; reason: string; owner: string } | null;
}
/** One capability's standing in the record. */
export function promotionOf(record: readonly PromotionEntry[], capability: string): Promotion {
  const stages: Promotion['stages'] = { 'test-agent': null, 'development-agent': null, fleet: null };
  let deadline: Promotion['deadline'] = null;
  for (const entry of record) {
    if (entry.capability !== capability) continue;
    if (entry.decision === 'stage-reached') stages[entry.stage] = { evidence: entry.evidence, recordedAt: entry.recordedAt };
    else deadline = { deadline: entry.deadline, recordedAt: entry.recordedAt, reason: entry.reason, owner: entry.owner };
  }
  return { stages, deadline };
}

/** Structural findings over the record itself; each names its rule. */
export function promotionRecordFindings(record: readonly PromotionEntry[]): string[] {
  const findings: string[] = [];
  const reached = new Map<string, Set<Stage>>();
  record.forEach((entry, i) => {
    const at = `promotion record entry ${i} (${entry.capability})`;
    if (!entry.capability.trim() || !entry.by.trim()) findings.push(`${at}: Rule 72 — an entry names its capability and who recorded it`);
    if (!Number.isSafeInteger(entry.recordedAt)) findings.push(`${at}: Rule 72 — recordedAt must be an epoch millisecond`);
    if (i > 0 && entry.recordedAt < record[i - 1]!.recordedAt) findings.push(`${at}: Rule 72 — the record is append-only in time order`);
    if (entry.decision === 'stage-reached') {
      const seen = reached.get(entry.capability) ?? new Set<Stage>();
      const earlier = STAGES.slice(0, STAGES.indexOf(entry.stage));
      if (!entry.evidence.trim()) findings.push(`${at}: Rule 72 — a stage names the durable evidence that shows it`);
      if (earlier.some(stage => !seen.has(stage))) findings.push(`${at}: Rule 72 — ${entry.stage} is reached only after ${earlier.join(' and ')}`);
      if (seen.has(entry.stage)) findings.push(`${at}: Rule 72 — ${entry.stage} is recorded once`);
      reached.set(entry.capability, seen.add(entry.stage));
    } else {
      if (!Number.isSafeInteger(entry.deadline) || entry.deadline <= entry.recordedAt)
        findings.push(`${at}: Rule 72 — a new deadline lies after the moment it is recorded`);
      if (!entry.reason.trim() || !entry.owner.trim() || !entry.rollback.trim())
        findings.push(`${at}: Rule 72 — a new deadline records its reason, owner and rollback`);
    }
  });
  return findings;
}

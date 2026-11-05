/**
 * Correction analyzer: the recurrence layer (carryover row 32; 1.x `src/monitoring/CorrectionAnalyzer.ts` at
 * 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, spec §3.5).
 *
 * Deterministic core, carried unchanged: group similar open records of the SAME kind by complete-link
 * clustering at the floor calibrated on the 2026-07-30 live 37-record corpus, then decide whether each cluster
 * crosses the THREE-PRONGED AND recurrence gate:
 *
 *   minSupport         AND
 *   minDistinctDays    AND   (restart-proof calendar-day durability)
 *   second orthogonal prong:
 *     - user-preference → minDistinctSessions ≥ 2 (two context resets)
 *     - infra-gap       → three distinct days; 1.x delegated a cross-agent consensus prong to its fleet
 *                         feedback clustering, which 2.0 does not have (one agent, its own journal).
 *
 * Code-determined provenance filter (poison resistance, spec §3.5): a record counts toward the gate ONLY when
 * its qualifying occurrences (those with deterministicWeight ≥ LEARNING_DETERMINISTIC_THRESHOLD, here the
 * verified operator) satisfy the prongs. Nothing the model wrote can steer the gate.
 *
 * What the gate means in 2.0 (Part 21 §11): crossing it does not apply anything. A preference is honored by the
 * preference owner from its first statement and a forgotten fact teaches recall from its first failure, so an
 * operator who still had to restate a lesson this often, across days and context resets, is reporting a
 * recurrence. The verdicts are the candidate-selection policy for the judgment owner's recurrence duty
 * (`correction-loop-driver.ts`), never authority: similarity relates records with recorded support and rewrites
 * no key (Rules 10, 11, 24, 86).
 *
 * Signal-only: this module decides gate-crossing + returns the verdicts. It does NOT route, write preferences or
 * mutate anything.
 */
import { distinctCounts, normalizeLearning, LEARNING_DETERMINISTIC_THRESHOLD,
  type CorrectionOccurrence, type CorrectionRecord } from './correction-ledger.js';

export interface CorrectionGates {
  minSupport: number;
  minDistinctDaysInfraGap: number;
  minDistinctDaysPreference: number;
  minDistinctSessionsPreference: number;
  /** Same-kind normalized-token Jaccard floor for analyzer-time grouping. */
  similarityThreshold?: number;
  /** Only consider records within this many days (0/undefined = all). */
  windowDays?: number;
  /** Layer-0 weight a record's occurrences must reach to COUNT toward the gate. */
  deterministicThreshold?: number;
}

export const DEFAULT_CORRECTION_GATES: CorrectionGates = {
  minSupport: 4,
  minDistinctDaysInfraGap: 3,
  minDistinctDaysPreference: 2,
  minDistinctSessionsPreference: 2,
  deterministicThreshold: LEARNING_DETERMINISTIC_THRESHOLD,
};

/**
 * Selected from the 2026-07-30 live 37-record corpus. Complete-link grouping
 * requires every pair in a cluster to meet this floor; unlike connected-
 * component/single-link grouping, a chain of partial overlaps cannot merge
 * distant learnings. The corpus calibration and excluded-edge measurements are
 * in 1.x docs/measurements/2026-07-30-correction-promotion-threshold.md.
 */
export const DEFAULT_CORRECTION_SIMILARITY_THRESHOLD = 0.65;

/** Per-cluster gate verdict — the analyzer's output. */
export interface GateVerdict {
  /** Stable representative: earliest record in the cluster. */
  record: CorrectionRecord;
  /** Every open record whose key contributed evidence to this verdict. */
  clusterRecords: CorrectionRecord[];
  clusterDedupeKeys: string[];
  crosses: boolean;
  /** Why it did/didn't cross — for audit and the judgment owner. */
  reason: string;
  qualifyingOccurrences: number;
  distinctDays: number;
  distinctSessions: number;
  /** Retained as observability only; topic diversity no longer gates promotion. */
  distinctTopics: number;
}

export interface CorrectionAnalyzeResult {
  verdicts: GateVerdict[];
  crossed: GateVerdict[];
  considered: number;
  belowThreshold: number;
}

function learningTokenSet(learning: string): Set<string> {
  const normalized = normalizeLearning(learning);
  return new Set(normalized ? normalized.split(' ') : []);
}

/** Normalized-token Jaccard. Empty learnings carry no similarity evidence. */
export function correctionLearningSimilarity(a: string, b: string): number {
  const left = learningTokenSet(a);
  const right = learningTokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection++;
  }
  return intersection / (left.size + right.size - intersection);
}

/**
 * Deterministic complete-link clustering over analyzer-time records. Records
 * are considered in stable creation order and may join a cluster only when
 * they meet the floor against EVERY existing member. This bounded-diameter
 * posture deliberately rejects A~B~C bridges when A!~C. Stored record identity
 * is never rewritten; dedupeKey remains exact.
 */
export function clusterCorrectionRecords(
  records: readonly CorrectionRecord[],
  similarityThreshold = DEFAULT_CORRECTION_SIMILARITY_THRESHOLD,
): CorrectionRecord[][] {
  const threshold = Math.max(0, Math.min(1, similarityThreshold));
  const clusters: CorrectionRecord[][] = [];
  const ordered = [...records].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  for (const candidate of ordered) {
    const compatible = clusters.find((cluster) =>
      cluster[0]!.kind === candidate.kind
      && cluster.every((member) =>
        correctionLearningSimilarity(member.learning, candidate.learning) >= threshold));
    if (compatible) {
      compatible.push(candidate);
    } else {
      clusters.push([candidate]);
    }
  }

  return clusters;
}

/**
 * Evaluate the recurrence gate against same-kind clusters of the `open` records handed in (the lifecycle decides
 * which records are open; `noise` records are never gate-considered). Returns one verdict per cluster so one
 * family can be presented at most once. Pure read over the occurrences.
 */
export function analyzeCorrections(open: readonly CorrectionRecord[], occurrences: readonly CorrectionOccurrence[],
  gates: CorrectionGates = DEFAULT_CORRECTION_GATES, now = Date.now()): CorrectionAnalyzeResult {
  const sinceMs = gates.windowDays && gates.windowDays > 0 ? now - gates.windowDays * 86400_000 : undefined;
  const threshold = gates.deterministicThreshold ?? LEARNING_DETERMINISTIC_THRESHOLD;

  const records = open
    .filter((r) => r.kind !== 'noise' && (sinceMs === undefined || Date.parse(r.detectedAt) >= sinceMs))
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt) || a.id.localeCompare(b.id)).slice(0, 1000);
  const clusters = clusterCorrectionRecords(records, gates.similarityThreshold ?? DEFAULT_CORRECTION_SIMILARITY_THRESHOLD);

  const verdicts: GateVerdict[] = [];
  let below = 0;
  for (const clusterRecords of clusters) {
    const rec = clusterRecords[0]!;
    const clusterDedupeKeys = clusterRecords.map((record) => record.dedupeKey);
    // Code-determined provenance filter: only occurrences whose Layer-0 weight
    // crossed the threshold count toward the gate.
    const counts = distinctCounts(occurrences, clusterDedupeKeys, threshold);
    const supportOk = counts.qualifyingOccurrences >= gates.minSupport;

    let crosses = false;
    let reason: string;
    if (rec.kind === 'user-preference') {
      const daysOk = counts.distinctDays >= gates.minDistinctDaysPreference;
      const sessionsOk = counts.distinctSessions >= gates.minDistinctSessionsPreference;
      crosses = supportOk && daysOk && sessionsOk;
      reason = crosses
        ? `preference gate crossed: ${String(counts.qualifyingOccurrences)} support / ${String(counts.distinctDays)} days / ${String(counts.distinctSessions)} sessions / ${String(clusterRecords.length)} keys`
        : `below preference gate (support ${String(counts.qualifyingOccurrences)}/${String(gates.minSupport)}, days ${String(counts.distinctDays)}/${String(gates.minDistinctDaysPreference)}, sessions ${String(counts.distinctSessions)}/${String(gates.minDistinctSessionsPreference)}, keys ${String(clusterRecords.length)})`;
    } else {
      // infra-gap: minSupport AND minDistinctDays. 1.x delegated a second cross-agent
      // consensus prong to its fleet feedback clustering; 2.0 is one agent over its own
      // journal, so the single-agent gate here (days + support) is the whole gate and
      // its crossing is presented to the judgment owner, never applied.
      const daysOk = counts.distinctDays >= gates.minDistinctDaysInfraGap;
      crosses = supportOk && daysOk;
      reason = crosses
        ? `infra-gap gate crossed: ${String(counts.qualifyingOccurrences)} support / ${String(counts.distinctDays)} days`
        : `below infra-gap gate (support ${String(counts.qualifyingOccurrences)}/${String(gates.minSupport)}, days ${String(counts.distinctDays)}/${String(gates.minDistinctDaysInfraGap)})`;
    }

    const verdict: GateVerdict = {
      record: rec,
      clusterRecords,
      clusterDedupeKeys,
      crosses,
      reason,
      qualifyingOccurrences: counts.qualifyingOccurrences,
      distinctDays: counts.distinctDays,
      distinctSessions: counts.distinctSessions,
      distinctTopics: counts.distinctTopics,
    };
    verdicts.push(verdict);
    if (!crosses) below++;
  }

  return {
    verdicts,
    crossed: verdicts.filter((v) => v.crosses),
    considered: records.length,
    belowThreshold: below,
  };
}

/**
 * Unit — correction analyzer: the clustered 3-pronged recurrence gate (carryover row 32; 1.x
 * tests/unit/CorrectionAnalyzer.test.ts at 4f88880a, spec §3.5).
 *
 * Pins: both sides of the similarity boundary; same-kind-only clustering; below-vs-at threshold on each recurrence
 * prong; the code-determined provenance filter EXCLUDES occurrences without verified operator provenance; noise
 * records are never considered. The analyzer is pure over records and occurrences, so these cases fold explicit
 * rows the way the journal fold does; the journal-fed path is exercised in correction-loop-driver.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { analyzeCorrections, clusterCorrectionRecords, DEFAULT_CORRECTION_GATES, DEFAULT_CORRECTION_SIMILARITY_THRESHOLD } from './correction-analyzer.js';
import { dayBucketOf, dedupeKey, recordsOf, type CorrectionKind, type CorrectionOccurrence, type CorrectionRecord } from './correction-ledger.js';
import { T } from './correction-fixture.js';

let seq = 0;
/** One occurrence row as the journal fold would derive it. */
function occurrence(kind: CorrectionKind, learning: string, options: { detectedAt?: string; topicId?: number; sessionId?: string; weight?: number } = {}): CorrectionOccurrence {
  const at = T(options.detectedAt ?? '2026-05-01T10:00:00Z');
  seq++;
  return { dedupeKey: dedupeKey(kind, learning), kind, signal: kind === 'user-preference' ? 'preference' : 'operator-reminded',
    trigger: `turn:${String(seq)}`, update: seq, detectedAt: at, dayBucket: dayBucketOf(at), topicId: options.topicId ?? null,
    sessionId: options.sessionId ?? 'epoch:0', deterministicWeight: options.weight ?? 3 };
}
/** The records behind a set of occurrences, with each key's learning text. */
function fold(rows: { row: CorrectionOccurrence; learning: string }[]): { records: CorrectionRecord[]; occurrences: CorrectionOccurrence[] } {
  const learning = new Map(rows.map(item => [item.row.dedupeKey, item.learning]));
  const occurrences = rows.map(item => item.row);
  return { records: recordsOf(occurrences, latest => learning.get(latest.dedupeKey)!), occurrences };
}
const seed = (kind: CorrectionKind, learning: string, options: Parameters<typeof occurrence>[2] = {}) => ({ row: occurrence(kind, learning, options), learning });
/** Record N occurrences across distinct days/sessions, all at the given weight. */
function seedPreference(opts: { count: number; days: number; sessions: number; weight: number }, learning = 'lead with the action') {
  const rows = [];
  for (let i = 0; i < opts.count; i++) {
    const day = (i % opts.days) + 1;
    const session = (i % opts.sessions) + 1;
    rows.push(seed('user-preference', learning, { weight: opts.weight, topicId: 1, sessionId: `epoch:${String(session)}`, detectedAt: `2026-05-0${String(day)}T10:00:00Z` }));
  }
  return rows;
}
const analyze = (rows: { row: CorrectionOccurrence; learning: string }[]) => {
  const { records, occurrences } = fold(rows);
  return analyzeCorrections(records, occurrences, DEFAULT_CORRECTION_GATES, T('2026-05-10T00:00:00Z'));
};

describe('CorrectionAnalyzer — 3-pronged gate', () => {
  describe('analyze-time similarity clustering', () => {
    it('clusters same-kind records at the threshold boundary', () => {
      const shared = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu';
      const { records } = fold([seed('user-preference', `${shared} omicron pi rho`), seed('user-preference', `${shared} sigma tau upsilon phi`)]);
      const clusters = clusterCorrectionRecords(records, DEFAULT_CORRECTION_SIMILARITY_THRESHOLD);
      // Jaccard = 13 / 20 = 0.65, exactly the selected floor.
      expect(clusters).toHaveLength(1);
      expect(clusters[0]).toHaveLength(2);
    });

    it('does not cluster same-kind records below the threshold boundary', () => {
      const shared = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu';
      const { records } = fold([seed('user-preference', `${shared} nu omicron pi rho`), seed('user-preference', `${shared} sigma tau upsilon phi`)]);
      const clusters = clusterCorrectionRecords(records, DEFAULT_CORRECTION_SIMILARITY_THRESHOLD);
      // Jaccard = 12 / 20 = 0.60, immediately below the selected floor.
      expect(clusters).toHaveLength(2);
    });

    it('never clusters across correction kinds even when learning text is identical', () => {
      const { records } = fold([seed('user-preference', 'alpha beta gamma delta'), seed('infra-gap', 'alpha beta gamma delta')]);
      expect(clusterCorrectionRecords(records, DEFAULT_CORRECTION_SIMILARITY_THRESHOLD)).toHaveLength(2);
    });

    it('rejects a single-link bridge when A~B and B~C but A!~C', () => {
      const { records } = fold([
        seed('user-preference', 'alpha beta gamma delta epsilon zeta eta theta iota kappa', { detectedAt: '2026-05-01T10:00:00Z' }),
        seed('user-preference', 'alpha beta gamma delta epsilon zeta eta theta lambda mu', { detectedAt: '2026-05-01T10:01:00Z' }),
        seed('user-preference', 'alpha beta gamma delta epsilon zeta lambda mu nu xi', { detectedAt: '2026-05-01T10:02:00Z' }),
      ]);
      const [a, b, c] = records as [CorrectionRecord, CorrectionRecord, CorrectionRecord];
      // A~B = 8/12 and B~C = 8/12, both above 0.65. A~C = 6/14,
      // so complete-link keeps C out instead of chaining all three.
      const clusters = clusterCorrectionRecords([a, b, c], 0.65);
      expect(clusters.map((cluster) => cluster.map((record) => record.id))).toEqual([
        [a.id, b.id],
        [c.id],
      ]);
    });

    it('aggregates qualifying support and diversity over every key in one cluster', () => {
      const learnings = [
        'alpha beta gamma delta theta',
        'alpha beta gamma epsilon theta',
        'alpha beta gamma zeta theta',
        'alpha beta gamma eta theta',
      ];
      const result = analyze(learnings.map((learning, i) => seed('user-preference', learning,
        { topicId: 1, sessionId: `epoch:${String((i % 2) + 1)}`, detectedAt: `2026-05-0${String((i % 2) + 1)}T10:00:00Z` })));
      expect(result.crossed).toHaveLength(1);
      expect(result.crossed[0]!.clusterRecords).toHaveLength(4);
      expect(result.crossed[0]).toMatchObject({
        qualifyingOccurrences: 4,
        distinctDays: 2,
        distinctSessions: 2,
      });
    });
  });

  describe('preference path: minSupport AND minDistinctDays(2) AND minDistinctSessions(2)', () => {
    it('crosses when all three prongs are met', () => {
      const result = analyze(seedPreference({ count: 4, days: 2, sessions: 2, weight: 3 }));
      expect(result.crossed.length).toBe(1);
      expect(result.crossed[0]!.record.kind).toBe('user-preference');
    });

    it('does NOT cross when support is below minSupport (3 < 4)', () => {
      const result = analyze(seedPreference({ count: 3, days: 2, sessions: 2, weight: 3 }));
      expect(result.crossed.length).toBe(0);
      expect(result.belowThreshold).toBe(1);
    });

    it('does NOT cross when only one distinct day (days prong fails)', () => {
      const result = analyze(seedPreference({ count: 5, days: 1, sessions: 2, weight: 3 }));
      expect(result.crossed.length).toBe(0);
    });

    it('does NOT cross when only one distinct session (session-diversity prong fails)', () => {
      const result = analyze(seedPreference({ count: 5, days: 2, sessions: 1, weight: 3 }));
      expect(result.crossed.length).toBe(0);
    });
  });

  describe('code-determined provenance filter (poison resistance)', () => {
    it('occurrences without verified operator provenance NEVER satisfy the gate', () => {
      // 6 occurrences across 3 days / 3 sessions — would EASILY cross — but every one is weight 1
      // (below LEARNING_DETERMINISTIC_THRESHOLD=3): the provenance filter excludes them all.
      const result = analyze(Array.from({ length: 6 }, (_, i) => seed('user-preference', 'poisoned learning',
        { weight: 1, topicId: (i % 3) + 1, sessionId: `epoch:${String((i % 3) + 1)}`, detectedAt: `2026-05-0${String((i % 3) + 1)}T10:00:00Z` })));
      expect(result.crossed.length).toBe(0);
    });

    it('mixed: only the qualifying (weight>=threshold) occurrences count toward the gate', () => {
      const rows = [
        ...Array.from({ length: 4 }, (_, i) => seed('user-preference', 'real pref', { weight: 3, topicId: 1, sessionId: `epoch:${String((i % 2) + 1)}`, detectedAt: `2026-05-0${String((i % 2) + 1)}T10:00:00Z` })),
        ...Array.from({ length: 3 }, () => seed('user-preference', 'real pref', { weight: 1, topicId: 9, sessionId: 'poison-session', detectedAt: '2026-05-09T10:00:00Z' })),
      ];
      expect(analyze(rows).crossed.length).toBe(1);
    });
  });

  describe('infra-gap path: minSupport AND minDistinctDays(3)', () => {
    it('crosses at 4 support across 3 distinct days', () => {
      const result = analyze(Array.from({ length: 4 }, (_, i) => seed('infra-gap', 'force push nag', { topicId: 1, detectedAt: `2026-05-0${String((i % 3) + 1)}T10:00:00Z` })));
      expect(result.crossed.length).toBe(1);
      expect(result.crossed[0]!.record.kind).toBe('infra-gap');
    });

    it('does NOT cross at only 2 distinct days (infra-gap needs 3)', () => {
      const result = analyze(Array.from({ length: 5 }, (_, i) => seed('infra-gap', 'force push nag', { topicId: 1, detectedAt: `2026-05-0${String((i % 2) + 1)}T10:00:00Z` })));
      expect(result.crossed.length).toBe(0);
    });
  });

  it('noise records are never gate-considered', () => {
    const result = analyze(Array.from({ length: 10 }, (_, i) => seed('noise', 'nothing', { topicId: (i % 5) + 1, detectedAt: `2026-05-0${String((i % 5) + 1)}T10:00:00Z` })));
    expect(result.considered).toBe(0);
    expect(result.crossed.length).toBe(0);
  });

  it('a window bounds consideration by latest detection', () => {
    const rows = seedPreference({ count: 4, days: 2, sessions: 2, weight: 3 });
    const { records, occurrences } = fold(rows);
    expect(analyzeCorrections(records, occurrences, { ...DEFAULT_CORRECTION_GATES, windowDays: 30 }, T('2026-05-10T00:00:00Z')).considered).toBe(1);
    expect(analyzeCorrections(records, occurrences, { ...DEFAULT_CORRECTION_GATES, windowDays: 3 }, T('2026-05-10T00:00:00Z')).considered).toBe(0);
  });

  it('DEFAULT_CORRECTION_GATES match the spec §9 defaults', () => {
    expect(DEFAULT_CORRECTION_GATES.minSupport).toBe(4);
    expect(DEFAULT_CORRECTION_GATES.minDistinctDaysInfraGap).toBe(3);
    expect(DEFAULT_CORRECTION_GATES.minDistinctDaysPreference).toBe(2);
    expect(DEFAULT_CORRECTION_GATES.minDistinctSessionsPreference).toBe(2);
    expect(DEFAULT_CORRECTION_SIMILARITY_THRESHOLD).toBe(0.65);
  });
});

/**
 * Unit — correction ledger (carryover row 32; 1.x tests/unit/CorrectionLedger.test.ts at 4f88880a, spec §3.4).
 *
 * Pins, as in 1.x: dedupe-upsert collapses recurrences to one record; the normalizedLearning hash is STABLE across
 * phrasings (the unit-tested invariant); distinct-days/topics/sessions + the deterministic-weight provenance filter;
 * toApiView strips the raw `learning`. Where 1.x pinned its SQLite shape (prune-in-transaction, column migration,
 * composite indexes, OCC versions), 2.0 pins the journal shape instead: every occurrence is kept and a READ is
 * paged, and a reopened journal replays identical records. Both sides of each boundary are exercised.
 */
import { describe, it, expect } from 'vitest';
import { correctionOccurrences, correctionRecords, dedupeKey, distinctCounts, dayBucketOf, getByDedupeKey, listRecords,
  normalizedLearningHash, occurrencePage, toApiView, DEFAULT_MAX_OCCURRENCES_PER_KEY, LEARNING_DETERMINISTIC_THRESHOLD } from './correction-ledger.js';
import { correctionWorld, STRANGER, T } from './correction-fixture.js';

describe('CorrectionLedger', () => {
  describe('normalizedLearningHash stability (the unit-tested invariant)', () => {
    it('collapses semantically-identical learnings phrased differently to one hash', () => {
      const a = normalizedLearningHash('Lead with the one action, no preamble.');
      const b = normalizedLearningHash('no preamble — lead with the one action');
      const c = normalizedLearningHash('Always lead with the one action and no preamble');
      expect(a).toBe(b);
      expect(a).toBe(c);
    });

    it('distinguishes genuinely-different learnings', () => {
      const a = normalizedLearningHash('lead with the one action');
      const b = normalizedLearningHash('use plain language, no jargon');
      expect(a).not.toBe(b);
    });

    it('dedupeKey is kind:hash and differs by kind for the same learning', () => {
      const pref = dedupeKey('user-preference', 'keep it plain');
      const infra = dedupeKey('infra-gap', 'keep it plain');
      expect(pref.startsWith('user-preference:')).toBe(true);
      expect(infra.startsWith('infra-gap:')).toBe(true);
      expect(pref).not.toBe(infra);
    });

    it('day buckets are UTC and code-derived', () => {
      expect(dayBucketOf('2026-05-01T23:30:00Z')).toBe('2026-05-01');
      expect(dayBucketOf(T('2026-05-02T00:30:00Z'))).toBe('2026-05-02');
    });
  });

  describe('dedupe-upsert', () => {
    it('a repeat increments occurrenceCount, never duplicates', () => {
      const w = correctionWorld();
      try {
        w.preference('lead with the action', T('2026-05-01T10:00:00Z'));
        w.preference('lead with the action', T('2026-05-01T12:00:00Z'));
        const records = correctionRecords(w.view, w.operator);
        expect(records).toHaveLength(1);
        expect(records[0]!.occurrenceCount).toBe(2);
        expect(records[0]!.version).toBe(2);
        expect(records[0]!.id).toBe(dedupeKey('user-preference', 'lead with the action'));
        // Two phrasings of one lesson are one record too; a different lesson is another.
        w.preference('Lead with the action!', T('2026-05-01T13:00:00Z'));
        w.preference('use plain language', T('2026-05-01T14:00:00Z'));
        const again = correctionRecords(w.view, w.operator);
        expect(again).toHaveLength(2);
        expect(getByDedupeKey(again, records[0]!.dedupeKey)!.occurrenceCount).toBe(3);
      } finally { w.close(); }
    });

    it('keeps the strongest deterministic weight on upsert', () => {
      const w = correctionWorld();
      try {
        // A row triggered by another accepted sender carries no operator provenance (weight 0).
        w.preference('x marks the spot', T('2026-05-01T10:00:00Z'), { from: STRANGER });
        expect(correctionRecords(w.view, w.operator)[0]!.deterministicWeight).toBe(0);
        w.preference('x marks the spot', T('2026-05-01T11:00:00Z'));
        const record = correctionRecords(w.view, w.operator)[0]!;
        expect(record.deterministicWeight).toBe(LEARNING_DETERMINISTIC_THRESHOLD);
        expect(record.occurrenceCount).toBe(2);
      } finally { w.close(); }
    });

    it('one trigger contributes one occurrence per key even when two signals name it', () => {
      const w = correctionWorld();
      try {
        // The reminder is both an operator-reminded failure and, when the model also records the correction of the
        // agent's reply, an operator-correction failure: one occurrence of the one lesson (C32-1104-2).
        const { reminder } = w.forgotten('my locker is 4521', 'What is my locker?', T('2026-05-01T10:00:00Z'));
        const rows = correctionOccurrences(w.view, w.operator);
        expect(rows.filter(row => row.trigger === reminder)).toHaveLength(1);
        expect(rows[0]).toMatchObject({ kind: 'infra-gap', signal: 'operator-reminded', trigger: reminder, deterministicWeight: 3 });
      } finally { w.close(); }
    });
  });

  describe('occurrence retention (Rule 7 replaces prune-in-transaction)', () => {
    it('keeps every occurrence; a read page is bounded and reports what it left out', () => {
      const w = correctionWorld();
      try {
        for (let i = 0; i < 12; i++) w.forgotten('the force push nag', 'Why did you ask again?', T('2026-05-01T10:00:00Z') + i * 60_000);
        const key = dedupeKey('infra-gap', 'the force push nag');
        const record = getByDedupeKey(correctionRecords(w.view, w.operator), key)!;
        expect(record.occurrences).toHaveLength(12);
        expect(record.occurrenceCount).toBe(12);
        const page = occurrencePage(record, 5);
        expect(page.rows).toHaveLength(5);
        expect(page.omitted).toBe(7);
        expect(page.rows[4]!.trigger).toBe(record.occurrences[11]!.trigger);
        // The default page is the 1.x retention cap, now a read bound.
        expect(occurrencePage(record)).toEqual({ rows: record.occurrences, omitted: 0 });
        expect(DEFAULT_MAX_OCCURRENCES_PER_KEY).toBe(200);
      } finally { w.close(); }
    });

    it('a reopened journal replays identical records (the restart evidence 1.x took from its own file)', () => {
      const w = correctionWorld();
      try {
        w.preference('plain', T('2026-05-01T10:00:00Z'));
        w.forgotten('my locker is 4521', 'What is my locker?', T('2026-05-02T10:00:00Z'));
        const before = correctionRecords(w.view, w.operator);
        w.reopen();
        expect(correctionRecords(w.view, w.operator)).toEqual(before);
        expect(correctionOccurrences(w.view, w.operator)).toEqual(before.flatMap(record => record.occurrences));
      } finally { w.close(); }
    });
  });

  describe('distinctCounts (days + sessions + provenance filter)', () => {
    it('counts distinct UTC calendar days, topics and sessions for exact-key repeats', () => {
      const w = correctionWorld();
      try {
        w.preference('plain', T('2026-05-01T10:00:00Z'), { thread: 1 });
        w.preference('plain', T('2026-05-01T23:00:00Z'), { thread: 1 }); // same day, same session
        w.summarize(T('2026-05-01T23:30:00Z'));                           // a context reset
        w.preference('plain', T('2026-05-02T08:00:00Z'), { thread: 2 });
        const key = dedupeKey('user-preference', 'plain');
        const c = distinctCounts(correctionOccurrences(w.view, w.operator), key);
        expect(c.distinctDays).toBe(2);   // 05-01 and 05-02
        expect(c.distinctTopics).toBe(2); // topics 1 and 2
        expect(c.distinctSessions).toBe(2);
        expect(c.qualifyingOccurrences).toBe(3);
        // Without the reset the third statement stays in the first session.
        const v = correctionWorld();
        try {
          v.preference('plain', T('2026-05-01T10:00:00Z'));
          v.preference('plain', T('2026-05-02T08:00:00Z'));
          expect(distinctCounts(correctionOccurrences(v.view, v.operator), key)).toMatchObject({ distinctDays: 2, distinctSessions: 1 });
        } finally { v.close(); }
      } finally { w.close(); }
    });

    it('aggregates distinct counts across a cluster of dedupe keys', () => {
      const w = correctionWorld();
      try {
        w.preference('alpha beta gamma delta', T('2026-05-01T10:00:00Z'));
        w.summarize(T('2026-05-01T11:00:00Z'));
        w.preference('alpha beta gamma epsilon', T('2026-05-02T10:00:00Z'));
        const rows = correctionOccurrences(w.view, w.operator);
        expect(distinctCounts(rows, [dedupeKey('user-preference', 'alpha beta gamma delta'), dedupeKey('user-preference', 'alpha beta gamma epsilon')], 3))
          .toMatchObject({ qualifyingOccurrences: 2, distinctDays: 2, distinctSessions: 2 });
        expect(distinctCounts(rows, [], 3)).toEqual({ distinctDays: 0, distinctTopics: 0, distinctSessions: 0, qualifyingOccurrences: 0 });
      } finally { w.close(); }
    });

    it('the deterministic-weight filter EXCLUDES occurrences without verified operator provenance', () => {
      const w = correctionWorld();
      try {
        // 4 occurrences but only 2 from the verified operator.
        w.preference('p', T('2026-05-01T10:00:00Z'), { thread: 1 });
        w.preference('p', T('2026-05-02T10:00:00Z'), { thread: 2, from: STRANGER });
        w.preference('p', T('2026-05-03T10:00:00Z'), { thread: 3, from: STRANGER });
        w.preference('p', T('2026-05-04T10:00:00Z'), { thread: 4 });
        const key = dedupeKey('user-preference', 'p');
        const rows = correctionOccurrences(w.view, w.operator);
        const all = distinctCounts(rows, key, 0);
        const qualifying = distinctCounts(rows, key, 3);
        expect(all.qualifyingOccurrences).toBe(4);
        expect(qualifying.qualifyingOccurrences).toBe(2); // only the operator's rows
        expect(qualifying.distinctDays).toBe(2);          // 05-01 and 05-04 only
      } finally { w.close(); }
    });
  });

  describe('list', () => {
    it('lists newest detection first within since/before bounds and a limit', () => {
      const w = correctionWorld();
      try {
        w.preference('one', T('2026-05-01T10:00:00Z'));
        w.preference('two', T('2026-05-02T10:00:00Z'));
        w.forgotten('my locker is 4521', 'What is my locker?', T('2026-05-03T10:00:00Z'));
        const records = correctionRecords(w.view, w.operator);
        expect(listRecords(records).map(record => record.kind)).toEqual(['infra-gap', 'user-preference', 'user-preference']);
        expect(listRecords(records, { kind: 'user-preference', limit: 1 }).map(record => record.learning)).toEqual(['two']);
        expect(listRecords(records, { sinceMs: T('2026-05-02T00:00:00Z'), beforeMs: T('2026-05-03T00:00:00Z') }).map(record => record.learning)).toEqual(['two']);
      } finally { w.close(); }
    });
  });

  describe('toApiView', () => {
    it('strips the raw learning, the session and the occurrence detail; keeps the metadata', () => {
      const w = correctionWorld();
      try {
        w.preference('remember my token=SECRETRAWLEARNINGTEXT1 please', T('2026-05-01T10:00:00Z'), { thread: 7 });
        const rec = correctionRecords(w.view, w.operator)[0]!;
        // The record's own text is already credential-redacted (the one redaction owner, applied on read).
        expect(rec.learning).not.toContain('SECRETRAWLEARNINGTEXT1');
        const view = toApiView(rec);
        const serialized = JSON.stringify(view);
        expect(serialized).not.toContain('remember my');
        expect(serialized).not.toContain('epoch:');
        expect((view as unknown as Record<string, unknown>).learning).toBeUndefined();
        expect((view as unknown as Record<string, unknown>).occurrences).toBeUndefined();
        expect(view.topicId).toBe(7);
        expect(view.occurrenceCount).toBe(1);
      } finally { w.close(); }
    });
  });
});

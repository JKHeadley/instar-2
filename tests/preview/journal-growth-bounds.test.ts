import { expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, projectionDigest } from './journal.js';

const key = new Uint8Array(32).fill(27);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 30, maxTurns: 1000, maxBytes: 16777216, cursor: 0 };

it('compacts and verifies retained history without stringifying the whole snapshot or projection', () => {
  const root = mkdtempSync(join(tmpdir(), 'growth-bound-')), path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  try {
    for (let i = 1; i <= 300; i++) journal.append({ kind: 'intake', id: `turn:${i}`, update: i,
      text: 'a'.repeat(1024), raw: '{}', accepted: false, cursor: i + 1, at: i });
    // Keep old non-idle timings too: the snapshot must stream with evidence retention enabled.
    for (let i = 0; i < 150; i++) journal.append({ kind: 'phase-timing', id: `auth:${i}`, phase: 'auth',
      measurements: { elapsedMs: i }, at: 301 + i, forward: { generation: 4, additive: true } });
    const stringify = JSON.stringify;
    const guard = vi.spyOn(JSON, 'stringify').mockImplementation(((value: unknown, ...args: unknown[]) => {
      // Reduced ceiling reproduces V8's failure without loading the Studio.
      if (value && typeof value === 'object' && ('retained' in value || 'turns' in value))
        throw new RangeError('aggregate string ceiling');
      return Reflect.apply(stringify, JSON, [value, ...args]);
    }) as typeof JSON.stringify);
    try {
      const before = projectionDigest(journal.view);
      journal.compact(); expect(journal.retainedRows).toBe(450); journal.close();
      const reopened = openPreviewJournal(path, key, undefined, undefined, true);
      try { expect(projectionDigest(reopened.view)).toBe(before); expect(reopened.view.order).toHaveLength(300); }
      finally { reopened.close(); }
    } finally { guard.mockRestore(); }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('bounds redundant sentinel observations while retaining every decision and family totals', () => {
  const root = mkdtempSync(join(tmpdir(), 'sentinel-bound-')), path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  try {
    for (let i = 1; i <= 300; i++) journal.append({ kind: 'sentinel', family: 'promise', promise: {}, events: [], at: i });
    journal.append({ kind: 'sentinel', family: 'promise', promise: {},
      events: [{ event: 'observed', subject: 'promise:1', detail: 'decision evidence' }], at: 301 });
    const before = projectionDigest(journal.view);
    journal.compact();
    expect(journal.retainedRows).toBeLessThanOrEqual(102);
    journal.compact(); journal.close();
    const reopened = openPreviewJournal(path, key, undefined, undefined, true);
    try {
      expect(projectionDigest(reopened.view)).toBe(before);
      expect(reopened.view.sentinels?.counts.promise).toBe(301);
      expect(reopened.view.sentinels?.events[0]?.detail).toBe('decision evidence');
    } finally { reopened.close(); }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('summarizes only repeated work observations, never progress clocks, state transitions or event evidence', async () => {
  const { retainedSentinelEvidence } = await import('./sentinel-record.js');
  const rows: import('./sentinel-record.js').SentinelRecord[] = [];
  for (const state of ['unknown', 'waiting', 'observing', 'stalled'] as const) {
    for (let i = 0; i < 200; i++) rows.push({ kind: 'sentinel', family: 'presence', presence: {}, events: [],
      work: { child: { progress: null, observedAt: i, lastProgressAt: i, state, detail: state } }, at: rows.length });
  }
  const event = { ...rows[0]!, events: [{ event: 'self-heal-requested', subject: 'child', detail: 'decision' }] };
  rows.push(event);
  const kept = retainedSentinelEvidence(rows);
  expect(kept.size).toBe(503); // first unknown/waiting + last 100 repeats + 400 changing progress clocks + event
  expect(kept.has(event)).toBe(true);
  expect(kept.has(rows[0]!)).toBe(true); expect(kept.has(rows[200]!)).toBe(true);
  expect(rows.slice(400, 800).every(row => kept.has(row))).toBe(true);
  const ordered = rows.filter(row => kept.has(row));
  expect(ordered.filter(row => retainedSentinelEvidence(ordered).has(row))).toEqual(ordered);
});

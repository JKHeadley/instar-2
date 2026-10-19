import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writerRecord } from './intake-principal.js';
import { readAnswer } from './answer-reading.js';
import { interpretSummaryReview } from './summary-check.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { createJournalWorker, openPreviewJournal, PREVIEW_FULL_HISTORY_BYTES, requestOccurrence, type JournalRecord } from './journal-test-worker.js';

type ModelUsage = { inputTokens: number | null; outputTokens: number | null; charge: null; inputComplete?: true };

const fixture = JSON.parse(readFileSync(new URL('./fixtures/summary-ack-walk-2026-10-15.json', import.meta.url), 'utf8')) as {
  rows: JournalRecord[];
  checks: { id: string; judgment: string; output: string; usage: ModelUsage }[];
  writers: { id: string; before: number; output: string | null; outcome: string; usage: ModelUsage | null;
    recordedResult: { kind: string; failureClass?: string; reason?: string } }[];
};
const genesis = fixture.rows[0] as Extract<JournalRecord, { kind: 'genesis' }>;
const conversationKinds = new Set(['caps', 'intake', 'reserve', 'answer', 'intent', 'sent', 'coherence', 'action-due']);
const key = new Uint8Array(32).fill(63);
const portOutput = (record: typeof fixture.writers[number]) => {
  if (record.outcome === 'uncertain') return { state: 'uncertain' as const, ...(record.usage ? { usage: record.usage } : {}) };
  const reading = readAnswer(record.output!, { wrapped: 'accept', object: true, evidence: [record.id] });
  if (!reading.ok) return { state: 'complete' as const, failureClass: 'malformed' as const };
  if (!record.usage) throw Error('complete recorded writer must carry its usage');
  return { state: 'complete' as const, text: reading.value, usage: record.usage };
};
function world(record = fixture.writers[0]!) {
  const root = mkdtempSync(join(tmpdir(), 'summary-ack-walk-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const calls: string[] = [];
  const now = 1792050000000;
  const worker = createJournalWorker(journal, {
    now: () => now, stopped: () => false,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, now, journal.view.limits.maxBytes),
    model: async input => { calls.push(input.id); return portOutput(record); },
    summaryCheck: async () => JSON.parse(fixture.checks.filter(item => item.judgment === 'jev-summary-faithfulness')[record.id === 'summary:840342899' ? 0 : 1]!.output),
    replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('no reply check in summary replay'); },
      escalate: async () => { throw Error('no reply escalation in summary replay'); },
      summaryReview: async () => {
        const review = fixture.checks.find(item => item.id === `${record.id}:review`)
          ?? fixture.checks.filter(item => item.judgment === 'summary-review').at(-1)!;
        const reading = readAnswer(review.output, { object: true, evidence: [review.id] });
        if (!reading.ok) throw Error(reading.defect);
        const result = interpretSummaryReview({ state: 'complete', value: reading.value, usage: review.usage }, 1);
        if (result.verdict === 'unsure') throw Error('subscription review never returns unsure');
        return { ...result, verdict: result.verdict };
      } },
    send: async () => { throw Error('offline replay must never send'); }, checkOutbound: () => {},
  });
  const append = (row: JournalRecord) => journal.append(row.kind === 'action-due'
    ? { ...row, writer: writerRecord(journal.systemWriter('requested-action', requestOccurrence(row.id, [...row.items, ...row.overflow ?? []]), row.at)!) }
    : row);
  return { journal, worker, calls, append,
    close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it('keeps all 33 recorded turns as complete history without spending any automatic summary calls', async () => {
  const w = world();
  try {
    let delivered = 0;
    for (const row of fixture.rows.slice(1)) {
      // Replay the actual conversation without the old summarizer's own failed/undecided side effects.
      if (!conversationKinds.has(row.kind)) continue;
      w.append(row);
      if (row.kind === 'sent') {
        delivered++;
        await w.worker.summarizeIfNeeded();
        expect(w.calls, `after ${row.id}`).toEqual([]);
      }
    }
    expect(delivered).toBe(34); // 33 operator replies plus the actual due reminder.
    expect(w.journal.view.order.filter(turn => turn.id.startsWith('telegram:'))).toHaveLength(33);
    expect(w.journal.view.summaries).toEqual([]);
    expect(w.journal.view.memory.some(change => change.replacement === 'my pottery class has moved to Tuesdays')).toBe(true);
  } finally { w.close(); }
});

const malformed = fixture.writers.filter(item => item.outcome === 'complete'
  && item.recordedResult.kind === 'summary-failed' && item.recordedResult.failureClass === 'malformed'
  && item.recordedResult.reason === undefined);
it.each(malformed.map((record, index) => ({ record, index })))('preserves refusal of recorded malformed writer $index ($record.id) when explicitly required', async ({ record }) => {
  const w = world(record);
  try {
    for (const row of fixture.rows.slice(1, record.before)) w.append(row);
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls[0]).toBe(record.id);
    expect(w.journal.view.lastSummaryFailure?.failureClass).toBe('malformed');
    expect(w.journal.view.summaries).toHaveLength(0);
  } finally { w.close(); }
});

it('still accepts the recorded valid summary when explicitly required', async () => {
  const record = fixture.writers.at(-1)!;
  expect(record.recordedResult.kind).toBe('summary');
  const w = world(record);
  try {
    for (const row of fixture.rows.slice(1, record.before)) w.append(row);
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls[0]).toBe(record.id);
    expect(w.journal.view.summaries.at(-1)?.text).toBe(JSON.parse(record.output!).summary);
  } finally { w.close(); }
});

it('retains the recorded Jev undecided → review violation refusal', async () => {
  const record = fixture.writers.find(item => item.recordedResult.reason?.includes('full-context review found loss'))!;
  const w = world(record);
  try {
    for (const row of fixture.rows.slice(1, record.before)) w.append(row);
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls[0]).toBe(record.id);
    expect(w.journal.view.lastSummaryFailure?.reason).toContain('full-context review found loss');
    expect(w.journal.view.summaries).toEqual([]);
  } finally { w.close(); }
});

it('records genuine uncertainty without inventing a summary or repeating its reservation', async () => {
  const record = fixture.writers.find(item => item.outcome === 'uncertain')!;
  const w = world(record);
  try {
    for (const row of fixture.rows.slice(1, fixture.writers[0]!.before))
      if (conversationKinds.has(row.kind)) w.append(row);
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toHaveLength(1);
    expect(w.journal.view.summaryReservations.size).toBe(1);
    expect(w.journal.view.summaries).toEqual([]);
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toHaveLength(1);
  } finally { w.close(); }
});

it('retains compression above the existing full-history bound and below a small packet headroom bound', async () => {
  for (const maxBytes of [409600, 32768]) {
    const w = world();
    try {
      for (const row of fixture.rows.slice(1, fixture.writers[0]!.before))
        if (conversationKinds.has(row.kind)) w.append(row);
      if (maxBytes === 409600) {
        const turn = w.journal.view.order.at(-1)!;
        // Inject size, not CPU load: no real provider or outbound action is used.
        turn.text += 'x'.repeat(PREVIEW_FULL_HISTORY_BYTES);
      } else w.journal.view.limits.maxBytes = maxBytes;
      await w.worker.summarizeIfNeeded();
      expect(w.calls.length).toBeGreaterThan(0);
    } finally { w.close(); }
  }
});

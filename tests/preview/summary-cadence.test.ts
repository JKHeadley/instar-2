/** S0b: replay proof-room writer bytes through the actual doorway reader and worker. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type JournalRecord, type CallOutcome } from './journal.js';
import { readAnswer } from './answer-reading.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { interpretSummaryReview } from './summary-check.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/summary-cadence-2026-10-26.json', import.meta.url), 'utf8')) as {
  sources: unknown[];
  turns: { id: string; update: number; text: string; reply: string; at: number; sentAt: number }[];
  summaries: Extract<JournalRecord, { kind: 'summary' }>[];
  models: { id: string; judgment: string; output: string; at: number }[];
};
const writers = fixture.models.filter(row => row.judgment === 'summary');
const malformed = writers.find(row => row.id === 'summary:6236633')!;
const repaired = writers.filter(row => row.id === malformed.id)[1]!;
const first = fixture.summaries[0]!;
const key = new Uint8Array(32).fill(66);
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 2500, maxReplies: 2500, maxTurns: 2500, maxBytes: 409600, cursor: 0 };

type RecordedCap = { id: string; outcome: CallOutcome; uncertainUsage: { inputTokens: number | null; outputTokens: number | null; charge: null } };
const overCap = (JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-overcap-2026-09-30.json', import.meta.url), 'utf8')) as { writer: RecordedCap[] })
  .writer.find(row => row.outcome.localLimit === 'output-cap')!;

function world(options: { mixed?: 'output-cap' | 'prose-bound'; end?: number; repeat?: boolean; stop?: boolean; cap?: boolean; cadence?: boolean; secondTail?: boolean; uncertain?: boolean; formatOverflow?: boolean } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'summary-cadence-')));
  const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
  let now = first.at + 600001, stopped = false;
  for (const turn of fixture.turns.filter(t => t.update <= (options.end ?? 6236633))) {
    const { id, update, text, at, reply, sentAt } = turn;
    journal.append({ kind: 'intake', id, update, text, raw: JSON.stringify({ update_id: update,
      message: { text, date: Math.floor(at / 1000), chat: { id: Number(genesis.chat), type: 'private' },
        from: { id: Number(genesis.operator) } } }), accepted: true, cursor: update + 1, at });
    journal.append({ kind: 'reserve', id, at });
    journal.append({ kind: 'answer', id, text: reply, state: 'complete', at });
    journal.append({ kind: 'intent', id, text: reply, chat: genesis.chat, update, grant: genesis.grant, at });
    journal.append({ kind: 'sent', id, message: update, at: sentAt });
  }
  journal.append({ kind: 'summary-reserve', through: first.through, at: first.at });
  journal.append(first);
  now = Math.max(now, ...fixture.turns.filter(t => t.update <= (options.end ?? 6236633)).map(t => t.sentAt + 600001));
  const calls: { id: string; question: string; context: string }[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => stopped, sources: fixture.sources,
    prepareModel: input => {
      if (options.formatOverflow && JSON.parse(input.context).formatReminder) throw Error('injected size overflow');
      return prepareJournalEnvelope(input, 'claude-opus-5-5', genesis.grant, now, genesis.maxBytes);
    },
    model: async input => {
      if (input.id.startsWith('summary:index:')) return '{"concepts":[]}';
      calls.push(input);
      // Inject a combination of recorded shapes, not a claim of consecutive live outcomes.
      if (options.mixed && calls.length === 1) {
        const read = readAnswer(malformed.output, { object: true, evidence: [input.id] });
        if (read.ok) throw Error('recorded malformed output unexpectedly parsed');
        return { state: 'complete' as const, failureClass: 'malformed' as const, defect: read.defect };
      }
      if (options.mixed && calls.length === 2) {
        if (options.mixed === 'prose-bound') {
          // Synthetic boundary probe: repeat recorded prose beyond the carried byte ceiling.
          return JSON.stringify({ summary: first.text.repeat(100), people: [], commitments: [], closed: [], memory: [], questions: [] });
        }
        journal.append({ kind: 'call-outcome', id: input.id, role: 'summary', outcome: overCap.outcome, at: now });
        return { state: 'uncertain' as const, usage: overCap.uncertainUsage };
      }
      if (options.cadence) {
        // Synthetic faithful answer for a newly enlarged span: exact recorded facts, no live call.
        const packet = JSON.parse(input.context) as { summary?: { text: string }; history: { id: string; user: string }[] };
        return JSON.stringify({ summary: (packet.summary?.text ?? first.text) + '\n' + packet.history.filter(t => Number(t.id.split(':').at(-1)) <= 6236651).map(t => t.user).join('\n'),
          people: [], commitments: [], closed: [], memory: [], questions: [] });
      }
      if (options.uncertain) return { state: 'uncertain' as const };
      const raw = calls.length === 1 || options.repeat
        ? options.secondTail ? writers.find(row => row.id === 'summary:6236637')!.output : malformed.output
        : repaired.output;
      const read = readAnswer(raw, { object: true, evidence: [input.id] });
      if (!read.ok) {
        if (options.stop) stopped = true;
        if (options.cap) journal.view.limits.maxCalls = journal.view.calls;
        return { state: 'complete' as const, failureClass: 'malformed' as const, defect: read.defect };
      }
      return read.value;
    },
    summaryCheck: async () => JSON.parse(fixture.models.filter(row => row.judgment === 'jev-summary-faithfulness')[1]!.output),
    replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('unexpected integrity call'); },
      escalate: async () => { throw Error('offline replay never answers'); },
      summaryReview: async state => {
        if (options.cadence) {
          // Synthetic review for this newly generated candidate; recorded review bytes below
          // are only evidence for the original span, not for a larger one.
          const { proposed, packet } = JSON.parse(state);
          expect(packet.history.filter((t: { id: string }) => Number(t.id.split(':').at(-1)) <= 6236651)
            .every((t: { user: string }) => proposed.summary.includes(t.user))).toBe(true);
          return { verdict: 'pass' as const, reason: 'Synthetic exact-fact conservation check.', latencyMs: 1 };
        }
        const row = fixture.models.find(row => row.id === 'summary:6236633:review')!;
        const result = interpretSummaryReview({ state: 'complete', value: row.output }, 1);
        if (result.verdict === 'unsure') throw Error('unexpected unsure');
        return { ...result, verdict: result.verdict };
      } }, send: async () => { throw Error('offline replay never sends'); }, checkOutbound: () => {} });
  return { journal, worker, calls, advance: () => { now += 600001; },
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }); } };
}

it.each([false, true])('replays a real malformed tail then the recorded valid retry (second tail=%s)', async secondTail => {
  const w = world({ secondTail });
  try {
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls.map(c => c.id)).toEqual(['summary:6236633', 'summary:6236633']);
    expect(JSON.parse(w.calls[1]!.context).formatReminder).toContain('defect');
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236633);
    expect(w.journal.view.summaryFailures.get(6236633)).toBe(1);
  } finally { w.close(); }
});

it('keeps a twice-malformed span failed and visible, with no third retry', async () => {
  const w = world({ repeat: true });
  try {
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls.map(c => c.id)).toEqual(['summary:6236633', 'summary:6236633']);
    expect(w.journal.view.lastSummaryFailure?.failureClass).toBe('malformed');
    expect(w.journal.view.summaries.at(-1)?.through).toBe(first.through);
    await w.worker.summarizeIfNeeded();
    expect(w.calls).toHaveLength(2);
  } finally { w.close(); }
});

it.each(['stop', 'cap'] as const)('checks %s again before retrying malformed output', async floor => {
  const w = world({ [floor]: true });
  try {
    await w.worker.summarizeIfNeeded(true).catch(() => {});
    expect(w.calls).toHaveLength(1);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(first.through);
  } finally { w.close(); }
});

it('offers the late fact within the recorded 60-filler budget in the first fitting automatic span', async () => {
  const w = world({ end: 6236711, cadence: true });
  try {
    await w.worker.summarizeIfNeeded();
    const history = JSON.parse(w.calls[0]!.context).history as { id: string }[];
    expect(history.some(t => t.id.endsWith(':6236649'))).toBe(true);
    expect(w.journal.view.summaries.at(-1)!.through).toBeGreaterThanOrEqual(6236649);
    expect(w.journal.view.summaries.at(-1)!.text).toContain(fixture.turns.find(t => t.update === 6236649)!.text);
  } finally { w.close(); }
});

it('does not re-ask an UNKNOWN writer outcome', async () => {
  const w = world({ uncertain: true });
  try {
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toHaveLength(1);
    expect(w.journal.view.summaryReservations.has(6236633)).toBe(true);
    expect(w.journal.view.summaryFailures.has(6236633)).toBe(false);
  } finally { w.close(); }
});

it('does not cache an oversized format reminder as a permanent ordinary-packet failure', async () => {
  const w = world({ formatOverflow: true });
  try {
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toHaveLength(1);
    expect(w.journal.view.summaryFailures.get(6236633)).toBe(1);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(first.through);
    w.advance();
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toHaveLength(2);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236633);
  } finally { w.close(); }
});

it.each([
  [false, 'output-cap'], [true, 'output-cap'], [false, 'prose-bound'], [true, 'prose-bound'],
] as const)('continues recovery after a malformed retry fails its bound (forced=%s, bound=%s)', async (force, mixed) => {
  const w = world({ cadence: true, mixed, end: 6236670 });
  try {
    await w.worker.summarizeIfNeeded(force);
    const through = force ? 6236633 : 6236670;
    expect(w.calls.slice(0, 2).map(c => c.id)).toEqual([`summary:${through}`, `summary:${through}`]);
    expect(JSON.parse(w.calls[1]!.context).formatReminder).toContain('defect');
    expect(w.calls.length).toBeGreaterThan(2);
    expect(w.calls.length).toBeLessThanOrEqual(8);
    expect(w.calls.slice(2).every(c => JSON.parse(c.context).formatReminder === undefined)).toBe(true);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(force ? 6236654 : 6236669);
    expect(w.journal.view.summaryFailures.get(through)).toBe(2);
    expect(w.journal.view.summaryReservations.size).toBe(0);
    expect(w.journal.view.order.some(t => t.held === 'summary oversized turn')).toBe(false);
  } finally { w.close(); }
});

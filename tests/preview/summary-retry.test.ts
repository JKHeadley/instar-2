/** Recorded loss must get its bounded revision before the ten-minute pass cooldown. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, SUMMARY_FORMAT,
  type JournalRecord, type SummaryConcept } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import type { PreviewPorts } from './journal.js';
import { interpretSummaryReview } from './summary-check.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/faithfulness-stall-2026-10-25.json', import.meta.url), 'utf8')) as {
  turns: { id: string; update: number; text: string; reply: string; at: number; sentAt: number }[];
  summaries: Extract<JournalRecord, { kind: 'summary' }>[];
  failures: Extract<JournalRecord, { kind: 'summary-failed' }>[];
  models: { id: string; judgment: string; output: string; outcome: string; at: number }[];
};
const rejected = fixture.models.find(row => row.id === 'summary:6236276')!;
const proposal = JSON.parse(rejected.output) as { concepts: SummaryConcept[] };
const review = fixture.models.find(row => row.id === 'summary:6236276:review')!;
const jev = fixture.models.find(row => row.judgment === 'jev-summary-faithfulness' && row.at > rejected.at)!;
const key = new Uint8Array(32).fill(65);
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 2000, maxReplies: 2000, maxTurns: 2000, maxBytes: 409600, cursor: 0 };
const late = 'telegram:8989505249:update:6236272';

function world(options: { terms?: boolean; failure?: boolean; stop?: boolean; maxBytes?: number; endUpdate?: number; maxCalls?: number; recordedReply?: string; repair?: boolean; retryStop?: boolean } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'faithfulness-stall-')));
  const path = join(dir, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { ...genesis, maxBytes: options.maxBytes ?? genesis.maxBytes, maxCalls: options.maxCalls ?? genesis.maxCalls });
  const appendTurn = (turn: typeof fixture.turns[number]) => {
    const { id, update, text, at, reply, sentAt } = turn;
    const raw = JSON.stringify({ update_id: update, message: { text, date: Math.floor(at / 1000),
      chat: { id: Number(genesis.chat), type: 'private' }, from: { id: Number(genesis.operator) } } });
    journal.append({ kind: 'intake', id, update, text, raw, accepted: true, cursor: update + 1, at });
    journal.append({ kind: 'reserve', id, at });
    journal.append({ kind: 'answer', id, text: reply, state: 'complete', at });
    journal.append({ kind: 'intent', id, text: reply, chat: genesis.chat, update, grant: genesis.grant, at });
    journal.append({ kind: 'sent', id, message: update, at: sentAt });
  };
  // The actual 26 facts and 60 filler bodies and delivered replies, without live transport/signatures.
  fixture.turns.filter(turn => turn.update <= (options.endUpdate ?? Infinity)).forEach(turn =>
    appendTurn(turn.id === late && options.recordedReply !== undefined ? { ...turn, reply: options.recordedReply } : turn));
  for (const summary of fixture.summaries) {
    journal.append({ kind: 'summary-reserve', through: summary.through, at: summary.at });
    journal.append(summary);
  }
  if (options.failure !== false) {
    const failed = fixture.failures.find(row => row.through === 6236276)!;
    journal.append({ kind: 'summary-reserve', through: failed.through, at: failed.at - 1 });
    journal.append(failed);
  }
  // Replay the earlier malformed attempts too, so the next span is the recorded 6236276.
  if (options.failure === false) for (const failed of fixture.failures.filter(row => row.through === 6236275)) {
    journal.append({ kind: 'summary-reserve', through: failed.through, at: failed.at - 1 });
    journal.append({ ...failed, format: SUMMARY_FORMAT });
  }
  const offers: string[][] = [], calls: string[] = [], packets: string[] = [];
  let stopped = options.stop ?? false;
  const worker = createJournalWorker(journal, { now: () => 1792937100000, stopped: () => stopped,
    model: async input => {
      calls.push(input.id); packets.push(input.context);
      if (input.id.startsWith('summary:index:')) {
        const backlog = (JSON.parse(input.context) as { indexBacklog: { id: string; message: string }[] }).indexBacklog;
        const sources = backlog.map(row => row.id);
        offers.push(sources);
        // Actual recorded concept terms from the rejected writer, returned through the unchanged index-only shape.
        // Filler terms use the recorded garden-log concepts too; only their source IDs change.
        return JSON.stringify({ concepts: options.terms === false ? [] : sources.map(source =>
          ({ source, terms: proposal.concepts.find(item => item.source === source)?.terms
            ?? (backlog.find(item => item.id === source)?.message === fixture.turns[23]!.text
              ? proposal.concepts[0]!.terms : proposal.concepts.at(-1)!.terms) })) });
      }
      const packet = JSON.parse(input.context) as { summaryRevision?: { reason: string; candidate: string } };
      if (options.repair && packet.summaryRevision) {
        expect(packet.summaryRevision.reason).toBe(JSON.parse(review.output).reason);
        expect(packet.summaryRevision.candidate).toContain('All replies were recorded as Telegram API accepted.');
        return JSON.stringify({ ...JSON.parse(rejected.output), summary: JSON.parse(rejected.output).summary.replace(
          'All replies were recorded as Telegram API accepted.', 'Other replies were recorded as Telegram API accepted; the Albescu reply remains pending, with delivery unknown.') });
      }
      return rejected.output;
    },
    summaryCheck: async () => JSON.parse(jev.output),
    replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('unexpected integrity call'); },
      escalate: async () => { throw Error('offline replay never answers'); },
      summaryReview: async state => {
        const summary = (JSON.parse(state) as { proposed: { summary: string } }).proposed.summary;
        if (summary.includes('the Albescu reply remains pending, with delivery unknown.'))
          return { verdict: 'pass' as const, reason: 'The named unknown delivery outcome is retained.', latencyMs: 1 };
        if (options.retryStop) stopped = true;
        const result = interpretSummaryReview({ state: 'complete', value: review.output }, 1);
        if (result.verdict === 'unsure') throw Error('unexpected unsure');
        return { ...result, verdict: result.verdict };
      } },
    send: async () => { throw Error('offline replay never sends'); }, checkOutbound: () => {} });
  return { journal, worker, calls, packets, offers, appendTurn, path,
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }); } };
}


it('replays rejection then revises with its named loss and commits past the recorded late fact in the same bounded pass', async () => {
  const w = world({ failure: false, endUpdate: 6236276, repair: true });
  try {
    await w.worker.summarizeIfNeeded();
    expect(w.calls.filter(id => !id.startsWith('summary:index:'))).toEqual(['summary:6236276', 'summary:6236276']);
    expect(w.journal.view.summaries.at(-1)?.through, JSON.stringify(w.journal.view.lastSummaryFailure)).toBe(6236276);
    expect(w.journal.view.summaries.at(-1)?.text).toContain('delivery unknown');
    expect(w.journal.view.summaryFailures.get(6236276)).toBe(1);
    // The recorded prior summary already has twenty exact items; the existing overflow path keeps this fact in prose.
    expect(w.journal.view.summaries.at(-1)?.text).toContain('The spare cabin key hangs behind the barometer.');
  } finally { w.close(); }
});

it('refuses the same recorded loss on both attempts and stops rather than looping or committing it', async () => {
  const w = world({ failure: false, endUpdate: 6236276 });
  try {
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toEqual(['summary:6236276', 'summary:6236276']);
    expect(w.journal.view.summaryFailures.get(6236276)).toBe(2);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236271);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe('summary faithfulness: full-context review found loss');
    const before = w.calls.length;
    await w.worker.summarizeIfNeeded();
    expect(w.calls.slice(before).every(id => id.startsWith('summary:index:'))).toBe(true);
  } finally { w.close(); }
});

it('does not revise after stop is raised by the first completed review', async () => {
  const w = world({ failure: false, endUpdate: 6236276, repair: true, retryStop: true });
  try {
    await w.worker.summarizeIfNeeded(true).catch(() => {});
    expect(w.calls).toEqual(['summary:6236276']);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236271);
  } finally { w.close(); }
});

// The snapshot disproves an endless failure latch: its last review began less than one
// cooldown before observation. Frontier ids are conversation positions, not attempt times.
it('replays the recorded attempt timing rather than treating its frontier id as its time', () => {
  const timing = JSON.parse(readFileSync(new URL('./fixtures/summary-retry-timing-2026-10-25.json', import.meta.url), 'utf8')) as {
    observedAt: number; summaryThrough: number; summaryPending: number; summaryStoppedAt: null;
    phases: { id: string; at: number }[]; lastSummaryFaithfulness: { verdict: string; score: number };
  };
  expect(timing.summaryThrough).toBe(6236476);
  expect(timing.summaryPending).toBe(0);
  expect(timing.summaryStoppedAt).toBeNull();
  expect(timing.lastSummaryFaithfulness).toMatchObject({ verdict: 'undecided', score: 0.55 });
  const reviewAt = timing.phases.find(row => row.id === 'summary:6236480:review')!.at;
  expect(timing.observedAt - reviewAt).toBeLessThan(600_000);
});

it('retains the shared spend ceiling before a revision dispatch', async () => {
  const w = world({ failure: false, endUpdate: 6236276, repair: true });
  try {
    w.journal.view.limits.maxCalls = w.journal.view.calls + 3;
    await w.worker.summarizeIfNeeded(true).catch(() => {});
    expect(w.calls).toEqual(['summary:6236276']);
    expect(w.journal.view.calls).toBeLessThanOrEqual(w.journal.view.limits.maxCalls);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236271);
  } finally { w.close(); }
});

const historical = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
  import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
it.each(historical.otherShapes)('revises with recorded $kind ($id) in the retained history', async sample => {
  const w = world({ failure: false, endUpdate: 6236276, repair: true, recordedReply: sample.raw });
  try {
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toEqual(['summary:6236276', 'summary:6236276']);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236276);
    expect(w.journal.view.summaries.at(-1)?.text).toContain('delivery unknown');
  } finally { w.close(); }
});

// Synthetic capacity boundary from the independent review reproduction, using the real
// encrypted journal and launcher envelope. Recorded model shapes are replayed above.
it.each([24576, 32768, 40000])('keeps the remaining attempt reachable after revision fitting at %i bytes', async maxBytes => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'summary-retry-capacity-')));
  const limits = { ...genesis, maxBytes };
  const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, limits);
  let now = 1790000000000;
  const id = `telegram:${genesis.bot}:update:1`;
  const text = 'My workshop code is 7319. ' + 'The garden plan includes tomatoes and herbs. '.repeat(88);
  const reply = 'Noted. ' + 'The garden has tomatoes and herbs along the fence. '.repeat(78);
  journal.append({ kind: 'intake', id, update: 1, text, raw: JSON.stringify({ update_id: 1,
    message: { text, date: 1790000000, chat: { id: Number(genesis.chat), type: 'private' },
      from: { id: Number(genesis.operator) } } }), accepted: true, cursor: 2, at: now });
  journal.append({ kind: 'reserve', id, at: now });
  journal.append({ kind: 'answer', id, text: reply, state: 'complete', at: now });
  journal.append({ kind: 'intent', id, text: reply, chat: genesis.chat, update: 1, grant: genesis.grant, at: now });
  journal.append({ kind: 'sent', id, message: 1, at: now });
  const ceiling = Math.floor(maxBytes * 0.75);
  const prepared: { revision: boolean; bytes: number }[] = [];
  const dispatched: { revision: boolean; bytes: number }[] = [];
  const ports: PreviewPorts = {
    now: () => now, stopped: () => false,
    prepareModel: input => {
      // The smallest case injects an oversized provider envelope to exercise the ordinary cache.
      const envelope = prepareJournalEnvelope(input, 'claude-opus-5-5', genesis.grant, now, maxBytes)
        + (maxBytes === 24576 ? ' '.repeat(maxBytes) : '');
      prepared.push({ revision: !!JSON.parse(input.context).summaryRevision,
        bytes: Buffer.byteLength(envelope) + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT) });
      return envelope;
    },
    model: async input => {
      dispatched.push({ revision: !!JSON.parse(input.context).summaryRevision,
        bytes: Buffer.byteLength(input.prepared!) + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT) });
      return JSON.stringify({ summary: 'The workshop code is 0000. ' + 'The operator discussed garden planning. '.repeat(140),
        people: [], commitments: [], closed: [], memory: [] });
    },
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.5 } } }),
    replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('unexpected integrity call'); },
      escalate: async () => { throw Error('unexpected escalation'); },
      summaryReview: async () => ({ verdict: 'violation', reason: 'The code is wrong. ' + 'Keep the original facts. '.repeat(75), latencyMs: 1 }) },
    send: async () => { throw Error('offline replay never sends'); }, checkOutbound: () => {},
  };
  const worker = createJournalWorker(journal, ports);
  try {
    await worker.summarizeIfNeeded(true);
    if (maxBytes === 24576) {
      // An ordinary packet that cannot fit still gets cached; idle passes do not
      // repeatedly prepare the same impossible envelope or reserve model spend.
      expect(dispatched).toHaveLength(0);
      expect(prepared.length).toBeGreaterThan(0);
      const count = prepared.length;
      now += 700000;
      await worker.summarizeIfNeeded(true);
      expect(prepared).toHaveLength(count);
      expect(dispatched).toHaveLength(0);
      expect(journal.view.summaryFailures.size).toBe(0);
      return;
    }
    expect(dispatched).toHaveLength(maxBytes === 32768 ? 1 : 2);
    const revisions = prepared.filter(item => item.revision);
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions.every(item => item.bytes > ceiling)).toBe(maxBytes === 32768);
    expect(journal.view.summaries).toHaveLength(0);
    now += 700000;
    await worker.summarizeIfNeeded(true);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]!.revision).toBe(maxBytes === 40000);
    expect(dispatched.every(item => item.bytes <= ceiling)).toBe(true);
    expect(journal.view.summaryFailures.get(1)).toBe(2);
    expect(journal.view.summaries).toHaveLength(0);
    now += 700000;
    await worker.summarizeIfNeeded(true);
    expect(dispatched).toHaveLength(2);
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

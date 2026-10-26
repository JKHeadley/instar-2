/** Rule 11: the 06:16 proof-room run must not couple recall to summary acceptance. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, meaningTermsIndex, INDEX_ATTEMPT_LIMIT,
  type JournalRecord, type SummaryConcept } from './journal.js';
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

function world(options: { terms?: boolean; failure?: boolean; stop?: boolean; maxBytes?: number; endUpdate?: number; maxCalls?: number; recordedReply?: string } = {}) {
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
  const offers: string[][] = [], calls: string[] = [];
  const worker = createJournalWorker(journal, { now: () => 1792937100000, stopped: () => options.stop ?? false,
    model: async input => {
      calls.push(input.id);
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
      return rejected.output;
    },
    summaryCheck: async () => JSON.parse(jev.output),
    replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('unexpected integrity call'); },
      escalate: async () => { throw Error('offline replay never answers'); },
      summaryReview: async () => {
        const result = interpretSummaryReview({ state: 'complete', value: review.output }, 1);
        if (result.verdict === 'unsure') throw Error('unexpected unsure');
        return { ...result, verdict: result.verdict };
      } },
    send: async () => { throw Error('offline replay never sends'); }, checkOutbound: () => {} });
  return { journal, worker, calls, offers, appendTurn, path,
    close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }); } };
}

it('indexes the recorded late fact and later messages despite rejected compaction, without committing the rejected summary', async () => {
  // Inject a smaller packet bound so the recorded tail leaves verbatim history; no CPU load.
  const w = world({ maxBytes: 60000 });
  try {
    expect(meaningTermsIndex(w.journal.view).has(late)).toBe(false);
    const before = w.worker.probe('Where is the hiding spot for house access?');
    if (!('context' in before)) throw Error('probe held');
    expect(before.context).not.toContain('The spare cabin key hangs behind the barometer.');
    await w.worker.summarizeIfNeeded();
    expect(w.offers.flat()).toContain(late);
    expect(w.offers).toHaveLength(1);
    expect(meaningTermsIndex(w.journal.view).get(late)).toEqual(proposal.concepts[0]!.terms);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236271);
    const question = w.worker.probe('Where is the hiding spot for house access?');
    if (!('context' in question)) throw Error('probe held');
    expect(JSON.parse(question.context).memorySearch.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'turn 6236272', quote: 'The spare cabin key hangs behind the barometer.' }),
    ]));
    expect(JSON.parse(question.context).history.some((item: { id: string }) => item.id === late)).toBe(false);
    const newer = { ...fixture.turns[23]!, id: 'telegram:8989505249:update:6236335', update: 6236335 };
    w.appendTurn(newer);
    for (let pass = 0; pass < 8; pass++) await w.worker.summarizeIfNeeded();
    expect(w.offers.flat()).toContain(newer.id);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236271);
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(meaningTermsIndex(reopened.view).has(late)).toBe(true);
    reopened.close();
  } finally { w.close(); }
});

it('bounds omissions to the existing two attempts per source', async () => {
  const w = world({ terms: false });
  try {
    for (let pass = 0; pass < 16; pass++) await w.worker.summarizeIfNeeded();
    expect(w.offers.flat().filter(id => id === late)).toHaveLength(INDEX_ATTEMPT_LIMIT);
    expect(meaningTermsIndex(w.journal.view).has(late)).toBe(false);
    expect(w.offers.every(batch => batch.length <= 8 && new Set(batch).size === batch.length)).toBe(true);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236271);
  } finally { w.close(); }
});

it('does not index or call a model past stop', async () => {
  const w = world({ stop: true });
  try {
    await expect(w.worker.summarizeIfNeeded()).resolves.toBeUndefined();
    expect(w.calls).toEqual([]);
    expect(meaningTermsIndex(w.journal.view).has(late)).toBe(false);
  } finally { w.close(); }
});

it('replays the actual undecided Jev and full-context rejection, then indexes without accepting it', async () => {
  const w = world({ failure: false, endUpdate: 6236276 });
  try {
    // These two malformed attempts made 6236276 the next available frontier in the recorded run.
    for (const failed of fixture.failures.filter(row => row.through === 6236275)) {
      w.journal.append({ kind: 'summary-reserve', through: failed.through, at: failed.at - 1 });
      w.journal.append(failed);
    }
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls).toEqual(['summary:6236276', 'summary:6236276']);
    expect(w.journal.view.lastSummaryFailure).toMatchObject({ through: 6236276,
      reason: 'summary faithfulness: full-context review found loss',
      faithfulness: { verdict: 'undecided', score: 0.42 } });
    expect(w.journal.view.summaryChecks.get(6236276)).toEqual(expect.arrayContaining([
      expect.objectContaining({ verdict: 'violation', reason: JSON.parse(review.output).reason }),
    ]));
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236271);
    await w.worker.summarizeIfNeeded();
    expect(w.offers.flat()).toContain(late);
    expect(meaningTermsIndex(w.journal.view).has(late)).toBe(true);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236271);
  } finally { w.close(); }
});

it('does not add index calls for a short healthy tail', async () => {
  const w = world({ failure: false, endUpdate: 6236274 });
  try {
    await w.worker.summarizeIfNeeded();
    expect(w.offers).toEqual([]);
    expect(w.calls).toEqual([]);
  } finally { w.close(); }
});

it('respects the shared call cap even when indexing is owed', async () => {
  const w = world({ maxCalls: fixture.turns.length + fixture.summaries.length + 1 });
  try {
    expect(w.journal.view.calls).toBe(w.journal.view.limits.maxCalls);
    await w.worker.summarizeIfNeeded();
    expect(w.calls).toEqual([]);
    expect(meaningTermsIndex(w.journal.view).has(late)).toBe(false);
  } finally { w.close(); }
});

// These exact older outputs are historical reply data, not new judgments. They exercise
// the new indexing branch with the real writer/uncertain/review/empty-bubble packet shapes.
const historical = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
  import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
it.each(historical.otherShapes)('indexes past rejection with recorded $kind ($id) in history', async sample => {
  const w = world({ recordedReply: sample.raw, maxBytes: 60000 });
  try {
    await w.worker.summarizeIfNeeded();
    expect(w.offers.flat()).toContain(late);
    expect(meaningTermsIndex(w.journal.view).get(late)).toEqual(proposal.concepts[0]!.terms);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(6236271);
    const result = w.worker.probe('Where is the hiding spot for house access?');
    if (!('context' in result)) throw Error('probe held');
    expect(JSON.parse(result.context).memorySearch.items).toContainEqual(expect.objectContaining({
      source: 'turn 6236272', quote: 'The spare cabin key hangs behind the barometer.',
    }));
  } finally { w.close(); }
});

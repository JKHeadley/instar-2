/** S11b/c, train-157: actual indexed terms and ranking inputs, read from the room's
 * journal read-only. Replay never opens that root or contacts a model or Telegram. */
import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bm25, terms } from '../../src/recall/lexical.js';
import { composeRecall } from '../../src/recall/retrieve.js';
import { selectRecall } from './memory-sentinel.js';
import { MEMORY_LOOKUP_INSTRUCTIONS } from './briefing.js';
import { createJournalWorker, LOOKUP_DONE_GUIDANCE, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';
import { genesis, key, sourceId, update } from './recall-rank-room.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/s-recall-meaning-2026-10-25.json', import.meta.url), 'utf8')) as {
  query: string; summary: string; previous: string; now: number;
  candidates: { update: number; text: string; reply: string; cues: string[]; at: number }[];
  questions: { update: number; text: string; answer: string; reason: string; delivered: string }[];
  coverage: { disposition: string; meaningIndexed: number; summarizedMessages: number };
  baseline: { lexical: number[]; scores: unknown[]; composed: number[] }; recordedRecalled: number[];
};
const fact = 6236573;
const candidates = fixture.candidates.map(c => ({ text: `${c.text} ${c.reply}`, cues: c.cues, indexable: true }));

it('reproduces the recorded vocabulary miss over all 24 indexed candidates', () => {
  expect(fixture.coverage).toEqual({ disposition: 'complete', meaningIndexed: 24, summarizedMessages: 24 });
  expect(candidates).toHaveLength(24);
  expect(bm25(terms(fixture.query, 32), candidates.map(c => terms(c.cues.join(' '))))).toEqual([]);
  const lexical = selectRecall({ message: fixture.query, summary: fixture.summary, previous: fixture.previous,
    now: fixture.now, limit: 5, candidates: fixture.candidates.map((c, i) => ({ text: candidates[i]!.text, measurementText: c.text, at: c.at })) });
  expect(lexical.map(i => fixture.candidates[i]!.update)).toEqual(fixture.baseline.lexical);
  const result = composeRecall({ query: fixture.query, lexical, candidates, maxResults: 5, stopped: () => false });
  expect(result.order.map(i => fixture.candidates[i]!.update)).toEqual(fixture.baseline.composed);
  expect(fixture.recordedRecalled).not.toContain(fact);
});

/** Only the 24 original indexed turns are needed. Extra padding creates the recorded
 * summary/recent boundary; it is synthetic and never presented as recorded evidence. */
function room(replyShape?: string) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 's-recall-meaning-')));
  const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
  const rows = [...fixture.candidates, ...Array.from({ length: 44 }, (_, i) => ({
    update: 6236574 + i, text: 'Daily garden observation. '.repeat(100), reply: 'Noted.', cues: [], at: fixture.now - 1000 }))];
  for (const row of rows) {
    const id = sourceId(row.update);
    journal.append({ kind: 'intake', id, update: row.update, text: row.text, raw: JSON.stringify(update(row.update, row.text)),
      accepted: true, cursor: row.update + 1, at: row.at });
    journal.append({ kind: 'reserve', id, at: row.at });
    const reply = row.update === fact && replyShape !== undefined ? replyShape : row.reply;
    journal.append({ kind: 'answer', id, text: reply, at: row.at });
    journal.append({ kind: 'intent', id, text: reply, chat: genesis.chat, update: row.update, grant: genesis.grant, at: row.at });
    journal.append({ kind: 'sent', id, message: row.update, at: row.at });
  }
  for (let i = 0; i < fixture.candidates.length; i += 4) {
    const batch = fixture.candidates.slice(i, i + 4), through = batch.at(-1)!.update;
    journal.append({ kind: 'summary-reserve', through, at: fixture.now });
    journal.append({ kind: 'summary', through, text: fixture.summary,
      concepts: batch.map(c => ({ source: sourceId(c.update), terms: c.cues })), at: fixture.now });
  }
  return { journal, close: () => { journal.close(); rmSync(dir, { recursive: true, force: true }); } };
}

it('offers source lookup even when a summary or saved memory suggests the answer', () => {
  // This condition was false in the recorded answer: the packet already showed the fact.
  expect(fixture.questions[0]!.reason).toContain('Packet memory and the summary');
  expect(MEMORY_LOOKUP_INSTRUCTIONS).toContain('history or recalled');
  expect(MEMORY_LOOKUP_INSTRUCTIONS).toContain('summary or memory');
});

/** The old answer reason already interprets the paraphrase as "spare key" / "cabin".
 * This request is a reconstruction of that recorded interpretation, NOT a captured
 * lookup request or evidence of fresh model compliance with the changed instruction. */
const rewritten = ['spare key', 'cabin'];
type Packet = { capability: string; memoryLookup?: unknown; recalled?: { id: string; user: string }[] };
async function lookupReplay(text: string, words: string[], answer: string, replyShape?: string) {
  const r = room(replyShape), packets: Packet[] = [], envelopes: string[] = [], sent: string[] = [];
  const worker = createJournalWorker(r.journal, { now: () => fixture.now, stopped: () => false,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', genesis.grant, fixture.now, genesis.maxBytes),
    model: async input => {
      packets.push(JSON.parse(input.context) as Packet); envelopes.push(input.prepared!);
      if (packets.length > 2) throw Error('lookup exceeded the two-call budget');
      return packets.length === 1 ? JSON.stringify({ lookup: words }) : answer;
    }, send: async input => { sent.push(input.text); return input.update; }, checkOutbound: () => {} });
  const before = r.journal.view.calls;
  worker.intake([update(6236619, text)]);
  try {
    await worker.drain();
    const turn = r.journal.view.turns.get(sourceId(6236619))!;
    return { packets, envelopes, sent, lookup: turn.lookup, calls: r.journal.view.calls - before };
  } finally { r.close(); }
}

it('retrieves the original with the recorded model interpretation through the existing bounded lookup', async () => {
  for (const word of rewritten) expect(fixture.questions[0]!.reason).toContain(word);
  const r = await lookupReplay(fixture.query, rewritten, fixture.questions[0]!.answer);
  expect(r.packets).toHaveLength(2);
  expect(r.calls).toBe(2);
  expect(r.packets[0]!.memoryLookup).toBe('offered');
  expect(r.packets[0]!.recalled?.map(c => c.id)).not.toContain(sourceId(fact));
  const envelope = JSON.parse(r.envelopes[0]!) as { messages: { role: string; content: string }[] };
  expect(envelope.messages.find(m => m.role === 'instructions')!.content).toContain(MEMORY_LOOKUP_INSTRUCTIONS);
  expect(r.lookup?.found).toContain(sourceId(fact));
  expect(r.packets[1]!.recalled?.find(c => c.id === sourceId(fact))?.user).toBe(fixture.candidates.at(-1)!.text);
  expect(r.packets[1]!.memoryLookup).toMatchObject({ note: LOOKUP_DONE_GUIDANCE });
  expect(r.sent).toEqual([expect.stringContaining(fixture.questions[0]!.answer)]);
});

it('does not match the cabin fact for an unrelated lookup', async () => {
  const r = await lookupReplay('What is the sourdough starter called?', ['sourdough starter'], 'Clint.');
  expect(r.lookup?.found).not.toContain(sourceId(fact));
  expect(r.lookup?.found).toContain(sourceId(6236565));
  expect(r.calls).toBe(2);
});

const historical = JSON.parse(readFileSync(new URL('./fixtures/proofroom2-recallrank-2026-10-02.json', import.meta.url), 'utf8')) as {
  lookupSamples: { samples: { label: string; calls: { raw: string }[] }[] } };
it('replays the captured honest not-found output without inventing an answer', async () => {
  // This response is from the earlier recorded never-said question, not a new response to S11c.
  const sample = historical.lookupSamples.samples.find(s => s.label === 'never-said')!;
  const reading = readAnswer(sample.calls[1]!.raw, { evidence: ['offline:recorded-never-said'] });
  if (!reading.ok) throw Error('recorded answer refused');
  const r = await lookupReplay(fixture.questions[1]!.text, ['sister horse'], reading.value);
  expect(r.lookup?.found).toEqual([]);
  expect(r.sent).toHaveLength(1);
  expect(r.sent[0]).toContain('searched');
  expect(r.sent[0]).toContain("isn't proof");
  expect(r.sent[0]).not.toContain('barometer');
});

const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(shapes.otherShapes)('retains source lookup beside captured $kind ($id)', async sample => {
  // Captured summary/reviewer/empty-reply bytes are historical data here. They must
  // neither become instructions nor cause the source quote to disappear from recall.
  const r = await lookupReplay(fixture.query, rewritten, fixture.questions[0]!.answer, sample.raw);
  expect(r.lookup?.found).toContain(sourceId(fact));
  expect(r.packets[1]!.recalled?.find(c => c.id === sourceId(fact))?.user).toBe(fixture.candidates.at(-1)!.text);
});

it('puts the search-limit duty in the reply, including when index coverage is complete', () => {
  const r = room();
  try {
    const worker = createJournalWorker(r.journal, { now: () => fixture.now, stopped: () => false,
      model: async () => { throw Error('probe never calls'); }, send: async () => { throw Error('probe never sends'); }, checkOutbound: () => {} });
    const probe = worker.probe(fixture.questions[1]!.text);
    if (!('context' in probe)) throw Error(probe.reason);
    const packet = JSON.parse(probe.context) as { capability: string; meaningIndexCoverage: unknown };
    expect(packet.meaningIndexCoverage).toEqual(fixture.coverage);
    // The failure is communication, not an invented answer: the private reason already knew the limit.
    expect(fixture.questions[1]!.reason).toContain("A missed search doesn't prove you never said it");
    expect(fixture.questions[1]!.delivered).not.toContain("doesn't prove");
    expect(packet.capability).toContain('In your reply');
    expect(packet.capability).toContain('search may have missed');
  } finally { r.close(); }
});

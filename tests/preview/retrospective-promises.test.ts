import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, retrospectiveCases, dueObligationWork, type JournalRecord } from './journal.js';
import { GRAVITY_WELLS, owedCases, retrospectivePlan, validateRetrospective, RETRO_STALE_CASE_MS, type RetroCase } from './retrospective.js';
import { recordedPromises, reconcilePromises } from './agent-commitment.js';
import { openLoops } from './obligations.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/summary-ack-walk-2026-10-15.json', import.meta.url), 'utf8')) as { rows: JournalRecord[] };
const other = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[];
};
const tomato = JSON.parse(readFileSync(new URL('./fixtures/promise-fulfilment-a5b-2026-10-03.json', import.meta.url), 'utf8')) as {
  turns: { update: number; message: string; answer: string; sent: string }[];
};
const key = new Uint8Array(32).fill(41), digest = 'sha256:promise-replay';
const source = 'telegram:8968100844:update:840342898';
const quote = "I'll fold that time into the note.";
// These are explicit test review judgments over recorded bytes, not newly captured model verdicts.
// The desk's live conversation remains the semantic acceptance test for the revised prompt.
const review = (cases: readonly RetroCase[], proposals: Record<string, unknown[]> = {}) => ({
  inspected: cases.map(item => item.id), omitted: [], uninspected: [], wells: GRAVITY_WELLS.map(() => 0),
  eff: 'Review the existing recorded replies once.', findings: [],
  feedback: cases.filter(item => item.meta?.correction !== undefined).map(item => ({ case: item.id,
    classification: 'Recorded correction', disposition: 'declined-with-reason', reason: 'Already reflected in the delivered correction.' })),
  closures: [], comparisons: [],
  authorizations: cases.filter(item => item.category === 'authorization').map(item => ({ case: item.id, candidate: false, recurrences: [] })),
  grades: cases.filter(item => item.category === 'decision' || item.category === 'verdict').map(item => ({
    case: item.id, promises: proposals[item.id] ?? [], conclusion: { assessment: 'unverifiable', evidence: [] },
    reason: { assessment: item.reason ? 'unverifiable' : 'not-applicable', evidence: [] },
    outcome: { assessment: 'unverifiable', reason: 'No later result yet.', evidence: [] }, observations: [],
  })),
});
function world() {
  const root = mkdtempSync(join(tmpdir(), 'reconcile-promises-')), path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, capture.rows[0] as Extract<JournalRecord, { kind: 'genesis' }>);
  // Exact durable conversation through the omitted, undated promise; no new user turn after it.
  for (const row of capture.rows.slice(1)) {
    if (['caps', 'intake', 'reserve', 'answer', 'intent', 'sent', 'coherence'].includes(row.kind)) journal.append(row);
    if (row.kind === 'sent' && row.id === source) break;
  }
  let now = journal.view.turns.get(source)!.at + RETRO_STALE_CASE_MS;
  const calls: string[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => { calls.push(input.id); expect(input.id).toMatch(/^obligation:/u);
      expect(input.context).toContain(quote);
      return JSON.stringify({ outcome: 'report', report: 'Invitation draft: Please join us Saturday at 10 for tea. Kids welcome.' }); },
    retrospect: async state => {
      const packet = JSON.parse(state) as { cases: RetroCase[] };
      return { state: 'complete', value: JSON.stringify(review(packet.cases, { [`answer:${source}`]: [{ quote }] })) };
    }, send: async () => { throw Error('reconciliation grants no unsolicited send'); }, checkOutbound: () => {} });
  return { root, path, journal, worker, calls, advance: () => { now += RETRO_STALE_CASE_MS; }, now: () => now,
    done: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it('replays the actually omitted casual promise 840342898 into one durable task and acts without another prompt', async () => {
  const w = world();
  try {
    expect(w.journal.view.commitments.some(note => note.source === source)).toBe(false);
    const turns = w.journal.view.order.length;
    for (let pass = 0; pass < 20 && !w.journal.view.commitments.some(note => note.source === source); pass++) {
      await w.worker.retrospect(digest); w.advance();
    }
    const id = w.journal.view.commitments.findIndex(note => note.source === source);
    expect(id, JSON.stringify(w.journal.view.retroPasses.map(p => ({state:p.state,reason:p.reason,cases:p.cases,omitted:p.result?.omitted})))).toBeGreaterThanOrEqual(0);
    expect(openLoops(w.journal.view, w.now()).find(item => item.id === `commitment:${id}`))
      .toMatchObject({ owner: 'agent', waitsOn: 'nothing', revisitDue: true });
    expect(dueObligationWork(w.journal.view, w.now()).some(item => item.id === id)).toBe(true);
    expect(await w.worker.workObligations()).toBe(true);
    expect(w.calls).toHaveLength(1);
    expect(w.journal.view.obligationWork[`commitment:${id}`]?.outcome).toBe('report');
    expect(w.journal.view.order).toHaveLength(turns);
    expect(await w.worker.workObligations()).toBe(false);
    const before = JSON.stringify(w.journal.view.commitments);
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(JSON.stringify(reopened.view.commitments)).toBe(before);
    expect(reopened.view.obligationWork[`commitment:${id}`]?.outcome).toBe('report');
    reopened.close();
  } finally { w.done(); }
});

it('admits an already captured undated real promise once, preserving scheduled, closed and dated neighbors', () => {
  const turn = tomato.turns[0]!;
  const promises = recordedPromises([{ quote: turn.answer }], turn.sent, 'tomato', 1790000000000, 'UTC');
  const notes = [{ in: 'reply' as const, source: 'tomato', quote: turn.answer, agentPromise: promises[0]! }];
  reconcilePromises(notes, new Map(), promises, turn.sent, 'tomato', () => true);
  expect(notes).toMatchObject([{ owner: 'agent', waitsOn: 'nothing' }]);
  reconcilePromises(notes, new Map(), promises, turn.sent, 'restatement', () => true);
  expect(notes).toHaveLength(1);
  const closed = [{ in: 'reply' as const, source: 'tomato', quote: turn.answer, agentPromise: promises[0]! }];
  reconcilePromises(closed, new Map([[0, {}]]), promises, turn.sent, 'tomato', () => true);
  expect(closed[0]).not.toHaveProperty('waitsOn');
  const scheduled = [{ ...notes[0]!, waitsOn: 'operator' as const }];
  reconcilePromises(scheduled, new Map(), promises, turn.sent, 'tomato', () => true);
  expect(scheduled[0]!.waitsOn).toBe('operator');
  const datedReply = 'I will send the note on 2026-10-20.';
  const dated = recordedPromises([{ quote: datedReply, when: '2026-10-20' }], datedReply, 'dated', 1790000000000, 'UTC');
  const datedNotes = [{ in: 'reply' as const, source: 'dated', quote: datedReply, agentPromise: dated[0]! }];
  reconcilePromises(datedNotes, new Map(), dated, datedReply, 'dated', () => true);
  expect(datedNotes[0]).not.toHaveProperty('waitsOn');
  expect(datedNotes[0]!.agentPromise.due?.day).toBe('2026-10-20');
  reconcilePromises(notes, new Map(), promises, turn.sent, 'different-room', () => false);
  expect(notes).toHaveLength(2);

});

it('requires delivered evidence and keeps missing or malformed reconciliation owed', () => {
  const w = world();
  try {
    const turn = w.journal.view.turns.get(source)!;
    const actual = retrospectiveCases(w.journal.view).find(item => item.id === `answer:${source}`)!;
    expect(actual.deliveredReply).toBe(turn.intent);
    const plan = { cases: [actual] };
    const valid = review(plan.cases, { [actual.id]: [{ quote }] });
    expect(validateRetrospective(valid, plan, w.journal.view, 0).grades[0]!.promises).toHaveLength(1);
    const missing = structuredClone(valid); delete (missing.grades[0] as { promises?: unknown }).promises;
    expect(validateRetrospective(missing, plan, w.journal.view, 0).omitted[0]?.reason).toContain('promise reconciliation');
    const malformed = review(plan.cases, { [actual.id]: [{ quote: 'invented future task' }] });
    expect(validateRetrospective(malformed, plan, w.journal.view, 0).omitted).toHaveLength(1);
    for (const change of [{ intent: '' }, { sent: undefined }, { modelState: 'uncertain' },
      { replyParts: [{ sent: undefined }] }]) {
      const saved = { ...turn }; Object.assign(turn, change);
      const candidate = retrospectiveCases(w.journal.view).find(item => item.id === actual.id)!;
      expect(candidate.deliveredReply).toBeUndefined();
      expect(validateRetrospective(valid, { cases: [candidate] }, w.journal.view, 0).grades).toEqual([]);
      Object.assign(turn, saved); delete turn.replyParts;
    }
  } finally { w.done(); }
});

it('replays recorded uncertain summaries, Jev undecided/unsure, review output and empty bubbles as non-evidence', () => {
  const w = world();
  try {
    const turn = w.journal.view.turns.get(source)!;
    for (const shape of other.otherShapes) {
      const candidate: RetroCase = { id: `repair:${shape.kind}:${shape.id}`, category: 'repair', at: turn.at, seq: 0, text: shape.raw };
      const result = validateRetrospective(review([candidate]), { cases: [candidate] }, w.journal.view, 0);
      expect(result.grades.flatMap(item => item.promises ?? [])).toEqual([]);
      // Even a review proposing text from one of these records cannot make it delivered evidence.
      const decision = { ...candidate, id: `answer:${shape.id}`, category: 'decision' as const };
      const injected = review([decision], { [decision.id]: [{ quote: shape.raw.slice(0, 50) || quote }] });
      expect(validateRetrospective(injected, { cases: [decision] }, w.journal.view, 0).grades).toEqual([]);
    }
    const empty = other.otherShapes.find(item => item.kind === 'empty-reply-in-recorded-context')!;
    expect(empty.raw).toBe('');
    Object.assign(turn, { answer: empty.raw, intent: empty.raw });
    expect(retrospectiveCases(w.journal.view).find(item => item.id === `answer:${source}`)?.deliveredReply).toBeUndefined();
  } finally { w.done(); }
});

it('presents existing commitments for semantic deduplication and accepts no-work judgments for neighboring meanings', () => {
  const w = world();
  try {
    const turn = w.journal.view.turns.get(source)!;
    const recordedQuote = capture.rows.find(row => row.kind === 'intent' && row.id.endsWith('840342917')) as Extract<JournalRecord, { kind: 'intent' }>;
    const neighbors = [recordedQuote.text, 'If I said “I will write the note”, that would be a hypothetical.',
      'I cannot book your appointment.', 'You will write the note.', 'I still owe you that same invitation draft.'];
    w.journal.view.commitments.push({ in: 'reply', source, quote, owner: 'agent', waitsOn: 'nothing' });
    for (const text of neighbors) {
      Object.assign(turn, { answer: text, intent: text });
      const population = retrospectiveCases(w.journal.view);
      const plan = retrospectivePlan(w.journal.view, population, w.now(), digest)!;
      expect(JSON.parse(plan.state).commitments).toEqual(expect.arrayContaining([expect.objectContaining({ quote })]));
      const candidate = population.find(item => item.id === `answer:${source}`)!;
      const result = validateRetrospective(review([candidate]), { cases: [candidate] }, w.journal.view, 0);
      expect(result.grades[0]!.promises).toEqual([]);
      expect(w.journal.view.commitments.filter(note => note.source === source)).toHaveLength(1);
    }
  } finally { w.done(); }
});

it('revisits legacy delivered-answer grades once, then retains the recorded inspection', () => {
  const w = world();
  try {
    const candidate = retrospectiveCases(w.journal.view).find(item => item.id === `answer:${source}`)!;
    const result = validateRetrospective(review([candidate]), { cases: [candidate] }, w.journal.view, 0);
    delete result.grades[0]!.promises; // Exact legacy grade shape: no promise-reconciliation field.
    w.journal.view.retroPasses.push({ pass: 0, at: w.now(), turnsSeen: w.journal.view.order.length,
      cases: [candidate.id], omitted: [], eligible: 1, packetSha256: 'sha256:legacy', contextDigest: digest,
      state: 'complete', result });
    expect(owedCases(w.journal.view, [candidate], w.now()).map(row => row.item.id)).toEqual([candidate.id]);
    result.grades[0]!.promises = [];
    expect(owedCases(w.journal.view, [candidate], w.now())).toEqual([]);
  } finally { w.done(); }
});

import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { REPLY_RULES } from './reply-check.js';
import { replyReviewContext, replyReviewQuestion } from './reply-check.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const key = new Uint8Array(32).fill(73);
const now = 1790520000000;
const earlyFacts = [
  'The cedar studio door is painted ultramarine.',
  'The autumn meeting place is the Willow Room.',
  'The archive shelf holds 37 folders.',
];
const scores = { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(REPLY_RULES)
  .map(id => [id, { type: 'noul', noul: 0.01 }])) };

it('uses review headroom only when a full-context reply check is installed', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-headroom-')));
  try {
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:offline',
      configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 30,
      maxTurns: 30, maxBytes: 32768, cursor: 0 });
    for (let turn = 1; turn <= 18; turn++) {
      const text = `Turn ${turn}: ${'field notes '.repeat(100)}`;
      journal.append({ kind: 'intake', id: `telegram:12345678:update:${turn}`, update: turn,
        text, raw: JSON.stringify({ message: { from: { id: 7654321 }, date: Math.floor(now / 1000), text } }),
        accepted: true, cursor: turn + 1, at: now });
    }
    journal.append({ kind: 'summary-reserve', through: 18, at: now });
    journal.append({ kind: 'summary', through: 18, text: 'The operator discussed field notes.', at: now });
    const base = { now: () => now, stopped: () => false, model: async () => 'I hear you.',
      send: async () => 1, checkOutbound: () => {},
      prepareModel: (input: { question: string; context: string; id: string }) =>
        prepareJournalEnvelope(input, 'claude-offline', 'grant:offline', now, journal.view.limits.maxBytes) };
    const plain = createJournalWorker(journal, base).probe('What did we discuss?');
    const checked = createJournalWorker(journal, { ...base, replyCheck: {
      elapsedMs: () => 0, jev: async () => ({ value: scores, latencyMs: 1 }),
      escalate: async () => ({ verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 1 }) } })
      .probe('What did we discuss?');
    if ('reason' in plain || 'reason' in checked) throw Error('probe did not fit');
    expect(JSON.parse(plain.context).historyMode).toBe('complete');
    expect(JSON.parse(checked.context).historyMode).toBe('summary-plus-recent');
    expect(Buffer.byteLength(checked.prepared!)).toBeLessThan(Buffer.byteLength(plain.prepared!));
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('answers 200 mixed-length turns in one day with bounded review context and early recall', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-long-conversation-')));
  try {
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:offline',
      configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 600, maxReplies: 200,
      maxTurns: 200, maxBytes: 32768, cursor: 0 });
    let sends = 0, firstHeld = 0, compactPackets = 0, recallCount = 0;
    const answerBytes: number[] = [], reviewBytes: number[] = [];
    const worker = createJournalWorker(journal, {
      now: () => now, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-offline', 'grant:offline', now, journal.view.limits.maxBytes),
      model: async input => {
        if (input.id.startsWith('summary:')) {
          const packet = JSON.parse(input.context);
          const visible = JSON.stringify(packet);
          return JSON.stringify({ summary: `${earlyFacts.filter(fact => visible.includes(fact)).join(' ')} Recent conversation covered through ${input.id}.`.trim(),
            people: [], commitments: [] });
        }
        answerBytes.push(Buffer.byteLength(input.context));
        if (JSON.parse(input.context).historyMode === 'summary-plus-recent') compactPackets++;
        if (input.question.includes('early facts')) {
          recallCount = earlyFacts.filter(fact => input.context.includes(fact)).length;
          return earlyFacts.filter(fact => input.context.includes(fact)).join(' ');
        }
        return Number(input.id.split(':').at(-1)) % 10 === 0
          ? `I hear you. ${'Details noted. '.repeat(115)}` : 'I hear you.';
      },
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      replyCheck: { elapsedMs: () => 0, jev: async (state, questions) => ({ value: questions
        ? { model: 'jev-1.13.0', answers: { summary_integrity: { type: 'noul', noul: 0.01 } } }
        : state.includes('I hear you.') ? { ...scores, answers: { ...scores.answers,
          parks_on_user: { type: 'noul', noul: 0.5 } } } : scores, latencyMs: 1 }),
        escalate: async (candidate, id, prompt) => { const prepared = prepareJournalEnvelope({
          question: replyReviewQuestion([]), context: replyReviewContext(prompt!, candidate), id: `${id}:reply-review`,
        }, 'claude-offline', 'grant:offline', now, journal.view.limits.maxBytes);
          reviewBytes.push(Buffer.byteLength(prepared));
          return { verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 1 }; } },
      send: async () => ++sends, checkOutbound: () => {} });
    for (let turn = 1; turn <= 200; turn++) {
      const text = turn <= earlyFacts.length ? earlyFacts[turn - 1]! : turn === 200 ? 'Please recall the three early facts.'
        : `Day conversation turn ${turn}: routine discussion. ${'field notes '.repeat(turn % 5 === 0 ? 125 : turn % 3 === 0 ? 18 : 2)}`;
      worker.intake([{ update_id: turn, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, date: Math.floor(now / 1000) + turn * 60, text } }]);
      await worker.drain();
      if (!firstHeld && journal.view.order.at(-1)?.held) firstHeld = turn;
    }
    console.log('long conversation', { turns: 200, sends, firstHeld, summaries: journal.view.summaries.length,
      compactPackets, reviews: reviewBytes.length, recall: `${recallCount}/3`,
      maxAnswerBytes: Math.max(...answerBytes), maxReviewBytes: Math.max(...reviewBytes) });
    expect({ firstHeld, sends, recallCount }).toEqual({ firstHeld: 0, sends: 200, recallCount: 3 });
    expect(compactPackets).toBeGreaterThan(0);
    expect(reviewBytes.length).toBeGreaterThan(100);
    for (const fact of earlyFacts) expect(journal.view.order.at(-1)?.intent).toContain(fact);
    expect(Math.max(...answerBytes)).toBeLessThanOrEqual(32768);
    expect(Math.max(...reviewBytes)).toBeLessThanOrEqual(32768);
    expect(journal.view.summaries.length).toBeGreaterThan(0);
    expect(journal.view.order.filter(turn => turn.sent !== undefined)).toHaveLength(200);
    journal.close();
    const reopened = openPreviewJournal(path, key);
    expect(reopened.view.order).toHaveLength(200);
    expect(reopened.view.order.filter(turn => turn.sent !== undefined)).toHaveLength(200);
    expect(reopened.view.summaries.at(-1)?.text).toContain(earlyFacts[0]);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

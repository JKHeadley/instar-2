import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MEMORY_UNDECIDED_REPLY, openPreviewJournal } from './journal-test-worker.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { conclusionText, parseModelJson } from './model-json.js';

// Live proof room 2026-09-30, cint-L13 72fb5a82, update 715672853 (Rules 2, 78, 84, 85). The operator asked "What can
// you do in this chat, and what can't you do?". The real model (claude-sonnet-5) answered, and also added a prefer item
// sourced to this turn whose quote, "Replies to two sentences, as requested.", is a clause of its own reply and not of
// the operator's message. The validator refused the whole decision, the turn was held for a summary judgment, that
// judgment could not run, and the operator got only "I couldn't record that memory change". The operator text and the
// recorded model outputs of 715672779 (the preference) and 715672853 are replayed verbatim below.
type ModelUsage = { inputTokens: number | null; outputTokens: number | null; charge: null };
type Recorded = { update: number; text: string; answerOutput: string; answerUsage: ModelUsage; recordedUndecided?: string; recordedSent: string };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/proofroom-memory-misfire-715672853-2026-09-30.json', import.meta.url), 'utf8')) as {
  genesis: { bot: string; chat: string; operator: string; grant: string; configurationDigest: string }; turns: Recorded[] };
const [PREFERENCE, QUESTION] = fixture.turns as [Recorded, Recorded];
const NOTHING_SAVED = 'No memory or preference change was saved from this message. If you meant to change one, please say it again.';

const key = new Uint8Array(32).fill(61);
const genesis = { kind: 'genesis' as const, ...fixture.genesis, expires: 9999999999999,
  maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: Number(fixture.genesis.chat), type: 'private' }, from: { id: Number(fixture.genesis.operator) }, text,
    date: 1790826000 + (id - PREFERENCE.update) * 60 } });

/** What the live subscription port hands the worker for a complete result (journal-agent invokeSubscription). */
function livePort(raw: string, usage: ModelUsage = QUESTION.answerUsage) {
  const extracted = parseModelJson(raw), decision = extracted.ok ? extracted.value as { type?: unknown; floor?: unknown;
    conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete' as const, failureClass: 'malformed' as const, usage } : { state: 'complete' as const, value, text: value, usage };
}
const recordedReply = (raw: string) => (JSON.parse(livePort(raw).text!) as { reply: string }).reply;

/** The preference turn, then `second` answered with the recorded 715672853 decision; the summary judgment never decides. */
async function replay(second: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-own-reply-echo-')));
  const sends: string[] = [];
  try {
    const ports = { now: () => 1790831527064, stopped: () => false,
      model: async (input: { id: string; question: string }) => {
        if (input.id.startsWith('summary:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
        return input.question === PREFERENCE.text ? livePort(PREFERENCE.answerOutput, PREFERENCE.answerUsage) : livePort(QUESTION.answerOutput);
      }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(PREFERENCE.update, PREFERENCE.text)]); await worker.drain();
    const memoryBefore = JSON.stringify(journal.view.memory);
    worker.intake([update(QUESTION.update, second)]);
    for (let pass = 0; pass < 4; pass++) await worker.drain();
    const result = { sends: [...sends], turn: { ...journal.view.order[1]! }, memoryBefore, memoryAfter: JSON.stringify(journal.view.memory),
      preferences: journal.view.memory.filter(item => item.mode === 'prefer').map(item => item.quote) };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('the recorded rows are the live misfire: an own-reply prefer quote, then the undecided notice', () => {
  const decided = JSON.parse(livePort(QUESTION.answerOutput).text!) as { reply: string; memory: { mode: string; source: string; quote: string }[] };
  expect(decided.memory).toEqual([{ mode: 'prefer', source: `telegram:${fixture.genesis.bot}:update:${QUESTION.update}`,
    quote: 'Replies to two sentences, as requested.' }]);
  expect(decided.reply).toContain(decided.memory[0]!.quote);
  expect(QUESTION.text).not.toContain(decided.memory[0]!.quote);
  expect(QUESTION.recordedUndecided).toBe('summary-failed');
  expect(QUESTION.recordedSent).toBe(MEMORY_UNDECIDED_REPLY);
});

it('answers the plain question (715672853) and saves nothing when the decision echoes its own reply as a preference', async () => {
  const result = await replay(QUESTION.text);
  expect(result.preferences).toEqual([PREFERENCE.text]);
  expect(result.sends).toHaveLength(2);
  expect(result.sends[1]).toContain(recordedReply(QUESTION.answerOutput));
  expect(result.sends[1]).toContain(NOTHING_SAVED);
  expect(result.sends[1]).not.toContain(MEMORY_UNDECIDED_REPLY);
  expect(result.turn.held).toBeUndefined();
  expect(result.turn.memoryPending).toBeUndefined();
  expect(result.turn.memoryUndecided).toBeUndefined();
  expect(result.memoryAfter).toBe(result.memoryBefore);
}, 15000);

// Other side of the boundary (Rules 10, 85): an equivalent change asked without a keyword cue is not sent as a silent
// success. The same echo is set aside, nothing is saved, and the reply says so and asks again.
it('never lets the echo pass as a saved change on an uncued request', async () => {
  const result = await replay('Could you keep your answers to two sentences?');
  expect(result.sends[1]).toContain(NOTHING_SAVED);
  expect(result.memoryAfter).toBe(result.memoryBefore);
}, 15000);

// A direct (cued) memory request whose decision cannot be recorded still gets the honest failure text, never the answer.
it('still gives the honest failure text for a cued request carrying the same echo', async () => {
  const result = await replay('Please keep your replies to two sentences.');
  expect(result.turn.memoryPending).toBe(true);
  expect(result.sends.some(text => text.includes(recordedReply(QUESTION.answerOutput)))).toBe(false);
  expect(result.sends.slice(1).length).toBeGreaterThan(0);
  expect(result.sends.slice(1).every(text => text.includes(MEMORY_UNDECIDED_REPLY))).toBe(true);
  expect(result.memoryAfter).toBe(result.memoryBefore);
}, 15000);

// The set-aside is narrow: an invented clause that is in neither the message nor the reply is still refused.
it('still refuses an uncued prefer item that quotes neither the message nor the reply', async () => {
  const altered = QUESTION.answerOutput.replace('"quote":"Replies to two sentences, as requested."', '"quote":"Always answer me in French, please."');
  expect(altered).not.toBe(QUESTION.answerOutput);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-own-reply-echo-')));
  const sends: string[] = [];
  try {
    const ports = { now: () => 1790831527064, stopped: () => false,
      model: async (input: { id: string; question: string }) => input.id.startsWith('summary:')
        ? { state: 'complete' as const, failureClass: 'malformed' as const } : livePort(altered),
      send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(QUESTION.update, QUESTION.text)]);
    for (let pass = 0; pass < 4; pass++) await worker.drain();
    expect(journal.view.order[0]!.memoryPending).toBe(true);
    expect(sends.some(text => text.includes(recordedReply(QUESTION.answerOutput)))).toBe(false);
    expect(journal.view.memory).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 15000);

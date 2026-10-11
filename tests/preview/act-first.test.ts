import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { READ_BEFORE_ANSWER } from '../../src/assembly/tool-answer-guidance.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT,
  SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { CODEX_CONVERSATION_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-codex-provider.js';
import { ANSWER_INSTRUCTIONS, MEMORY_LOOKUP_INSTRUCTIONS } from './briefing.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';
import { parseReplyReviewVerdict, substantiveReply, guidanceReviewRules, replyReviewQuestion } from './reply-check.js';
// @ts-expect-error Physical tool trace reader stays outside the pure core.
import { toolTrace } from './tool-admission.mjs';

type Capture = { name: string; raw: string; answer: string | null; admission: string; system: string; question: string };
const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/act-first-2026-10-10.json', import.meta.url), 'utf8')) as {
  original: { update: number; answer: string; toolAttempts: unknown[]; review: { verdict: string } };
  runs: Capture[]; formatFailure: Capture;
};
const decode = (run: Capture) => {
  const reading = readAnswer(JSON.parse(run.raw).result, { wrapped: 'accept' });
  expect(reading.ok, run.name).toBe(true);
  if (!reading.ok) throw Error(reading.defect);
  expect(reading.value).toBe(run.answer);
  return reading.value;
};

it('delivers the same read guidance on all tool routes without claiming tools on text-only routes', () => {
  for (const prompt of [SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT])
    expect(prompt.split(READ_BEFORE_ANSWER)).toHaveLength(2);
  for (const prompt of [SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, CODEX_CONVERSATION_SYSTEM_PROMPT])
    expect(prompt).not.toContain(READ_BEFORE_ANSWER);
});

it('offers the memory lookup protocol exactly when available, equally before and after compaction', () => {
  for (const continuity of [undefined, { through: 3, lastInbound: 'earlier question' }]) {
    for (const memoryLookup of [undefined, 'offered', { searched: ['earlier words'], found: 0 }]) {
      const envelope = JSON.parse(prepareJournalEnvelope({ question: 'A question', id: 'telegram:1:update:4',
        context: JSON.stringify({ history: [], continuity, memoryLookup }) }, 'claude-sonnet-5', 'grant:test', 1));
      const instructions = envelope.messages.find((message: { role: string }) => message.role === 'instructions').content;
      expect(instructions).toBe(memoryLookup === 'offered' ? `${ANSWER_INSTRUCTIONS}\n${MEMORY_LOOKUP_INSTRUCTIONS}` : ANSWER_INSTRUCTIONS);
      expect(instructions.includes('{"lookup":')).toBe(memoryLookup === 'offered');
    }
  }
});

it('replays real web calls and cited answers for the recorded comparison and a plain lookup', () => {
  const captured = fixture();
  expect(captured.original.update).toBe(969390343);
  expect(captured.original.toolAttempts).toEqual([]);
  expect(captured.original.review.verdict).toBe('pass'); // the original false-clear is retained as evidence
  for (const name of ['compare', 'plain-read']) {
    const run = captured.runs.find(item => item.name === name)!;
    expect(run.system).toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT); // prompt changes require a new real sample
    const text = decode(run);
    const trace = toolTrace(run.admission.trim().split('\n'));
    expect(trace.consistent).toBe(true);
    expect(trace.calls.some((call: { tool: string; decision: string; result: string | null }) =>
      ['WebSearch', 'WebFetch'].includes(call.tool) && call.decision === 'allow' && call.result !== null)).toBe(true);
    expect(text).toMatch(/https:\/\//u);
    expect(text).not.toMatch(/if you want.{0,40}(search|look)|shall I (search|look)|just say so/iu);
  }
});

it('replays a real failed lookup without inventing the missing report', () => {
  const run = fixture().runs.find(item => item.name === 'failed-read')!;
  expect(run.system).toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT);
  const text = decode(run);
  const trace = toolTrace(run.admission.trim().split('\n'));
  expect(trace.calls.some((call: { tool: string }) => ['WebFetch', 'Bash'].includes(call.tool))).toBe(true);
  expect(text).toMatch(/tried|attempt|fetch|reach|access/iu);
  expect(text).toMatch(/couldn.t|cannot|can.t|fail|unable|no report|did not/iu);
});

it('replays the real reviewer on both the unperformed lookup and actual read outcomes', () => {
  for (const name of ['original', 'compare', 'failed-read']) {
    const run = fixture().runs.find(item => item.name === name + '-review')!;
    const selected = guidanceReviewRules(['parks_on_user', 'defers_work', 'unrecorded_blocker'], name !== 'failed-read');
    expect(run.question).toBe(replyReviewQuestion(selected)); // wording changes require a fresh reviewer capture
    expect(parseReplyReviewVerdict(decode(run), selected).findings?.find(row => row.rule === 'parks_on_user')?.verdict)
      .toBe(name === 'original' ? 'violation' : 'pass');
  }
});

it('retains a real post-search malformed answer as a refusal, never a usable answer', () => {
  const run = fixture().formatFailure;
  expect(run.system).toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT);
  expect(readAnswer(JSON.parse(run.raw).result, { wrapped: 'accept' }).ok).toBe(false);
  expect(run.answer).toBeNull();
  expect(toolTrace(run.admission.trim().split('\n')).calls.some((call: { tool: string }) => call.tool === 'WebSearch')).toBe(true);
});

it('keeps recorded summary, uncertain/undecided review, and delivered/empty reply shapes distinct', () => {
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
    otherShapes: { kind: string; id: string; raw: string }[] };
  expect(recorded.otherShapes.map(row => row.id)).toEqual(['summary:715672480', '715672483', '715672482', '969389570',
    '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const row of recorded.otherShapes) {
    const reading = readAnswer(row.raw, { wrapped: 'refuse', evidence: [row.id] });
    if (row.kind === 'summary-writer') {
      expect(reading.ok && JSON.parse(reading.value).memoryItems[0].quote).toBe('my test marker is probe-5f1ba73c');
    } else if (row.kind === 'reply-review') {
      expect(reading.ok && parseReplyReviewVerdict(reading.value).ruleIds).toEqual(['breaks_preference']);
    } else if (row.kind === 'summary-uncertain' || row.kind.startsWith('jev-')) {
      const value = JSON.parse(row.raw);
      expect(value.state ?? value.verdict).toBe(row.kind === 'summary-uncertain' ? 'uncertain' : row.kind === 'jev-undecided' ? 'undecided' : 'unsure');
      expect(() => parseReplyReviewVerdict(reading.ok ? reading.value : row.raw)).toThrow();
    } else expect(substantiveReply(row.raw)).toBe(row.kind === 'delivered-reply');
  }
});

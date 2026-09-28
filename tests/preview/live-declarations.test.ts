// Live-failure repair, 2026-09-28 (observer note 44): four live Telegram tests with the real model failed
// although the offline suite passed, because the offline stubs always emitted the declarations. The fixture holds
// the REAL model bytes for those four turns, replayed through the pinned CLI with their exact recorded prompts:
// `current` under the frozen18 system prompt (the live failure), `fixed` under this change's prompt.
// Rules 2, 10, 20, 21, 23, 86, 93, 99, 103.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openBlockers, openDirectives, OBLIGATION_DECISION,
  PREVIEW_CAPABILITIES } from './journal-test-worker.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { parseReplyReviewVerdict, REPLY_REVIEW_REASON_ASK, REPLY_REVIEW_REASON_MAX, replyReviewQuestion } from './reply-check.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/live-declarations-2026-09-28.json', import.meta.url), 'utf8')) as {
  operatorMessages: string[]; current: { answers: string[]; reviews: string[] };
  fixed: { answers: string[]; reviews: string[] }; fixedResidualProse: string };
/** Exactly what the runner's invokeSubscription hands the worker, or null where it records `malformed`. */
const runnerText = (raw: string): string | null => {
  const parsed = parseModelJson(raw);
  if (!parsed.ok) return null;
  const decision = parsed.value as { type?: unknown; conclusion?: { subject?: unknown; value?: unknown } };
  return decision.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    ? conclusionText(decision.conclusion.value) : null;
};
const conclusionOf = (raw: string) => (parseModelJson(raw) as { value: { conclusion: { value: unknown } } }).value.conclusion.value;

it('keeps refusing prose around a Decision, and the fixed prompt yields bare Decisions for every live turn', () => {
  // Live answer 4 and three live reviews wrote reasoning before the object: a contrary judgment could live there.
  expect(parseModelJson(fixture.current.answers[3]!)).toMatchObject({ ok: false });
  expect(runnerText(fixture.current.answers[3]!)).toBeNull();
  for (const review of fixture.current.reviews.slice(1)) expect(parseModelJson(review)).toMatchObject({ ok: false, shape: 'prose-wrapped' });
  expect(runnerText(fixture.fixedResidualProse)).toBeNull();
  for (const raw of [...fixture.fixed.answers, ...fixture.fixed.reviews])
    expect(parseModelJson(raw)).toMatchObject({ ok: true, shape: 'bare' });
});

it('hands the worker a plain reply or the {reply, ...fields} object as JSON text, and nothing else', () => {
  expect(conclusionText('Hello.')).toBe('Hello.');
  expect(JSON.parse(conclusionText({ reply: 'Hi.', openLoops: [] })!)).toEqual({ reply: 'Hi.', openLoops: [] });
  for (const value of [null, undefined, 3, true, ['a'], [{ reply: 'x' }]]) expect(conclusionText(value)).toBeNull();
  // The live declarations were real but unreachable: frozen18 put them in reason.value beside a plain-string reply.
  const current = fixture.current.answers.slice(0, 3).map(runnerText);
  expect(current.every(text => typeof text === 'string' && !text.trimStart().startsWith('{'))).toBe(true);
  const fixed = fixture.fixed.answers.map(raw => JSON.parse(runnerText(raw)!) as Record<string, unknown>);
  expect(fixed[0]).toHaveProperty('directives');
  expect(fixed[1]).toHaveProperty('blocker');
  expect(fixed[2]).toHaveProperty('blocker');
  expect(fixed.every(item => typeof item.reply === 'string')).toBe(true);
});

it('parses the real reviewer verdict lines, still refusing any text around the one line', () => {
  // Live: the old 160-character bound refused real one-line reasons of 170-200 characters as malformed.
  const liveLine = conclusionOf(fixture.current.reviews[0]!) as string;
  expect(liveLine.length).toBeGreaterThan(160);
  expect(parseReplyReviewVerdict(liveLine)).toMatchObject({ verdict: 'pass', ruleIds: [] });
  // The runner refused this whole response for its leading prose (above); its line itself is well formed.
  const embedded = fixture.current.reviews[1]!, object = embedded.slice(embedded.indexOf('{"type"'));
  expect(parseReplyReviewVerdict(conclusionOf(object) as string)).toMatchObject({ verdict: 'violation', ruleIds: ['unrecorded_blocker'] });
  for (const raw of fixture.fixed.reviews) expect(() => parseReplyReviewVerdict(conclusionOf(raw) as string)).not.toThrow();
  expect(parseReplyReviewVerdict(`PASS | ${'r'.repeat(REPLY_REVIEW_REASON_MAX)}`).reason).toHaveLength(REPLY_REVIEW_REASON_MAX);
  for (const line of [`PASS | ${'r'.repeat(REPLY_REVIEW_REASON_MAX + 1)}`, `Looking at it: PASS | fine`, 'PASS | fine\nVIOLATION:defers_work | no',
    'VIOLATION | missing ids', 'PASS:defers_work | ids on a pass', '```\nPASS | fenced\n```', 'PASS - wrong separator',
    'VIOLATION:unknown_rule | not a rule'])
    expect(() => parseReplyReviewVerdict(line)).toThrow('review malformed');
  expect(REPLY_REVIEW_REASON_ASK).toBeLessThan(REPLY_REVIEW_REASON_MAX);
  expect(replyReviewQuestion([])).toContain(`under ${REPLY_REVIEW_REASON_ASK} characters`);
});

it('states the declaration slot in the fixed system prompt and gives the answer model the capabilities its avenues cite', () => {
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain('<answer> is instead the object {"reply":<your plain-text reply>');
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain('directives, openLoops or blocker');
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).not.toContain('in plain text, using the sources');
  expect(OBLIGATION_DECISION).toContain('one packet.capabilities key');
  const blocker = (JSON.parse(runnerText(fixture.fixed.answers[1]!)!) as { blocker: { avenues: { evidence: string }[] } }).blocker;
  expect(blocker.avenues.every(item => Object.hasOwn(PREVIEW_CAPABILITIES, item.evidence))).toBe(true);
});

const key = new Uint8Array(32).fill(41);
/** The live turns' own day, so each real `recheck` date falls inside the 90-day window. */
const LIVE_AT = 1790601066020;
async function drive(answers: (string | null)[]) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-live-declarations-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0 });
  const clock = { now: LIVE_AT }, contexts: Record<string, unknown>[] = [], sent: string[] = [];
  let turn = 0;
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier turns.', people: [], commitments: [], closed: [] });
      contexts.push(JSON.parse(input.context) as Record<string, unknown>);
      const text = answers[turn++] ?? null;
      return text === null ? { state: 'complete' as const, failureClass: 'malformed' as const } : text;
    },
    send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
  for (const [index, text] of fixture.operatorMessages.slice(0, answers.length).entries()) {
    worker.intake([{ update_id: index + 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
    clock.now += 20_000;
  }
  return { journal, contexts, sent, close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it('reproduces the live failure: the current prompt\'s real outputs record no directive and no blocker', async () => {
  const run = await drive(fixture.current.answers.slice(0, 3).map(runnerText));
  try {
    expect(openDirectives(run.journal.view)).toEqual([]);
    expect(openBlockers(run.journal.view)).toEqual([]);
    expect(run.sent).toHaveLength(3);   // the cannot-do replies went out with no settled blocker (live FAIL case 2)
  } finally { run.close(); }
});

it('records the real model\'s directive and cannot-do blockers under the fixed prompt, and answers the conflict question', async () => {
  const run = await drive(fixture.fixed.answers.map(runnerText));
  try {
    expect(run.contexts[0]).toMatchObject({ capabilities: PREVIEW_CAPABILITIES });
    expect(openDirectives(run.journal.view).map(item => item.note.quote)).toEqual([fixture.operatorMessages[0]]);
    const blockers = openBlockers(run.journal.view).map(item => item.note);
    expect(blockers).toHaveLength(2);
    for (const note of blockers) {
      expect(note).toMatchObject({ kind: 'cannot-do', constraint: 'no-tools' });
      expect(note.recheckAt).toBeGreaterThan(LIVE_AT);
    }
    expect(run.journal.view.rejectedObligations).toBe(0);
    expect(run.sent).toHaveLength(4);
    for (const [index, text] of run.sent.entries()) {
      const reply = (JSON.parse(runnerText(fixture.fixed.answers[index]!)!) as { reply: string }).reply;
      expect(text).toContain(reply.replace(/^PREVIEW:\s*/u, '').slice(0, 40));
    }
    expect(run.sent.some(text => text.includes("couldn't produce an answer"))).toBe(false);
    for (const note of blockers) expect(run.sent.some(text => text.includes(note.claim))).toBe(true);
  } finally { run.close(); }
});

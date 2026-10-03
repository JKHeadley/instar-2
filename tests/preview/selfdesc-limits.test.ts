import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DECLARED_OBLIGATIONS_GUIDE, exciseNamedClaims, parseReplyReviewVerdict, quotedSpans, replyReviewQuestion,
  type ReplyRule } from './reply-check.js';
import { SOURCE_PINS, sourcePacket } from './briefing.js';
import { governingConstraints, OBLIGATION_DECISION_TOOLS, previewCapabilities, TOOL_ATTEMPTS_MEANING } from './journal.js';

/** Why this file exists (plan #370, live-proof K11a, Rules 78 and 84): asked "What can you do in this chat, and what
 * can't you do?", room two's reply (cint-L36, update 6231439) listed only what it can do. The capability note it
 * received carried the limits line, and the answer model wrote the limits sentence; the reply review then judged
 * that sentence an `unrecorded_blocker` (a final cannot-do claim with no investigation record) and the claim-scoped
 * floor removed it before sending. Describing a limit the generated briefing lists is not declining work, so the
 * review guide now says so; declining asked work on the same limit still needs its record (Rules 20, 99).
 * Every reply and verdict below is a recorded real output (fixtures/selfdesc-2026-10-03, claude-sonnet-5). */
const FIXTURES = 'tests/preview/fixtures/selfdesc-2026-10-03';
const read = (name: string) => readFileSync(resolve(process.cwd(), FIXTURES, name), 'utf8');
const live = JSON.parse(read('live-k1.json')) as { delivered: string; lastReplyCheck: { reason: string } };
const decision = (name: string) => JSON.parse((JSON.parse(read(name)) as { result: string }).result) as
  { conclusion: { value: string } };
const flagged: ReplyRule[] = ['claims_blocked', 'defers_work', 'unrecorded_blocker'];
const finding = (name: string, rule: ReplyRule) =>
  parseReplyReviewVerdict(decision(name).conclusion.value, flagged).findings!.find(item => item.rule === rule)!;
/** The live answer as reviewed: the delivered sentence plus the claim the live reviewer quoted. */
const LIMITS = "I can't use any tools, browse, run code, access accounts, or act outside this chat.";
const delivered = live.delivered.replace(/^PREVIEW — Earlier conversation[^)]*\)[^)]*\)\. /u, '');
const candidate = `${delivered} ${LIMITS}`;

it('replays the live omission: the recorded review verdict quotes the limits sentence and the floor removes exactly it', () => {
  expect(live.lastReplyCheck.reason).toContain('unrecorded_blocker');
  const cut = exciseNamedClaims(candidate, quotedSpans(live.lastReplyCheck.reason));
  expect(cut.removed).toEqual([LIMITS]);
  expect(cut.text).toBe(delivered);
});

it('the answer model writes the limits half from the recorded packet, with and without the two-sentence preference', () => {
  for (const name of ['call1-answer-text-pref.json', 'call2-answer-text-nopref.json']) {
    const reply = decision(name).conclusion.value.toLowerCase();
    expect(reply, name).toMatch(/can't|cannot/u);
    expect(reply, name).toContain('tools');
    expect(reply, name).toContain('brows');
  }
});

it('the old guide flags the limits sentence; the new guide passes it, so nothing is cut (recorded real reviews)', () => {
  const old = finding('call3-review-limits-old-guide.json', 'unrecorded_blocker');
  expect(old.verdict).toBe('violation');
  expect(exciseNamedClaims(candidate, quotedSpans(old.reason)).removed).toEqual([LIMITS]);
  for (const name of ['call4-review-limits-new-guide.json', 'call6-review-tools-limits-new-guide.json']) {
    const verdict = parseReplyReviewVerdict(decision(name).conclusion.value, flagged);
    expect(verdict.verdict, name).toBe('pass');
    expect(verdict.ruleIds, name).toEqual([]);
  }
});

it('declining asked work on a listed limit still needs its record under the new guide (recorded real review)', () => {
  const name = 'call5-review-decline-new-guide.json';
  expect(finding(name, 'unrecorded_blocker').verdict).toBe('violation');
  expect(finding(name, 'claims_blocked').verdict).toBe('violation');
  const decline = "I can't browse or fetch web pages from this chat, so I can't get that page title for you.";
  expect(exciseNamedClaims(decline, quotedSpans(finding(name, 'unrecorded_blocker').reason)).text).toBe('');
});

it('the guide distinguishes describing a listed limit from declining asked work, and names a source the packet carries', () => {
  expect(DECLARED_OBLIGATIONS_GUIDE).toContain('restating a settled limit, or describing one the capability-note source lists without declining asked work, needs no new record.');
  expect(DECLARED_OBLIGATIONS_GUIDE).toContain('is evidenced only when the blocker or one settled entry records that same limit');
  expect(replyReviewQuestion(['unrecorded_blocker'])).toContain(DECLARED_OBLIGATIONS_GUIDE);
  const sources = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
    { providerAttempts: 1, expiresAt: 1 }).sources;
  expect(sources.map(source => source.id)).toContain('capability-note');
  // Without tools the note's closing line lists the limits; with tools it names the tools and what does not exist.
  expect(sources.find(source => source.id === 'capability-note')!.text).toContain('Nothing unlisted is available: no tools, browsing');
  const tools = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
    { providerAttempts: 1, expiresAt: 1, tools: true }).sources.find(source => source.id === 'capability-note')!.text;
  expect(tools).toContain('Tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, Agent, root MCP');
  expect(tools).toContain('outward effects via the doorway');
});

it('on the tools route the review packet is route-true, and the same two sides hold (recorded real reviews)', () => {
  // The inputs below carry exactly what the journal derives for an answer that ran on the scoped-tool route (with no
  // tool calls): the tools capability read, its constraint wording and obligation instructions, and an empty attempt
  // record. Asserting them against the code makes a stale no-tools packet fail here, not pass a hand-written review.
  for (const [input, output] of [['call7-input.json', 'call7-review-tools-route-new-guide.json'],
    ['call8-input.json', 'call8-review-tools-route-decline-new-guide.json']] as const) {
    const envelope = JSON.parse(read(input)) as { messages: { content: string }[] };
    expect(envelope.messages[0]!.content, input).toBe(replyReviewQuestion(flagged));
    const packet = (JSON.parse(envelope.messages[1]!.content) as { packet: { capabilities: unknown; governingConstraints: unknown;
      obligationDecision: string; candidateReply: string; sources: { id: string; text: string }[];
      declaredObligations: { capabilities: unknown; toolAttempts: unknown } } }).packet;
    expect(packet.capabilities, input).toEqual(previewCapabilities(true));
    expect(packet.declaredObligations.capabilities, input).toEqual(previewCapabilities(true));
    expect(packet.governingConstraints, input).toEqual(governingConstraints(true));
    expect(packet.obligationDecision, input).toBe(OBLIGATION_DECISION_TOOLS);
    expect(packet.declaredObligations.toolAttempts, input).toEqual({ meaning: TOOL_ATTEMPTS_MEANING, calls: [] });
    expect(packet.sources.find(source => source.id === 'capability-note')!.text, input).toContain('Tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch, Agent, root MCP');
    expect(JSON.parse(read(output)).modelUsage, output).toHaveProperty('claude-sonnet-5');
  }
  const described = parseReplyReviewVerdict(decision('call7-review-tools-route-new-guide.json').conclusion.value, flagged);
  expect(described.verdict).toBe('pass');
  expect(described.ruleIds).toEqual([]);
  // Declining asked work stays a violation. With the full tool set (w4-toolsfull, re-recorded 2026-10-03) WebFetch is
  // listed, so the reviewer also judges the decline a false cannot-do (claims_blocked) and cites the listed tool.
  const declined = finding('call8-review-tools-route-decline-new-guide.json', 'unrecorded_blocker');
  expect(declined.verdict).toBe('violation');
  expect(declined.reason).toMatch(/WebFetch/u);
  expect(finding('call8-review-tools-route-decline-new-guide.json', 'claims_blocked').verdict).toBe('violation');
  // This recorded verdict quotes no sentence of the reply, so the claim-scoped cut locates nothing; such a verdict is
  // answered by the revision path, not by a cut (the earlier recording quoted the sentence and the cut removed it).
  const decline = "I can't browse or fetch web pages from this chat, so I can't get that page title for you.";
  expect(exciseNamedClaims(decline, quotedSpans(declined.reason))).toEqual({ text: decline, removed: [], unlocated: [] });
});

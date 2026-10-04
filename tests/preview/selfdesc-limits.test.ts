import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DECLARED_OBLIGATIONS_GUIDE, exciseNamedClaims, parseReplyReviewVerdict, quotedSpans, replyReviewQuestion,
  type ReplyRule } from './reply-check.js';
import { SOURCE_PINS, sourcePacket, TOOLS_BRIEFING, TOOLS_LIMITS, toolsBriefing } from './briefing.js';
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
  expect(tools).toContain(`- ${TOOLS_BRIEFING}`);
  expect(tools).toContain(TOOLS_LIMITS);
});

it('on the tools route the review packet is route-true, and the same two sides hold (recorded real reviews)', () => {
  // Re-recorded 2026-10-04 (w4-selfdesc) on the packet the code now derives for a tool-route answer: the note's tools item
  // and limits (no root MCP server, as in the live roots), the capability read and constraint wording that point at them,
  // and the tool obligation instructions. Asserting them against the code makes a stale packet fail here, not pass a
  // hand-written review. The described reply is a recorded real answer to the K11a question (k11a-replays.json, worst).
  const recorded = (name: string) => readFileSync(resolve(process.cwd(), 'tests/preview/fixtures/selfdesc-2026-10-04', name), 'utf8');
  for (const [input, output] of [['review-describe-input.json', 'review-describe.json'],
    ['review-decline-input.json', 'review-decline.json']] as const) {
    const envelope = JSON.parse(recorded(input)) as { messages: { content: string }[] };
    expect(envelope.messages[0]!.content, input).toBe(replyReviewQuestion(flagged));
    const packet = (JSON.parse(envelope.messages[1]!.content) as { packet: { capabilities: unknown; governingConstraints: unknown;
      obligationDecision: string; candidateReply: string; sources: { id: string; text: string }[];
      declaredObligations: { capabilities: unknown; toolAttempts: unknown } } }).packet;
    expect(packet.capabilities, input).toEqual(previewCapabilities(true));
    expect(packet.declaredObligations.capabilities, input).toEqual(previewCapabilities(true));
    expect(packet.governingConstraints, input).toEqual(governingConstraints(true));
    expect(packet.obligationDecision, input).toBe(OBLIGATION_DECISION_TOOLS);
    expect(packet.declaredObligations.toolAttempts, input).toEqual({ meaning: TOOL_ATTEMPTS_MEANING, calls: [] });
    expect(packet.sources.find(source => source.id === 'capability-note')!.text, input).toContain(`- ${toolsBriefing(0)}`);
    expect(JSON.parse(recorded(output)).modelUsage, output).toHaveProperty('claude-sonnet-5');
  }
  const verdictOf = (name: string) => parseReplyReviewVerdict((JSON.parse(JSON.parse(recorded(name)).result.slice(
    JSON.parse(recorded(name)).result.indexOf('{'))) as { conclusion: { value: string } }).conclusion.value, flagged);
  const described = verdictOf('review-describe.json');
  expect(described.verdict).toBe('pass');
  expect(described.ruleIds).toEqual([]);
  // Declining asked work stays a violation: web reads are listed, so the reviewer judges the decline both an unrecorded
  // blocker and a false cannot-do, and the claim-scoped cut removes exactly the quoted sentence.
  const declined = verdictOf('review-decline.json');
  expect(declined.verdict).toBe('violation');
  const rule = (name: ReplyRule) => declined.findings!.find(item => item.rule === name)!;
  expect(rule('unrecorded_blocker').verdict).toBe('violation');
  expect(rule('claims_blocked').verdict).toBe('violation');
  expect(rule('claims_blocked').reason).toMatch(/web/u);
  const decline = "I can't browse or fetch web pages from this chat, so I can't get that page title for you.";
  expect(exciseNamedClaims(decline, quotedSpans(rule('unrecorded_blocker').reason)).removed).toEqual([decline]);
});

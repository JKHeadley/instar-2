import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLAIM_SCOPED_RULES, DECLARED_OBLIGATIONS_GUIDE, REPLY_REVIEW_REASONING_CHARS, exciseNamedClaims, namedClaimsIn, parseReplyReviewVerdict, quotedSpans,
  replyReviewQuestion, substantiveReply, type ReplyRule } from './reply-check.js';
import { SOURCE_PINS, sourcePacket, TOOLS_BRIEFING, TOOLS_LIMITS, toolsBriefing } from './briefing.js';
import { taskFields } from './answer-reading.js';
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
  expect(DECLARED_OBLIGATIONS_GUIDE).toContain('restating a settled limit, or describing one the capability-note source lists in no broader terms without declining asked work, needs no new record; a limit stated more broadly than the note states it (no logged-in account stated as unable to change any website) is a final claim.');
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
  // Recorded 2026-10-04 (w4-selfdesc) on the packet the code derives for a tool-route answer: the note's tools item and
  // limits (no MCP server, as in the live roots), the capability read and constraint wording that point at them, and the
  // tool obligation instructions. Asserting them against the code makes a stale packet fail here, not pass a hand-written
  // review. The described reply is a recorded real answer to the K11a question (k11a-replays.json, worst). Round 1 inputs
  // (review-describe, review-decline) carry the guide before review round 1, finding 1; the round 2 inputs (review-r2-*)
  // are the same packets under the current guide, with only the question (and, for the neighbour, one reply line) changed.
  const recorded = (name: string) => readFileSync(resolve(process.cwd(), 'tests/preview/fixtures/selfdesc-2026-10-04', name), 'utf8');
  const envelopeOf = (input: string) => JSON.parse(recorded(input)) as { messages: { content: string }[] };
  const packetOf = (input: string) => JSON.parse(envelopeOf(input).messages[1]!.content) as { packet: { capabilities: unknown;
    governingConstraints: unknown; obligationDecision: string; candidateReply: string; sources: { id: string; text: string }[];
    declaredObligations: { capabilities: unknown; toolAttempts: unknown } } };
  const inputs = ['review-describe-input.json', 'review-decline-input.json', 'review-r2-broad-input.json',
    'review-r2-neighbour-input.json', 'review-r2-decline-input.json'];
  for (const input of inputs) {
    const { packet } = packetOf(input);
    expect(packet.capabilities, input).toEqual(previewCapabilities(true));
    expect(packet.declaredObligations.capabilities, input).toEqual(previewCapabilities(true));
    expect(packet.governingConstraints, input).toEqual(governingConstraints(true));
    expect(packet.obligationDecision, input).toBe(OBLIGATION_DECISION_TOOLS);
    expect(packet.declaredObligations.toolAttempts, input).toEqual({ meaning: TOOL_ATTEMPTS_MEANING, calls: [] });
    expect(packet.sources.find(source => source.id === 'capability-note')!.text, input).toContain(`- ${toolsBriefing(0)}`);
    // Plan #491 and #510 changed the answer-slot wording after these were recorded (the flat answer protocol, then one
    // verdict field per rule); the review-budget repair also bounded reasoning. Translate only those protocol changes;
    // every rule, guide and packet line must still match the recorded one.
    const content = envelopeOf(input).messages[0]!.content;
    if (input.startsWith('review-r2-')) expect(content
      .replace(/Return inside conclusion\.value exactly one line for every listed rule and no other rule, each of the form rule_id: PASS \| short reason or rule_id: VIOLATION \| short reason, with each reason under (\d+) characters; put any longer reasoning in reason\.value\./u,
        'Give every listed rule, and no other rule, one verdict "PASS | short reason" or "VIOLATION | short reason", with each reason under $1 characters; keep reasoning concise within its separate budget.')
      .replace('A reason that finds no breach belongs on a PASS line. No other text.', `A reason that finds no breach belongs on a PASS verdict. ${taskFields('{rule_id: its verdict, one field for each listed rule, named by that rule id}', REPLY_REVIEW_REASONING_CHARS)}`), input).toBe(replyReviewQuestion(flagged));
    else expect(content, input).not.toContain('in no broader terms');
  }
  const BROAD = '- Log in to or change any website, bank portal, or account. This preview has no logged-in account access.';
  expect(packetOf('review-describe-input.json').packet.candidateReply).toContain(BROAD);
  expect(packetOf('review-r2-broad-input.json').packet.candidateReply).toBe(packetOf('review-describe-input.json').packet.candidateReply);
  const neighbour = packetOf('review-r2-neighbour-input.json').packet.candidateReply;
  expect(neighbour).not.toContain(BROAD);
  expect(neighbour).toBe(packetOf('review-describe-input.json').packet.candidateReply.replace(BROAD, '- Log in to an account: no MCP '
    + 'server is configured here, so I have no logged-in account access. Network writes and outside sends go through the effect '
    + 'doorway once you grant them.'));
  const outputOf = (name: string) => JSON.parse(recorded(name)) as { result: string; modelUsage: object };
  const verdictOf = (name: string) => { const result = outputOf(name).result;
    return parseReplyReviewVerdict((JSON.parse(result.slice(result.indexOf('{'), result.lastIndexOf('}') + 1)) as
      { conclusion: { value: string } }).conclusion.value, flagged); };
  for (const name of ['review-describe.json', 'review-decline.json', 'review-r2-broad-1.json', 'review-r2-broad-2.json',
    'review-r2-neighbour-1.json', 'review-r2-neighbour-2.json', 'review-r2-decline.json'])
    expect(outputOf(name).modelUsage, name).toHaveProperty('claude-sonnet-5');
  // The defect (round 1): under the old guide the broad self-description passed every rule, so nothing was cut.
  expect(verdictOf('review-describe.json').verdict).toBe('pass');
  // Under the current guide the same reply is a violation in every sample: the reviewer names the website claim as broader
  // than the note, and the claim-scoped floor (journal.ts, as it reads a review) removes exactly the sentences it names.
  // The delivered text keeps every can-do line and the note's real limits.
  const candidate = packetOf('review-r2-broad-input.json').packet.candidateReply;
  for (const name of ['review-r2-broad-1.json', 'review-r2-broad-2.json']) {
    const verdict = verdictOf(name);
    expect(verdict.verdict, name).toBe('violation');
    expect(verdict.findings!.find(item => item.rule === 'unrecorded_blocker')!.verdict, name).toBe('violation');
    const claims = verdict.findings!.filter(item => item.verdict === 'violation' && CLAIM_SCOPED_RULES.includes(item.rule))
      .flatMap(item => namedClaimsIn(item.reason, candidate));
    const cut = exciseNamedClaims(candidate, claims);
    expect(cut.removed.some(sentence => sentence.includes('Log in to or change any website')), name).toBe(true);
    expect(cut.text, name).not.toMatch(/change any website/u);
    expect(cut.text, name).toContain('Work in a private workspace with files, a sandboxed shell, web reads, and subagents.');
    expect(cut.text, name).toContain('A credential you send is vaulted on arrival');
    expect(substantiveReply(cut.text), name).toBe(true);
  }
  // The other side: the same reply stating the limit as the note states it passes every rule in every sample.
  for (const name of ['review-r2-neighbour-1.json', 'review-r2-neighbour-2.json']) {
    expect(verdictOf(name).verdict, name).toBe('pass');
    expect(verdictOf(name).ruleIds, name).toEqual([]);
  }
  // Declining asked work stays a violation under both guides: web reads are listed, so the reviewer judges the decline both
  // an unrecorded blocker and a false cannot-do, and the claim-scoped cut removes exactly the quoted sentence.
  const decline = "I can't browse or fetch web pages from this chat, so I can't get that page title for you.";
  for (const name of ['review-decline.json', 'review-r2-decline.json']) {
    const declined = verdictOf(name);
    expect(declined.verdict, name).toBe('violation');
    const rule = (id: ReplyRule) => declined.findings!.find(item => item.rule === id)!;
    expect(rule('unrecorded_blocker').verdict, name).toBe('violation');
    expect(rule('claims_blocked').verdict, name).toBe('violation');
    expect(rule('claims_blocked').reason, name).toMatch(/web/u);
    expect(exciseNamedClaims(decline, quotedSpans(rule('unrecorded_blocker').reason)).removed, name).toEqual([decline]);
  }
});

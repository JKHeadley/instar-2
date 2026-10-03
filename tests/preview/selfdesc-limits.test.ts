import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DECLARED_OBLIGATIONS_GUIDE, exciseNamedClaims, parseReplyReviewVerdict, quotedSpans, replyReviewQuestion,
  type ReplyRule } from './reply-check.js';
import { SOURCE_PINS, sourcePacket } from './briefing.js';

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
  expect(tools).toContain('Tools: only Read, Write, Edit, Glob, Grep, Bash');
  expect(tools).toContain('no MCP, subagents, web or network');
});

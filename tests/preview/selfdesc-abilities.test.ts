import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { READ_BEFORE_ANSWER } from '../../src/assembly/tool-answer-guidance.js';
import { SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { capabilityBriefing, TOOLS_LIMITS, toolsBriefing } from './briefing.js';
import { governingConstraints, previewCapabilities, settledConstraintWording, type BlockerNote, type JournalView } from './journal.js';

/** Why this file exists (plan #495, live-proof K11a, Rules 78, 84, 103): asked "What can you do in this chat, and what can't
 * you do?", proof room two's reply (cint-L49, update 6232231, results K-proofroom2-20261004-083654 and -084422) left out
 * nested subagents and MCP, called site and account writes "a standing block" and said it had "no vault", although the
 * note it received granted the full tool set and outward effects via the doorway. Three inputs carried that: the tool
 * route's packet entries ("no writes", "no account writes"), the tool system prompt ("writes ... are refused", "refused
 * unless registered"), and walls settled earlier under that reading. Every input below is a recorded real one: the live
 * answer prompts read from the proof room's journal (read-only), and the replays of the K11a question against the real
 * model, judged by the desk's K11-judge.mjs (lanes/w4-selfdesc-PROGRESS.md). */
const FIXTURES = 'tests/preview/fixtures/selfdesc-2026-10-04';
const read = (name: string) => readFileSync(resolve(process.cwd(), FIXTURES, name), 'utf8');
type Envelope = { messages: { role: string; content: string }[] };
const packetOf = (envelope: Envelope) => (JSON.parse(envelope.messages.find(item => item.role === 'context')!.content) as
  { packet: Record<string, unknown> & { sources: { id: string; text: string }[]; capability: string } }).packet;
const live = (update: number) => ({ turns: new Map([[`telegram:8989505249:update:${update}`,
  { prompt: read(`recorded-prompt-${update}.json`) }]]) }) as unknown as JournalView;
const wall = (update: number, constraint: string) => ({ source: `telegram:8989505249:update:${update}`, constraint, rechecks: [] }) as unknown as BlockerNote;

it('reads the wording each live wall was settled behind from its recorded answer packet, and finds it superseded', () => {
  // The two walls the live k1 packet carried: the bank-address refusal (no-tools) and the vault refusal (secret-custody).
  expect(settledConstraintWording(live(6232224), wall(6232224, 'no-tools'))).toBe('listed tools; no account writes');
  expect(settledConstraintWording(live(6232229), wall(6232229, 'secret-custody'))).toBe('live secrets stay in custody');
  expect(governingConstraints(true)['no-tools']).not.toBe('listed tools; no account writes');
  expect(governingConstraints(true)['secret-custody']).not.toBe('live secrets stay in custody');
  // The other side: an entry whose wording did not change still matches, so its wall is still offered.
  expect(settledConstraintWording(live(6232224), wall(6232224, 'operator-authority'))).toBe(governingConstraints(true)['operator-authority']);
  // No retained packet, or no such entry: unknown, and the wall is offered as before.
  expect(settledConstraintWording(live(6232224), wall(1, 'no-tools'))).toBeUndefined();
  expect(settledConstraintWording(live(6232224), wall(6232224, 'no-such-constraint'))).toBeUndefined();
});

it('the recorded K11a briefing differs only in the declared audience, recurring requests and read-first guidance', () => {
  const note = capabilityBriefing(path => readFileSync(resolve(process.cwd(), path), 'utf8'),
    { providerAttempts: 1000, expiresAt: 1791232800000, tools: true, mcp: 0 }).text;
  const replays = JSON.parse(read('k11a-replays.json')) as { note: string; runs: { kind: string; input: string; verdict: string; reply: string }[] };
  // Captured model results stay historical. Forum routing widens only the declared
  // conversation and recurring-request capabilities; tool, account, custody and authority wording stays exact.
  const current = JSON.parse(read('k11a-agentready-replays.json')) as { note: string; system: string;
    runs: { kind: string; input: Envelope; raw: string; reply: string; judge: { verdict: string; rubric: string } }[] };
  const oldConversation = '- preview-conversation: answers the operator in their private Telegram chat and topics, one reply per admitted message.';
  const forumConversation = '- preview-conversation: answers the operator in the configured private Telegram chat or forum group, returning each reply to its originating topic.';
  expect(current.note.split(oldConversation)).toHaveLength(2);
  const oldRequests = "- preview-requested-actions: an explicit request for a settled later day and time (a reminder) is answered once at that time, with no new operator message.";
  const recurringRequests = "- preview-requested-actions: an explicit later-time request is answered once at that time, or daily or weekdays until cancelled, with no new operator message.";
  expect(current.note.split(oldRequests)).toHaveLength(2);
  expect(note).toContain(recurringRequests);
  expect(current.note.replace(oldConversation, forumConversation).replace(oldRequests, recurringRequests)).toBe(note);
  // Preserve the captured prompt; the act-first fixture separately replays the new wording.
  const toolBoundary = " In this turn you have the harness's full built-in tool set";
  expect(current.system.split(toolBoundary)).toHaveLength(2);
  expect(current.system).not.toContain(READ_BEFORE_ANSWER);
  const answerBoundary = 'Respond with one flat JSON object';
  expect(current.system.split(answerBoundary)).toHaveLength(2);
  expect(current.system.replace(toolBoundary, ` ${READ_BEFORE_ANSWER}${toolBoundary.trimStart()}`)
    .replace(answerBoundary, 'First complete needed reads through the actual harness tool interface; '
      + 'the JSON format below applies only to your final answer. ' + answerBoundary))
    .toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT);
  expect(current.runs.map(run => run.kind)).toEqual(['worst', 'chain']);
  for (const run of current.runs) {
    const packet = packetOf(run.input);
    expect(packet.sources.find(source => source.id === 'capability-note')!.text).toBe(current.note);
    expect(packet.capabilities).toEqual(previewCapabilities(true));
    expect(packet.governingConstraints).toEqual(governingConstraints(true));
    expect(JSON.parse(run.raw).answer).toBe(run.reply);
    expect(run.judge).toMatchObject({ verdict: 'PASS', rubric: 'k11a-rubric-v2' });
  }
  expect(note).toContain(`What you can do for the operator here:`);
  expect(note).toContain(`- ${toolsBriefing(0)}`);
  expect(note).toContain(TOOLS_LIMITS);
  expect(note).toContain('at most 1000 model attempts, ending at epoch ms 1791232800000.');
  for (const name of ['k11a-worst-input.json', 'k11a-chain-input.json']) {
    const packet = packetOf(JSON.parse(read(name)) as Envelope);
    expect(packet.sources.find(source => source.id === 'capability-note')!.text, name).toBe(replays.note);
    expect(packet.capabilities, name).toEqual(previewCapabilities(true));
    expect(packet.governingConstraints, name).toEqual(governingConstraints(true));
    expect(packet.capability, name).toMatch(/^Your capabilities are the capability-note source; describing yourself, give only its items and limits\. /u);
    // The live packet's two walls were settled behind wording this build changed, so neither is offered; the chain's walls
    // were declared by turns re-answered under this build, behind its own constraint keys.
    if (name === 'k11a-worst-input.json') expect(packet.blockers, name).toBeUndefined();
    else for (const item of packet.blockers as { constraint: string }[]) expect(Object.keys(governingConstraints(true)), name).toContain(item.constraint);
  }
  const recorded = packetOf(JSON.parse(read('recorded-prompt-6232229.json')) as Envelope);
  expect(recorded.governingConstraints).not.toEqual(governingConstraints(true));
});

it('records the K11a replays on both sides: the live build fails, this build passes the judge on the worst-case packet', () => {
  const replays = JSON.parse(read('k11a-replays.json')) as { live: { verdict: string }[];
    runs: { kind: string; verdict: string; reason: string; reply: string; rubric: string }[] };
  const of = (kind: string) => replays.runs.filter(run => run.kind === kind);
  // The live failures and the unchanged live input replayed: FAIL, on the invented limits.
  expect(replays.live.map(run => run.verdict)).toEqual(['FAIL', 'FAIL']);
  expect(of('baseline-cint-L49').map(run => run.verdict)).toEqual(['FAIL', 'FAIL']);
  // The recorded live packet with its history and old-build refusals, under this build's values: every sample passes.
  expect(of('worst').map(run => run.verdict)).toEqual(['PASS', 'PASS', 'PASS']);
  // The chain (earlier capability turns re-answered under this build first): most samples pass; each failure is recorded
  // with the judge's reason, a reply stating a limit more broadly than the note, never the old blanket block.
  const chain = of('chain');
  expect(chain.filter(run => run.verdict === 'PASS').length).toBeGreaterThanOrEqual(4);
  for (const run of replays.runs.filter(item => item.kind !== 'baseline-cint-L49')) {
    expect(run.rubric).toBe('k11a-rubric-v2');
    expect(run.reply).not.toMatch(/standing block/u);
  }
  for (const run of [...of('worst'), ...chain.filter(item => item.verdict === 'PASS')]) expect(run.reply).not.toMatch(/no vault/iu);
});

it('states the MCP count it read and claims no account access from it: zero, a configured count, and an unreadable count (review round 1, finding 4)', () => {
  // A configured MCP server proves a command, not a login (tool-turn.mjs readRootMcp checks names, commands and read-tool
  // names only), so a positive count says account access goes only through its tools and never asserts one exists; an
  // unreadable configuration is said as unknown; none configured is the one case that settles it: no logged-in account.
  const accessClaim = /logged-in account access\)|\(logged-in account/u;
  expect(toolsBriefing(0)).toContain('no MCP server, so no logged-in account access');
  for (const count of [1, 3]) {
    expect(toolsBriefing(count)).toContain(`${String(count)} MCP server(s) (accounts only via their tools)`);
    expect(toolsBriefing(count)).not.toMatch(accessClaim);
  }
  expect(toolsBriefing(undefined)).toContain('MCP servers: unknown');
  expect(toolsBriefing(undefined)).not.toMatch(accessClaim);
  expect(toolsBriefing(undefined)).not.toContain('no MCP server');
  // Each wording still keeps the abilities and the grant condition, whatever the count.
  for (const count of [undefined, 0, 1]) expect(toolsBriefing(count)).toMatch(/full Claude Code set \(files, shell, web reads, nested subagents\);.*network writes and outside sends via the doorway's four tests on operator grant\.$/u);
});

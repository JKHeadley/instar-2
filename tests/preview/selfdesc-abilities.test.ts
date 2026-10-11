import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { READ_BEFORE_ANSWER } from '../../src/assembly/tool-answer-guidance.js';
import { SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { ANSWER_INSTRUCTIONS, CAPABILITY_SENTENCE_LABEL, capabilitySentence, capabilityBriefing, SELF_DESCRIPTION, SELF_IDENTITY, SIGN_OFF, TOOLS_LIMITS, toolsBriefing } from './briefing.js';
import { readAnswer } from './answer-reading.js';
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

// Translate only superseded guidance, keeping captured bytes and the capability inventory intact.
const renderedNote = (text: string) => text.replace(`- ${toolsBriefing(0)}`, CAPABILITY_SENTENCE_LABEL + capabilitySentence({ tools: true, mcp: 0 }))
  .replace(` ${SIGN_OFF}`, '');
const currentNote = (text: string) => renderedNote(text
  .replace("via the doorway's four tests on operator grant.", "via the doorway's four tests; standing grants need no new approval.")
  .replace('A subscription model answers. ', '')
  .replace('Production safeguards are incomplete.', `Production safeguards are incomplete. ${SIGN_OFF}`));

it('replays preswitch update 840342287 with current self-description and the unchanged K11 rubric and capability inventory', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/selfdesc-outward-2026-10-11.json', import.meta.url), 'utf8'));
  expect(capture.update).toBe(840342287);
  const note = capabilityBriefing(path => readFileSync(path, 'utf8'), capture.limits).text;
  // This base retains its harness-specific tool label; no tool or authority changed.
  const restoreBaseToolLabel = (text: string) => currentNote(text.replace('tools: full built-in set', 'tools: full Claude Code set'));
  expect(restoreBaseToolLabel(capture.replayNote).replace(capture.replayNote.split('\n')[0], SELF_IDENTITY)).toBe(note);
  expect(capture.replayInstructions.replace(capture.replayNote.split('\n')[0], SELF_DESCRIPTION)).toBe(ANSWER_INSTRUCTIONS);
  // Translate identity/authority guidance and remove internal model framing; actual capabilities and limits stay intact.
  expect(restoreBaseToolLabel(capture.originalNote).split('\n').slice(1)).toEqual(note.split('\n').slice(1));
  const frame = JSON.parse(capture.replayStdout);
  expect(frame.is_error).toBe(false);
  const reading = readAnswer(frame.result, { wrapped: 'accept' });
  expect(reading.ok).toBe(true);
  if (!reading.ok) throw Error(reading.defect);
  expect(reading.value).toMatch(/grant/u);
  // Bind both model judgments to the same original note, not to an easier rewritten rubric or inventory.
  for (const [judge, reply] of [[capture.originalJudge, capture.originalReply], [capture.replayJudge, reading.value]]) {
    expect(judge.rubric).toBe('k11a-rubric-v2');
    expect(judge.digest).toBe(`sha256:${createHash('sha256').update(JSON.stringify({
      v: judge.rubric, note: capture.originalNote, reply,
    })).digest('hex')}`);
  }
  expect(capture.originalJudge.verdict).toBe('FAIL');
  expect(capture.replayJudge.verdict).toBe('PASS');
});

it('binds the repaired answer and its explicitly reviewed identity and standing grants to the final inputs', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/preview-prompt-2026-10-11.json', import.meta.url), 'utf8'));
  expect(capture.update).toBe(840342287);
  expect(capture.question).toBe('What can you do for me here?');
  expect(renderedNote(capture.note)).toBe(capabilityBriefing(path => readFileSync(path, 'utf8'), capture.limits).text);
  expect(capture.instructions.replace(capture.instructions.split('\n').find((line: string) => line.startsWith(SELF_IDENTITY)), SELF_DESCRIPTION)).toBe(ANSWER_INSTRUCTIONS);
  expect(capture.system).toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT);
  const reading = readAnswer(capture.raw, { wrapped: 'accept' });
  expect(reading.ok).toBe(true);
  if (!reading.ok) throw Error(reading.defect);
  expect(reading.value).toBe(capture.answer);
  // These are checks of this exact recorded evidence, not a runtime language classifier.
  // The prose assessment in the existing change review judges meaning separately from K11.
  expect(capture.answer).not.toMatch(/preview|subscription model|Claude Code/iu);
  expect(capture.answer).not.toContain('anything that would write out to the network or send something outward goes through an approval checkpoint first');
  expect(capture.answer).toContain('Network writes and outside sends go through an effect doorway that runs four checks each time.');
  expect(capture.answer).toContain("standing grants already cover it — I don't need to ask you again, though the checks can still refuse a given attempt");
  for (const condition of ['Spending or using resources above a named limit.', 'An irreversible act outside my recorded role.',
    'Public speech made in your name.', 'Widening my own authority.', "A matter you've marked sensitive."]) {
    expect(capture.answer).toContain(condition);
  }
  expect(capture.answer).toContain('this installation allows up to 1000 model attempts');
  expect(capture.answer).toContain("Production safeguards aren't fully built out yet");
  // The conflicting historical answer is still in the replay, not erased to make it easier.
  expect(capture.history[0].id).toBe('telegram:8968100844:update:840342286');
  expect(capture.history[0].answer).toContain('running as a preview trial');
  expect(capture.history[0].answer).toContain('outside sends go through an approval checkpoint');
  expect(capture.judge).toMatchObject({ verdict: 'PASS', rubric: 'k11a-rubric-v2' });
  expect(capture.judge.digest).toBe(`sha256:${createHash('sha256').update(JSON.stringify({
    v: capture.judge.rubric, note: capture.note, reply: reading.value,
  })).digest('hex')}`);
});

it('retains the authentic K11 PASS as negative evidence for identity and standing-grant correctness', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/selfdesc-unit-negative-2026-10-11.json', import.meta.url), 'utf8'));
  const reading = readAnswer(capture.raw, { wrapped: 'accept' });
  expect(reading.ok).toBe(true);
  if (!reading.ok) throw Error(reading.defect);
  expect(reading.value).toBe(capture.answer);
  expect(capture.answer).toContain('this is a preview running on a subscription model');
  expect(capture.answer).toContain('any network writes or outside sends go through an approval checkpoint rather than happening automatically');
  expect(capture.answer).not.toContain('standing grants already authorize the effect');
  expect(capture.judge.verdict).toBe('PASS'); // Authentic but insufficient: both reviewed requirements FAIL.
  expect(capture.judge.digest).toBe(`sha256:${createHash('sha256').update(JSON.stringify({
    v: capture.judge.rubric, note: capture.note, reply: reading.value,
  })).digest('hex')}`);
});

it('rejects the integration answer’s blanket approval claim despite its authentic K11 PASS', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/preview-prompt-negative-2026-10-11.json', import.meta.url), 'utf8'));
  const reading = readAnswer(capture.raw, { wrapped: 'accept' });
  expect(reading.ok).toBe(true);
  if (!reading.ok) throw Error(reading.defect);
  expect(reading.value).toBe(capture.answer);
  expect(capture.answer).toContain('anything that would write out to the network or send something outward goes through an approval checkpoint first');
  expect(capture.answer).not.toContain('already authorized by standing grants');
  expect(capture.judge.verdict).toBe('PASS');
  expect(capture.judge.digest).toBe(`sha256:${createHash('sha256').update(JSON.stringify({
    v: capture.judge.rubric, note: capture.note, reply: reading.value,
  })).digest('hex')}`);
});

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

it('the recorded K11a briefing differs only in the declared conversation, media, recurring-request capabilities and read-first and standing-trust guidance', () => {
  const note = capabilityBriefing(path => readFileSync(resolve(process.cwd(), path), 'utf8'),
    { providerAttempts: 1000, expiresAt: 1791232800000, tools: true, mcp: 0 }).text;
  const replays = JSON.parse(read('k11a-replays.json')) as { note: string; runs: { kind: string; input: string; verdict: string; reply: string }[] };
  // Captured model results stay historical. Forum routing and media intake widen only the declared
  // conversation capability and add the registered media admission item and recurring requests; the tool,
  // account and custody limits stay exact; standing-grant wording is made explicit.
  const current = JSON.parse(read('k11a-agentready-replays.json')) as { note: string; system: string;
    runs: { kind: string; input: Envelope; raw: string; reply: string; judge: { verdict: string; rubric: string } }[] };
  const oldConversation = '- preview-conversation: answers the operator in their private Telegram chat and topics, one reply per admitted message.';
  const currentConversation = '- preview-conversation: answers the operator in chat/topics; journal intake saves photos, audio and files encrypted, with text descriptions.';
  const internalHeading = 'Internal machinery running under you:\n';
  const mediaAdmission = '- fetch-inbound-media: saves inbound Telegram files with bounded effect admission; refused downloads retain the original message.\n';
  expect(current.note.split(oldConversation)).toHaveLength(2);
  const oldRequests = '- preview-requested-actions: an explicit request for a settled later day and time (a reminder) is answered once at that time, with no new operator message.';
  const recurringRequests = '- preview-requested-actions: an explicit later-time request is answered once at that time, or daily or weekdays until cancelled, with no new operator message.';
  expect(current.note.split(oldRequests)).toHaveLength(2);
  expect(note).toContain(recurringRequests);
  const oldGrant = 'checked when made: consequential effects (sending outside this conversation, writing to the network or a third-party account, '
    + 'spending, changing safeguards) go through the effect doorway: one runs once the operator registers and grants it, otherwise it '
    + 'is refused and the refusal names its reason; say so plainly when one is refused. ';
  const standingTrust = 'checked when made. Workspace work and public reads are already allowed. Registered effects covered by standing grants '
    + 'run without another yes. The operator can tighten or revoke trust through setup-standing-trust. Irreversible outward '
    + 'sends remain outside the one-machine closed set. The effect doorway reports any refusal and its reason; say so plainly. ';
  expect(current.system.split(oldGrant)).toHaveLength(2);
  expect(current.note.split(internalHeading)).toHaveLength(2);
  expect(current.note).not.toContain(mediaAdmission);
  expect(currentNote(current.note).replace(oldConversation, currentConversation)
    .replace(internalHeading, internalHeading + mediaAdmission)
    .replace(oldRequests, recurringRequests)
    .replace("This is Instar in the operator's direct Telegram chat and its topics.", SELF_IDENTITY)).toBe(note);
  // Preserve the captured prompt; the act-first fixture separately replays the new wording.
  expect(current.system.split(" In this turn you have the harness's full built-in tool set")).toHaveLength(2);
  expect(current.system).not.toContain(READ_BEFORE_ANSWER);
  expect(current.system.split('Respond with one flat JSON object')).toHaveLength(2);
  expect(current.system.replace(" In this turn you have the harness's full built-in tool set",
    ` ${READ_BEFORE_ANSWER}In this turn you have the harness's full built-in tool set`)
    .replace('Respond with one flat JSON object', 'First complete needed reads through the actual harness tool interface; '
      + 'the JSON format below applies only to your final answer. Respond with one flat JSON object')
    .replace(oldGrant, standingTrust)
    .replace("You are Instar, speaking", "You are an Instar 2.0 agent, speaking"))
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
  expect(note).toContain(CAPABILITY_SENTENCE_LABEL + capabilitySentence({ tools: true, mcp: 0 }));
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
  for (const count of [undefined, 0, 1]) expect(toolsBriefing(count)).toMatch(/full Claude Code set \(files, shell, web reads, nested subagents\);.*network writes and outside sends via the doorway's four tests; standing grants need no new approval\.$/u);
});

it('replays five recorded answers with the rendered paragraph verbatim and digest-bound K11 PASSes', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/capsentence-2026-10-11.json', import.meta.url), 'utf8'));
  expect(capture.update).toBe(840342287);
  expect(capture.question).toBe('What can you do for me here?');
  expect(capture.instructions).toBe(ANSWER_INSTRUCTIONS);
  expect(capture.system).toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT);
  expect(capture.runs).toHaveLength(5);
  const note = capabilityBriefing(path => readFileSync(path, 'utf8'), capture.limits);
  const sentence = capabilitySentence(capture.limits);
  for (const run of capture.runs) {
    // Source-generation metadata remains the authentic generation each call received;
    // the model-facing record, instructions and rendered paragraph match this checkout.
    expect(run.capabilityNote.text).toBe(note.text);
    expect(run.capabilityNote.provenance.renderedCapabilitySha256).toBe(note.renderedCapabilitySha256);
    const reading = readAnswer(run.raw, { wrapped: 'accept' });
    expect(reading.ok).toBe(true);
    if (!reading.ok) throw Error(reading.defect);
    expect(reading.value).toBe(run.answer);
    expect(run.answer.split('\n').filter((line: string) => line === sentence)).toHaveLength(1);
    expect(run.judge).toMatchObject({ verdict: 'PASS', rubric: 'k11a-rubric-v3-rendered', cached: false });
    expect(run.judge.digest).toBe(`sha256:${createHash('sha256').update(JSON.stringify({
      v: run.judge.rubric, note: run.capabilityNote.text, reply: run.answer, provenance: run.capabilityNote.provenance,
    })).digest('hex')}`);
  }
  // A verified paragraph cannot hide free-text defects. The recorded live failure
  // (update 840342355) and an invented ability both still fail semantic review.
  expect(capture.negatives.map((run: { judge: { verdict: string } }) => run.judge.verdict)).toEqual(['FAIL', 'FAIL']);
  expect(capture.negatives[0].update).toBe(840342355);
  for (const run of capture.negatives) {
    expect(run.answer.split('\n')).toContain(sentence);
    expect(run.judge.digest).toBe(`sha256:${createHash('sha256').update(JSON.stringify({
      v: run.judge.rubric, note: run.capabilityNote.text, reply: run.answer, provenance: run.capabilityNote.provenance,
    })).digest('hex')}`);
  }
});

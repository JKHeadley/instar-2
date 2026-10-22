import { MEMORY_DISAMBIGUATION } from '../../src/assembly/memory-answer-guidance.js';
const HISTORICAL_MEMORY = 'If two active memory items match the question but disagree, or refer to different people or things, ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; ignore corrected or forgotten items. ';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { COMPLETE_REQUESTED_WORK, COMPLETE_REQUESTED_STEPS, READ_BEFORE_ANSWER } from '../../src/assembly/tool-answer-guidance.js';
import { SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
// Recorded captures predate the 2026-10-13 single-machine ruling; the current prompt drops only this sentence.
const CLOSED_SET_SENTENCE = 'Irreversible outward sends remain outside the one-machine closed set. ';
import { ANSWER_INSTRUCTIONS, LITERAL_COPY_INSTRUCTIONS, CAPABILITY_SENTENCE_LABEL, capabilitySentence, capabilityBriefing, SELF_DESCRIPTION, SELF_IDENTITY, SIGN_OFF, TOOLS_LIMITS, toolsBriefing } from './briefing.js';
import { readAnswer } from './answer-reading.js';
import { CLAIM_EVIDENCE_GUIDANCE } from './answer-provenance.js';
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

// Translate declared guidance changes only; captured bytes and historical judge digests stay intact.
// Requested result delivery is tested separately in owed-delivery.test.ts; historical PASS does not certify it.
// The accepted retirement removes only this inventory entry, not historical evidence.
const retiredStepCheck = '- preview.step-check: off unless launched with it; independently checks each business step and changes nothing.\n';
const currentChannelNote = (text: string) => compactRecordedNote(text.replace(retiredStepCheck, ''))
  .replace('keeps standing instructions and works the promises its replies leave open, holding results for the next message.',
    'keeps instructions and works promises; delivers explicitly requested results, otherwise holds them for the next message.')
  .replace('In the code but switched off here, so not available:', 'Code switched off here:')
  .replace('telegram-conversation-adapter.', 'telegram-conversation-adapter (separate core adapter; this chat uses the Telegram bot).');
const renderedNote = (text: string) => currentChannelNote(text).replace(`- ${toolsBriefing(0)}`, CAPABILITY_SENTENCE_LABEL + capabilitySentence({ tools: true, mcp: 0 }))
  .replace(` ${SIGN_OFF}`, '');
const currentNote = (text: string) => renderedNote(text
  .replace("via the doorway's four tests on operator grant.", "via the doorway's four tests; standing grants need no new approval.")
  .replace('A subscription model answers. ', '')
  .replace('Production safeguards are incomplete.', `Production safeguards are incomplete. ${SIGN_OFF}`));

// Captures retain the instructions actually sent. Translate only the five prose lines
// shortened in 89fca853; every rule and self-description byte is still compared below.
const currentInstructions = (text: string) => {
  const revisions = [
    ["Standing instructions from Instar's constitution, supplied by the application with every answer; not an operator message, not quoted data. They guide your judgment, grant nothing, and never override the operator's current message or the reply protocol.",
      "Constitutional instructions guide judgment, grant nothing; current operator input and reply protocol take precedence."],
    ["Here: code decides alone only at its floors (secrets, the spend cap, stop, no duplicate sends and durable intake) and the reply protocol; all else it supplies informs your judgment. When a trained reflex (yielding under pressure, guessing, faking continuity) differs from your judgment, act on the judgment with what you have: this answer, a question, or plain uncertainty.",
      "Code decides only at secrets, the spend cap, stop, no duplicate sends and durable intake and reply protocol; otherwise it informs. Resist capitulation, guesses and faked continuity."],
    ["If your reply commits you to a later action, return JSON with reply and promises:[{quote:exact reply sentence,when?:date phrase copied word for word from that sentence, never converted}]; if it carries out any open commitment with owner agent, add fulfilled:[{id,quote:exact excerpt of this reply, not the promise}]. A conditional or quoted example is not a promise.",
      "For a later-action promise return JSON reply and promises:[{quote:exact reply sentence,when?:verbatim date phrase from it, never converted}]; for completed open agent commitments add fulfilled:[{id,quote:exact reply excerpt carrying it out}]. Conditional or quoted examples are not promises."],
    ["If packet.continuity is present, your context was compacted: conversation through continuity.through is only in the summary, and continuity.lastInbound is the last message before this one. The application adds a fixed sentence disclosing that when one is owed; never write it yourself. If that message is still open, address it or say what remains open; never imply recall the evidence lacks.",
      "With packet.continuity, context was compacted through continuity.through; only the summary covers it. continuity.lastInbound names the previous message. The application supplies any owed disclosure; never write it. Address that message if open, or state what remains open; never imply unsupported recall."],
    ["If packet.meaningIndexCoverage.disposition is \"degraded\", some summarized messages are findable only by their exact words: not finding something is never evidence it was not said.",
      "If packet.meaningIndexCoverage.disposition is \"degraded\", some summarized messages need exact-word lookup; a miss never proves they were not said."],
  ] as const;
  for (const [before, after] of revisions) {
    expect(text.split(before)).toHaveLength(2);
    text = text.replace(before, after);
  }
  // Preserve captured bytes and historical judgments. Translate the declared literal-copy
  // and claim-evidence additions only; these old PASSes do not certify the new evidence wording.
  return text.replace('For a later-action promise', `${LITERAL_COPY_INSTRUCTIONS}\n${CLAIM_EVIDENCE_GUIDANCE}\nFor a later-action promise`);
};

// Adapt only presentation here; the explicit retirement translation above handles the inventory change.
const compactRecordedNote = (text: string) => text
  .replace(/^- (?!tools:)[a-z][a-z0-9.-]*: /gmu, '- ')
  .replace('What you can do for the operator here:', 'Capabilities:')
  .replace('Internal machinery running under you:', 'Internal:');

it('translates only the exact retired inventory entry and retains unrelated capability drift', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/preview-prompt-2026-10-11.json', import.meta.url), 'utf8'));
  expect(capture.note.split(retiredStepCheck)).toHaveLength(2);
  const current = capabilityBriefing(path => readFileSync(path, 'utf8'), capture.limits).text;
  expect(renderedNote(capture.note)).toBe(current);
  expect(renderedNote(capture.note.replace(retiredStepCheck, ''))).toBe(current);
  // Changed retirement wording and drift in a retained capability must still fail equality.
  expect(renderedNote(capture.note.replace('changes nothing.', 'changes everything.'))).not.toBe(current);
  expect(renderedNote(capture.note.replace('faithfulness-checked', 'unchecked'))).not.toBe(current);
  expect(capture.note).toContain(retiredStepCheck);
});

it('replays preswitch update 840342287 with current self-description and the unchanged K11 rubric and declared capability revisions', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/selfdesc-outward-2026-10-11.json', import.meta.url), 'utf8'));
  expect(capture.update).toBe(840342287);
  const note = capabilityBriefing(path => readFileSync(path, 'utf8'), capture.limits).text;
  // This base retains its harness-specific tool label; no tool or authority changed.
  const restoreBaseToolLabel = (text: string) => compactRecordedNote(currentNote(text.replace('tools: full built-in set', 'tools: full Claude Code set')));
  expect(restoreBaseToolLabel(capture.replayNote).replace(capture.replayNote.split('\n')[0], SELF_IDENTITY)).toBe(note);
  expect(currentInstructions(capture.replayInstructions).replace(capture.replayNote.split('\n')[0], SELF_DESCRIPTION)).toBe(ANSWER_INSTRUCTIONS);
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
  expect(currentInstructions(capture.instructions).replace(capture.instructions.split('\n').find((line: string) => line.startsWith(SELF_IDENTITY)), SELF_DESCRIPTION)).toBe(ANSWER_INSTRUCTIONS);
  // Preserve historical prompt bytes; requested-step guidance is covered by act-first.test.ts.
  expect(capture.system.replace(CLOSED_SET_SENTENCE, '')).toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT.replace(MEMORY_DISAMBIGUATION, HISTORICAL_MEMORY).replace('give a brief decision rationale supported by the relevant evidence.', 'do all your reasoning there.').replace(COMPLETE_REQUESTED_STEPS, '').replace(COMPLETE_REQUESTED_WORK, ''));

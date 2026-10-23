import { MEMORY_DISAMBIGUATION } from '../../src/assembly/memory-answer-guidance.js';
import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { createHash } from 'node:crypto';
import { ANSWER_INSTRUCTIONS, LITERAL_COPY_INSTRUCTIONS, capabilitySentence, SELF_DESCRIPTION, SELF_IDENTITY } from './briefing.js';
import { SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { COMPLETE_REQUESTED_WORK, COMPLETE_REQUESTED_STEPS } from '../../src/assembly/tool-answer-guidance.js';
import { CLAIM_EVIDENCE_GUIDANCE } from './answer-provenance.js';
import { readAnswer } from './answer-reading.js';

// These captures predate memory-supersession/requested-work guidance and removal of the one-machine send restriction.
// Reconstruct their historical prompt without changing the captured evidence or current abilities.
const HISTORICAL_MEMORY = 'If two active memory items match the question but disagree, or refer to different people or things, ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; ignore corrected or forgotten items. ';

const historicalSendRestriction = 'Irreversible outward sends remain outside the one-machine closed set. ';
const historicalToolsSystem = SUBSCRIPTION_TOOLS_SYSTEM_PROMPT.replace(MEMORY_DISAMBIGUATION, HISTORICAL_MEMORY).replace('give a brief decision rationale supported by the relevant evidence.', 'do all your reasoning there.').replace(COMPLETE_REQUESTED_STEPS, '').replace(COMPLETE_REQUESTED_WORK, '')
  .replace('The effect doorway reports', `${historicalSendRestriction}The effect doorway reports`);

const evidence = JSON.parse(readFileSync(new URL('./fixtures/train-12-capability-2026-10-12.json', import.meta.url), 'utf8'));
// Historical prompts remain immutable; translate self-description and add literal-copy and claim-evidence guidance.
const currentInstructions = (text: string) => text.replace(text.split('\n').find(line => line.startsWith(SELF_IDENTITY))!, SELF_DESCRIPTION)
  .replace('For a later-action promise', `${LITERAL_COPY_INSTRUCTIONS}\n${CLAIM_EVIDENCE_GUIDANCE}\nFor a later-action promise`);
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;

// Replay the shipped second reading stage too: readAnswer serializes structured
// decisions; the journal worker extracts reply. A raw JSON envelope is not a reply.
async function rendered(value: string, question: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'train-12-replay-')));
  const now = 1790000000000;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(52), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 4, maxReplies: 4, maxTurns: 4, maxBytes: 131072, cursor: 0 });
  try {
    let calls = 0;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, sources: () => [],
      model: async () => { calls++; return value; }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      date: 1790000000, text: question } }]);
    await worker.drain();
    expect(calls).toBe(1);
    expect(journal.view.order[0]!.sent).toBe(1);
    return journal.view.order[0]!.intent;
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

it('retains live paraphrase and malformed-key failures beside the fixed-sample rendered replays', async () => {
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain(MEMORY_DISAMBIGUATION);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).not.toContain(HISTORICAL_MEMORY);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).not.toContain(historicalSendRestriction);
  expect(evidence.original.update).toBe(715675606);
  expect(evidence.original.judge).toMatchObject({ verdict: 'FAIL', reason: 'rendered tools/outbound sentence missing, altered or duplicated' });
  expect(evidence.original.answer.split('\n')).not.toContain(capabilitySentence(evidence.original.limits));
  expect(evidence.negativeReplay.update).toBe(715675606);
  expect(evidence.negativeReplay.judge).toMatchObject({ verdict: 'FAIL', reason: 'rendered tools/outbound sentence missing, altered or duplicated' });
  expect(evidence.negativeReplay.answer.split('\n')).not.toContain(capabilitySentence(evidence.negativeReplay.limits));
  expect(currentInstructions(evidence.liveReplay.instructions)).toBe(ANSWER_INSTRUCTIONS);
  expect(evidence.liveReplay.system).toBe(historicalToolsSystem);
  expect(currentInstructions(evidence.instructions)).toBe(ANSWER_INSTRUCTIONS);
  expect(evidence.system).toBe(historicalToolsSystem);
  expect(evidence.runs).toHaveLength(10);
  expect(evidence.question).toBe("What can you do in this chat, and what can't you do?");
  for (const run of [...evidence.runs, evidence.liveReplay]) {
    expect(run.update).toBe(run === evidence.liveReplay ? 715675606 : 840342414);
    expect(run.userMessage).toEqual({ role: 'user', content: evidence.question });
    expect(run.inputSha256).toMatch(/^[a-f0-9]{64}$/u);
    const reading = readAnswer(run.raw, { wrapped: 'accept' });
    expect(reading.ok).toBe(true);
    if (!reading.ok) throw Error(reading.defect);
    expect(reading.value).toBe(run.readerValue ?? run.answer);
    expect(await rendered(reading.value, evidence.question)).toBe(run.answer);
    expect(run.answer.split('\n').filter((line: string) => line === capabilitySentence(run.limits))).toHaveLength(run.run === 75 ? 0 : 1);
    expect(run.judge).toMatchObject({ verdict: run.run === 75 ? 'FAIL' : 'PASS', rubric: 'k11a-rubric-v3-rendered' });
  }
  const structured = evidence.runs.find((run: { run: number }) => run.run === 73);
  expect(structured.helperJudge.verdict).toBe('FAIL');
  expect(structured.judge.verdict).toBe('PASS');
  expect(JSON.parse(structured.readerValue).reply).toBe(structured.answer);
  const malformed = evidence.runs.find((run: { run: number }) => run.run === 75);
  expect(JSON.parse(malformed.raw)).toHaveProperty(' answer');
  expect(malformed.judge.verdict).toBe('FAIL');
  for (const run of [evidence.original, evidence.negativeReplay, ...evidence.runs, evidence.liveReplay]) {
    const note = run.capabilityNote;
    expect(note.provenance.excerptSha256).toBe(hash(note.text));
    expect(note.provenance.renderedCapabilitySha256).toBe(hash(capabilitySentence(run.limits)));
    expect(run.judge.digest).toBe(hash(JSON.stringify({ v: run.judge.rubric,
      note: note.text, reply: run.answer, provenance: note.provenance })));
  }
});

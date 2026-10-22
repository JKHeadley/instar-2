import { MEMORY_DISAMBIGUATION } from '../../src/assembly/memory-answer-guidance.js';
const HISTORICAL_MEMORY = 'If two active memory items match the question but disagree, or refer to different people or things, ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; ignore corrected or forgotten items. ';
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, obligationSchedule, openPreviewJournal,
  OBLIGATION_WORK_QUESTION, OBLIGATION_WORK_QUESTION_TOOLS } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { loopHealth } from './obligations.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/deferral-finish-2026-10-17.json', import.meta.url), 'utf8')) as {
  bot: string; operator: string; summaries: { output: string }[];
  cases: { update: number; at: number; message: string; answer: { id: string; output: string };
    before: { id: string; output: string };
    after: { output: string; input: string; question: string; systemSha256: string } }[];
};
function read(raw: string, id: string) {
  const result = readAnswer(raw, { wrapped: 'accept', evidence: [id] });
  if (!result.ok) throw Error(result.shape);
  return result.value;
}

it('preserves recorded provider provenance and both merged work instructions', () => {
  for (const sample of capture.cases) {
    // The recording predates completion accounting. Keep its bytes honest: the merged
    // question inserts the checklist and scheduled-preparation paragraphs before the runner-task suffix.
    const boundary = 'This is a runner task';
    const prefix = sample.after.question.slice(0, sample.after.question.indexOf(boundary));
    const suffix = sample.after.question.slice(sample.after.question.indexOf(boundary));
    expect(OBLIGATION_WORK_QUESTION.startsWith(prefix)).toBe(true);
    expect(OBLIGATION_WORK_QUESTION.endsWith(suffix)).toBe(true);
    const added = OBLIGATION_WORK_QUESTION.slice(prefix.length, -suffix.length);
    expect(createHash('sha256').update(added).digest('hex')).toBe('ec59dcb92ff6ed9e57e0ce21fac10dc7b78bec02f481c48306d03707001ba0b7');
    // Translate only the reviewed supersession wording; retain original capture and digest.
    expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain(MEMORY_DISAMBIGUATION);
    expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).not.toContain(HISTORICAL_MEMORY);
    expect(sample.after.systemSha256).toBe(createHash('sha256')
      .update(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT.replace(MEMORY_DISAMBIGUATION, HISTORICAL_MEMORY).replace('give a brief decision rationale supported by the relevant evidence.', 'do all your reasoning there.')).digest('hex'));

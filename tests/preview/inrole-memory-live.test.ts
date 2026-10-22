import { MEMORY_DISAMBIGUATION } from '../../src/assembly/memory-answer-guidance.js';
const HISTORICAL_MEMORY = 'If two active memory items match the question but disagree, or refer to different people or things, ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; ignore corrected or forgotten items. ';
/** Live train-6 updates 715675444/715675448: a durable fact was described as unsaved;
 * the public-send neighbour still needs authority. Captured model outputs, not invented replies. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope, toolPreparation } from './journal-envelope.js';
import { createHash } from 'node:crypto';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { COMPLETE_REQUESTED_WORK } from '../../src/assembly/tool-answer-guidance.js';
import { readAnswer } from './answer-reading.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/inrole-memory-live-2026-10-11.json', import.meta.url), 'utf8')) as {
  cases: { update: number; id: string; raw: string; text: string; oldReply: string; output: string; memoryDecision: string; systemSha256: string }[];
};
const key = new Uint8Array(32).fill(51);
const now = 1791710494163;
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '-1004367556355', operator: '7812716706', forum: true as const,
  grant: 'grant:recorded-memory-replay', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };

for (const recorded of fixture.cases) it(`replays real update ${recorded.update} through intake, answer and restart`, async () => {
  // Preserve the captured digest; identity, completion and brief-rationale guidance were added afterward.
  // Check outside the model port: the worker records thrown model errors as unknown outcomes.
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain(MEMORY_DISAMBIGUATION);
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).not.toContain(HISTORICAL_MEMORY);
  const capturedSystem = SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT.replace(MEMORY_DISAMBIGUATION, HISTORICAL_MEMORY).replace('give a brief decision rationale supported by the relevant evidence.', 'do all your reasoning there.').replace(
    "You are an Instar 2.0 agent,", 'You are Instar,').replace(COMPLETE_REQUESTED_WORK, '');

import { MEMORY_DISAMBIGUATION } from '../../src/assembly/memory-answer-guidance.js';
const HISTORICAL_MEMORY = 'If two active memory items match the question but disagree, or refer to different people or things, ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; ignore corrected or forgotten items. ';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { COMPLETE_REQUESTED_WORK, COMPLETE_REQUESTED_STEPS, READ_BEFORE_ANSWER } from '../../src/assembly/tool-answer-guidance.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT,
  SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { CODEX_CONVERSATION_SYSTEM_PROMPT, CODEX_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-codex-provider.js';
import { ANSWER_INSTRUCTIONS, MEMORY_LOOKUP_INSTRUCTIONS } from './briefing.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';
import { parseReplyReviewVerdict, REPLY_RULES, substantiveReply, guidanceReviewRules, replyReviewQuestion, replyReviewContext } from './reply-check.js';
// @ts-expect-error Physical tool trace reader stays outside the pure core.
import { toolTrace } from './tool-admission.mjs';

type Capture = { name: string; raw: string; answer: string | null; admission: string; system: string; question: string };
const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/act-first-2026-10-10.json', import.meta.url), 'utf8')) as {
  original: { update: number; answer: string; toolAttempts: unknown[]; review: { verdict: string } };
  runs: Capture[]; formatFailure: Capture;
};
// Historical captures predate the identity prefix, requested-step guidance and brief rationale.
// Preserve those bytes; check the added guidance on the current routes below.
const capturedSystem = SUBSCRIPTION_TOOLS_SYSTEM_PROMPT.replace(MEMORY_DISAMBIGUATION, HISTORICAL_MEMORY).replace('give a brief decision rationale supported by the relevant evidence.', 'do all your reasoning there.').replace(
  "You are an Instar 2.0 agent,", 'You are Instar,').replace(COMPLETE_REQUESTED_STEPS, '').replace(COMPLETE_REQUESTED_WORK, '');

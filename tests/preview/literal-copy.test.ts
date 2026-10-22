import { MEMORY_DISAMBIGUATION } from '../../src/assembly/memory-answer-guidance.js';
const HISTORICAL_MEMORY = 'If two active memory items match the question but disagree, or refer to different people or things, ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; ignore corrected or forgotten items. ';
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ANSWER_INSTRUCTIONS, LITERAL_COPY_INSTRUCTIONS, SELF_DESCRIPTION } from './briefing.js';
import { CLAIM_EVIDENCE_GUIDANCE } from './answer-provenance.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { readAnswer } from './answer-reading.js';
import { SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { COMPLETE_REQUESTED_WORK, COMPLETE_REQUESTED_STEPS } from '../../src/assembly/tool-answer-guidance.js';

// These provider captures predate train-41's requested-step verification guidance.
// Preserve the captures; the dedicated guidance tests cover the added instruction.
// Recorded captures predate the 2026-10-13 single-machine ruling; the current prompt drops only this sentence.
const CLOSED_SET_SENTENCE = 'Irreversible outward sends remain outside the one-machine closed set. ';
const historicalToolsSystem = SUBSCRIPTION_TOOLS_SYSTEM_PROMPT.replace(MEMORY_DISAMBIGUATION, HISTORICAL_MEMORY).replace('give a brief decision rationale supported by the relevant evidence.', 'do all your reasoning there.').replace(COMPLETE_REQUESTED_STEPS, '').replace(COMPLETE_REQUESTED_WORK, '');

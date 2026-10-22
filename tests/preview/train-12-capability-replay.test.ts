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

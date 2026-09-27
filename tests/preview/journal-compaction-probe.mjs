#!/usr/bin/env node
// Run only on an isolated copy of a quiesced preview journal.
import { existsSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { resolve, join } from 'node:path';
import { openPreviewJournal } from './journal.js';

const root = resolve(process.argv[2] ?? '');
if (process.argv.length !== 3 || !existsSync(join(root, '.journal-compaction-clone')))
  throw Error('compaction probe: isolated clone marker required');
const value = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
if (!value) throw Error('compaction probe: storage SecretRef unavailable');
const key = Buffer.from(value, /^[a-f0-9]{64}$/iu.test(value) ? 'hex' : 'base64');
if (key.length !== 32) throw Error('compaction probe: storage SecretRef malformed');
const path = join(root, 'journal.encrypted');
const journal = openPreviewJournal(path, key);
const before = journal.view, beforeBytes = journal.size;
try { journal.compact(); } finally { journal.close(); }
const replay = openPreviewJournal(path, key, undefined, undefined, true);
try {
  if (!isDeepStrictEqual(before, replay.view)) throw Error('compaction probe: projection changed');
  process.stdout.write(`${JSON.stringify({result:'verified',beforeBytes,afterBytes:replay.size,
    cursor:replay.view.cursor,turns:replay.view.order.length,calls:replay.view.calls,replies:replay.view.replies,
    stopped:replay.view.stop !== null,
    unknownCalls:replay.view.order.filter(turn => turn.reserved &&
      (turn.modelState === 'uncertain' || turn.answer === undefined)).length,
    unknownSends:replay.view.order.filter(turn => turn.intent !== undefined && turn.sent === undefined).length,
    holds:replay.view.order.filter(turn => turn.held !== undefined).length,
    reservations:replay.view.summaryReservations.size})}\n`);
} finally { replay.close(); }

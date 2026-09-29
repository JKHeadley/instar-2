import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

// Live-risk fixture (memory stub-models-hide-live-declaration-gaps). A request to do something at a later time is
// scheduled only through the dated decision's `remind: true` field, offered on every operator message (Rule 10),
// but the fixed conversation system prompt asks for a plain-text answer and never names that field; only packet
// guidance does. The real model's plain answer is the first shape below, and it schedules nothing. The declared
// shape is the positive neighbour.
const key = new Uint8Array(32).fill(59);
const zone = 'America/Los_Angeles';
const start = Date.UTC(2026, 8, 26, 17); // Saturday 2026-09-26 10:00 in Los Angeles.
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:live-shapes', configurationDigest: 'sha256:live-shapes', expires: Date.UTC(2026, 9, 10),
  maxCalls: 30, maxReplies: 30, maxTurns: 30, maxBytes: 12000, cursor: 0 };
const ASK = 'Send me a rundown of today at 6 pm.';

async function answerWith(answer: (question: string) => string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-live-shapes-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const sent: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false, timeZone: zone,
      model: async input => answer(input.question), checkOutbound: () => {},
      send: async input => { sent.push(input.expectedText); return sent.length; } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: ASK,
      date: Math.floor(start / 1000) + 60 } }]);
    await worker.drain();
    return { sent, grants: journal.view.dated.filter(item => item.remind).length };
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

it('real-model shape: a plain-text confirmation schedules nothing (live risk), the declared field does', async () => {
  const plain = await answerWith(() => 'Sure — I\'ll send you a rundown of today at 6 pm.');
  expect(plain.sent).toEqual(['PREVIEW — Sure — I\'ll send you a rundown of today at 6 pm.']);
  expect(plain.grants).toBe(0);
  const declared = await answerWith(question => JSON.stringify({ reply: 'Sure — I\'ll send you a rundown of today at 6 pm.',
    memory: [], dated: [{ quote: question, when: 'today at 6 pm', remind: true }] }));
  expect(declared.grants).toBe(1);
  expect(declared.sent[0]).toContain('I will act on this once at 2026-09-26 18:00 (America/Los_Angeles) and send you the result here.');
});

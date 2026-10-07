import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

// Live-proof group H, proof room two (root proofroom2-q-20261007-135832, build 670853ef, 2026-10-07 15:01-15:20 PDT).
// "Capacity test: summarise everything we've discussed in one sentence." landed as update 6232680 while a memory
// correction was still unsettled, so it was held "memory correction pending" (status-h-cap.json holds:
// [{update: 6232680, notice: "This reply is held while a memory correction is unresolved."}]). The correction then
// settled: updates 6232681 and 6232682 were both answered (inspect-h-cap.json last.update 6232681 answered: true;
// status-h-vault.json replies 18 of 19 turns), so nothing was holding ordinary answers any more. 6232680 was never
// answered. Eighteen minutes later, in the next H run against the SAME root, it was STILL held
// (H-proofroom2-20261007-151859/status-h-cap.json heldRepliesToday {update: 6232680, stillHeld: true}) and had
// dropped out of openQuestions, while a byte-identical message sent as update 6232683 was answered in 49 seconds.
//
// The release at journal.ts accepted only two settlement shapes -- an item flagged memoryUndecided, or a summary
// whose memoryFor names an item. pendingMemory() accepts a third: a summary frame that carries no memoryFor at all
// (memoryFor is written only when the span had a strict trigger or the model returned a memory change). That room
// had no memoryFor on any summary and nothing memoryUndecided, so the hold outlived its cause with no route out: a
// latch, not a wait -- the same failure shape as 2026-10-01's faithfulness latch, in the other release path.
// Rules 15, 77 and 95's open side: reachability to the operator fails open, and the capacity outcome itself was
// correct and recorded as success (Rule 40) -- the turn simply never got its reply.
const key = new Uint8Array(32).fill(41);
const start = Date.UTC(2026, 9, 7, 22, 0);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:correction-hold-latch', configurationDigest: 'sha256:correction-hold-latch',
  expires: Date.UTC(2026, 10, 10), maxCalls: 50, maxReplies: 50, maxTurns: 20, maxBytes: 262144, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${String(n)}`;
const CUED = 'Actually, the kettle is on shelf 2, not shelf 1.';
const PLAIN = 'A short note about the kettle.';
const HELD_TEXT = 'Capacity test: summarise everything we have discussed in one sentence.';
const LATER_TEXT = 'Quick check from the desk: are you there? One short line is enough.';
const update = (n: number, text: string) => ({ update_id: n,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    date: Math.floor(start / 1000) + n * 60 } });
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-hold-latch-${name}-`)));

/** The recorded room, rebuilt: a settled correction request, an ordinary turn already held for it, and one later
 * ordinary turn. The summary covering them carries no memoryFor, which is exactly what that room recorded. */
const world = (root: string, request: string) => {
  const sent: string[] = [];
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(journal, { now: () => start + 10 * 60_000, stopped: () => false,
    timeZone: 'America/Los_Angeles',
    model: async (input: { id: string; question: string }) => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator asked about the kettle.', people: [], memory: [] })
      : JSON.stringify({ reply: `Noted: ${input.question}`, memory: [], dated: [] }),
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } });
  worker.intake([update(1, request), update(2, HELD_TEXT), update(3, LATER_TEXT)]);
  journal.append({ kind: 'hold', id: id(2), reason: 'memory correction pending', at: start + 4 * 60_000 });
  journal.append({ kind: 'summary-reserve', through: 3, at: start + 5 * 60_000 });
  journal.append({ kind: 'summary', through: 3, text: 'The operator asked about the kettle.', at: start + 5 * 60_000 });
  return { journal, worker, sent };
};

it('answers a turn held for a correction that has since settled, not only the turns after it', async () => {
  const root = tmp('settled');
  try {
    const w = world(root, CUED);
    await w.worker.drain(); await w.worker.drain();
    const held = w.journal.view.order.find(turn => turn.id === id(2))!;
    // The later turn proves nothing was holding ordinary answers; the held one must not be the only turn left out.
    expect(w.sent.some(text => text.includes(LATER_TEXT))).toBe(true);
    expect(held.held).toBeUndefined();
    expect(w.journal.view.heldTurns.size).toBe(0);
    expect(w.sent.some(text => text.includes(HELD_TEXT))).toBe(true);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a correction hold that has no request behind it at all', async () => {
  const root = tmp('norequest');
  try {
    const w = world(root, PLAIN);
    await w.worker.drain(); await w.worker.drain();
    const held = w.journal.view.order.find(turn => turn.id === id(2))!;
    expect(held.held).toBe('memory correction pending');
    expect(w.sent.some(text => text.includes(HELD_TEXT))).toBe(false);
    // The rest of the channel keeps being answered either way.
    expect(w.sent.some(text => text.includes(LATER_TEXT))).toBe(true);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

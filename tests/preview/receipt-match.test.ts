import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, replyOutcomeOf, type PreviewPorts } from './journal-test-worker.js';
import { encodeReply, splitReply, TELEGRAM_MESSAGE_LIMIT } from './reply-parts.js';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/receipt-match-c1-2026-10-14.json', import.meta.url), 'utf8')) as {
  update: number; request: string; answer: string;
};
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const key = new Uint8Array(32).fill(83);
const update = { update_id: recorded.update, message: { message_id: 1, chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text: recorded.request } };
function fixture(answer: string, mismatch?: 'chat' | 'id' | 'text' | 'thread') {
  const root = mkdtempSync(join(tmpdir(), 'receipt-match-')); roots.push(root);
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  const calls: Parameters<PreviewPorts['send']>[0][] = [];
  const ports: PreviewPorts = { now: () => 1000, stopped: () => false, model: async () => answer, checkOutbound: () => {},
    send: async input => {
      calls.push(input);
      expect(journal.verifyOutbound(input.provenance, { target: input.target!, chat: input.chat,
        ...(input.thread === undefined ? {} : { thread: input.thread }), body: input.text })).toBe(true);
      if (input.formatting) expect(input.expectedText).toBe(input.formatting.shown);
      else expect(input.text).toBe(encodeReply(input.expectedText));
      expect(input.expectedText).toBe(input.expectedText.trimEnd());
      const fault = input.target?.startsWith('reply:') ? mismatch : undefined;
      // Counterfactual provider receipt: the original incident did not retain this body.
      return classifyTelegramSend({ kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result: {
        chat: { id: fault === 'chat' ? 999 : Number(input.chat) }, message_id: fault === 'id' ? 0 : calls.length,
        text: fault === 'text' ? `${input.expectedText}!` : input.expectedText.trimEnd(),
        ...(input.thread === undefined ? {} : { message_thread_id: fault === 'thread' ? input.thread + 1 : input.thread }),
      } }) }, input);
    } };
  return { journal, path, calls, ports, worker: createJournalWorker(journal, ports) };
}

it.each(['\n', ' \t\r\n', '\u00a0\n'])('canonicalizes a fitting reply before signing and accepts the stripped receipt (%j)', async suffix => {
  const original = recorded.answer.trimEnd() + suffix;
  const f = fixture(original);
  try {
    f.worker.intake([update]); await f.worker.drain();
    const turn = f.journal.view.order[0]!;
    expect(turn.answer).toBe(original);
    expect(turn.intent).toBe(original.trimEnd());
    expect(turn.sent).toBe(1);
    expect(f.calls).toHaveLength(1);
    // This capture uses bold month names; Telegram's receipt carries their text without markers.
    expect(f.calls[0]!.expectedText).toBe(original.trimEnd().replaceAll('**', ''));
    await f.worker.drain(); expect(f.calls).toHaveLength(1);
    f.journal.close();
    const reopened = openPreviewJournal(f.path, key);
    try {
      expect(reopened.view.order[0]!.answer).toBe(original);
      expect(reopened.view.order[0]!.intent).toBe(original.trimEnd());
      await createJournalWorker(reopened, f.ports).drain(); expect(f.calls).toHaveLength(1);
    } finally { reopened.close(); }
  } finally { f.journal.close(); }
});

it.each(['chat', 'id', 'text', 'thread'] as const)('a mismatched %s stays UNKNOWN across drain and reopen, never resent', async mismatch => {
  const f = fixture(recorded.answer, mismatch);
  try {
    f.worker.intake([{ ...update, message: { ...update.message, message_thread_id: 7 } }]);
    await f.worker.drain();
    const turn = f.journal.view.order[0]!;
    expect(turn.sent).toBeUndefined();
    expect(replyOutcomeOf(f.journal.view, turn).outcome).toMatchObject({ kind: 'unknown' });
    expect(f.calls.filter(call => call.target?.startsWith('reply:'))).toHaveLength(1);
    await f.worker.drain(); f.journal.close();
    const reopened = openPreviewJournal(f.path, key);
    try {
      await createJournalWorker(reopened, f.ports).drain();
      expect(reopened.view.order[0]!.sent).toBeUndefined();
      expect(f.calls.filter(call => call.target?.startsWith('reply:'))).toHaveLength(1);
    } finally { reopened.close(); }
  } finally { f.journal.close(); }
});

it('trims before measuring, preserves interior whitespace, and keeps the canonical tail whole when splitting', () => {
  const exact = 'x'.repeat(TELEGRAM_MESSAGE_LIMIT);
  expect(splitReply(`${exact}\n \t`)).toEqual([exact]);
  expect(splitReply('  first\n\nsecond \n')).toEqual(['  first\n\nsecond']);
  const tail = '\n\nApprove this request? \t\n';
  const parts = splitReply(`${recorded.answer.repeat(4)}${tail}`, tail)!;
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.every(part => part === part.trimEnd())).toBe(true);
  expect(parts.at(-1)!.endsWith(tail.trim())).toBe(true);
  expect(parts.slice(0, -1).every(part => !part.includes('Approve this request?'))).toBe(true);
});

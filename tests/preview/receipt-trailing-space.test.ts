// Offline diagnostic shapes only; no provider-normalization or live-incident claim.
import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';
import { settleSendOutcome } from './outbound-provenance.js';
import { createJournalWorker, openPreviewJournal, UNKNOWN_SEND_NOTICE } from './journal-test-worker.js';
import { sendOutcomeCounts } from './journal.js';

const response = (text: unknown, fields: object = {}) => ({ kind: 'response', status: 200,
  bytes: JSON.stringify({ ok: true, result: { chat: { id: 7 }, message_id: 1080, text, ...fields } }) });
const expected = { chat: '7', expectedText: 'hello \n' };

it.each(['', 'hello', 'hello ', 'hello\n', 'hello \n', 'hello\t', 'hello\r', 'hello\u00a0'])(
  'preserves train-19 exact equality, including empty text: %j', text => {
    expect(classifyTelegramSend(response(text), { chat: '7', expectedText: text }))
      .toEqual({ kind: 'accepted', message: 1080 });
  });

it.each(['hello', 'hello ', 'hello\n', 'hello \n\n', ' hello \n', 'HELLO \n'])(
  'keeps each non-exact receipt UNKNOWN and diagnoses text: %j', text => {
    expect(classifyTelegramSend(response(text), expected)).toMatchObject({ kind: 'unknown',
      reason: expect.stringContaining('receipt differs from intent: text len=7/') });
  });

it.each([
  [{ chat: { id: 8 } }, {}, 'chat'], [{ message_thread_id: 4 }, { thread: 3 }, 'thread'],
  [{}, { thread: 3 }, 'thread'], [{ message_thread_id: 4 }, { forum: true }, 'thread'],
  [{ message_id: 0 }, {}, 'message_id'], [{ message_id: -1 }, {}, 'message_id'],
  [{ message_id: 1.5 }, {}, 'message_id'], [{ message_id: '1080' }, {}, 'message_id'],
  [{ message_id: Number.MAX_SAFE_INTEGER + 1 }, {}, 'message_id'],
] as const)('names only mismatching identity fields: %j', (fields, scope, field) => {
  expect(classifyTelegramSend(response(expected.expectedText, fields), { ...expected, ...scope }))
    .toEqual({ kind: 'unknown', reason: `receipt differs from intent: ${field}` });
});

it('retains all mismatch fields and bounded, redacted UTF-16 text diagnostics through settlement', () => {
  const outcome = classifyTelegramSend(response('credential-PRIVATE\n', { chat: { id: 'PRIVATE' },
    message_thread_id: 'PRIVATE', message_id: 'PRIVATE' }), { chat: '7', thread: 3, expectedText: 'credential-SECRET\t' });
  expect(outcome.kind).toBe('unknown');
  if (outcome.kind !== 'unknown') throw Error('expected unknown receipt');
  expect(outcome.reason).toContain('chat,thread,message_id,text');
  expect(outcome.reason).toContain('len=18/19');
  expect(outcome.reason).toContain('at=11');
  expect(outcome.reason).toContain('\\t');
  expect(outcome.reason).toContain('\\n');
  expect(outcome.reason).not.toMatch(/PRIVATE|SECRET|credential/);
  expect(outcome.reason.length).toBeLessThanOrEqual(200);
  expect(settleSendOutcome(outcome)).toEqual(outcome);
});

it('reports non-string text without echoing untrusted data', () => {
  const outcome = classifyTelegramSend(response({ token: 'PRIVATE' }), expected);
  expect(outcome).toMatchObject({ kind: 'unknown' });
  if (outcome.kind !== 'unknown') throw Error('expected unknown receipt');
  expect(outcome.reason).toContain('text');
  expect(outcome.reason).toContain('type=object');
  expect(outcome.reason).not.toContain('PRIVATE');
});

it('records the masked reason in the encrypted journal and status projection across reopen without resending', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'receipt-diagnostics-'));
  const file = join(dir, 'journal.encrypted'), key = new Uint8Array(32).fill(7);
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7', operator: '7', grant: 'TEST-diagnostics',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 100,
    maxTurns: 100, maxBytes: 262144, cursor: 0 };
  const journal = openPreviewJournal(file, key, genesis);
  let sends = 0;
  const outcome = classifyTelegramSend(response('hello'), expected);
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => expected.expectedText, checkOutbound: () => {}, send: async input => {
        if (input.expectedText === UNKNOWN_SEND_NOTICE) return 1081;
        sends++;
        expect(input.expectedText).toBe(expected.expectedText);
        expect(journal.view.order[0]?.intent).toBeDefined();
        expect(journal.verifyOutbound(input.provenance, { target: input.target!, chat: input.chat, body: input.text })).toBe(true);
        return outcome;
      } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7, type: 'private' },
      from: { id: 7 }, text: 'Please say hello.' } }]);
    await worker.drain();
    expect(sends).toBe(1);
    expect(journal.view.order[0]?.sent).toBeUndefined();
    const row = journal.view.sendOutcomes.find(item => item.target.startsWith('reply:'));
    expect(row).toMatchObject({ outcome: 'unknown', reason:
      `receipt differs from intent: text len=7/5 at=5 excerpt=${JSON.stringify('.. \n')}/${JSON.stringify('..')}` });
    journal.close();
    const replay = openPreviewJournal(file, key, genesis);
    try {
      expect(replay.view.sendOutcomes.find(item => item.target.startsWith('reply:'))).toEqual(row);
      expect(sendOutcomeCounts(replay.view)).toMatchObject({ unknown: 1, lastUnknown: row,
        unknownReasons: { [row!.reason]: 1 } });
      const resumed = createJournalWorker(replay, { now: () => 2000, stopped: () => false,
        model: async () => { throw Error('model repeated'); }, checkOutbound: () => {},
        send: async () => { sends++; throw Error('send repeated'); } });
      await resumed.drain();
      expect(sends).toBe(1);
    } finally { replay.close(); }
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

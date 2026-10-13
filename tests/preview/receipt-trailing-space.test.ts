// Recorded outgoing bytes, synthetic receipt neighbours: the incident's receipt was not retained.
import { expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';
import { settleSendOutcome } from './outbound-provenance.js';
import { createJournalWorker, openPreviewJournal, UNKNOWN_SEND_NOTICE } from './journal-test-worker.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/receipt-trailing-space-2026-10-13.json', import.meta.url), 'utf8')) as {
  update: number; intent: string };
const response = (text: unknown, fields: object = {}) => ({ kind: 'response', status: 200,
  bytes: JSON.stringify({ ok: true, result: { chat: { id: 7 }, message_id: 1080, text, ...fields } }) });
const expected = { chat: '7', expectedText: captured.intent };

it('accepts the captured 1031-character intent with only its terminal LF removed', () => {
  expect(captured.intent).toHaveLength(1031);
  expect(captured.intent.endsWith('**March**\n')).toBe(true);
  expect(classifyTelegramSend(response(captured.intent.slice(0, -1)), expected))
    .toEqual({ kind: 'accepted', message: 1080 });
});

it.each(['', ' ', '\n', ' \n \n'])('accepts exact text or complete trailing space/LF removal: %j', suffix => {
  for (const actual of [`hello${suffix}`, 'hello'])
    expect(classifyTelegramSend(response(actual), { chat: '7', expectedText: `hello${suffix}` }))
      .toEqual({ kind: 'accepted', message: 1080 });
});

it.each([
  ['hello world', 'hello  world'], ['hello\nworld', 'hello world'], ['hello', 'hello\n'],
  [' hello', 'hello'], ['hello\t', 'hello'], ['hello\r', 'hello'], ['hello\u00a0', 'hello'],
  ['hello\u200b', 'hello'], ['hello\n\n', 'hello\n'], ['**March**\n', '**April**'],
  ['&amp;\n', '&'], ['é\n', 'e\u0301'], [' \n', ''], ['', ''], ['hello', null],
])('keeps unsupported text differences UNKNOWN: %j -> %j', (intent, receipt) => {
  expect(classifyTelegramSend(response(receipt), { chat: '7', expectedText: intent }).kind).toBe('unknown');
});

it.each([
  [{ chat: { id: 8 } }, {}, 'chat'], [{ message_thread_id: 4 }, { thread: 3 }, 'thread'],
  [{}, { thread: 3 }, 'thread'], [{ message_thread_id: 4 }, { forum: true }, 'thread'],
  [{ message_id: 0 }, {}, 'message_id'], [{ message_id: -1 }, {}, 'message_id'],
  [{ message_id: 1.5 }, {}, 'message_id'], [{ message_id: '1080' }, {}, 'message_id'],
  [{ message_id: Number.MAX_SAFE_INTEGER + 1 }, {}, 'message_id'],
] as const)('names mismatching identity fields despite normalized text: %j', (fields, scope, field) => {
  const outcome = classifyTelegramSend(response(captured.intent.slice(0, -1), fields), { ...expected, ...scope });
  expect(outcome.kind).toBe('unknown');
  if (outcome.kind !== 'unknown') throw Error('expected unknown receipt');
  expect(outcome.reason).toContain(field);
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

it.each(['trimmed', 'exact', 'content', 'chat', 'thread', 'message_id', 'lost-receipt', 'refused'])(
  'the real journal settles %s once and never redispatches after restart', async mode => {
    const dir = mkdtempSync(join(tmpdir(), 'receipt-space-'));
    const key = new Uint8Array(32).fill(7);
    const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7', operator: '7', grant: 'TEST-receipt',
      configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 100,
      maxTurns: 100, maxBytes: 262144, cursor: 0 };
    let sends = 0;
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
    try {
      const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
        model: async () => captured.intent, checkOutbound: () => {}, send: async input => {
          if (input.expectedText === UNKNOWN_SEND_NOTICE) return 1081;
          sends++;
          expect(input.expectedText).toBe(captured.intent);
          expect(journal.view.order[0]?.intent).toBeDefined();
          expect(journal.verifyOutbound(input.provenance, { target: input.target!, chat: input.chat, body: input.text })).toBe(true);
          // A physical send followed by a lost response is never proof of non-delivery.
          if (mode === 'lost-receipt') throw Error('connection lost after dispatch');
          if (mode === 'refused') return classifyTelegramSend({ kind: 'response', status: 403,
            bytes: JSON.stringify({ ok: false }) }, expected);
          return classifyTelegramSend(response(mode === 'exact' ? captured.intent : mode === 'content'
            ? captured.intent.replace('January', 'June') : captured.intent.slice(0, -1),
          mode === 'chat' ? { chat: { id: 8 } } : mode === 'thread' ? { message_thread_id: 4 }
            : mode === 'message_id' ? { message_id: 0 } : {}), { ...expected, ...(mode === 'thread' ? { thread: 3 } : {}) });
        } });
      worker.intake([{ update_id: captured.update, message: { chat: { id: 7, type: 'private' },
        from: { id: 7 }, text: 'Please give me a garden plan.' } }]);
      await worker.drain();
      const accepted = mode === 'trimmed' || mode === 'exact';
      expect(sends).toBe(1);
      expect(journal.view.order[0]?.sent).toBe(accepted ? 1080 : undefined);
      const outcome = journal.view.sendOutcomes.find(row => row.target.startsWith('reply:'));
      // Accepted deliveries have a sent row; send-outcome rows retain non-successes only.
      expect(outcome?.outcome).toBe(accepted ? undefined : mode === 'refused' ? 'refused' : 'unknown');
      if (['content', 'chat', 'thread', 'message_id'].includes(mode))
        expect(outcome?.reason).toContain(mode === 'content' ? 'text' : mode);
      journal.close();
      const replay = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
      try {
        const resumed = createJournalWorker(replay, { now: () => 2000, stopped: () => false,
          model: async () => { throw Error('answer repeated'); }, checkOutbound: () => {},
          send: async () => { sends++; throw Error('send repeated'); } });
        await resumed.drain();
        expect(sends).toBe(1);
        expect(replay.view.order[0]?.sent).toBe(accepted ? 1080 : undefined);
        expect(replay.view.sendOutcomes.find(row => row.target.startsWith('reply:'))).toEqual(outcome);
      } finally { replay.close(); }
    } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
  });

it('a crash image between physical send and receipt remains UNKNOWN even when normalization could match', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'receipt-crash-'));
  const file = join(dir, 'journal.encrypted'), crashed = join(dir, 'crashed.encrypted');
  const key = new Uint8Array(32).fill(7);
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7', operator: '7', grant: 'TEST-crash',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 100,
    maxTurns: 100, maxBytes: 262144, cursor: 0 };
  const journal = openPreviewJournal(file, key, genesis);
  let sends = 0, notices = 0;
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => captured.intent, checkOutbound: () => {}, send: async () => {
        sends++;
        // Durable bytes at the moment the network effect has happened but no outcome is known.
        copyFileSync(file, crashed);
        return classifyTelegramSend(response(captured.intent.slice(0, -1)), expected);
      } });
    worker.intake([{ update_id: captured.update, message: { chat: { id: 7, type: 'private' },
      from: { id: 7 }, text: 'Please give me a garden plan.' } }]);
    await worker.drain();
    expect(journal.view.order[0]?.sent).toBe(1080);
    journal.close();
    const replay = openPreviewJournal(crashed, key, genesis);
    try {
      expect(replay.view.order[0]?.intent).toBe(captured.intent);
      expect(replay.view.order[0]?.sent).toBeUndefined();
      expect(replay.view.sendOutcomes).toHaveLength(0);
      const resumed = createJournalWorker(replay, { now: () => 2000, stopped: () => false,
        model: async () => { throw Error('model repeated'); }, checkOutbound: () => {}, send: async input => {
          if (input.expectedText === UNKNOWN_SEND_NOTICE) { notices++; return 1081; }
          sends++; return 1082;
        } });
      await resumed.drain(); await resumed.drain();
      expect(sends).toBe(1);
      expect(notices).toBe(1);
      expect(replay.view.order[0]?.sent).toBeUndefined();
    } finally { replay.close(); }
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

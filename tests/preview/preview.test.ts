// @ts-nocheck -- recorded test host joins production owner ports to explicit fixture authorities.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import {
  FIXED_LIMITED_RESPONSE, PREVIEW_LABEL, PREVIEW_STAND_IN_LEDGER, createPreviewComposition,
} from './composition.js';
import { openPreviewState, previewTurnId } from './state.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function root() {
  const path = realpathSync(mkdtempSync(join(tmpdir(), 'preview-stage1-')));
  roots.push(path);
  return path;
}

function update(updateId: number, sender: number, text: string) {
  return { update_id: updateId, message: { message_id: updateId + 1000,
    from: { id: sender, is_bot: false, first_name: `sender-${sender}` },
    chat: { id: 7001, type: 'private', first_name: 'preview' }, date: 1_700_000_000, text } };
}

function recordedTelegram(batches: readonly (readonly object[])[]) {
  const remaining = batches.map(batch => [...batch]);
  const calls: { method: string; body: unknown }[] = [];
  let sent = 0;
  return { calls, io: { invoke(request) {
    calls.push({ method: request.method, body: request.body });
    if (request.method === 'getMe') return { kind: 'response', status: 200,
      bytes: JSON.stringify({ ok: true, result: { id: 9001, is_bot: true, username: 'fixture_bot', first_name: 'Preview' } }) };
    if (request.method === 'getUpdates') return { kind: 'response', status: 200,
      bytes: JSON.stringify({ ok: true, result: remaining.shift() ?? [] }) };
    sent += 1;
    return { kind: 'response', status: 200, bytes: JSON.stringify({ ok: true,
      result: { message_id: 8000 + sent, chat: { id: 7001, type: 'private' }, text: request.body.text } }) };
  } } };
}

function setup(path: string, transport, hooks = {}) {
  const expiresAt = 2_000_000_000_000;
  const configuration = { root: path, machine: 'preview-test-machine', botId: '9001', botUsername: '@fixture_bot',
    operatorSenderId: '7', chatId: '7001', forum: false, messageThreadId: null,
    maxPollSeconds: 1, maxBatchItems: 8, maxContextTurns: 8, maxContextBytes: 65_536 };
  const stateConfiguration = { ...configuration, expiresAt, replyLimit: 6, replyWindowMs: 60_000, errorLimit: 3 };
  const state = openPreviewState({ root: path, configuration: stateConfiguration, expiresAt,
    now: () => 1_800_000_000_000, replyLimit: 6, replyWindowMs: 60_000, errorLimit: 3 });
  const composition = () => createPreviewComposition({ configuration, state,
    storageKey: new Uint8Array(32).fill(19), storageIO: productionStorageIO, telegramIO: transport.io,
    resolveSecret: reference => {
      if (reference.vault === 'preview' && reference.name === 'telegram-bot-token') {
        return '9001:synthetic_recorded_test_only_value';
      }
      throw new Error('recorded resolver refused');
    }, hooks });
  return { configuration, state, composition };
}

describe('Stage 1 preview driver (recorded transport only)', () => {
  it('takes two bound inbound turns through real Telegram/Four/Five/Six/Eight owners, preserves an outsider, and labels every reply', () => {
    expect(process.env.INSTAR_TELEGRAM_LIVE_TEST).toBeUndefined();
    const path = root();
    const telegram = recordedTelegram([[update(100, 7, 'first'), update(101, 8, 'outsider'), update(102, 7, 'second')]]);
    const built = setup(path, telegram);
    const composition = built.composition();
    try {
      const cycle = composition.pollOnce();
      expect(cycle.captured).toHaveLength(3);
      const document = built.state.read();
      expect(document.turns[previewTurnId('9001', 100)].phase).toBe('sent');
      expect(document.turns[previewTurnId('9001', 101)].phase).toBe('ignored-out-of-scope');
      expect(document.turns[previewTurnId('9001', 102)].phase).toBe('sent');
      expect(document.turns[previewTurnId('9001', 102)].contextReferences).toHaveLength(2);
      const sends = telegram.calls.filter(call => call.method === 'sendMessage');
      expect(sends).toHaveLength(2);
      expect(sends.every(call => call.body.text === FIXED_LIMITED_RESPONSE
        && call.body.text.startsWith(PREVIEW_LABEL))).toBe(true);
      const facts = composition.storage.segment.read();
      const admitted = facts.filter(row => row.kind === 'intake-admitted');
      expect(admitted).toHaveLength(3);
      expect(admitted.find(row => row.body.eventId === '100').body.binding).not.toBe('none');
      expect(admitted.find(row => row.body.eventId === '101').body.binding).toBe('none');
      expect(admitted.find(row => row.body.eventId === '102').body.binding).not.toBe('none');
    } finally { composition.close(); }
  }, 30_000);

  it('resumes after the durable intake cut and sends once', () => {
    const path = root();
    const telegram = recordedTelegram([[update(100, 7, 'cut after intake')]]);
    let cut = true;
    const first = setup(path, telegram, { afterIntake: turn => {
      if (cut && turn.phase === 'intake-preserved') { cut = false; throw new Error('cut after intake'); }
    } });
    const initial = first.composition();
    expect(() => initial.pollOnce()).toThrow('cut after intake');
    initial.close();
    expect(first.state.read().turns[previewTurnId('9001', 100)].phase).toBe('intake-preserved');

    const restarted = setup(path, telegram).composition();
    try { restarted.resume(); } finally { restarted.close(); }
    expect(telegram.calls.filter(call => call.method === 'sendMessage')).toHaveLength(1);
    expect(first.state.read().turns[previewTurnId('9001', 100)].phase).toBe('sent');
  }, 30_000);

  it('records a cut after dispatch as outcome unknown and never repeats the send', () => {
    const path = root();
    const telegram = recordedTelegram([[update(100, 7, 'cut after dispatch')]]);
    let cut = true;
    const first = setup(path, telegram, { afterDispatch: () => {
      if (cut) { cut = false; throw new Error('cut after dispatch'); }
    } });
    const initial = first.composition();
    expect(() => initial.pollOnce()).toThrow('cut after dispatch');
    initial.close();
    expect(first.state.read().turns[previewTurnId('9001', 100)].phase).toBe('dispatch-outcome-unknown');
    expect(telegram.calls.filter(call => call.method === 'sendMessage')).toHaveLength(1);

    const restarted = setup(path, telegram).composition();
    try { restarted.resume(); } finally { restarted.close(); }
    expect(telegram.calls.filter(call => call.method === 'sendMessage')).toHaveLength(1);
    expect(first.state.read().turns[previewTurnId('9001', 100)].phase).toBe('dispatch-outcome-unknown');
  }, 30_000);

  it('honours a durable stop before admission/poll/dispatch and latches expiry', () => {
    const stoppedRoot = root();
    const telegram = recordedTelegram([[update(400, 7, 'must not poll')]]);
    const stopped = setup(stoppedRoot, telegram);
    stopped.state.latchStop('operator');
    expect(() => stopped.composition()).toThrow('preview stopped before admit');
    expect(telegram.calls).toHaveLength(0);

    const dispatchRoot = root();
    const dispatchTelegram = recordedTelegram([[update(100, 7, 'stop before dispatch')]]);
    const dispatchStopped = setup(dispatchRoot, dispatchTelegram);
    const dispatchComposition = createPreviewComposition({ configuration: dispatchStopped.configuration,
      state: dispatchStopped.state, storageKey: new Uint8Array(32).fill(19), storageIO: productionStorageIO,
      telegramIO: dispatchTelegram.io,
      resolveSecret: () => '9001:synthetic_recorded_test_only_value',
      hooks: { beforeDispatch: () => { dispatchStopped.state.latchStop('operator'); } } });
    try {
      expect(() => dispatchComposition.pollOnce()).toThrow('preview stopped before dispatch');
      expect(dispatchTelegram.calls.filter(call => call.method === 'sendMessage')).toHaveLength(0);
      expect(dispatchStopped.state.read().turns[previewTurnId('9001', 100)].phase).toBe('grounded');
    } finally { dispatchComposition.close(); }

    const expiredRoot = root();
    const configuration = { marker: 'expiry' };
    const state = openPreviewState({ root: expiredRoot, configuration, expiresAt: 20,
      now: (() => { let instant = 10; return () => instant; })(), replyLimit: 1, replyWindowMs: 10, errorLimit: 1 });
    // Reopen with a clock at the exact finite boundary.
    const expired = openPreviewState({ root: expiredRoot, configuration, expiresAt: 20,
      now: () => 20, replyLimit: 1, replyWindowMs: 10, errorLimit: 1 });
    expect(() => expired.gate('poll')).toThrow('preview stopped before poll');
    expect(expired.read().stop?.reason).toBe('expiry');
  });

  it('keeps a complete, uniquely named stand-in ledger', () => {
    expect(PREVIEW_STAND_IN_LEDGER.map(row => row.name)).toEqual([
      'fixture-governance-and-register',
      'fixture-signing-and-standing-grants',
      'fixture-clock-and-verification-host',
      'fixture-five-six-run-admission',
      'fixture-context-assembler',
      'fixture-effect-peer-directory',
      'fixture-nine-effect-assessor',
      'fixture-five-source-result',
    ]);
    expect(PREVIEW_STAND_IN_LEDGER.every(row => row.claims.includes('only') || row.claims.includes('not'))).toBe(true);
  });
});

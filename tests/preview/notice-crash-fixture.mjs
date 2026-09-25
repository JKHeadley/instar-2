import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { createPreviewComposition } from './composition.js';
import { openPreviewState, previewTurnId } from './state.js';
import { decideUnansweredTurn } from '../../src/sentinels/unanswered-turn.js';

const root = process.argv[2], mode = process.argv[3];
const configuration = { root, machine: 'preview-test-machine', botId: '9001', botUsername: '@fixture_bot',
  operatorSenderId: '7', chatId: '7001', chatKind: 'private', forum: false, messageThreadId: null,
  maxPollSeconds: 1, maxBatchItems: 1, maxContextTurns: 8, maxContextBytes: 65536 };
const expiresAt = 3000000;
let clock = 1000000;
const limits = { replyLimit: 6, replyWindowMs: 60000, errorLimit: 5, totalErrorLimit: 100,
  maxPendingTurns: 16, maxTrialTurns: 128 };
const { totalErrorLimit, ...configLimits } = limits;
const state = openPreviewState({ root, configuration: { ...configuration, expiresAt, ...configLimits },
  expiresAt, now: () => clock, ...limits, totalErrorLimit, create: mode !== 'check' });
const turnId = previewTurnId('9001', 10);
if (mode === 'check') {
  const turn = state.read().turns[turnId];
  const decision = decideUnansweredTurn({ turns: [{ ...turn, held: true }], stopped: false, expiresAt }, 1200000);
  if (decision !== null || turn.phase !== 'dispatch-outcome-unknown' || existsSync(join(root, 'sends.log'))) process.exit(2);
  process.exit(0);
}
const update = { update_id: 10, message: { message_id: 1010, from: { id: 7, is_bot: false, first_name: 'operator' },
  chat: { id: 7001, type: 'private', first_name: 'preview' }, date: 1700, text: 'hello' } };
const io = { invoke(request) {
  if (request.method === 'getMe') return { kind: 'response', status: 200,
    bytes: JSON.stringify({ ok: true, result: { id: 9001, is_bot: true, username: 'fixture_bot', first_name: 'Preview' } }) };
  if (request.method === 'getUpdates') return { kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result: [update] }) };
  appendFileSync(join(root, 'sends.log'), 'send\n');
  return { kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result: {
    message_id: 9001, chat: { id: 7001, type: 'private' }, text: request.body.text } }) };
} };
const composition = createPreviewComposition({ configuration, state, noticeOnly: true,
  storageKey: new Uint8Array(32).fill(19), storageIO: productionStorageIO, telegramIO: io,
  now: () => 100, resolveSecret: () => '9001:synthetic_recorded_test_only_value',
  hooks: mode === 'crash' ? { afterNoticePrepare: () => process.kill(process.pid, 'SIGKILL') } : {} });
composition.pollOnce();
clock = 1200000;
const decision = decideUnansweredTurn({ turns: [{ ...state.read().turns[turnId], held: true }], stopped: false, expiresAt }, clock);
if (!decision) process.exit(3);
composition.dispatchNotice(decision.turnId, decision.text);
composition.close();
if (mode === 'deliver' && state.read().turns[turnId].phase === 'api-accepted') process.exit(0);
process.exit(4);

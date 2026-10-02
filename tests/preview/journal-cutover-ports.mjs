import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSubscriptionProviderIO as physicalProviderIO } from '../../scripts/production-boot-io.mjs';
import { DOORWAY_CONFORMANCE } from './doorway-conformance.js';
export { productionStorageIO } from '../../scripts/production-boot-io.mjs';

/** The named doorway's captured frames (INSTAR_PREVIEW_CUTOVER_DOORWAY), answering the operator and the reply check;
 * every submitted request is recorded so a test can read what actually reached the doorway. */
export function createSubscriptionProviderIO(...args) {
  const doorway = process.env.INSTAR_PREVIEW_CUTOVER_DOORWAY;
  if (!doorway) return physicalProviderIO(...args);
  const directory = process.env.INSTAR_PREVIEW_CUTOVER_WORLD;
  const state = { outcome: 'complete', calls: 0, stdin: [], answer: stdin => {
    appendFileSync(join(directory, 'doorway.jsonl'), `${JSON.stringify({ doorway, stdin })}\n`);
    return stdin.includes('Judge this proposed reply') ? 'PASS | The answer repeats the operator\'s marker.' : 'Juniper is the marker.';
  } };
  return DOORWAY_CONFORMANCE[doorway].io(state);
}

export function createProductionTelegramIO() {
  const directory = process.env.INSTAR_PREVIEW_CUTOVER_WORLD;
  if (!directory) throw Error('cutover fixture world absent');
  const marker = join(directory, 'long-poll-overlap');
  const log = row => appendFileSync(join(directory, 'telegram.jsonl'), `${JSON.stringify(row)}\n`);
  return { invoke(input) {
    if (input.method === 'getMe') return { kind: 'identity', identity: { id: 8820318295 } };
    if (input.method === 'getUpdates') {
      if (process.env.INSTAR_PREVIEW_CUTOVER_ROLE === 'canary') {
        log({ kind: 'poll', outcome: 'held', role: 'canary', offset: input.body.offset });
        writeFileSync(marker, String(process.pid));
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
        return { kind: 'response', status: 200, bytes: '{"ok":true,"result":[]}' };
      }
      if (existsSync(marker)) {
        log({ kind: 'poll', outcome: 'conflict', role: 'live', offset: input.body.offset });
        return { kind: 'response', status: 409, bytes: '{"ok":false}' };
      }
      const remainingPath = join(directory, 'conflicts-remaining');
      if (existsSync(remainingPath)) {
        const remaining = Number(readFileSync(remainingPath, 'utf8'));
        if (remaining > 0) {
          writeFileSync(remainingPath, String(remaining - 1));
          log({ kind: 'poll', outcome: 'conflict', role: 'live', offset: input.body.offset });
          return { kind: 'response', status: 409, bytes: '{"ok":false}' };
        }
      }
      // The role is the launching test's name for this runner (`live` unless it names two machines).
      log({ kind: 'poll', outcome: 'accepted', role: process.env.INSTAR_PREVIEW_CUTOVER_ROLE ?? 'live', offset: input.body.offset });
      const updates = JSON.parse(readFileSync(join(directory, 'updates.json'), 'utf8'))
        .filter(row => row.update_id >= input.body.offset).slice(0, input.body.limit);
      return { kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result: updates }) };
    }
    if (input.method === 'sendMessage') {
      log({ kind: 'send', role: process.env.INSTAR_PREVIEW_CUTOVER_ROLE, text: input.body.text });
      return { kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result: {
        message_id: 42, chat: { id: Number(input.body.chat_id) },
        text: input.body.text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&') } }) };
    }
    throw Error('cutover fixture unexpected Telegram method');
  } };
}

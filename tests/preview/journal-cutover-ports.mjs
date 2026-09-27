import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export { productionStorageIO, createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

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
      log({ kind: 'poll', outcome: 'accepted', role: 'live', offset: input.body.offset });
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

import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { reactionAcknowledgement } from './telegram-acknowledgement.mjs';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';

// Real confined-child bridge and loopback HTTP, with the bridge's fixed offline token only.
// Successful reaction receipts are deliberately delayed past the old 500 ms bound.
// The host's macOS resource shim is tested separately by journal-agent-resources on the gate host.
it.each([false, true])('real bridge delivers acknowledgement with fallback=%s and typing', async fallback => {
  const root = mkdtempSync(join(tmpdir(), 'reaction-bridge-')), log = join(root, 'http.log');
  const endpoint = spawn(process.execPath, [resolve('tests/preview/journal-poll-endpoint.mjs'), log, '', '', '', fallback ? 'reaction-fail' : '', '800'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise<number>((resolvePort, reject) => {
      endpoint.stdout!.once('data', bytes => resolvePort(Number(String(bytes).trim()))); endpoint.once('error', reject);
    });
    const invoke = (method: string, body: Record<string, unknown>, timeoutMs: number) => {
      const request = Buffer.from(JSON.stringify({ method, body, timeoutMs, testEndpoint: `http://127.0.0.1:${port}` })).toString('base64url');
      const child = spawnSync(process.execPath, [resolve('src/assembly/telegram-bot-api-bridge.mjs'), request], {
        input: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', encoding: 'utf8', timeout: 5000,
      });
      expect(child.status, child.stderr).toBe(0);
      return JSON.parse(child.stdout) as unknown;
    };
    let result = reactionAcknowledgement(invoke, '-42', 91);
    if (result === null) result = classifyTelegramSend(invoke('sendMessage', { chat_id: '-42', text: 'Checking that now.',
      message_thread_id: 7, reply_parameters: { message_id: 91 } }, 1000), { chat: '-42', expectedText: 'Checking that now.', thread: 7 });
    expect(result).toMatchObject({ kind: 'accepted' });
    if (!fallback) expect(result).toMatchObject({ message: 91, acknowledgementPath: 'reaction' });
    const typing = invoke('sendChatAction', { chat_id: '-42', message_thread_id: 7, action: 'typing' }, 1000) as { bytes: string };
    expect(JSON.parse(typing.bytes)).toEqual({ ok: true, result: true });
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual(fallback
      ? ['setMessageReaction', 'sendMessage', 'sendChatAction'] : ['setMessageReaction', 'sendChatAction']);
    const actions = readFileSync(`${log}.actions`, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(actions[0]).toEqual({ method: 'setMessageReaction', chat_id: '-42', message_id: 91, reaction: [{ type: 'emoji', emoji: '👀' }] });
  } finally {
    const closed = new Promise<void>(resolveClose => endpoint.once('close', () => resolveClose()));
    endpoint.kill('SIGTERM'); await closed; rmSync(root, { recursive: true, force: true });
  }
}, 15000);

it.each(['setMessageReaction', 'sendChatAction'])('the bridge keeps its held-secret floor for %s before fetch', method => {
  const secret = '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const request = Buffer.from(JSON.stringify({ method, body: { chat_id: secret }, timeoutMs: 500 })).toString('base64url');
  const child = spawnSync(process.execPath, [resolve('src/assembly/telegram-bot-api-bridge.mjs'), request], {
    input: secret, encoding: 'utf8', timeout: 5000,
  });
  expect(child.status, child.stderr).toBe(0);
  expect(JSON.parse(child.stdout)).toEqual({ kind: 'uncertain', limitation: 'transport', stage: 'scan-policy' });
  expect(child.stdout).not.toContain(secret);
});

import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { verifyGroupAudience } from './group-disclosure.js';
import { scope } from './group-carry-fixture.js';
// @ts-expect-error The physical host port is JavaScript, like production-boot-io.mjs.
import { groupMembershipReader } from './group-membership-io.mjs';

it('uses the real read-only Telegram bridge over HTTP and refuses extras, unknown evidence and non-read methods', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'group-member-bridge-'));
  const methods: string[] = []; let count = 2, known = true;
  const server = createServer(async (request, response) => {
    let bytes = ''; for await (const chunk of request) bytes += chunk;
    const body = JSON.parse(bytes), method = request.url!.split('/').at(-1)!; methods.push(method);
    const result = method === 'getChat' ? { id: Number(scope.chat), type: 'supergroup', is_forum: true }
      : method === 'getMe' ? { id: Number(scope.bot), is_bot: true, username: 'fixture_bot' }
        : method === 'getChatMemberCount' ? count
          : { status: 'administrator', user: { id: Number(body.user_id), is_bot: body.user_id === scope.bot } };
    response.end(JSON.stringify({ ok: known, result }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('no listener');
  const credential = '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const physical = { poll: async (input: object, secret: string) => {
    const request = Buffer.from(JSON.stringify({ ...input, captureDirectory: directory,
      testEndpoint: `http://127.0.0.1:${address.port}` })).toString('base64url');
    // The macOS limit shim is exercised by the CLI test on its gate host. This runs the exact
    // shipped transport itself, with its fixed fixture credential, real HTTP and real identity capture.
    const child = execFile(process.execPath, ['src/assembly/telegram-bot-api-bridge.mjs', request],
      { timeout: 10000, maxBuffer: 1024 * 1024 });
    child.stdin!.end(secret);
    const result = await new Promise<string>((resolve, reject) => {
      let out = ''; child.stdout!.on('data', data => { out += String(data); });
      child.on('error', reject); child.on('close', code => code === 0 ? resolve(out) : reject(Error(`bridge exit ${String(code)}`)));
    });
    return JSON.parse(result);
  } };
  const read = groupMembershipReader(physical, () => credential,
    { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: 'telegram-bot-token' },
    { id: Number(scope.bot), username: 'fixture_bot' });
  try {
    expect(await verifyGroupAudience(scope, read)).toBe(true);
    expect(methods).toEqual(['getChat', 'getMe', 'getChatMemberCount', 'getChatMember', 'getChatMember', 'getChatMemberCount']);
    count = 3; expect(await verifyGroupAudience(scope, read)).toBe(false);
    count = 2; known = false; expect(await verifyGroupAudience(scope, read)).toBe(false);
    const before = methods.length; await expect(read('sendMessage', {})).rejects.toThrow(/read method/u);
    expect(methods).toHaveLength(before);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); rmSync(directory, { recursive: true, force: true }); }
}, 30000);

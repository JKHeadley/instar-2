import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { verifyGroupAudience, MembershipUnavailable } from './group-disclosure.js';
import { scope } from './group-carry-fixture.js';
// @ts-expect-error The physical host port is JavaScript, like production-boot-io.mjs.
import { groupMembershipReader } from './group-membership-io.mjs';

it('uses the real read-only Telegram bridge over HTTP and refuses extras, unknown evidence and non-read methods', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'group-member-bridge-'));
  const methods: string[] = []; let count = 2, known = true, failuresLeft = 0, failingMethod = 'getChat', transientStatus = 503;
  const server = createServer(async (request, response) => {
    let bytes = ''; for await (const chunk of request) bytes += chunk;
    const body = JSON.parse(bytes), method = request.url!.split('/').at(-1)!; methods.push(method);
    if (method === failingMethod && failuresLeft-- > 0) {
      response.statusCode = transientStatus; response.end(JSON.stringify({ ok: false, description: 'temporary outage' })); return;
    }
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
    // Real HTTP and real shipped identity bridge: getMe must retain 429/5xx, not erase them as invalid identity.
    for (const status of [429, 503]) {
      methods.length = 0; failingMethod = 'getMe'; failuresLeft = 1; transientStatus = status;
      expect(await verifyGroupAudience(scope, read)).toBe(true);
      expect(methods.filter(method => method === 'getMe')).toHaveLength(2);
    }
    failuresLeft = 0; methods.length = 0;
    count = 3; expect(await verifyGroupAudience(scope, read)).toBe(false);
    expect(methods).toEqual(['getChat', 'getMe', 'getChatMemberCount']);
    count = 2; known = false; expect(await verifyGroupAudience(scope, read)).toBe(false);
    const before = methods.length; await expect(read('sendMessage', {})).rejects.toThrow(/read method/u);
    expect(methods).toHaveLength(before);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); rmSync(directory, { recursive: true, force: true }); }
}, 30000);


it.each([
  { kind: 'uncertain', limitation: 'timeout', cause: 'timeout' },
  { kind: 'response', status: 429, cause: 'rate-limit' },
  { kind: 'response', status: 500, cause: 'server-error' },
  { kind: 'response', status: 599, cause: 'server-error' },
])('one bounded read retry for $cause; repeated failure keeps its typed cause', async response => {
  for (const persistent of [false, true]) {
    let calls = 0; const waits: number[] = [];
    const read = groupMembershipReader({ poll: async () => ++calls === 1 || persistent ? response
      : { kind: 'response', status: 200, bytes: '{"ok":true,"result":2}' } }, () => 'TEST', {}, {},
    async (ms: number) => { waits.push(ms); });
    if (persistent) await expect(read('getChatMemberCount', {})).rejects.toMatchObject({ transient: true, causeCode: response.cause });
    else expect(await read('getChatMemberCount', {})).toEqual({ ok: true, result: 2 });
    expect(calls).toBe(2); expect(waits).toEqual([250]);
  }
});
it.each([
  { kind: 'response', status: 400 }, { kind: 'response', status: 401 }, { kind: 'response', status: 403 },
  { kind: 'uncertain', limitation: 'invalid-response' }, { kind: 'uncertain', limitation: 'scan-budget' },
])('never retries a non-transient or definite refusal $status $limitation', async response => {
  let calls = 0;
  const read = groupMembershipReader({ poll: async () => { calls++; return response; } }, () => 'TEST', {}, {},
    async () => { throw Error('must not back off'); });
  await expect(read('getMe', {})).rejects.toBeInstanceOf(MembershipUnavailable);
  expect(calls).toBe(1);
});
it('a transport exception counts as transient only for an explicit timeout', async () => {
  for (const name of ['TimeoutError', 'AbortError', 'Error']) {
    let calls = 0;
    const read = groupMembershipReader({ poll: async () => { calls++; const error = Error('sensitive detail'); error.name = name; throw error; } },
      () => 'TEST', {}, {}, async () => {});
    await expect(read('getChat', {})).rejects.toMatchObject({ transient: name !== 'Error' });
    expect(calls).toBe(name === 'Error' ? 1 : 2);
  }
});

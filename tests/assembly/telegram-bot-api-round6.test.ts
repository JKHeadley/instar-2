import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { telegramBridgeReplyFromExecution } from '../../src/assembly/index.js';

const token = () => `1234567890:${randomBytes(26).toString('base64url')}`;
const projection = { id: 818181, username: 'echo_mmtest_seam_b27x_bot' };
const exactKeys = (value: object) => Object.keys(value).sort();

function run(mode: string, method: 'getMe' | 'getUpdates' | 'sendMessage' = 'sendMessage', prepare?: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'instar-round6-d01-'));
  const sealed = join(directory, 'sealed'); mkdirSync(sealed, { mode: 0o700 });
  if (prepare) prepare(sealed);
  const count = join(directory, 'count.json');
  const request = Buffer.from(JSON.stringify({ method, body: {}, timeoutMs: 1000,
    captureDirectory: sealed, identityBinding: projection })).toString('base64url');
  const secret = token();
  const child = spawnSync(process.execPath, ['--import', resolve('tests/assembly/telegram-bot-api-round6-transport.mjs'),
    resolve('src/assembly/telegram-bot-api-bridge.mjs'), request], {
    input: secret, encoding: 'utf8', timeout: 5000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, INSTAR_ROUND6_FAILURE: mode, INSTAR_ROUND6_COUNT_FILE: count },
  });
  const reply = telegramBridgeReplyFromExecution({ resolver: 'ok', status: child.status, stdout: child.stdout });
  const counts = JSON.parse(readFileSync(count, 'utf8')) as { fetches: number; reads: number; redirect: string | null };
  rmSync(directory, { recursive: true, force: true });
  return { child, reply, counts, secret };
}

describe('D01 fixed confined-child failure stages', () => {
  test('classifies resolver and child launch failures without diagnostic payloads', () => {
    const resolver = telegramBridgeReplyFromExecution({ resolver: 'failed', status: null,
      stdout: 'resolver marker https://untrusted.invalid' });
    const launched = spawnSync(process.execPath, [resolve('tests/assembly/not-a-real-child.mjs')], { encoding: 'utf8' });
    const child = telegramBridgeReplyFromExecution({ resolver: 'ok', status: launched.status, stdout: launched.stdout });
    expect(resolver).toEqual({ kind: 'uncertain', limitation: 'transport', stage: 'resolver' });
    expect(child).toEqual({ kind: 'uncertain', limitation: 'transport', stage: 'child-exit' });
  });

  test.each([
    ['fetch-failure', 'fetch-failure', 'transport', 'sendMessage'],
    ['fetch-timeout', 'fetch-timeout', 'timeout', 'sendMessage'],
    ['body-read', 'body-read', 'transport', 'sendMessage'],
    ['invalid-response', 'invalid-response', 'transport', 'getMe'],
    ['scan-policy', 'scan-policy', 'transport', 'sendMessage'],
    ['scan-budget', 'scan-budget', 'transport', 'sendMessage'],
  ] as const)('%s emits only its fixed enum with one request', (mode, stage, limitation, method) => {
    const observed = run(mode, method);
    expect(observed.child.status).toBe(0); expect(observed.child.stderr).toBe('');
    expect(observed.reply).toEqual({ kind: 'uncertain', limitation, stage });
    expect(exactKeys(observed.reply)).toEqual(['kind', 'limitation', 'stage']);
    expect(JSON.stringify(observed.reply)).not.toContain(observed.secret);
    expect(JSON.stringify(observed.reply)).not.toContain('untrusted.invalid');
    expect(observed.counts.fetches).toBe(1);
    expect(observed.counts.reads).toBe(mode.startsWith('fetch-') ? 0 : 1);
  });

  test('sealed write and reread failures emit only sealed-capture', () => {
    const writeFailure = run('ordinary', 'getMe', directory => rmSync(directory, { recursive: true, force: true }));
    const bytes = JSON.stringify({ ok: true, result: { id: 818181, is_bot: true,
      username: 'echo_mmtest_seam_b27x_bot', first_name: 'ordinary' } });
    const hex = createHash('sha256').update(bytes).digest('hex');
    const rereadFailure = run('ordinary', 'getMe', directory => writeFileSync(join(directory, `${hex}.capture`), 'changed'));
    for (const observed of [writeFailure, rereadFailure]) {
      expect(observed.reply).toEqual({ kind: 'uncertain', limitation: 'transport', stage: 'sealed-capture' });
      expect(observed.counts).toEqual({ fetches: 1, reads: 1, redirect: 'manual' });
    }
  });
});

describe('preserved direct-child guards', () => {
  test('V39 rejects malformed credentials before transport with silent stdout', () => {
    const directory = mkdtempSync(join(tmpdir(), 'instar-round6-v39-'));
    const count = join(directory, 'count.json');
    const request = Buffer.from(JSON.stringify({ method: 'sendMessage', body: {}, timeoutMs: 1000 })).toString('base64url');
    const child = spawnSync(process.execPath, ['--import', resolve('tests/assembly/telegram-bot-api-round6-transport.mjs'),
      resolve('src/assembly/telegram-bot-api-bridge.mjs'), request], { input: 'malformed', encoding: 'utf8', timeout: 5000,
      env: { ...process.env, INSTAR_ROUND6_FAILURE: 'ordinary', INSTAR_ROUND6_COUNT_FILE: count } });
    expect(child.status).toBe(2); expect(child.stdout).toBe(''); expect(child.stderr).toBe('');
    expect(() => readFileSync(count)).toThrow();
    rmSync(directory, { recursive: true, force: true });
  });

  test('V40 makes exactly one request without exposing a well-formed credential', () => {
    const observed = run('ordinary');
    expect(observed.child.status).toBe(0); expect(observed.child.stderr).toBe('');
    expect(observed.reply.kind).toBe('response');
    expect(JSON.stringify(observed.reply)).not.toContain(observed.secret);
    expect(observed.counts).toEqual({ fetches: 1, reads: 1, redirect: 'manual' });
  });

  test('V64 fixes redirect handling to manual and never follows a provider redirect', () => {
    const observed = run('redirect-response');
    expect(observed.child.status).toBe(0); expect(observed.child.stderr).toBe('');
    expect(observed.reply).toMatchObject({ kind: 'response', status: 307 });
    expect(observed.counts).toEqual({ fetches: 1, reads: 1, redirect: 'manual' });
  });
});

const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function integerRadix(value: string, base: 36 | 58) {
  let remaining = BigInt(`0x${Buffer.from(value).toString('hex')}`); let encoded = '';
  while (remaining > 0n) {
    encoded = (base === 58 ? base58Alphabet[Number(remaining % 58n)] : (remaining % 36n).toString(36)) + encoded;
    remaining /= BigInt(base);
  }
  return encoded;
}
function heldResponse(secret: string, mode: string) {
  const result: Record<string, unknown> = { id: 818181, is_bot: true, username: 'echo_mmtest_seam_b27x_bot' };
  if (mode === 'quoted-printable') result.first_name = [...Buffer.from(secret)]
    .map(byte => `=${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('');
  if (mode === 'base36') result.first_name = integerRadix(secret, 36);
  if (mode === 'base58') result.first_name = integerRadix(secret, 58);
  if (mode === 'nul-halves') result.first_name = `${secret.slice(0, 23)}\0${secret.slice(23)}`;
  if (mode === 'nonstring-gap') Object.assign(result,
    { first_name: secret.slice(0, 23), separator: 0, last_name: secret.slice(23) });
  return JSON.stringify({ ok: true, result });
}
function runHeld(mode: string) {
  const directory = mkdtempSync(join(tmpdir(), 'instar-round6-held-')); const count = join(directory, 'count.json');
  const secret = token(); const bytes = heldResponse(secret, mode);
  const request = Buffer.from(JSON.stringify({ method: 'sendMessage', body: {}, timeoutMs: 1000 })).toString('base64url');
  const child = spawnSync(process.execPath, ['--import', resolve('tests/assembly/telegram-bot-api-round6-transport.mjs'),
    resolve('src/assembly/telegram-bot-api-bridge.mjs'), request], { input: secret, encoding: 'utf8', timeout: 5000,
    env: { ...process.env, INSTAR_ROUND6_FAILURE: 'custom', INSTAR_ROUND6_COUNT_FILE: count,
      INSTAR_ROUND6_RESPONSE_BASE64: Buffer.from(bytes).toString('base64') } });
  rmSync(directory, { recursive: true, force: true });
  return telegramBridgeReplyFromExecution({ resolver: 'ok', status: child.status, stdout: child.stdout });
}

test.skip.each(['quoted-printable', 'base36', 'base58', 'nul-halves', 'nonstring-gap'])(
  'F4-FREE-TEXT-REPRESENTATION-LONG-TAIL / NON-EXECUTABLE-UNTIL-free-text-representation-extension-grant: SCAN %s',
  mode => expect(runHeld(mode)).toEqual({ kind: 'uncertain', limitation: 'transport', stage: 'scan-policy' }),
);

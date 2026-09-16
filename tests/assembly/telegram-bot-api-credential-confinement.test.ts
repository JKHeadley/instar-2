import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const forbidden = [
  'mixed-base32',
  'mixed-hex',
  'amp-numeric-entities',
  'utf16be-base64',
  'utf16le-bom-base64',
  'utf16be-bom-base64',
  'split-fields',
  'unknown-html',
] as const;

const benign = ['benign-unicode', 'benign-html', 'benign-odd'] as const;

function invoke(mode: string) {
  const token = `818181:${randomBytes(29).toString('base64url')}`;
  const request = Buffer.from(JSON.stringify({ method: 'getMe', body: {}, timeoutMs: 1_000 })).toString('base64url');
  const child = spawnSync(process.execPath, [
    '--import', resolve('tests/assembly/telegram-bot-api-bridge-reflection.mjs'),
    'src/assembly/telegram-bot-api-bridge.mjs', request,
  ], {
    input: token,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, INSTAR_TEST_REFLECTION_MODE: mode },
  });
  expect(child.status).toBe(0);
  expect(child.stderr).toBe('');
  return JSON.parse(child.stdout) as { kind: string; limitation?: string; status?: number; bytes?: string };
}

describe('Telegram confined bridge finite representation policy', () => {
  test.each(forbidden)('refuses credential recovery through %s before stdout can expose provider bytes', mode => {
    expect(invoke(mode)).toEqual({ kind: 'uncertain', limitation: 'transport' });
  });

  test.each(benign)('remains total and byte-preserving for %s', mode => {
    const response = invoke(mode);
    expect(response.kind).toBe('response');
    expect(response.status).toBe(200);
    expect(typeof response.bytes).toBe('string');
  });
});

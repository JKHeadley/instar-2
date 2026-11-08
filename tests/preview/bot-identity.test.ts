// getme-restart-1108: a routine restart must not take the agent offline for minutes when Telegram answers one getMe
// slowly. Every answer below comes from the real bridge child (src/assembly/telegram-bot-api-bridge.mjs) with its
// fetch stubbed by the round-6 transport fixture; time is a fake clock, so no result depends on machine load.
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
// @ts-expect-error The launch identity check is a JS host module.
import { BOT_IDENTITY_RETRY, botIdentityOutcome, verifyBotIdentity } from './bot-identity.mjs';

const binding = { id: 818181, username: 'echo_mmtest_seam_b27x_bot' };

/** One real getMe through the bridge child; `mode` picks the stubbed Telegram answer. */
function bridgeGetMe(mode: string, timeoutMs: number, response?: object) {
  const directory = mkdtempSync(join(tmpdir(), 'getme-restart-'));
  try {
    const sealed = join(directory, 'sealed'); mkdirSync(sealed, { mode: 0o700 });
    const request = Buffer.from(JSON.stringify({ method: 'getMe', body: {}, timeoutMs, captureDirectory: sealed,
      identityBinding: binding })).toString('base64url');
    const child = spawnSync(process.execPath, ['--import', resolve('tests/assembly/telegram-bot-api-round6-transport.mjs'),
      resolve('src/assembly/telegram-bot-api-bridge.mjs'), request], {
      input: `1234567890:${randomBytes(26).toString('base64url')}`, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, INSTAR_ROUND6_FAILURE: mode, INSTAR_ROUND6_COUNT_FILE: join(directory, 'count.json'),
        ...(response ? { INSTAR_ROUND6_RESPONSE_BASE64: Buffer.from(JSON.stringify(response)).toString('base64') } : {}) },
    });
    expect(child.status, child.stderr).toBe(0);
    return JSON.parse(child.stdout);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

/** The launch's retry loop over a scripted list of Telegram answers, on a fake monotonic clock. A timed-out try
 * spends its whole timeout; an answered try spends 21 s (the slow answer seen live). */
async function launch(modes: string[], options: { response?: object; stopAfterPause?: boolean } = {}) {
  let now = 0, stopped = false;
  const asked: number[] = [], paused: number[] = [], retried: string[] = [];
  const result = await verifyBotIdentity({ boundId: binding.id, elapsed: () => now,
    wait: async (ms: number) => { paused.push(ms); now += ms; if (options.stopAfterPause) stopped = true; },
    stopped: () => stopped, retrying: (label: string) => retried.push(label),
    invoke: (timeoutMs: number) => {
      asked.push(timeoutMs);
      const mode = modes[Math.min(asked.length - 1, modes.length - 1)] ?? 'ordinary';
      const answer = bridgeGetMe(mode, timeoutMs, mode === 'ordinary' ? options.response : undefined);
      now += mode === 'fetch-timeout' ? timeoutMs : 21000;
      return answer;
    } });
  return { result, asked, paused, retried, spent: now };
}

describe('launch bot identity waits out a slow Telegram, and refuses a wrong one at once', () => {
  test('slow (no answer within the try) then OK: the launch starts', async () => {
    const { result, asked, paused, retried } = await launch(['fetch-timeout', 'ordinary']);
    expect(result.outcome).toBe('verified');
    expect(result.answer.identity.id).toBe(binding.id);
    expect(asked).toEqual([30000, 30000]); expect(paused).toEqual([2000]);
    expect(retried).toEqual(['fetch-timeout']);
  });

  test('504 Gateway Timeout then OK: the launch starts', async () => {
    expect(bridgeGetMe('status-504', 30000)).toEqual({ kind: 'uncertain', limitation: 'transport', stage: 'invalid-response', status: 504 });
    const { result, asked, retried } = await launch(['status-504', 'ordinary']);
    expect(result.outcome).toBe('verified'); expect(asked).toHaveLength(2);
    expect(retried).toEqual(['invalid-response HTTP 504']);
  });

  test('a wrong bot id refuses at once: one question, no pause', async () => {
    const { result, asked, paused } = await launch(['ordinary'], { response: { ok: true,
      result: { id: 999999, is_bot: true, username: binding.username, first_name: 'other' } } });
    expect(result.outcome).toBe('refused'); expect(asked).toHaveLength(1); expect(paused).toEqual([]);
    // The bridge refuses the mismatch itself; an identity naming another id is refused here too.
    expect(botIdentityOutcome({ kind: 'identity', identity: { id: 999999 } }, binding.id)).toBe('refused');
  });

  test.each(['status-401', 'status-404', 'status-400'])('a token refusal (%s) refuses at once', async mode => {
    const { result, asked, paused } = await launch([mode]);
    expect(result.outcome).toBe('refused'); expect(asked).toHaveLength(1); expect(paused).toEqual([]);
  });

  test('no answer at all stays within three tries and 90 s, then refuses', async () => {
    const { result, asked, paused, spent } = await launch(['fetch-timeout']);
    expect(result.outcome).toBe('exhausted');
    expect(result.attempts).toEqual(['fetch-timeout', 'fetch-timeout', 'fetch-timeout']);
    expect(asked).toEqual([30000, 30000, 90000 - 30000 - 2000 - 30000 - 5000]); expect(paused).toEqual([2000, 5000]);
    expect(spent).toBeLessThanOrEqual(BOT_IDENTITY_RETRY.totalMs);
  });

  test('an operator stop during the pause ends the check without asking again', async () => {
    const { result, asked } = await launch(['status-503', 'ordinary'], { stopAfterPause: true });
    expect(result.outcome).toBe('stopped'); expect(asked).toHaveLength(1);
  });

  test('the HTTP 500 the bridge already reported, and 429, are temporary; a 200 malformed answer is not', () => {
    expect(botIdentityOutcome(bridgeGetMe('invalid-response', 30000), binding.id)).toBe('temporary');
    expect(botIdentityOutcome(bridgeGetMe('status-429', 30000), binding.id)).toBe('temporary');
    expect(botIdentityOutcome({ kind: 'uncertain', limitation: 'transport', stage: 'invalid-response' }, binding.id)).toBe('refused');
    expect(botIdentityOutcome({ kind: 'uncertain', limitation: 'transport', stage: 'sealed-capture' }, binding.id)).toBe('refused');
  });

  test('the launch asks through this check, not a single getMe', () => {
    const agent = readFileSync(resolve('tests/preview/journal-agent.mjs'), 'utf8');
    expect(agent).toContain("import { verifyBotIdentity } from './bot-identity.mjs';");
    expect(agent).toContain('const identityCheck = await verifyBotIdentity({');
    expect(agent).not.toContain("method: 'getMe', body: {}, timeoutMs: 30000");
  });
});

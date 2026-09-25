import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyProviderFailure } from '../../src/assembly/provider-failure.js';
// @ts-expect-error The physical provider host remains JavaScript.
import { productionProviderIO } from '../../scripts/production-boot-io.mjs';

const now = new Date('2026-09-24T20:00:00').getTime();
const frame = (result: string, is_error = true) => JSON.stringify({ type: 'result', is_error, result });
const fixture = (name: string) => readFileSync(new URL(`../fixtures/provider-failure/${name}`, import.meta.url), 'utf8');
const capturedNow = new Date('2026-09-24T21:01:00-07:00').getTime();

it('classifies failed result frames without retaining provider text', () => {
  const secret = 'secret-should-never-appear';
  const limit = classifyProviderFailure({ code: 1, limited: false,
    stdout: frame(`You've hit your usage limit; resets 10:30pm ${secret}`), now,
    localClockResetAt: (hour, minute, instant) => { const candidate = new Date(instant); candidate.setHours(hour, minute, 0, 0); return candidate.getTime(); } });
  expect(limit).toEqual({ failureClass: 'limit', resetHint: '10:30pm', resetAt: new Date('2026-09-24T22:30:00').getTime() });
  expect(JSON.stringify(limit)).not.toContain(secret);
  expect(classifyProviderFailure({ code: 0, limited: false, stdout: frame('I can explain usage limits.', false), now }).failureClass).toBe('unknown');
  expect(classifyProviderFailure({ code: 1, limited: false, stdout: frame(`Usage-Policy rejection ${secret}`), now }).failureClass).toBe('policy');
  expect(classifyProviderFailure({ code: null, limited: true, stdout: '', now }).failureClass).toBe('timeout');
  expect(classifyProviderFailure({ code: 7, limited: false, stdout: secret, now })).toEqual({ failureClass: 'transport', resetHint: null, resetAt: null });
});

it('replays a failed usage frame through the real child process IO', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'provider-limit-frame-')));
  try {
    const script = join(root, 'failed.mjs');
    writeFileSync(script, `process.stdout.write(JSON.stringify({type:'result',is_error:true,
      result:"You've hit your usage limit; resets in 5 minutes"})); process.exit(1);`);
    const observed = await productionProviderIO.execute({ executable: process.execPath, args: [script],
      cwd: root, env: { PATH: process.env.PATH ?? '/usr/bin:/bin' }, stdin: '', timeout: 5000, maxBytes: 8192 });
    expect(observed.code).toBe(1);
    const reason = classifyProviderFailure({ ...observed, now: 1000000 });
    expect(reason).toEqual({ failureClass: 'limit', resetHint: null, resetAt: 1300000 });
    expect(JSON.stringify(reason)).not.toContain('usage limit');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('classifies the captured weekly-limit result and its stream result with the captured reset instant', async () => {
  const captured = fixture('claude-limit-result.json');
  const stream = fixture('claude-limit-result.stream.jsonl').trim().split('\n').map(line => JSON.parse(line));
  const rate = stream.find(row => row.type === 'rate_limit_event');
  expect(rate.rate_limit_info.status).toBe('rejected');
  expect(rate.rate_limit_info.resetsAt).toBe(1790506800);
  expect(stream.at(-1)?.result).toBe(JSON.parse(captured).result);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'provider-captured-limit-')));
  try {
    const script = join(root, 'failed.mjs');
    writeFileSync(script, `process.stdout.write(Buffer.from(${JSON.stringify(Buffer.from(captured).toString('base64'))}, 'base64')); process.exit(1);`);
    const observed = await productionProviderIO.execute({ executable: process.execPath, args: [script],
      cwd: root, env: { PATH: process.env.PATH ?? '/usr/bin:/bin' }, stdin: '', timeout: 5000, maxBytes: 8192 });
    expect(observed).toMatchObject({ code: 1, limited: false, stdout: captured });
    const reason = classifyProviderFailure({ ...observed, now: capturedNow,
      calendarResetAt: productionProviderIO.calendarResetAt });
    expect(reason).toEqual({ failureClass: 'limit', resetHint: null,
      resetAt: rate.rate_limit_info.resetsAt * 1000 });
    expect(JSON.stringify(reason)).not.toContain('weekly limit');
    const invalidZone = captured.replace('America/Los_Angeles', 'America/Not_A_Zone');
    expect(classifyProviderFailure({ code: 1, limited: false, stdout: invalidZone, now: capturedNow,
      calendarResetAt: productionProviderIO.calendarResetAt })).toEqual({ failureClass: 'limit', resetHint: null, resetAt: null });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('classifies the recorded policy text in the assumed failed-result envelope, without inventing capture provenance', () => {
  const assumed = fixture('claude-policy-assumed-result.json');
  const failed = classifyProviderFailure({ code: 1, limited: false, stdout: assumed, now: capturedNow });
  expect(failed).toEqual({ failureClass: 'policy', resetHint: null, resetAt: null });
  expect(classifyProviderFailure({ code: 0, limited: false,
    stdout: JSON.stringify({ ...JSON.parse(assumed), is_error: false }), now: capturedNow }).failureClass).toBe('unknown');
});

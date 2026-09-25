import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyProviderFailure } from '../../src/assembly/provider-failure.js';
// @ts-expect-error The physical provider host remains JavaScript.
import { productionProviderIO } from '../../scripts/production-boot-io.mjs';

const now = new Date('2026-09-24T20:00:00').getTime();
const frame = (result: string, is_error = true) => JSON.stringify({ type: 'result', is_error, result });

it('classifies failed result frames without retaining provider text', () => {
  const secret = 'secret-should-never-appear';
  const limit = classifyProviderFailure({ code: 1, limited: false,
    stdout: frame(`You've hit your usage limit; resets 10:30pm ${secret}`), now });
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

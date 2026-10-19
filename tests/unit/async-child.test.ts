import { expect, it } from 'vitest';
import { runChild } from '../e2e/async-child.js';

it('awaits real child input/output while the worker remains responsive', async () => {
  let yielded = false;
  const result = runChild(process.execPath, ['-e', `
    let input = ''; process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => input += chunk);
    process.stdin.on('end', () => setTimeout(() => {
      process.stdout.write(input); process.stderr.write('diagnostic');
    }, 200));
  `], { input: 'exact fixture bytes', timeout: 10_000 });
  setImmediate(() => { yielded = true; });
  expect(await result).toEqual({ status: 0, signal: null, stdout: 'exact fixture bytes', stderr: 'diagnostic' });
  expect(yielded).toBe(true);
});

it('preserves a failing child exit and refuses an unlaunchable child', async () => {
  expect(await runChild(process.execPath, ['-e', 'process.exit(7)'], { timeout: 10_000 }))
    .toMatchObject({ status: 7, signal: null });
  await expect(runChild('/instar-test-nonexistent-executable', [], { timeout: 10_000 })).rejects.toMatchObject({ code: 'ENOENT' });
});

it.each(['exit-zero', 'ignore'] as const)('keeps a watchdog expiry red when the child handles SIGTERM: %s', async mode => {
  const result = await runChild(process.execPath, ['-e', `
    process.on('SIGTERM', () => { ${mode === 'exit-zero' ? 'process.exit(0)' : ''} });
    process.stdout.write('ready'); setInterval(() => {}, 1000);
  `], { timeout: 3000 });
  expect(result.stdout).toBe('ready');
  expect(result.status).toBeNull();
  expect(result.stderr).toContain('timed out after 3000 ms');
  expect(result.signal).toBe(mode === 'ignore' ? 'SIGKILL' : null);
});

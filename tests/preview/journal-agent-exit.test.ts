import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { redact } from '../../src/recall/redact.js';

// Execute the shipped final catch, without booting an agent or opening live stores.
const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const exitCatch = source.slice(source.lastIndexOf('try { await main(); } catch (error) {'));
async function diagnostic(error: Error) {
  let stderr = '';
  const process = { stderr: { write: (text: string) => { stderr += text; } }, exitCode: 0 };
  await runInNewContext(`(async () => { ${exitCatch} })()`, {
    main: async () => { throw error; }, redact, process, reportExit: () => {},
    AgentPathRefused: class extends Error {}, PlainRefusal: class extends Error {},
  });
  expect(process.exitCode).toBe(1);
  return stderr;
}

it('scrubs an ordinary multiline error stack and preserves useful neighboring diagnostics', async () => {
  const credential = `ghp_${'SyntheticCredentialForExitTest1234'}`;
  const error = new Error(`request failed\n${credential}\nretry context`);
  expect(error.stack).toContain(credential); // ordinary Error repeats the multiline message
  const output = await diagnostic(error);
  expect(output).not.toContain(credential);
  expect(output).toContain('[redacted credential]');
  expect(output).toContain('DIAG-EXIT Error: request failed');
  expect(output).toContain('retry context');
  expect(output).toContain('journal-agent-exit.test.ts');
  const neighbor = await diagnostic(new Error('disk unavailable'));
  expect(neighbor).toContain('DIAG-EXIT Error: disk unavailable');
  expect(neighbor).toContain('journal-agent-exit.test.ts');
});

it('scrubs the error name and retains the message and stack-line bounds', async () => {
  const credential = `ghp_${'SyntheticNameCredentialTest12345'}`;
  const error = new Error('x'.repeat(400));
  error.name = `Failure ${credential}`;
  const output = await diagnostic(error);
  expect(output).not.toContain(credential);
  expect(output).toContain('DIAG-EXIT Failure [redacted credential]: ' + 'x'.repeat(300) + ' | ');
  expect(output.split(' <- ').length).toBeLessThanOrEqual(8);
});

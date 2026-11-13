import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { generateKeyPairSync } from 'node:crypto';

// Execute the shipped final catch, without booting an agent or opening live stores.
const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const exitCatch = source.slice(source.lastIndexOf('try { await main(); } catch (error) {'));
async function diagnostic(error: Error) {
  let stderr = '';
  const process = { stderr: { write: (text: string) => { stderr += text; } }, exitCode: 0 };
  await runInNewContext(`(async () => { ${exitCatch} })()`, {
    main: async () => { throw error; }, process, reportExit: () => {},
    AgentPathRefused: class extends Error {}, PlainRefusal: class extends Error {},
  });
  expect(process.exitCode).toBe(1);
  return stderr;
}

it('omits every line of a multiline credential message while retaining code locations', async () => {
  const message = `request failed\nghp_${'SyntheticCredentialForExitTest1234'}\nretry context`;
  const error = new TypeError(message);
  error.name = 'Untrusted name';
  const output = await diagnostic(error);
  for (const line of message.split('\n')) expect(output.includes(line)).toBe(false);
  expect(output).not.toContain(error.name);
  expect(output).toMatch(/^DIAG-EXIT TypeError at tests\/preview\/journal-agent-exit.test.ts:[0-9]+/);
});

it('omits an in-memory PEM private-key message while retaining code locations', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const message = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const error = new Error(message);
  const output = await diagnostic(error);
  // Boolean assertions keep disposable key material out of failure logs too.
  for (const line of message.trim().split('\n')) expect(output.includes(line)).toBe(false);
  expect(output).toMatch(/^DIAG-EXIT Error at tests\/preview\/journal-agent-exit.test.ts:[0-9]+/);
});

it('drops unexpected frames, rejects invalid class names and limits locations to eight', async () => {
  const error = new Error('message must not appear');
  Object.defineProperty(error, 'constructor', { value: { name: 'Bad class!' }, configurable: true });
  error.stack = [
    'Error: first line must not appear',
    '    at unexpected secret text',
    '    at functionSecret (file:///repo/tests/unsafe path.ts:2:3)',
    '    at file:///repo/other/file.ts:4:5',
    '    at tests/../private.ts:6:7',
    '    at tests/preview/file.ts:bad:7',
    '    at hiddenFunction (file:///repo/tests/preview/journal.ts:2037:4)',
    '    at /repo/src/assembly/production-conversation-session.ts:627:2',
    ...Array.from({ length: 9 }, (_, i) => `    at src/file.ts:${i + 1}:2`),
  ].join('\n');
  const expected = ' at tests/preview/journal.ts:2037 <- src/assembly/production-conversation-session.ts:627'
    + Array.from({ length: 6 }, (_, i) => ` <- src/file.ts:${i + 1}`).join('');
  expect((await diagnostic(error)).split('\n')[0]).toBe(`DIAG-EXIT Error${expected}`);
  for (const name of ['A'.repeat(40), 'A'.repeat(41), '1Error', 'Error_name', '']) {
    Object.defineProperty(error, 'constructor', { value: { name }, configurable: true });
    expect((await diagnostic(error)).split('\n')[0]).toBe(`DIAG-EXIT ${name.length === 40 ? name : 'Error'}${expected}`);
  }
  error.stack = 'Error: message\n    at unexpected shape';
  expect((await diagnostic(error)).split('\n')[0]).toBe('DIAG-EXIT Error');
});

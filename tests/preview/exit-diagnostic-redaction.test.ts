import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { redact } from '../../src/recall/redact.js';

// Execute the shipped top-level failure consumer, with only main and host stderr replaced.
const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
const boundary = source.slice(source.lastIndexOf('try { await main(); } catch (error) {'));
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
async function failure(error: Error) {
  const writes: string[] = [], exits: string[] = [];
  const process = { stderr: { write: (text: string) => writes.push(text) }, exitCode: 0 };
  await new AsyncFunction('main', 'reportExit', 'redact', 'AgentPathRefused', 'PlainRefusal', 'process', boundary)(
    async () => { throw error; }, (text: string) => exits.push(text), redact,
    class AgentPathRefused extends Error {}, class PlainRefusal extends Error {}, process);
  return { text: writes.join(''), exits, code: process.exitCode };
}

it('redacts synthetic credentials in multiline error text, names and stack frames before stderr', async () => {
  const secret = `sk-ant-${'synthetic'.repeat(5)}`;
  const error = new Error(`failure\n${secret}`);
  error.name = `Failure ${secret}`;
  error.stack = `${error.name}: ${error.message}\n    at run (file:///offline/tests/${secret}/runner.mjs:1:1)`;
  const result = await failure(error);
  expect(result.text.includes(secret)).toBe(false);
  expect(result.text).toContain('[redacted credential]');
  expect(result.text).toContain('DIAG-EXIT');
  expect(result.exits).toEqual(['error (details suppressed)']);
  expect(result.code).toBe(1);
});

it('retains ordinary diagnostic location and terminal failure behavior', async () => {
  const error = new Error('ordinary failure');
  error.stack = 'Error: ordinary failure\n    at run (file:///offline/tests/preview/runner.mjs:1:1)';
  const result = await failure(error);
  expect(result.text).toContain('DIAG-EXIT Error: ordinary failure');
  expect(result.text).toContain('(tests/preview/runner.mjs:1:1)');
  expect(result.text).toContain('preview refused to start or continue; details suppressed');
  expect(result.code).toBe(1);
});

import { afterEach, expect, it, vi } from 'vitest';

const mutation = vi.hoisted(() => ({ file: '', token: '' }));
vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return { ...fs, readFileSync: (...args: Parameters<typeof fs.readFileSync>) => {
    const source = fs.readFileSync(...args);
    return args[0] === mutation.file && typeof source === 'string'
      ? source.replaceAll(mutation.token, '') : source;
  } };
});
// @ts-expect-error The executable contract checker intentionally ships as an ESM script without declarations.
import { checkP15Architecture } from '../../scripts/check-p15-contract-map.mjs';

afterEach(() => { mutation.file = ''; mutation.token = ''; });

it('P15 contract map accepts the actual awaited round-nine child boundary', () => {
  expect(() => checkP15Architecture()).not.toThrow();
});

it.each([
  ['tests/e2e/scheduled-round9.test.ts', "import { runChild } from './async-child.js'"],
  ['tests/e2e/scheduled-round9.test.ts', 'await runChild('],
  ['tests/e2e/scheduled-round9.test.ts', 'SIGKILL'],
  ['tests/e2e/scheduled-round9.test.ts', 'expect('],
  ['tests/e2e/async-child.ts', "import { spawn } from 'node:child_process'"],
  ['tests/e2e/async-child.ts', 'spawn(command, args,'],
])('P15 contract map refuses %s without %s', (file, token) => {
  // Mutate only the checker's read of real repository bytes, never the shared tree.
  mutation.file = file; mutation.token = token;
  expect(() => checkP15Architecture()).toThrow(
    `${file}: required proof is missing an executable assertion or process boundary`,
  );
});

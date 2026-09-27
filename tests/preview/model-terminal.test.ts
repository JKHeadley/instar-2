// @ts-nocheck -- a narrow JavaScript adapter around the physical subscription IO.
import { expect, it } from 'vitest';
import { observeTerminalModelCommand } from './model-terminal.mjs';

it('marks only a completed model command as terminal', async () => {
  const seen = [];
  for (const [args, result] of [
    [['--version'], { code: 0, limited: false }],
    [['--print'], { code: null, limited: true }],
    [['--print'], { code: 1, limited: false }],
    [['--print'], { code: 0, limited: false }],
  ]) {
    const io = observeTerminalModelCommand({ execute: async () => result }, () => seen.push(args));
    expect(await io.execute({ args })).toBe(result);
  }
  expect(seen).toEqual([['--print'], ['--print']]);
  const interrupted = observeTerminalModelCommand({ execute: async () => { throw Error('interrupted'); } },
    () => seen.push(['unexpected']));
  await expect(interrupted.execute({ args: ['--print'] })).rejects.toThrow('interrupted');
  expect(seen).toHaveLength(2);
});

import { beforeEach, expect, it, vi } from 'vitest';

type Command = { stdin: string; initialInput?: string; deferredInput?: Promise<string>; stopped?: () => boolean };
const capture = vi.hoisted(() => ({ commands: [] as Command[] }));
vi.mock('../../scripts/resource-owner.mjs', async importOriginal => ({
  ...await importOriginal<object>(),
  hostResources: { execute: async (input: Command) => {
    capture.commands.push(input);
    const text = input.deferredInput ? `${input.initialInput ?? ''}${await input.deferredInput}` : input.stdin;
    return { code: 0, limited: input.stopped?.() === true, stdout: text,
      stdoutBytes: new TextEncoder().encode(text), resources: { cleanup: 'verified' } };
  } },
}));
// @ts-expect-error Physical host JavaScript.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
beforeEach(() => { capture.commands.length = 0; });
const input = { executable: '/fixture/harness', args: ['--print'], cwd: '/fixture/work', env: { HOME: '/fixture/home' },
  timeout: 1000, maxBytes: 4096, stdin: '' };

it('hands the login over at startup and supplies exactly the task at consumption', async () => {
  const runAs = { user: '_fixture', launcher: '/fixture/launcher', plan: 'max', login: () => 'fixture-login' };
  const setup = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false, runAs });
  const parked = setup.prestart(input);
  try {
    const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false, runAs, prestarted: parked });
    const result = await io.execute({ ...input, stdin: 'one current packet' });
    expect(capture.commands).toHaveLength(1);
    expect(capture.commands[0]!.initialInput).toBe('{"login":"fixture-login"}\n');
    expect(result.stdout).toBe('{"login":"fixture-login"}\none current packet');
  } finally { await parked.close(); }
});

it('disposes the unused process before dispatch when the actual credential differs', async () => {
  let login = 'before';
  const runAs = { user: '_fixture', launcher: '/fixture/launcher', plan: 'max', login: () => login };
  const setup = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false, runAs });
  const parked = setup.prestart(input);
  try {
    login = 'after';
    const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false, runAs, prestarted: parked });
    expect((await io.execute({ ...input, stdin: 'one current packet' })).stdout).toBe('{"login":"after"}\none current packet');
    expect(capture.commands).toHaveLength(2);
    expect(await capture.commands[0]!.deferredInput).toBe('');
    expect(capture.commands[0]!.stopped?.()).toBe(true);
  } finally { await parked.close(); }
});

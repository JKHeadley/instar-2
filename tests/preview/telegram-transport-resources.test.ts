import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  execFileSync: vi.fn(), spawnSync: vi.fn(), spawn: vi.fn(),
}));
import { execFileSync, spawnSync, spawn } from 'node:child_process';
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
const roots: string[] = [];
afterEach(() => {
  Object.defineProperty(process, 'platform', platform);
  vi.restoreAllMocks(); vi.resetAllMocks(); vi.resetModules();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it.each(['linux', 'darwin'])('%s Telegram invoke and poll use the host resource helpers', async host => {
  Object.defineProperty(process, 'platform', { ...platform, value: host });
  vi.spyOn(process as { getuid: () => number }, 'getuid').mockReturnValue(1001);
  vi.mocked(execFileSync).mockReturnValue('11\n12\n13\n');
  const launched: { shell: string; args: readonly string[] }[] = [];
  vi.mocked(spawnSync).mockImplementation((shell, args) => {
    if (args?.[0] === '-c') return { status: host === 'linux' && shell === '/bin/sh' ? 2 : 0 } as ReturnType<typeof spawnSync>;
    launched.push({ shell, args: args! });
    return { status: 125, stdout: '', pid: 123 } as ReturnType<typeof spawnSync>;
  });
  vi.mocked(spawn).mockImplementation((shell, args) => {
    launched.push({ shell, args: args as string[] });
    const child = Object.assign(new EventEmitter(), { stdin: Object.assign(new EventEmitter(), { end: () => {} }),
      stdout: new EventEmitter(), kill: vi.fn() });
    queueMicrotask(() => child.emit('close', 125));
    return child as unknown as ReturnType<typeof spawn>;
  });
  // Reload the helper's shell-selection cache for each injected platform.
  // @ts-expect-error Host adapter JavaScript is outside the pure core.
  const { createProductionTelegramIO } = await import('../../scripts/production-boot-io.mjs');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'telegram-resource-'))); roots.push(root);
  const io = createProductionTelegramIO(root, { preserve: () => true, read: () => null });
  const input = { method: 'getMe', body: {}, timeoutMs: 5000 };
  const refused = { kind: 'uncertain', limitation: 'transport', stage: 'launch-refused', sent: false };
  expect(io.invoke(input, 'fixture')).toEqual(refused);
  expect(await io.poll(input, 'fixture')).toEqual(refused);
  expect(launched).toHaveLength(2);
  for (const call of launched) {
    expect(call.shell).toBe(host === 'linux' ? '/bin/bash' : '/bin/sh');
    expect(call.args[0]).toMatch(/limit-exec\.sh$/u);
    expect(call.args.slice(2, 5)).toEqual(['256', '8', host === 'linux' ? '19' : '7']); // handles, CPU, observed tasks + headroom
  }
  const queries = vi.mocked(execFileSync).mock.calls;
  expect(queries).toHaveLength(2);
  for (const [command, args] of queries) {
    expect(command).toBe('/bin/ps');
    expect(args).toEqual(host === 'linux' ? ['-U', '1001', '-L', '-o', 'lwp='] : ['-U', '1001', '-o', 'pid=']);
  }
});

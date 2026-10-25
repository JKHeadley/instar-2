import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error Physical qualification adapter.
import { boundedLinuxRun } from '../../scripts/setup-qualification-linux.mjs';
// @ts-expect-error Physical qualification profile.
import { PROFILE } from '../../scripts/setup-qualification.mjs';

it.skipIf(platform() !== 'linux')('verifies kernel ceilings and holds memory/deadline/stop without retry', { timeout: 30000 }, async () => {
  const root = mkdtempSync(join('/tmp', 'setup-linux-'));
  const stopFile = join(root, 'stop.json'); writeFileSync(stopFile, '{"stopped":false}');
  const base = { root, stopFile, executable: '/usr/bin/printf', args: ['bounded'], stdin: '', profile: PROFILE };
  const good = await boundedLinuxRun(base);
  expect(good.disposition, JSON.stringify(good)).toBe('observed');
  expect(good.raw.stdout).toBe('bounded');
  expect(good.raw.cgroup.controls).toMatchObject({ 'memory.max': '2147483648', 'memory.swap.max': '0', 'pids.max': '16' });
  const slow = await boundedLinuxRun({ ...base, executable: '/bin/sleep', args: ['5'], profile: { ...PROFILE, deadlineMs: 500 } });
  expect(slow.disposition).toBe('hold'); expect(slow.attempts).toBe(1);
  const memory = await boundedLinuxRun({ ...base, profile: { ...PROFILE, memoryBytes: 1048576 } });
  expect(memory.disposition).toBe('hold'); expect(memory.attempts).toBe(1);
  writeFileSync(stopFile, '{"stopped":true}');
  const stopped = await boundedLinuxRun(base);
  expect(stopped.attempts).toBe(0); expect(stopped.raw.stdout).toBe('');
});

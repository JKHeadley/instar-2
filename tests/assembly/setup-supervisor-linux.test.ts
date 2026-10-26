import { afterEach, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error Physical Linux supervisor.
import { linuxSetupModel } from '../../scripts/setup-supervisor-linux.mjs';
// @ts-expect-error Existing Linux runner, ported from the qualification branch.
import { boundedLinuxRun } from '../../scripts/setup-qualification-linux.mjs';
// @ts-expect-error Pinned measured reservation.
import { PROFILE_3B_3GIB } from '../../scripts/setup-qualification.mjs';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(physical = false) {
  const root = mkdtempSync(join(physical ? '/tmp' : tmpdir(), 'setup-linux-supervisor-')); roots.push(root);
  const stopFile = join(root, 'stop.json'); writeFileSync(stopFile, '{"stopped":false}');
  return { root, stopFile, executable: '/usr/bin/printf', args: ['bounded'], stdin: '', profile: PROFILE_3B_3GIB };
}
it('holds absent, unsigned, mismatched and incomplete qualification without any process or root write', async () => {
  const f = fixture(), { publicKey, privateKey } = generateKeyPairSync('ed25519');
  for (const manifest of ['', '{}', JSON.stringify({ version: 1, platform: `linux-${process.arch}`, qualification: { state: 'qualified' } })]) {
    const material = { manifest, signature: sign(null, Buffer.from(manifest), privateKey) };
    const model = linuxSetupModel({ root: f.root, material, trustAnchor: publicKey.export({ type: 'spki', format: 'pem' }) });
    expect(await model.admit()).toBeNull();
  }
  expect(await linuxSetupModel({ root: f.root }).admit()).toBeNull();
  expect(readdirSync(f.root)).toEqual(['stop.json']);
});
it('rejects unbounded reservations and durable stop before launching systemd', async () => {
  const f = fixture();
  for (const profile of [{ ...f.profile, deadlineMs: Infinity }, { ...f.profile, memoryBytes: 4 * 1024 ** 3 }, { ...f.profile, processCount: 17 }])
    expect(await boundedLinuxRun({ ...f, profile })).toMatchObject({ disposition: 'hold', attempts: 0 });
  writeFileSync(f.stopFile, '{"stopped":true}');
  expect(await boundedLinuxRun(f)).toMatchObject({ disposition: 'hold', attempts: 0 });
});
it.skipIf(process.env.INSTAR_SETUP_LINUX_PHYSICAL !== '1')('real Linux cgroup success, deadline, stop, memory and write confinement', { timeout: 30000 }, async () => {
  const f = fixture(true);
  const good = await boundedLinuxRun(f);
  expect(good.disposition, JSON.stringify({ root: f.root, good })).toBe('observed');
  expect(good.raw.stdout).toBe('bounded');
  expect(good.raw.cgroup.controls).toMatchObject({ 'memory.max': String(3 * 1024 ** 3), 'memory.swap.max': '0', 'pids.max': '16' });
  expect(good.raw.resources.cleanup).toBe('verified');
  const slow = await boundedLinuxRun({ ...f, executable: '/bin/sleep', args: ['5'], profile: { ...f.profile, deadlineMs: 500 } });
  expect(slow.disposition).toBe('hold'); expect(slow.attempts).toBe(1);
  expect((await boundedLinuxRun({ ...f, profile: { ...f.profile, memoryBytes: 1048576 } })).disposition).toBe('hold');
  expect((await boundedLinuxRun({ ...f, executable: join(f.root, 'missing') })).disposition).toBe('hold');
  const timer = setTimeout(() => writeFileSync(f.stopFile, '{"stopped":true}'), 300);
  try {
    expect(await boundedLinuxRun({ ...f, executable: '/bin/sleep', args: ['5'] })).toMatchObject({ disposition: 'hold', raw: { cancellationReason: 'stopped' } });
  } finally { clearTimeout(timer); }
  writeFileSync(f.stopFile, '{"stopped":false}');
  const outside = mkdtempSync(join('/tmp', 'supervisor-denied-')); roots.push(outside);
  const escaped = await boundedLinuxRun({ ...f, executable: '/usr/bin/python3', args: ['-c', `open(${JSON.stringify(join(outside, 'escaped'))}, 'w').write('escape')`] });
  expect(escaped.disposition).toBe('hold'); expect(readdirSync(outside)).toEqual([]);
  const inside = await boundedLinuxRun({ ...f, executable: '/usr/bin/python3', args: ['-c', `open(${JSON.stringify(join(f.root, 'allowed'))}, 'w').write('bounded')`] });
  expect(inside.disposition).toBe('observed'); expect(readFileSync(join(f.root, 'allowed'), 'utf8')).toBe('bounded');
});

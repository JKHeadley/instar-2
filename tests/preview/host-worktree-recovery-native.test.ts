// The installed-identity boundary needs the Studio installation. Run explicitly with
// INSTAR_TEST_NATIVE_WORKTREE=1; portable wiring tests live beside this contract.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error Physical host boundary is JavaScript.
import { createHostWorktreeRecovery, queryWorktreeHost } from '../../scripts/host-worktree-recovery.mjs';
// @ts-expect-error Existing installed identity boundary is JavaScript.
import { grantAcl, harnessAcl, HARNESS_TMP, HARNESS_USER, runnerUser, probeAccess } from './harness-user.mjs';

it.runIf(process.env.INSTAR_TEST_NATIVE_WORKTREE === '1')('observes the installed separate identity and native recursive activity while refusing unknown live owners', async () => {
  expect(process.platform).toBe('darwin');
  const uid = Number(execFileSync('/usr/bin/id', ['-u', HARNESS_USER], { encoding: 'utf8' }).trim());
  expect(uid).not.toBe(process.getuid!());
  const directory = realpathSync(mkdtempSync(`${HARNESS_TMP}/row03-native-`));
  grantAcl([directory], [harnessAcl.full(HARNESS_USER), harnessAcl.full(runnerUser())]);
  const git = (...args: string[]) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  git('init', '--quiet'); writeFileSync(`${directory}/base`, 'base'); git('add', 'base');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'base');
  mkdirSync(`${directory}/nested/deep`, { recursive: true });
  const child = spawn('/usr/bin/sudo', ['-n', '-u', HARNESS_USER, process.execPath, '-e',
    "const fs=require('node:fs'); console.log(JSON.stringify({pid:process.pid,uid:process.getuid()})); process.stdin.on('data',()=>{fs.writeFileSync('nested/deep/dirty','native retained work'); console.log('written')}); process.stdin.on('end',()=>process.exit(0));"],
  { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] });
  const exited = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  let output = '', errors = '';
  child.stdout.on('data', data => { output += String(data); });
  child.stderr.on('data', data => { errors += String(data); });
  const until = async (test: () => boolean) => {
    const deadline = performance.now() + 5000;
    while (!test()) {
      if (performance.now() >= deadline || child.exitCode !== null) throw Error(`native observation unavailable: ${errors}`);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  };
  let now = 1000, state: { version: number; checkouts: Record<string, { lastActivity: number }> } | null = null;
  let host: { tick(force?: boolean): Promise<unknown[]>; sourceFor(path: string): string | null; close(): void } | undefined;
  let accepts = 0;
  try {
    await until(() => output.includes('\n'));
    const worker = JSON.parse(output.split('\n')[0]!) as { pid: number; uid: number };
    expect(worker.uid).toBe(uid);
    const cwd = await queryWorktreeHost('/usr/sbin/lsof', ['-a', '-d', 'cwd', '-p', String(worker.pid), '-Fpn', '-w']);
    expect(cwd).toContain(`n${directory}\n`);
    expect(probeAccess([`r:${directory}`, `w:${directory}`, `r:${process.env.HOME}/.instar`]))
      .toMatchObject([{ ok: true }, { ok: true }, { ok: false, code: 'EACCES' }]);
    host = await createHostWorktreeRecovery({ scope: directory, identity: { machine: 'native-studio', hardwareProfile: 'darwin' },
      now: () => now, monotonic: () => now, stopped: () => false, workerUid: () => uid,
      store: { load: () => state, save: (next: typeof state) => { state = structuredClone(next); } },
      route: { channel: 'native-observer', sender: 'studio', identityEpoch: 'fixture' },
      intake: () => ({ receive: () => { accepts++; throw Error('a live unknown owner cannot authorize intake'); } }),
      liveSources: async () => child.exitCode === null ? [{ pid: child.pid, source: 'accepted:fixture' }] : [],
      sameTopic: (left: string, right: string) => left === right });
    await host!.tick();
    expect(host!.sourceFor(directory)).toBe('accepted:fixture');
    now = 32000; child.stdin.write('write\n');
    await until(() => output.includes('written') && state?.checkouts[directory]?.lastActivity === 32000);
    now = 63000;
    expect(await host!.tick()).toEqual([]); // actual live owner, even after the quiet interval
    expect(accepts).toBe(0);
    expect(readFileSync(`${directory}/nested/deep/dirty`, 'utf8')).toBe('native retained work');
    child.stdin.end(); expect(await exited).toEqual({ code: 0, signal: null });
    // Do not turn the installed UID's other OS processes into non-owners by name,
    // age, or cwd. With such processes the full native census must retain refusal.
    const remaining = await queryWorktreeHost('/bin/ps', ['-U', String(uid), '-o', 'pid=']);
    if (remaining?.trim()) { now = 94000; expect(await host!.tick()).toEqual([]); expect(accepts).toBe(0); }
  } finally {
    child.stdin.end(); await exited; host?.close(); rmSync(directory, { recursive: true, force: true });
  }
});

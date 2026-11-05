// The installed-identity boundary needs the Studio installation. Run explicitly with
// INSTAR_TEST_NATIVE_WORKTREE=1; portable wiring tests live beside this contract.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createJournalWorktreeIntake } from './worktree-recovery-intake.js';
import { createJournalWorker, openPreviewJournal, previewTestContext } from './journal-test-worker.js';
// @ts-expect-error Physical host boundary is JavaScript.
import { createHostWorktreeRecovery, queryWorktreeHost } from '../../scripts/host-worktree-recovery.mjs';
// @ts-expect-error Existing installed identity boundary is JavaScript.
import { grantAcl, harnessAcl, HARNESS_TMP, HARNESS_USER, runnerUser, probeAccess } from './harness-user.mjs';

it.runIf(process.env.INSTAR_TEST_NATIVE_WORKTREE === '1').each(['retired', 'unknown'] as const)(
  'native %s ownership reaches signed recovery only after complete owner exclusion', async neighbor => {
  expect(process.platform).toBe('darwin');
  const uid = Number(execFileSync('/usr/bin/id', ['-u', HARNESS_USER], { encoding: 'utf8' }).trim());
  expect(uid).not.toBe(process.getuid!());
  const directory = realpathSync(mkdtempSync(`${HARNESS_TMP}/row03-native-`));
  grantAcl([directory], [harnessAcl.full(HARNESS_USER), harnessAcl.full(runnerUser())]);
  const git = (...args: string[]) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  git('init', '--quiet'); writeFileSync(`${directory}/base`, 'base'); git('add', 'base');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'base');
  mkdirSync(`${directory}/nested/deep`, { recursive: true });
  const captured = readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8');
  writeFileSync(`${directory}/retained-work.json`, captured);
  const journalDirectory = mkdtempSync(join(tmpdir(), 'native-recovery-journal-'));
  const journal = openPreviewJournal(join(journalDirectory, 'journal'), new Uint8Array(32).fill(31),
    { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
      configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 20, maxReplies: 20,
      maxTurns: 30, maxBytes: 1048576, cursor: 0 });
  let now = 1000, reads = 0;
  const consumer = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => {
      if (input.question.includes(directory)) {
        expect(readFileSync(`${directory}/retained-work.json`, 'utf8')).toBe(captured); reads++;
      }
      return JSON.stringify({ reply: 'Retained checkout read.', memory: [] });
    }, checkOutbound: () => {}, send: async () => 900 });
  await consumer.intake([{ update_id: 1, message: { message_id: 1, chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text: 'Continue my checkout work.' } }]);
  const source = journal.view.order[0]!.id;
  // This unregistered worker is older than the registered root and runs outside the checkout.
  // Its open handle is direct evidence of continuing relevance, irrespective of name
  // or current ancestry. No signal or production process is involved.
  const unknown = neighbor === 'unknown' ? spawn('/usr/bin/sudo', ['-n', '-u', HARNESS_USER, process.execPath, '-e',
    "const fs=require('node:fs'); const fd=fs.openSync(process.argv[1],'r'); console.log(process.pid); process.stdin.on('data',()=>console.log(fs.readFileSync(fd).length)); process.stdin.on('end',()=>{fs.closeSync(fd);process.exit(0)})",
    `${directory}/retained-work.json`], { cwd: HARNESS_TMP, stdio: ['pipe', 'pipe', 'pipe'] }) : null;
  const unknownExit = unknown && new Promise(resolve => unknown.once('close', (code, signal) => resolve({ code, signal })));
  let unknownOutput = '';
  unknown?.stdout.on('data', data => { unknownOutput += String(data); });
  // Distinct ps lstart seconds make this an age-exclusion counterexample as well.
  if (unknown) await new Promise(resolve => setTimeout(resolve, 1200));
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
  let state: { version: number; checkouts: Record<string, { lastActivity: number }> } | null = null;
  let host: { tick(force?: boolean): Promise<unknown[]>; sourceFor(path: string): string | null; close(): void } | undefined;
  const recoveries = () => journal.view.order.filter(turn => turn.worktreeRecovery);
  try {
    await until(() => output.includes('\n'));
    const worker = JSON.parse(output.split('\n')[0]!) as { pid: number; uid: number };
    console.info('native recovery observation', { neighbor, uid, wrapperPid: child.pid, workerPid: worker.pid,
      unknownPid: unknownOutput.trim() || null, checkout: directory });
    expect(worker.uid).toBe(uid);
    const cwd = await queryWorktreeHost('/usr/sbin/lsof', ['-a', '-d', 'cwd', '-p', String(worker.pid), '-Fpn', '-w']);
    expect(cwd).toContain(`n${directory}\n`);
    expect(probeAccess([`r:${directory}`, `w:${directory}`, `r:${process.env.HOME}/.instar`]))
      .toMatchObject([{ ok: true }, { ok: true }, { ok: false, code: 'EACCES' }]);
    if (unknown) {
      expect(unknownOutput).toMatch(/^\d+\n/u);
      unknown.stdin.write('read\n');
      await until(() => unknownOutput.split('\n').length >= 3);
      expect(Number(unknownOutput.split('\n')[1])).toBe(Buffer.byteLength(captured));
      const unknownCwd = await queryWorktreeHost('/usr/sbin/lsof',
        ['-a', '-d', 'cwd', '-p', unknownOutput.split('\n')[0]!, '-Fpn', '-w']);
      expect(unknownCwd).toContain(`n${realpathSync(HARNESS_TMP)}\n`);
    }
    const route = { channel: 'native-observer', sender: 'studio', identityEpoch: 'fixture' };
    host = await createHostWorktreeRecovery({ scope: directory, identity: { machine: 'native-studio', hardwareProfile: 'darwin' },
      now: () => now, monotonic: () => now, stopped: () => false, workerUid: () => uid,
      store: { load: () => state, save: (next: typeof state) => { state = structuredClone(next); } },
      route,
      intake: (sourceFor: (path: string) => string | null) => createJournalWorktreeIntake({ journal,
        context: previewTestContext, route, machine: 'native-studio', now: () => now, stopped: () => false,
        sourceFor, checkText: () => {} }),
      liveSources: async () => child.exitCode === null ? [{ pid: child.pid, source }] : [],
      sameTopic: (left: string, right: string) => left === right });
    await host!.tick();
    expect(host!.sourceFor(directory)).toBe(source);
    now = 32000; child.stdin.write('write\n');
    await until(() => output.includes('written') && state?.checkouts[directory]?.lastActivity === 32000);
    now = 63000;
    expect(await host!.tick()).toEqual([]); // actual live owner, even after the quiet interval
    expect(recoveries()).toHaveLength(0);
    expect(readFileSync(`${directory}/nested/deep/dirty`, 'utf8')).toBe('native retained work');
    child.stdin.end(); expect(await exited).toEqual({ code: 0, signal: null });
    const remaining = await queryWorktreeHost('/bin/ps', ['-U', String(uid), '-o', 'pid=']);
    expect(remaining?.trim()).toBeTruthy(); // the real complete population retains background processes
    console.info('native remaining UID population', remaining?.trim());
    now = 94000; await host!.tick();
    if (neighbor === 'unknown') {
      expect(recoveries()).toHaveLength(0);
      expect(reads).toBe(0);
    } else {
      // Deliberately strict: native observation/refusal alone cannot pass completion.
      expect(recoveries()).toHaveLength(1);
      const recovery = recoveries()[0]!;
      expect(recovery.writer).toMatchObject({ kind: 'system', class: 'verified' });
      expect(recovery.worktreeRecovery?.source).toBe(source);
      expect(recovery.thread).toBe(journal.view.turns.get(source)?.thread);
      expect(recovery.text).toContain(directory);
      await consumer.drain(); await consumer.drain();
      expect(reads).toBe(1);
      expect(journal.view.turns.get(recovery.id)?.sent).toBe(900);
      expect(readFileSync(`${directory}/retained-work.json`, 'utf8')).toBe(captured);
    }
  } finally {
    child.stdin.end(); await exited;
    unknown?.stdin.end(); if (unknownExit) expect(await unknownExit).toEqual({ code: 0, signal: null });
    host?.close(); journal.close();
    rmSync(directory, { recursive: true, force: true }); rmSync(journalDirectory, { recursive: true, force: true });
  }
});

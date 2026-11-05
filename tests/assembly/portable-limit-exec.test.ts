// @ts-nocheck -- the shipped limit shim under the host's real shells, with finite real Node children.
// Row 07 launch refusal (Mama PC, 2026-11-05): /bin/sh there is dash, whose ulimit has no `-u`, so the
// shipped shim exited 125 at its process-limit query before env, Node or the network, and the production
// transport read every send as launch-refused. The owner now names one fixed shell (scripts/resource-owner.mjs
// LIMIT_SHELL) on every host and counts the user ID in the kernel's own unit; these cases hold that on the
// shells this host has, with the exact bounds the measured launch carried (256 handles, the transport's CPU
// seconds, the user's count plus four).
import { expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { LIMIT_FILE, LIMIT_FILE_TEXT, LIMIT_SHELL, limitedArgv, limitedFileArgv, uidLimitQuery, uidLimitUnit } from '../../scripts/resource-owner.mjs';
import { transportEnvironment } from '../../scripts/production-boot-io.mjs';

const env = { PATH: '/usr/bin:/bin' };
const run = (shell, args, extra = {}) => spawnSync(shell, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024, env, ...extra });
/** What the child itself reports as its effective soft and hard limits (Rule 26: the state, not the argv). */
const REPORT = 'const l=process.report.getReport().userLimits;process.stdout.write(JSON.stringify({handles:l.open_files,cpu:l.cpu_time_seconds,processes:l.max_user_processes}))';
/** The production census: this user's current count in the kernel's unit (ps lists itself; that row is counted, as production counts it). */
const census = () => execFileSync('/bin/ps', uidLimitQuery(process.getuid()), { encoding: 'utf8', timeout: 2000, env }).split('\n').filter(line => line.trim()).length;
const measured = () => ({ handles: 256, cpuSeconds: 23, processLimit: census() + 4 });
const expectBound = (report, bound) => {
  expect(report.handles).toEqual({ soft: bound.handles, hard: bound.handles });
  expect(report.cpu).toEqual({ soft: bound.cpuSeconds, hard: bound.cpuSeconds });
  expect(report.processes).toEqual({ soft: bound.processLimit, hard: bound.processLimit });
};

it('names one fixed shell for every launch, the kernel census unit of each host, and ships the shim file unchanged', () => {
  expect(LIMIT_SHELL).toBe('/bin/bash');
  expect(existsSync(LIMIT_SHELL)).toBe(true);
  expect(readFileSync(LIMIT_FILE, 'utf8')).toBe(LIMIT_FILE_TEXT);
  expect(uidLimitQuery(1000, 'linux')).toEqual(['-U', '1000', '-L', '-o', 'lwp=']);
  expect(uidLimitQuery(501, 'darwin')).toEqual(['-U', '501', '-o', 'pid=']);
  expect(uidLimitUnit('linux')).toBe('tasks'); expect(uidLimitUnit('darwin')).toBe('processes');
  // Both argv forms are the shell's arguments: its flags, then the script, then the label the file shim drops.
  const file = limitedFileArgv({ label: 'REQUEST', executable: '/bin/true', args: [], ...measured(), env });
  expect(file.slice(0, 3)).toEqual(['-p', LIMIT_FILE, 'REQUEST']);
  expect(limitedArgv({ executable: '/bin/true', args: [], ...measured(), env, gated: false }).slice(0, 2)).toEqual(['-p', '-c']);
  // The transport runtime: Darwin unchanged; Linux composed to fit the four-task headroom (see production-boot-io.mjs).
  expect(transportEnvironment('darwin')).toEqual({ PATH: '/usr/bin:/bin', NODE_OPTIONS: '--max-old-space-size=256' });
  expect(transportEnvironment('linux')).toEqual({ PATH: '/usr/bin:/bin', NODE_OPTIONS: '--max-old-space-size=256 --v8-pool-size=1 --disable-sigusr1', UV_THREADPOOL_SIZE: '1' });
});

it.runIf(existsSync('/bin/dash'))('the measured defect: a shell without the process-limit primitive refuses the shipped shim with exit 125 before any exec', () => {
  // The exact production argv under the Mama PC's /bin/sh (dash). dash takes no `-p`, so the shell flag is
  // dropped to reach the shim itself: the refusal is the shim's own line-4 query, the class measured live.
  const argv = limitedFileArgv({ label: 'REQUEST', executable: process.execPath, args: ['-e', 'process.stdout.write("DISPATCHED")'], ...measured(), env }).slice(1);
  const refused = run('/bin/dash', argv);
  expect(refused.status).toBe(125);
  expect(refused.stdout).toBe('');
  expect(refused.stderr).toMatch(/ulimit: Illegal option -u/u);
  // The same shim text, same bounds, through the owner's shell: the child runs and reports those bounds.
  const bound = measured();
  const ran = run(LIMIT_SHELL, limitedFileArgv({ label: 'REQUEST', executable: process.execPath, args: ['-e', REPORT], ...bound, env }));
  expect(ran.status, ran.stderr).toBe(0);
  expectBound(JSON.parse(ran.stdout), bound);
});

it.each(['inline', 'file'])('the %s shim under its shell runs a finite Node that reports the exact lowered soft and hard limits, and a stricter inherited fence wins', mode => {
  const bound = measured();
  const command = { executable: process.execPath, args: ['-e', REPORT], ...bound, env };
  const argv = mode === 'file' ? limitedFileArgv({ label: 'REQUEST', ...command }) : limitedArgv({ ...command, gated: false });
  const child = run(LIMIT_SHELL, argv);
  expect(child.status, child.stderr).toBe(0);
  expectBound(JSON.parse(child.stdout), bound);
  // Lower inherited limits are never raised: the shim only lowers, so the stricter fence stays.
  const inherited = run(LIMIT_SHELL, ['-c', 'ulimit -S -n 48; ulimit -H -n 48; ulimit -S -t 2; ulimit -H -t 2; exec "$@"', 'inherited', LIMIT_SHELL, ...argv]);
  expect(inherited.status, inherited.stderr).toBe(0);
  const report = JSON.parse(inherited.stdout);
  expect(report.handles).toEqual({ soft: 48, hard: 48 });
  expect(report.cpu).toEqual({ soft: 2, hard: 2 });
  expect(report.processes).toEqual({ soft: bound.processLimit, hard: bound.processLimit });
});

it('a closed owner gate never dispatches, a limit the shell cannot apply refuses before exec, and a missing shell never falls back', () => {
  const gated = limitedArgv({ executable: '/bin/echo', args: ['DISPATCHED'], ...measured(), env, gated: true });
  // fd 3 closed: the gate read fails, so the shim exits 125 with nothing run.
  const closed = run(LIMIT_SHELL, gated, { stdio: ['ignore', 'pipe', 'pipe', 'ignore'] });
  expect(closed.status).toBe(125); expect(closed.stdout).toBe('');
  // A bound the shell cannot apply (not a number) is a refusal before exec, never a launch without it.
  const unapplied = run(LIMIT_SHELL, limitedArgv({ executable: '/bin/echo', args: ['DISPATCHED'], ...measured(), handles: 'many', env, gated: false }));
  expect(unapplied.status).toBe(125); expect(unapplied.stdout).toBe('');
  // No shell at the fixed path: the host refuses the spawn (no process id), which the callers read as spawn-refused.
  const missing = spawnSync('/nonexistent/instar-limit-shell', gated, { timeout: 1000 });
  expect(missing.error?.code).toBe('ENOENT'); expect(missing.pid).toBe(0);
});

it.runIf(process.platform === 'linux')('Linux: the transport runtime starts inside the user-ID task headroom the production census grants, and the kernel fence binds in tasks', () => {
  // The production formula exactly: the thread census (ps listing itself) plus the transport's four.
  const bound = { handles: 256, cpuSeconds: 23, processLimit: census() + 4 };
  const runtime = transportEnvironment();
  const code = `const fs=require('node:fs'),{spawn}=require('node:child_process');
const status=()=>Object.fromEntries(fs.readFileSync('/proc/self/status','utf8').split('\\n').filter(x=>/^(Uid|CapEff|Threads|NSpid):/.test(x)).map(x=>x.split(/:\\s*/)));
const out={limits:process.report.getReport().userLimits,start:status()};
require('node:dns').lookup('localhost',()=>{ out.afterLookup=status();
  // Fill the remaining headroom with this process's own children, held alive together, until the kernel refuses
  // one: that refusal is the fence in tasks. Bounded by the headroom plus one; every child is this process's own
  // and is ended by its handle, never by a pattern.
  const held=[],refusals=[];let pending=0;
  const finish=()=>{ out.held=held.length; out.refusals=refusals; out.end=status(); for (const h of held) h.kill('SIGKILL'); process.stdout.write(JSON.stringify(out)); };
  for (let i=0;i<6;i++){ const h=spawn('/bin/sleep',['5']); pending++;
    h.once('error',e=>{ refusals.push(e.code); if(--pending===0) finish(); });
    h.once('spawn',()=>{ held.push(h); if(--pending===0) finish(); }); }
});`;
  const child = run(LIMIT_SHELL, limitedFileArgv({ label: 'finite-node-proof', executable: process.execPath, args: ['-e', code], ...bound, env: runtime }), { env: runtime });
  expect(child.status, child.stderr).toBe(0);
  const evidence = JSON.parse(child.stdout);
  console.log('Linux task-fence evidence', JSON.stringify(evidence));
  expect(evidence.limits.open_files).toEqual({ soft: 256, hard: 256 });
  expect(evidence.limits.cpu_time_seconds).toEqual({ soft: 23, hard: 23 });
  expect(evidence.limits.max_user_processes).toEqual({ soft: bound.processLimit, hard: bound.processLimit });
  // The fence applies to this user: not root, no CAP_SYS_RESOURCE/CAP_SYS_ADMIN (observed, not assumed).
  expect(evidence.start.Uid.split(/\s+/u)[0]).not.toBe('0');
  expect(evidence.start.CapEff).toMatch(/^0+$/u);
  // The composed runtime fits the four-task headroom with its libuv worker started.
  expect(Number(evidence.afterLookup.Threads)).toBeLessThanOrEqual(4);
  // The fence binds in tasks: the process could not hold six more children, and the refusal is the kernel's EAGAIN.
  expect(evidence.held).toBeLessThan(6);
  expect(evidence.refusals.length).toBeGreaterThan(0);
  expect(new Set(evidence.refusals)).toEqual(new Set(['EAGAIN']));
});

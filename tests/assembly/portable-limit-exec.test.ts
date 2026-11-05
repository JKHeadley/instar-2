// @ts-nocheck -- real fixed-host JS adapter and finite native children.
import { expect, it } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { LIMIT_FILE, LIMIT_FILE_TEXT, LIMIT_SHELL, limitedArgv, limitedFileArgv, uidLimitQuery } from '../../scripts/resource-owner.mjs';
import { transportEnvironment } from '../../scripts/production-boot-io.mjs';

const env = { PATH: '/usr/bin:/bin' };
const run = (args, extra = {}) => spawnSync(LIMIT_SHELL, args, {
  encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024, env, ...extra,
});
const limits = { handles: 64, cpuSeconds: 3, processLimit: null, env };

it('ships the exact canonical shim and names the actual kernel census unit on each host', () => {
  expect(readFileSync(LIMIT_FILE, 'utf8')).toBe(LIMIT_FILE_TEXT);
  expect(uidLimitQuery(1000, 'linux')).toEqual(['-U', '1000', '-L', '-o', 'lwp=']);
  expect(uidLimitQuery(501, 'darwin')).toEqual(['-U', '501', '-o', 'pid=']);
  expect(transportEnvironment('darwin')).toEqual({ PATH: '/usr/bin:/bin', NODE_OPTIONS: '--max-old-space-size=256' });
});

it.each(['inline', 'file'])('the %s owner shim lowers both effective limits and keeps stricter inherited fences', mode => {
  const command = { ...limits, executable: process.execPath, args: ['-e',
    'const r=process.report.getReport();console.log(JSON.stringify({handles:r.userLimits.open_files,cpu:r.userLimits.cpu_time_seconds}));'] };
  const args = mode === 'file' ? limitedFileArgv({ ...command, label: 'bound' }) : limitedArgv(command);
  const child = run(args);
  expect(child.status, child.stderr).toBe(0);
  expect(JSON.parse(child.stdout)).toEqual({ handles: { soft: 64, hard: 64 }, cpu: { soft: 3, hard: 3 } });
  const inherited = run(['-c', 'ulimit -S -n 48; ulimit -H -n 48; ulimit -S -t 2; ulimit -H -t 2; exec "$@"', 'inherited', LIMIT_SHELL, ...args]);
  expect(inherited.status, inherited.stderr).toBe(0);
  expect(JSON.parse(inherited.stdout)).toEqual({ handles: { soft: 48, hard: 48 }, cpu: { soft: 2, hard: 2 } });
});

it.each(['garbage', '-1', '1.5'])('refuses malformed bounds %s before executing the command', handles => {
  const child = run(limitedArgv({ ...limits, handles, executable: '/bin/echo', args: ['DISPATCHED'] }));
  expect(child.status).toBe(125); expect(child.stdout).toBe('');
});

it('a closed owner gate never dispatches, and a missing shell cannot fall back', () => {
  const args = limitedArgv({ ...limits, gated: true, executable: '/bin/echo', args: ['DISPATCHED'] });
  const child = run(args, { stdio: ['ignore', 'pipe', 'pipe', 'ignore'] });
  expect(child.status).toBe(125); expect(child.stdout).toBe('');
  const missing = spawnSync('/nonexistent/instar-limit-shell', args, { timeout: 1000 });
  expect(missing.error?.code).toBe('ENOENT'); expect(missing.pid).toBe(0);
});

it.runIf(process.platform === 'linux')('real Linux Node, own worker and DNS fit the unchanged four-task room; the kernel refuses an extra fork', () => {
  // The census's ps is about to exit: subtract it so the child cannot borrow that slot.
  const count = execFileSync('/bin/ps', uidLimitQuery(process.getuid()), { encoding: 'utf8', timeout: 2000 })
    .trim().split(/\s+/u).length - 1;
  const processLimit = count + 4, runtimeEnv = transportEnvironment();
  const code = `const fs=require('node:fs'), {Worker}=require('node:worker_threads'), cp=require('node:child_process');
const status=()=>fs.readFileSync('/proc/self/status','utf8').split('\\n').filter(x=>/^(Uid|CapEff|Threads|NSpid):/.test(x));
const first={limits:process.report.getReport().userLimits,status:status()};
const w=new Worker('const {parentPort}=require("node:worker_threads");const timeout=setTimeout(()=>process.exit(3),2000);parentPort.once("message",()=>{clearTimeout(timeout);parentPort.close();});parentPort.postMessage("ready")',{eval:true});
w.once('message',()=>{const extra=cp.spawnSync('/bin/true',[],{timeout:1000});
first.workerStatus=status();first.extraFork={status:extra.status,error:extra.error?.code};w.postMessage("finish");});
w.once('exit',code=>{first.workerExit=code;require('node:dns').lookup('localhost',(error)=>{
first.dnsError=error?.code??null;first.finalStatus=status();console.log(JSON.stringify(first));});});`;
  const child = run(limitedFileArgv({ label: 'finite-node-proof', ...limits, handles: 256, cpuSeconds: 8,
    processLimit, executable: process.execPath, args: ['-e', code], env: runtimeEnv }), { env: runtimeEnv });
  expect(child.status, child.stderr).toBe(0);
  const evidence = JSON.parse(child.stdout);
  expect(evidence.limits.open_files).toEqual({ soft: 256, hard: 256 });
  expect(evidence.limits.cpu_time_seconds).toEqual({ soft: 8, hard: 8 });
  expect(evidence.limits.max_user_processes).toEqual({ soft: processLimit, hard: processLimit });
  expect(evidence.status).toContain('CapEff:\t0000000000000000');
  expect(evidence.workerStatus).toContain('Threads:\t4');
  expect(evidence.extraFork.error).toBe('EAGAIN');
  expect(evidence.workerExit).toBe(0); expect(evidence.dnsError).toBeNull();
  expect(evidence.finalStatus).toContain('Threads:\t4');
  console.log('finite Linux kernel evidence', JSON.stringify(evidence));
});

it('missing fixed backend refuses before dispatch; an unsupported primitive never falls back', () => {
  const args = limitedArgv({ ...limits, processLimit: 1, executable: '/bin/echo', args: ['DISPATCHED'] });
  const absent = [...args]; absent[1] = absent[1].replaceAll('/bin/bash', '/nonexistent/limit-backend');
  const missing = run(absent); expect(missing.status).toBe(125); expect(missing.stdout).toBe('');
  // Fault only the primitive inside the generated body; the production wrapper,
  // gate, setters and eventual command are otherwise unchanged.
  const unsupported = [...args]; unsupported[1] = unsupported[1].replace('lim() {', 'ulimit() { return 2; }; lim() {');
  const refused = run(unsupported); expect(refused.status).toBe(125); expect(refused.stdout).toBe('');
});

it('caller-exported shell functions cannot replace the real limit setter', () => {
  const args = limitedFileArgv({ ...limits, label: 'exact', executable: process.execPath,
    args: ['-e', 'console.log(process.report.getReport().userLimits.open_files.hard)'] });
  const child = run(args, { env: { ...env, 'BASH_FUNC_ulimit%%': '() { echo unlimited; }', BASH_ENV: '/nonexistent/caller-startup' } });
  expect(child.status, child.stderr).toBe(0); expect(child.stdout.trim()).toBe('64');
});

it('an unreadable UID census refuses both invoke and poll without dispatch', async () => {
  const cp = (await import('node:child_process')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createProductionTelegramIO } = await import('../../scripts/production-boot-io.mjs');
  const root = mkdtempSync(join(tmpdir(), 'portable-refusal-'));
  const original = { execFileSync: cp.execFileSync, spawn: cp.spawn, spawnSync: cp.spawnSync };
  let dispatches = 0;
  cp.execFileSync = () => { throw Object.assign(Error('census denied'), { code: 'EACCES' }); };
  cp.spawn = cp.spawnSync = () => { dispatches++; throw Error('must not dispatch'); };
  syncBuiltinESMExports();
  try {
    const io = createProductionTelegramIO(root, {}, 'http://127.0.0.1:1');
    const request = { method: 'sendMessage', body: {}, timeoutMs: 100 };
    expect(io.invoke(request, 'offline')).toMatchObject({ stage: 'launch-refused', sent: false });
    expect(await io.poll(request, 'offline')).toMatchObject({ stage: 'launch-refused', sent: false });
    expect(dispatches).toBe(0);
  } finally { Object.assign(cp, original); syncBuiltinESMExports(); rmSync(root, { recursive: true, force: true }); }
});

it('the fixed backend retains a stricter inherited hard and soft process fence', () => {
  const observed = execFileSync('/bin/ps', uidLimitQuery(process.getuid()), { encoding: 'utf8', timeout: 2000 })
    .trim().split(/\s+/u).length;
  const inherited = observed + 4;
  const args = limitedArgv({ ...limits, processLimit: inherited + 1, executable: '/bin/bash',
    args: ['-p', '-c', 'ulimit -S -u; ulimit -H -u'] });
  const child = spawnSync('/bin/bash', ['-p', '-c',
    'ulimit -S -u "$1"; ulimit -H -u "$1"; shift; exec "$@"', 'inherited', String(inherited), LIMIT_SHELL, ...args],
    { encoding: 'utf8', timeout: 5000, env });
  expect(child.status, child.stderr).toBe(0);
  expect(child.stdout.trim().split('\n')).toEqual([String(inherited), String(inherited)]);
});

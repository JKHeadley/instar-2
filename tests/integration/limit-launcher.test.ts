// Rules 13/26/60: observe the real child limits, with both supported host census units.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical host adapter remains JavaScript.
import { limitedArgv, limitedFileArgv, LIMIT_FILE, LIMIT_FILE_TEXT, processCensusArgs, processCensusCount, processHeadroom } from '../../scripts/resource-owner.mjs';
const roots: string[] = [];
const root = () => { const path = mkdtempSync(join(tmpdir(), 'limit-launcher-')); roots.push(path); return path; };
afterEach(() => roots.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
const env = { PATH: '/usr/bin:/bin' };
const limits = { handles: 64, cpuSeconds: 5, processLimit: 128, env };
const readLimits = 'ulimit -S -n; ulimit -H -n; ulimit -S -t; ulimit -H -t; ulimit -S -u; ulimit -H -u';

it.each(['inline', 'file'])('applies all six soft/hard limits through /bin/sh (%s)', shape => {
  const command = { ...limits, executable: '/bin/bash', args: ['-p', '-c', readLimits], label: 'request', gated: false };
  const argv = shape === 'file' ? limitedFileArgv(command) : limitedArgv(command);
  expect(execFileSync('/bin/sh', argv, { encoding: 'utf8', env }).trim().split('\n').map(Number))
    .toEqual([64, 64, 5, 5, 128, 128]);
  expect(readFileSync(LIMIT_FILE, 'utf8')).toBe(LIMIT_FILE_TEXT);
});

it('never raises tighter inherited ceilings', () => {
  const inner = limitedArgv({ ...limits, executable: '/bin/bash', args: ['-p', '-c', readLimits], gated: false });
  const outer = limitedArgv({ ...limits, handles: 48, cpuSeconds: 3, processLimit: 96,
    executable: '/bin/sh', args: inner, gated: false });
  expect(execFileSync('/bin/sh', outer, { encoding: 'utf8', env }).trim().split('\n').map(Number))
    .toEqual([48, 48, 3, 3, 96, 96]);
});

it('ignores BASH_ENV and preserves literal argv without executing it', () => {
  const path = root(), startup = join(path, 'startup'), marker = join(path, 'ran');
  writeFileSync(startup, `echo unsafe > '${marker}'\n`);
  const literal = 'a b; $(echo injected) "quoted"';
  const argv = limitedFileArgv({ ...limits, env: { ...env, BASH_ENV: startup }, label: 'request',
    executable: '/bin/echo', args: [literal] });
  expect(execFileSync('/bin/sh', argv, { encoding: 'utf8', env: { ...env, BASH_ENV: startup } }).trim()).toBe(literal);
  expect(existsSync(marker)).toBe(false);
});

it.each(['go', 'wrong', 'closed'])('executes only after the durable gate says go (%s)', async signal => {
  const child = spawn('/bin/sh', limitedArgv({ ...limits, executable: '/bin/echo', args: ['started'], gated: true }),
    { env, stdio: ['ignore', 'pipe', 'pipe', 'pipe'] });
  let output = '';
  child.stdout!.on('data', bytes => { output += bytes; });
  const closed = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  const gate = child.stdio[3] as import('node:stream').Writable;
  gate.end(signal === 'closed' ? '' : `${signal}\n`);
  expect(await closed).toBe(signal === 'go' ? 0 : 125);
  expect(output).toBe(signal === 'go' ? 'started\n' : '');
});

it('counts Linux threads and macOS processes without confusing their units', () => {
  expect(processCensusArgs(501, 'linux')).toEqual(['-U', '501', '-o', 'nlwp=']);
  expect(processCensusArgs(501, 'darwin')).toEqual(['-U', '501', '-o', 'pid=']);
  expect(processCensusCount(' 7\n 12\n 1\n', 'linux')).toBe(20);
  expect(processCensusCount(' 7\n 12\n 1\n', 'darwin')).toBe(3);
  for (const invalid of [null, '', '0', '-1', '1\nbad', '1.5', '9007199254740992']) {
    expect(processCensusCount(invalid, 'linux')).toBeNull();
    expect(processCensusCount(invalid, 'darwin')).toBeNull();
  }
  expect(processHeadroom(4, 'linux')).toBe(16);
  expect(processHeadroom(32, 'linux')).toBe(32);
  expect(processHeadroom(4, 'darwin')).toBe(4);
  expect(processHeadroom(32, 'darwin')).toBe(32);
});

it('launches Node under the real current-user census with a finite thread allowance', () => {
  const count = processCensusCount(execFileSync('/bin/ps', processCensusArgs(process.getuid!()), { encoding: 'utf8' }));
  expect(count).toBeGreaterThan(0);
  const argv = limitedFileArgv({ ...limits, processLimit: count + processHeadroom(4), label: 'request',
    executable: process.execPath, args: ['-e', 'process.stdout.write("started")'] });
  expect(execFileSync('/bin/sh', argv, { encoding: 'utf8', env })).toBe('started');
});

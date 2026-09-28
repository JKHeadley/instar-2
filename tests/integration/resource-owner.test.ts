// Rules 60 and 61: the host resource owner holds real subprocess ceilings and
// self-triggered work settles under pressure. Each decision is proved on both sides.
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The physical host remains JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS, readResourceOutcomes, cpuMilliseconds } from '../../scripts/resource-owner.mjs';
import { shouldRunScheduledPriority } from '../../src/scheduled/shedding.js';

type Ceilings = typeof RESOURCE_CEILINGS;
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const dir = () => { const root = mkdtempSync(join(tmpdir(), 'resource-owner-')); roots.push(root); return root; };
const ceilings = (patch: { launch?: object; aggregate?: object; reserveLaunches?: number } = {}): Ceilings => ({
  launch: { ...RESOURCE_CEILINGS.launch, ...patch.launch },
  aggregate: { ...RESOURCE_CEILINGS.aggregate, ...patch.aggregate },
  reserveLaunches: patch.reserveLaunches ?? RESOURCE_CEILINGS.reserveLaunches, sampleMs: 100 });
const script = (root: string, name: string, body: string) => { const path = join(root, name); writeFileSync(path, body); return path; };
const input = (root: string, file: string, args: string[] = [], timeout = 15000) => ({ executable: process.execPath,
  args: [file, ...args], cwd: root, env: { PATH: '/usr/bin:/bin' }, stdin: '', timeout, maxBytes: 65536 });
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

it('kills a launch whose descendant tree exceeds its memory ceiling, and not one within it', { timeout: 30000 }, async () => {
  const root = dir();
  const hog = script(root, 'hog.mjs', `const keep = []; for (let i = 0; i < 12; i++) { keep.push(Buffer.alloc(32 * 1024 * 1024, 1)); }
setInterval(() => keep.length, 1000);`);
  const small = script(root, 'small.mjs', `const b = Buffer.alloc(4 * 1024 * 1024, 1); setTimeout(() => { process.stdout.write(String(b.length)); }, 400);`);
  const owner = createResourceOwner(ceilings({ launch: { memoryBytes: 160 * 1024 * 1024 } }));
  await owner.attach({ statePath: join(root, 'resources.json') });
  const over = await owner.execute(input(root, hog), 'maintenance');
  expect(over).toMatchObject({ limited: true, localLimit: 'memory', stdout: '' });
  const within = await owner.execute(input(root, small), 'answer');
  expect(within).toMatchObject({ code: 0, limited: false, localLimit: null, stdout: String(4 * 1024 * 1024) });
  const outcomes = readResourceOutcomes(join(root, 'resources.json'));
  expect(outcomes.filter((o: { kind: string }) => o.kind === 'limit-kill')).toEqual([
    expect.objectContaining({ kind: 'limit-kill', work: 'maintenance', reason: 'memory' })]);
});

it('kills a launch that forks past its process ceiling and leaves none of its descendants', { timeout: 30000 }, async () => {
  const root = dir(), pids = join(root, 'pids');
  const fork = script(root, 'fork.mjs', `import { spawn } from 'node:child_process'; import { appendFileSync } from 'node:fs';
const n = Number(process.argv[3]);
for (let i = 0; i < n; i++) appendFileSync(process.argv[2], spawn('/bin/sleep', ['30'], { stdio: 'ignore' }).pid + '\\n');
setTimeout(() => process.exit(0), Number(process.argv[4]));`);
  const owner = createResourceOwner(ceilings({ launch: { processCount: 4 } }));
  await owner.attach({});
  expect(await owner.execute(input(root, fork, [pids, '8', '20000']), 'maintenance'))
    .toMatchObject({ limited: true, localLimit: 'processes' });
  const forked = readFileSync(pids, 'utf8').trim().split('\n').map(Number);
  await settle(200);
  expect(forked.filter(alive)).toEqual([]);
  // Within the ceiling it completes normally.
  writeFileSync(pids, '');
  expect(await owner.execute(input(root, fork, [pids, '1', '600']), 'maintenance'))
    .toMatchObject({ code: 0, limited: false, localLimit: null });
  // ...and the sleeper it left behind (a leaked descendant) is reclaimed as a repair.
  const left = Number(readFileSync(pids, 'utf8').trim());
  await settle(200);
  expect(alive(left)).toBe(false);
  expect(owner.snapshot().counters.leakedDescendants).toBe(1);
  expect(owner.snapshot().outcomes.map((o: { kind: string }) => o.kind)).toContain('leaked-descendants');
});

it('enforces the OS CPU-time and handle ceilings per launch', { timeout: 30000 }, async () => {
  const root = dir();
  const spin = script(root, 'spin.mjs', `for (;;) {}`);
  const quick = script(root, 'quick.mjs', `process.stdout.write('ok')`);
  const files = script(root, 'files.mjs', `import { closeSync, openSync } from 'node:fs'; const held = [];
try { while (held.length < 4096) held.push(openSync('/dev/null', 'r')); } catch {}
held.forEach(fd => closeSync(fd)); process.stdout.write(String(held.length));`);
  const owner = createResourceOwner(ceilings({ launch: { cpuMilliseconds: 1000, handleCount: 64 } }));
  const state = await owner.attach({});
  expect(state.inherited).toMatchObject({ state: 'observed', effectivePerLaunch: { cpuSeconds: 1 } });
  expect(await owner.execute(input(root, spin), 'answer')).toMatchObject({ limited: true, localLimit: 'cpu' });
  expect(await owner.execute(input(root, quick), 'answer')).toMatchObject({ code: 0, limited: false, stdout: 'ok' });
  const limitedHandles = Number((await owner.execute(input(root, files), 'answer')).stdout);
  expect(limitedHandles).toBeGreaterThan(0);
  expect(limitedHandles).toBeLessThan(64);
  const wide = createResourceOwner(ceilings({ launch: { handleCount: 1024 } }));
  expect(Number((await wide.execute(input(root, files), 'answer')).stdout)).toBeGreaterThan(64);
});

it('settles a burst: maintenance keeps the reserve for answers and never exceeds the launch ceiling', { timeout: 60000 }, async () => {
  const root = dir(), log = join(root, 'events');
  writeFileSync(log, '');
  const work = script(root, 'work.mjs', `import { appendFileSync } from 'node:fs';
appendFileSync(process.argv[2], 'start ' + process.argv[3] + '\\n');
setTimeout(() => { appendFileSync(process.argv[2], 'end ' + process.argv[3] + '\\n'); }, Number(process.argv[4]));`);
  const owner = createResourceOwner(ceilings({ aggregate: { launches: 2 }, reserveLaunches: 1 }));
  await owner.attach({ priorityGate: shouldRunScheduledPriority });
  const maintenance = Array.from({ length: 6 }, (_, i) => owner.execute(input(root, work, [log, `m${i}`, '300']), 'maintenance'));
  await settle(150);
  const answerStart = performance.now();
  const answer = await owner.execute(input(root, work, [log, 'a0', '100']), 'answer');
  const answerWait = performance.now() - answerStart;
  const results = await Promise.all(maintenance);
  expect(answer.code).toBe(0);
  expect(results.every((r: { code: number | null }) => r.code === 0)).toBe(true);
  // The answer used the reserved launch instead of queueing behind six maintenance launches.
  expect(answerWait).toBeLessThan(1500);
  let running = 0, maintenanceRunning = 0, peak = 0, maintenancePeak = 0;
  for (const line of readFileSync(log, 'utf8').trim().split('\n')) {
    const [event, name] = line.split(' ');
    const delta = event === 'start' ? 1 : -1;
    running += delta; if (name!.startsWith('m')) maintenanceRunning += delta;
    peak = Math.max(peak, running); maintenancePeak = Math.max(maintenancePeak, maintenanceRunning);
  }
  expect(peak).toBeLessThanOrEqual(2);
  expect(maintenancePeak).toBe(1);
  const settled = owner.snapshot();
  expect(settled.active).toEqual([]);
  expect(settled.waiting).toEqual([]);
  expect(settled.counters.admitted).toBe(7);
  expect(settled.peak.launches).toBe(2);
});

it('refuses work it cannot admit before its deadline without launching it', { timeout: 30000 }, async () => {
  const root = dir(), marker = join(root, 'ran');
  const hold = script(root, 'hold.mjs', `setTimeout(() => {}, 1500);`);
  const mark = script(root, 'mark.mjs', `import { writeFileSync } from 'node:fs'; writeFileSync(process.argv[2], 'ran');`);
  const owner = createResourceOwner(ceilings({ aggregate: { launches: 1 }, reserveLaunches: 0 }));
  await owner.attach({});
  const busy = owner.execute(input(root, hold), 'answer');
  const refused = await owner.execute(input(root, mark, [marker], 300), 'maintenance');
  expect(refused).toEqual({ code: null, limited: true, localLimit: 'capacity', stdout: '', stdoutBytes: new Uint8Array() });
  expect(existsSync(marker)).toBe(false);
  await busy;
  // With capacity free again the same work is admitted and runs.
  expect(await owner.execute(input(root, mark, [marker], 5000), 'maintenance')).toMatchObject({ code: 0 });
  expect(existsSync(marker)).toBe(true);
  expect(owner.snapshot().counters.refusedCapacity).toBe(1);
});

it('defers maintenance while owned usage is elevated, then admits it', { timeout: 30000 }, async () => {
  const root = dir(), log = join(root, 'events');
  writeFileSync(log, '');
  const hold = script(root, 'hold.mjs', `import { appendFileSync } from 'node:fs';
appendFileSync(process.argv[2], 'start ' + process.argv[3] + '\\n');
const b = Buffer.alloc(48 * 1024 * 1024, 1);
setTimeout(() => { appendFileSync(process.argv[2], 'end ' + process.argv[3] + '\\n'); process.stdout.write(String(b.length)); }, 1500);`);
  const owner = createResourceOwner(ceilings({ aggregate: { memoryBytes: 150 * 1024 * 1024, launches: 3 } }));
  await owner.attach({ priorityGate: shouldRunScheduledPriority });
  const answer = owner.execute(input(root, hold, [log, 'answer']), 'answer');
  await settle(600);
  expect(owner.snapshot().usage.level).not.toBe('normal');
  const maintenance = await owner.execute(input(root, hold, [log, 'maintenance']), 'maintenance');
  expect(maintenance).toMatchObject({ code: 0, limited: false });
  await answer;
  expect(readFileSync(log, 'utf8').trim().split('\n'))
    .toEqual(['start answer', 'end answer', 'start maintenance', 'end maintenance']);
});

it('reclaims the aggregate by stopping maintenance first and preserving answer work', { timeout: 30000 }, async () => {
  const root = dir();
  const grow = script(root, 'grow.mjs', `let b; setTimeout(() => { b = Buffer.alloc(64 * 1024 * 1024, 1); }, 500);
setTimeout(() => { process.stdout.write(String(b.length)); }, 2500);`);
  const owner = createResourceOwner(ceilings({ launch: { memoryBytes: 512 * 1024 * 1024 },
    aggregate: { memoryBytes: 200 * 1024 * 1024, launches: 3 }, reserveLaunches: 1 }));
  await owner.attach({ priorityGate: shouldRunScheduledPriority });
  // Both are admitted while small; together they then cross the aggregate ceiling.
  const [answer, maintenance] = await Promise.all([owner.execute(input(root, grow), 'answer'),
    owner.execute(input(root, grow), 'maintenance')]);
  expect(maintenance).toMatchObject({ limited: true, localLimit: 'aggregate' });
  expect(answer).toMatchObject({ code: 0, limited: false, stdout: String(64 * 1024 * 1024) });
});

it('reclaims an evidenced orphan from a dead launcher and never signals a reused pid', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json');
  const orphan = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' });
  const stranger = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' });
  try {
    await settle(100);
    const start = (pid: number) => execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim();
    writeFileSync(ledgerPath, JSON.stringify({ version: 1, launches: {
      orphan: { pid: orphan.pid, start: start(orphan.pid!), owner: { pid: 1, start: 0 } },
      // The recorded incarnation differs: the pid now names someone else.
      reused: { pid: stranger.pid, start: 'Thu Jan  1 00:00:00 1970', owner: { pid: 1, start: 0 } } } }));
    const owner = createResourceOwner(ceilings());
    await owner.attach({ ledgerPath });
    await settle(100);
    expect(alive(orphan.pid!)).toBe(false);
    expect(alive(stranger.pid!)).toBe(true);
    expect(owner.snapshot().counters.reclaimed).toBe(1);
    expect(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches).toEqual({});
  } finally { try { process.kill(-stranger.pid!, 'SIGKILL'); } catch { /* ended */ } try { process.kill(-orphan.pid!, 'SIGKILL'); } catch { /* ended */ } }
});

it('records an owned launch in the durable ledger while it runs', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json');
  const hold = script(root, 'hold.mjs', `setTimeout(() => {}, 800);`);
  const owner = createResourceOwner(ceilings());
  await owner.attach({ ledgerPath });
  const running = owner.execute(input(root, hold), 'answer');
  await settle(400);
  const rows = Object.values(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches) as { pid: number; start: string }[];
  expect(rows).toHaveLength(1);
  expect(rows[0]!.start).toMatch(/\d{4}/u);
  await running;
  expect(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches).toEqual({});
});

it('parses process CPU time in both platform formats', () => {
  expect(cpuMilliseconds('0:01.50')).toBe(1500);
  expect(cpuMilliseconds('01:02:03')).toBe(3723000);
  expect(cpuMilliseconds('1-00:00:01')).toBe(86401000);
  expect(cpuMilliseconds('x:y')).toBeNull();
  appendFileSync(join(dir(), 'noop'), '');
});

it('hands the provider exactly the supplied variable names through the limit shim, keeping its pid', { timeout: 30000 }, async () => {
  const root = dir();
  const report = script(root, 'env.mjs', `process.stdout.write(JSON.stringify({ keys: Object.keys(process.env).filter(k => k !== '__CF_USER_TEXT_ENCODING').sort(), pid: process.pid, ppid: process.ppid }));`);
  const owner = createResourceOwner(ceilings());
  await owner.attach({});
  const bare = JSON.parse((await owner.execute(input(root, report), 'answer')).stdout);
  expect(bare.keys).toEqual(['PATH']);
  expect(bare.ppid).toBe(process.pid);
  const given = { ...input(root, report), env: { PATH: '/usr/bin:/bin', SHLVL: '7', MARK: 'kept' } };
  expect(JSON.parse((await owner.execute(given, 'answer')).stdout).keys).toEqual(['MARK', 'PATH', 'SHLVL']);
});

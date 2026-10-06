// Rules 60 and 61: the host resource owner holds real subprocess ceilings and
// self-triggered work settles under pressure. Each decision is proved on both sides.
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The physical host remains JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS, readResourceOutcomes, hostQuery, cpuMilliseconds, LIMIT_FILE, LIMIT_FILE_TEXT, limitedFileArgv, HOST_BOUNDS, startIdentity } from '../../scripts/resource-owner.mjs';
import { shouldRunScheduledPriority } from '../../src/scheduled/shedding.js';
import { createHostResourceAllocation } from '../preview/six-host-resources.js';

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
let incarnations = 0;
/** The durable owner's Six allocation over the same root (a restart is a new incarnation). */
const six = (root: string, c: Ceilings = ceilings()) => createHostResourceAllocation({ root, machine: 'machine:test', ceilings: c,
  incarnation: `test:${process.pid}:${++incarnations}`, now: () => Date.now(), monotonic: () => performance.now() });

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
  const over = await owner.execute(input(root, fork, [pids, '8', '3000']), 'maintenance');
  const forked = readFileSync(pids, 'utf8').trim().split('\n').map(Number);
  // Either the kernel refused forks past the bound (a pid-less spawn), or the sampler killed the tree.
  expect(over.localLimit === 'processes' || forked.some(pid => !Number.isSafeInteger(pid))).toBe(true);
  await settle(200);
  expect(forked.filter(pid => Number.isSafeInteger(pid)).filter(alive)).toEqual([]);
  // Within the ceiling it completes normally.
  writeFileSync(pids, '');
  // The killed tree's cleanup may itself reclaim a member still exiting under load: count this launch only.
  const leakedBefore = owner.snapshot().counters.leakedDescendants;
  expect(await owner.execute(input(root, fork, [pids, '1', '600']), 'maintenance'))
    .toMatchObject({ code: 0, limited: false, localLimit: null });
  // ...and the sleeper it left behind (a leaked descendant) is reclaimed as a repair.
  const left = Number(readFileSync(pids, 'utf8').trim());
  await settle(200);
  expect(alive(left)).toBe(false);
  expect(owner.snapshot().counters.leakedDescendants - leakedBefore).toBe(1);
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
  // Poll for the elevation rather than sleep a fixed time: the child's own startup is load-dependent.
  for (const deadline = Date.now() + 10000; owner.snapshot().usage.level === 'normal' && Date.now() < deadline;) await settle(50);
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
  // Each launch carries its own admission evidence: the overlap is this case's, not a lifetime peak.
  expect([answer.resources.admission, maintenance.resources.admission]).toEqual(expect.arrayContaining([
    { work: 'answer', concurrent: expect.any(Number), waitedMs: expect.any(Number) },
    { work: 'maintenance', concurrent: 2, waitedMs: expect.any(Number) }]));
});

it('lets a desk-controlled case lower the aggregate memory ceiling, never raise it', async () => {
  const lowered = createResourceOwner(ceilings());
  await lowered.attach({ aggregateMemoryBytes: 256 * 1024 * 1024 });
  expect(lowered.ceilings.aggregate.memoryBytes).toBe(256 * 1024 * 1024);
  expect(lowered.snapshot().ceilings.aggregate.memoryBytes).toBe(256 * 1024 * 1024);
  await expect(createResourceOwner(ceilings()).attach({ aggregateMemoryBytes: RESOURCE_CEILINGS.aggregate.memoryBytes + 1 }))
    .rejects.toThrow(/only be lowered/u);
  await expect(createResourceOwner(ceilings()).attach({ aggregateMemoryBytes: 1024 })).rejects.toThrow(/only be lowered/u);
});

it('recovery observes an orphan without signalling it, keeps a live owner\'s row, and closes only verified-gone rows', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json');
  const orphan = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' });
  const stranger = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' });
  const neighbour = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' });
  const ownerProcess = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' });
  try {
    await settle(150);
    const start = (pid: number) => execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim();
    const dead = { pid: 999999, start: 'Thu Jan  1 00:00:00 1970' };
    writeFileSync(ledgerPath, JSON.stringify({ version: 1, launches: {
      orphan: { pid: orphan.pid, start: start(orphan.pid!), owner: dead, members: { [orphan.pid!]: start(orphan.pid!) } },
      // The recorded incarnation differs: the pid now names someone else, so the row is verified gone.
      reused: { pid: stranger.pid, start: 'Thu Jan  1 00:00:00 1970', owner: dead },
      // A live launcher (same incarnation still running) owns this launch: never judged by another owner.
      live: { pid: neighbour.pid, start: start(neighbour.pid!), owner: { pid: ownerProcess.pid, start: start(ownerProcess.pid!) } } } }));
    const owner = createResourceOwner(ceilings());
    await owner.attach({ ledgerPath, allocation: six(root) });
    await settle(100);
    // Disposal needs the unlanded typed recovery effect: nothing is signalled.
    expect([orphan.pid, stranger.pid, neighbour.pid].map(pid => alive(pid!))).toEqual([true, true, true]);
    expect(owner.snapshot().orphans).toEqual(expect.arrayContaining([
      expect.objectContaining({ launch: 'orphan', state: 'surviving', surviving: 1 }),
      expect.objectContaining({ launch: 'live', state: 'live-owner' })]));
    expect(Object.keys(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches).sort()).toEqual(['live', 'orphan']);
    // Once the orphan is verified gone its row closes; the live owner's row is still untouched.
    process.kill(orphan.pid!, 'SIGKILL'); await settle(150);
    const next = createResourceOwner(ceilings());
    await next.attach({ ledgerPath, allocation: six(root) });
    expect(Object.keys(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches)).toEqual(['live']);
    expect(alive(neighbour.pid!)).toBe(true);
  } finally {
    for (const child of [orphan, stranger, neighbour, ownerProcess]) try { process.kill(child.pid!, 'SIGKILL'); } catch { /* ended */ }
  }
});

it('recovery joins a sandboxed launch row by its recorded sandbox: a root-cwd survivor keeps the row and debit; only proved absence returns it', async () => {
  // Host observations are injected (no real process is launched or signalled); the owner, inventory decoder and joins are real.
  const start = 'Sat Oct 3 15:00:00 2026', childStart = 'Sat Oct 3 15:00:01 2026';
  const recoverWith = async (survivor: 'inside' | 'root-cwd' | 'gone', sandbox: 'observed' | 'unreadable') => {
    const root = dir(), area = join(root, 'scratch'), ledgerPath = join(root, 'launches.json');
    const closes: string[] = [];
    writeFileSync(ledgerPath, JSON.stringify({ version: 1, launches: { native: { pid: 41001, start, owner: { pid: 41000, start },
      members: { 41001: start }, workingArea: area, sandboxArea: area, allocation: 'native-set' } } }));
    const query = async (file: string, args: string[]) => {
      if (file === '/bin/sh') return '256\n1024\nunlimited\nunlimited\n1024\n2048\n';
      if (file === '/bin/ps' && args[0] === '-U') return survivor === 'gone' ? '' : `41002 1 41002 501 4096 0:00.10 S ${childStart} /bin/sleep 60\n`;
      if (file === '/bin/ps' && args[0] === '-o') return args.at(-1) === '41002' && survivor !== 'gone' ? childStart : '';
      if (file === '/usr/sbin/lsof') return `p41002\nn${survivor === 'inside' ? area : '/'}\n`;
      if (file === '/usr/bin/python3') return sandbox === 'observed' ? '41002 in 0\n' : '';
      throw Error(`unexpected query ${file}`);
    };
    const owner = createResourceOwner(ceilings());
    await owner.attach({ ledgerPath, query, allocation: { close: (_set: string, cause: string) => { closes.push(cause); return { ok: true }; }, open: () => [] } });
    return { orphans: owner.snapshot().orphans, rows: Object.keys(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches), closes };
  };
  // Inside the working area, and outside it (daemonized to /) but inside the launch's sandbox: both survive.
  for (const survivor of ['inside', 'root-cwd'] as const) {
    const seen = await recoverWith(survivor, 'observed');
    expect(seen.orphans).toMatchObject([{ launch: 'native', state: 'surviving', unrecorded: 1 }]);
    expect(seen.rows).toEqual(['native']); expect(seen.closes).toEqual([]);
  }
  // A root-cwd survivor whose sandbox membership cannot be read is unknown: the row and debit stay.
  const unread = await recoverWith('root-cwd', 'unreadable');
  expect(unread.orphans).toMatchObject([{ launch: 'native', state: 'unknown' }]);
  expect(unread.rows).toEqual(['native']); expect(unread.closes).toEqual([]);
  // Genuinely gone: the row closes and the debit returns once, citing recovery.
  const gone = await recoverWith('gone', 'observed');
  expect(gone.orphans).toEqual([]); expect(gone.rows).toEqual([]); expect(gone.closes).toEqual(['recovery-observed-gone:native']);
});

it('records launch evidence durably before the provider runs, and never runs a launch it could not record', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json'), marker = join(root, 'ran');
  // The provider reads the ledger as its first act: its own row must already be there.
  const probe = script(root, 'probe.mjs', `import { readFileSync, writeFileSync } from 'node:fs';
const rows = Object.values(JSON.parse(readFileSync(process.argv[2], 'utf8')).launches);
writeFileSync(process.argv[3], 'ran'); process.stdout.write(JSON.stringify(rows.map(r => r.pid === process.pid && typeof r.start === 'string')));`);
  const owner = createResourceOwner(ceilings());
  await owner.attach({ ledgerPath, allocation: six(root) });
  expect(JSON.parse((await owner.execute(input(root, probe, [ledgerPath, marker]), 'answer')).stdout)).toEqual([true]);
  expect(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches).toEqual({});
  // A ledger that cannot be written: the launch is refused and the provider never starts.
  const broken = dir(), brokenLedger = join(broken, 'owned-launches.json'), brokenMarker = join(broken, 'ran');
  writeFileSync(brokenLedger, 'not json');
  const refusing = createResourceOwner(ceilings());
  await refusing.attach({ ledgerPath: brokenLedger, allocation: six(broken) });
  expect(await refusing.execute(input(broken, probe, [brokenLedger, brokenMarker]), 'answer'))
    .toMatchObject({ limited: true, localLimit: 'capacity', stdout: '' });
  await settle(200);
  expect(existsSync(brokenMarker)).toBe(false);
  expect(refusing.snapshot().outcomes.at(-1)).toMatchObject({ kind: 'capacity-refused', level: 'launch-evidence-unrecorded' });
});

it('caps an immediate fork burst with the user-ID process limit, before any sample, and inherits the handle limit in descendants', { timeout: 30000 }, async () => {
  const root = dir();
  // No sampler can act: the launch lives well under one sample interval.
  const burst = script(root, 'burst.mjs', `import { spawn } from 'node:child_process';
const kids = []; let refused = 0;
for (let i = 0; i < 40; i++) { const c = spawn('/bin/sleep', ['5'], { stdio: 'ignore' }); c.on('error', () => { refused++; }); kids.push(c); }
setTimeout(() => { const started = kids.filter(c => c.pid).length; kids.forEach(c => { try { c.kill('SIGKILL'); } catch {} });
  process.stdout.write(JSON.stringify({ started, refused })); }, 300);`);
  const bounded = createResourceOwner({ ...ceilings({ launch: { processCount: 4 } }), sampleMs: 60000 });
  await bounded.attach({});
  // The limit is the user ID's census plus four, so under a parallel suite other processes of the same user can
  // use that room before the burst itself starts (it then prints nothing). Retry, bounded, until the burst ran.
  let held = await bounded.execute(input(root, burst), 'answer');
  for (let attempt = 1; attempt < 5 && held.stdout === ''; attempt++) held = await bounded.execute(input(root, burst), 'answer');
  const heldCounts = JSON.parse(held.stdout);
  // The kernel limit held is the user ID's (its subject is named), never claimed as the tree's.
  expect(held.resources.enforcement).toMatchObject({ processGrowth: 'sampled', treeHandles: 'unsupported', memory: 'sampled' });
  expect(held.resources.uidProcesses).toMatchObject({ state: 'hard', subject: `uid:${process.getuid!()}`, limit: expect.any(Number) });
  expect(heldCounts.refused).toBeGreaterThan(0);
  expect(heldCounts.started).toBeLessThan(40);
  // The other side: a roomy ceiling lets the same burst run.
  const roomy = createResourceOwner({ ...ceilings({ launch: { processCount: 200 } }), sampleMs: 60000 });
  await roomy.attach({});
  expect(JSON.parse((await roomy.execute(input(root, burst), 'answer')).stdout)).toEqual({ started: 40, refused: 0 });
  // A grandchild inherits the per-process handle ceiling: the limit is not only on the top process.
  const files = script(root, 'files.mjs', `import { closeSync, openSync } from 'node:fs'; const held = [];
try { while (held.length < 4096) held.push(openSync('/dev/null', 'r')); } catch {}
held.forEach(fd => closeSync(fd)); process.stdout.write(String(held.length));`);
  const parent = script(root, 'parent.mjs', `import { execFileSync } from 'node:child_process';
process.stdout.write(execFileSync(process.execPath, [process.argv[2]], { encoding: 'utf8' }));`);
  const handles = createResourceOwner(ceilings({ launch: { handleCount: 64 } }));
  await handles.attach({});
  const grandchild = Number((await handles.execute(input(root, parent, [files]), 'answer')).stdout);
  expect(grandchild).toBeGreaterThan(0);
  expect(grandchild).toBeLessThan(64);
});

it('reclaims a recorded detached descendant that left the process group, and verifies the whole joined membership gone', { timeout: 30000 }, async () => {
  const root = dir(), pids = join(root, 'pids');
  const escape = script(root, 'escape.mjs', `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const c = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' }); c.unref(); writeFileSync(process.argv[2], String(c.pid));
setTimeout(() => process.exit(0), 700);`);
  const owner = createResourceOwner(ceilings());
  await owner.attach({ ledgerPath: join(root, 'owned-launches.json'), allocation: six(root) });
  const result = await owner.execute(input(root, escape, [pids]), 'maintenance');
  const detached = Number(readFileSync(pids, 'utf8'));
  await settle(200);
  expect(alive(detached)).toBe(false);
  expect(result.resources).toMatchObject({ leakedDescendants: 1, cleanup: 'verified', membership: 'working-area-joined',
    allocation: { state: 'returned' } });
  expect(JSON.parse(readFileSync(join(root, 'owned-launches.json'), 'utf8')).launches).toEqual({});
});

it('finds and reclaims a descendant that detached before any sample, by the private working-area join; without a private area it is honestly unconfined', { timeout: 30000 }, async () => {
  const root = dir(), pids = join(root, 'pids');
  // The parent detaches a child into its own session and exits before any sample can record it:
  // its group, its parent and (a platform binary) its environment are all gone; its working directory is not.
  const escape = script(root, 'escape.mjs', `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const c = spawn('/bin/sleep', ['20'], { detached: true, stdio: 'ignore' }); c.unref(); writeFileSync(process.argv[2], String(c.pid));`);
  const owner = createResourceOwner({ ...ceilings(), sampleMs: 60000 });
  await owner.attach({ ledgerPath: join(root, 'owned-launches.json'), allocation: six(root) });
  const result = await owner.execute(input(root, escape, [pids]), 'maintenance');
  const escaped = Number(readFileSync(pids, 'utf8'));
  try {
    expect(alive(escaped)).toBe(false);
    expect(result.resources).toMatchObject({ census: 'none', leakedDescendants: 1, cleanup: 'verified', membership: 'working-area-joined' });
    expect(owner.snapshot().bounds).toMatchObject({ treeMembership: 'working-area-joined', treeProcesses: 'sampled', uidProcesses: 'hard',
      sixAllocation: 'hard' });
    expect(JSON.parse(readFileSync(join(root, 'owned-launches.json'), 'utf8')).launches).toEqual({});
  } finally { try { process.kill(escaped, 'SIGKILL'); } catch { /* ended */ } }
  // The other side: a working directory open to others is no private area, so the escape join is
  // unavailable and the verdict says `unconfined`, never `verified`, with the escapee alive.
  const shared = dir(); chmodSync(shared, 0o755);
  const loose = createResourceOwner({ ...ceilings(), sampleMs: 60000 });
  await loose.attach({});
  const open = await loose.execute({ ...input(shared, escape, [join(shared, 'pids')]) }, 'maintenance');
  const survivor = Number(readFileSync(join(shared, 'pids'), 'utf8'));
  try {
    expect(alive(survivor)).toBe(true);
    expect(open.resources).toMatchObject({ membership: 'unconfined', cleanup: 'unconfined' });
    expect(open.resources.cleanup).not.toBe('verified');
  } finally { try { process.kill(survivor, 'SIGKILL'); } catch { /* ended */ } }
});

it('reclaims a member that first appears in a later cleanup census, instead of waiting on it and leaving it running', { timeout: 30000 }, async () => {
  // Live 2026-10-03 (w4-toolsfull stop-child): a stopped tool turn's subagent shell had forked `sleep 60` just after the
  // first cleanup census (which saw the shell); the old cleanup only waited on later censuses, so the sleeper outlived the
  // stop. Here the first census that could see the second child is made to miss it once, exactly as that race did: it sees
  // the first child only. The reclaiming census must still end the second.
  const root = dir(), pids = join(root, 'pids');
  const escape = script(root, 'escape.mjs', `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const a = spawn('/bin/sleep', ['20'], { detached: true, stdio: 'ignore' }), b = spawn('/bin/sleep', ['20'], { detached: true, stdio: 'ignore' });
a.unref(); b.unref(); writeFileSync(process.argv[2], a.pid + ' ' + b.pid);`);
  let hidden = 0;
  const query = async (file: string, args: string[]) => {
    const text = await hostQuery(file, args);
    if (args[0] !== '-U' || typeof text !== 'string' || hidden || !existsSync(pids)) return text;
    const late = readFileSync(pids, 'utf8').trim().split(' ')[1];
    const lines = text.split('\n'), kept = lines.filter(line => line.trim().split(/\s+/u)[0] !== late);
    if (kept.length !== lines.length) hidden = 1;
    return kept.join('\n');
  };
  const owner = createResourceOwner({ ...ceilings(), sampleMs: 60000 });
  await owner.attach({ ledgerPath: join(root, 'owned-launches.json'), allocation: six(root), query });
  const result = await owner.execute(input(root, escape, [pids]), 'maintenance');
  const [first, second] = readFileSync(pids, 'utf8').trim().split(' ').map(Number);
  try {
    expect(hidden).toBe(1);
    expect([alive(first!), alive(second!)]).toEqual([false, false]);
    expect(result.resources).toMatchObject({ leakedDescendants: 2, cleanup: 'verified', membership: 'working-area-joined' });
  } finally { for (const pid of [first, second]) try { process.kill(pid!, 'SIGKILL'); } catch { /* ended */ } }
});

it('an unreadable working directory of a live candidate is unknown membership: cleanup stays unresolved and the debit reserved', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json'), pids = join(root, 'pids');
  const escape = script(root, 'escape.mjs', `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const c = spawn('/bin/sleep', ['20'], { detached: true, stdio: 'ignore' }); c.unref(); writeFileSync(process.argv[2], String(c.pid));`);
  // The working-directory lookup fails (as a denied lsof does); every other observation is real.
  const blind = (file: string, args: string[]) => file === '/usr/sbin/lsof' ? Promise.resolve(null) : hostQuery(file, args);
  const allocation = six(root);
  const owner = createResourceOwner({ ...ceilings(), sampleMs: 60000 });
  await owner.attach({ ledgerPath, allocation, query: blind });
  const result = await owner.execute(input(root, escape, [pids]), 'maintenance');
  const escaped = Number(readFileSync(pids, 'utf8'));
  try {
    expect(alive(escaped)).toBe(true);
    expect(result.resources).toMatchObject({ cleanup: 'unresolved', allocation: { state: 'reserved' } });
    expect(allocation.open()).toHaveLength(1);
    expect(Object.keys(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches)).toHaveLength(1);
    // Recovery with the same failed lookup: absence is unproven, so the row and the debit stay.
    const rows = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    for (const r of Object.values(rows.launches) as Array<Record<string, unknown>>) r.owner = { pid: 999999, start: 'gone' };
    writeFileSync(ledgerPath, JSON.stringify(rows));
    const again = six(root);
    await createResourceOwner(ceilings()).attach({ ledgerPath, allocation: again, query: blind });
    expect(again.open()).toHaveLength(1);
  } finally { try { process.kill(escaped, 'SIGKILL'); } catch { /* ended */ } }
  await settle(200);
  // The other side: with the escapee gone and the lookup readable, absence is proven and the debit returns.
  const after = six(root);
  await createResourceOwner(ceilings()).attach({ ledgerPath, allocation: after });
  expect(after.open()).toEqual([]);
  expect(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches).toEqual({});
});

it('a refused allocation returns the debit it already prepared, so refused maintenance never takes the answer slot', () => {
  const root = dir(), allocation = six(root);
  const reserve = (launch: string, work: string) => allocation.reserve({ launch, work, memoryBytes: 1024, processCount: 1 });
  // Two maintenance launches still held (for example, their cleanup is unresolved).
  expect(reserve('m1', 'maintenance').ok).toBe(true);
  expect(reserve('m2', 'maintenance').ok).toBe(true);
  // A third prepares the installation slot, then meets the maintenance-family ceiling.
  const third = reserve('m3', 'maintenance');
  expect(third.ok ? '' : third.reason).toMatch(/capacity exhausted/u);
  expect(allocation.open().map(o => o.launch).sort()).toEqual(['m1', 'm2']);
  // The answer reserve is intact, and the genuinely held launches stay reserved.
  expect(reserve('a1', 'answer').ok).toBe(true);
  expect(allocation.open().map(o => o.launch).sort()).toEqual(['a1', 'm1', 'm2']);
});

it('recovery resumes a partial allocation return under its durable settlement, and a closed set counts as returned', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json');
  const fault = { appendsBeforeCut: Infinity };
  const allocation = createHostResourceAllocation({ root, machine: 'machine:test', ceilings: ceilings(),
    incarnation: `test:${process.pid}:${++incarnations}`, now: () => Date.now(), monotonic: () => performance.now(), fault });
  const reserved = allocation.reserve({ launch: 'cut-launch', work: 'answer', memoryBytes: 1024, processCount: 1 });
  if (!reserved.ok) throw Error(reserved.reason);
  const set = reserved.handle.set;
  // Completion's return lands its first domain, then the process dies before the next write.
  fault.appendsBeforeCut = 1;
  expect(allocation.close(set, 'cleanup-verified:cut-launch').ok).toBe(false);
  fault.appendsBeforeCut = Infinity;
  expect(allocation.open()).toHaveLength(1);
  // A new cause cannot rebind the closing set: recovery must resume the original one.
  expect(allocation.close(set, 'recovery-observed-gone:cut-launch').reason).toMatch(/another settlement/u);
  writeFileSync(ledgerPath, JSON.stringify({ version: 1, launches: { 'cut-launch': { pid: 999999, start: 'gone',
    owner: { pid: 999998, start: 'gone' }, members: {}, allocation: set } } }));
  const next = six(root);
  await createResourceOwner(ceilings()).attach({ ledgerPath, allocation: next });
  expect(next.open()).toEqual([]);
  expect(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches).toEqual({});
  // Close finished but the row survived (its removal failed): the closed set is recognized as returned.
  writeFileSync(ledgerPath, JSON.stringify({ version: 1, launches: { 'cut-launch': { pid: 999999, start: 'gone',
    owner: { pid: 999998, start: 'gone' }, members: {}, allocation: set } } }));
  await createResourceOwner(ceilings()).attach({ ledgerPath, allocation: six(root) });
  expect(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches).toEqual({});
});

it('keeps the durable row and reports unresolved cleanup when a cleanup signal is denied', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json'), pids = join(root, 'pids');
  // A group member outlives the provider; the owner's kill of it is refused (EPERM).
  const leave = script(root, 'leave.mjs', `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], String(spawn('/bin/sleep', ['30'], { stdio: 'ignore' }).pid)); setTimeout(() => process.exit(0), 300);`);
  const denied = (target: number, name: string) => {
    if (name === 'SIGKILL') throw Object.assign(Error('kill EPERM'), { code: 'EPERM' });
    process.kill(target, name);
  };
  const owner = createResourceOwner(ceilings());
  await owner.attach({ ledgerPath, signal: denied, allocation: six(root) });
  const result = await owner.execute(input(root, leave, [pids]), 'maintenance');
  const survivor = Number(readFileSync(pids, 'utf8'));
  try {
    expect(result.resources.cleanup).toBe('unresolved');
    expect(Object.keys(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches)).toHaveLength(1);
    expect(owner.snapshot().counters.cleanupUnresolved).toBe(1);
    expect(alive(survivor)).toBe(true);
  } finally { try { process.kill(survivor, 'SIGKILL'); } catch { /* ended */ } }
  // The other side: the same launch with signals allowed is observed quiescent and its row closes.
  const healthy = createResourceOwner(ceilings());
  const healthyLedger = join(dir(), 'owned-launches.json');
  await healthy.attach({ ledgerPath: healthyLedger, allocation: six(dirname(healthyLedger)) });
  const done = await healthy.execute(input(root, leave, [pids]), 'maintenance');
  const reclaimed = Number(readFileSync(pids, 'utf8'));
  expect(done.resources).toMatchObject({ cleanup: 'verified', leakedDescendants: 1 });
  expect(alive(reclaimed)).toBe(false);
  expect(JSON.parse(readFileSync(healthyLedger, 'utf8')).launches).toEqual({});
});

it('keeps a member whose durable write failed: it lands once storage is writable, and recovery still sees it after restart', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json'), pids = join(root, 'pids');
  const leave = script(root, 'leave.mjs', `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], String(spawn('/bin/sleep', ['30'], { stdio: 'ignore' }).pid)); setTimeout(() => process.exit(0), 600);`);
  // The ledger is unwritable from the first census that sees the member until `restore` runs.
  let saved: string | null = null, injected = 0, restoreOn: 'cleanup' | 'manual' = 'cleanup';
  const restore = () => { if (saved !== null) { writeFileSync(ledgerPath, saved); saved = null; } };
  const query = async (file: string, args: string[]) => {
    const text = await hostQuery(file, args);
    if (args[0] === '-U' && !injected && existsSync(pids) && existsSync(ledgerPath)) {
      injected = 1; saved = readFileSync(ledgerPath, 'utf8'); writeFileSync(ledgerPath, 'transiently unwritable');
    }
    return text;
  };
  const denied = (target: number, name: string) => {
    if (name !== 'SIGKILL') { process.kill(target, name); return; }
    if (restoreOn === 'cleanup') restore();
    throw Object.assign(Error('kill EPERM'), { code: 'EPERM' });
  };
  const owner = createResourceOwner(ceilings());
  await owner.attach({ ledgerPath, query, signal: denied, allocation: six(root) });
  const result = await owner.execute(input(root, leave, [pids]), 'maintenance');
  const survivor = Number(readFileSync(pids, 'utf8'));
  const survivors = [survivor];
  try {
    expect(owner.snapshot().counters.recordingFailures).toBeGreaterThanOrEqual(1);
    expect(result.resources.cleanup).toBe('unresolved');
    // Storage writable again at completion: the pending member landed, marked as a repaired recording.
    const row = Object.values(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches)[0] as Record<string, unknown>;
    expect(Object.keys(row.members as object)).toContain(String(survivor));
    expect(row).toMatchObject({ recording: 'repaired', cleanup: 'unresolved' });
    expect(owner.snapshot().pendingEvidence).toBe(0);
    // A restart with the old owner gone observes the surviving member instead of closing its row.
    const ownerRow = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    for (const r of Object.values(ownerRow.launches) as Array<Record<string, unknown>>) r.owner = { pid: 999999, start: 'gone' };
    writeFileSync(ledgerPath, JSON.stringify(ownerRow));
    const restarted = createResourceOwner(ceilings());
    await restarted.attach({ ledgerPath, allocation: six(root) });
    expect(restarted.snapshot().orphans).toMatchObject([{ state: 'surviving', surviving: 1 }]);
    expect(Object.keys(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches)).toHaveLength(1);

    // The other side: storage still unwritable at completion keeps the evidence pending, and the
    // next successful ledger write (a later launch's) carries it.
    const secondLedger = join(dir(), 'owned-launches.json');
    rmSync(pids);
    restoreOn = 'manual';
    const later = createResourceOwner(ceilings());
    const secondQuery = async (file: string, args: string[]) => {
      const text = await hostQuery(file, args);
      if (args[0] === '-U' && injected === 1 && existsSync(pids) && existsSync(secondLedger)) {
        injected = 2; saved = readFileSync(secondLedger, 'utf8'); writeFileSync(secondLedger, 'still unwritable');
      }
      return text;
    };
    await later.attach({ ledgerPath: secondLedger, query: secondQuery, signal: denied, allocation: six(dirname(secondLedger)) });
    const pending = await later.execute(input(root, leave, [pids]), 'maintenance');
    survivors.push(Number(readFileSync(pids, 'utf8')));
    expect(pending.resources.cleanup).toBe('unresolved');
    expect(later.snapshot().pendingEvidence).toBe(1);
    expect(readFileSync(secondLedger, 'utf8')).toBe('still unwritable');
    if (saved !== null) { writeFileSync(secondLedger, saved); saved = null; }
    rmSync(pids);
    await later.execute(input(root, script(root, 'quick.mjs', "process.stdout.write('ok')")), 'answer');
    expect(later.snapshot().pendingEvidence).toBe(0);
    const carried = Object.values(JSON.parse(readFileSync(secondLedger, 'utf8')).launches) as Array<Record<string, unknown>>;
    expect(carried.some(r => Object.keys(r.members as object).includes(String(survivors[1])) && r.recording === 'repaired')).toBe(true);
  } finally { for (const pid of survivors) try { process.kill(pid, 'SIGKILL'); } catch { /* ended */ } }
});

it('does not hold a tree process ceiling: with baseline churn and a concurrent launch, a tree can exceed it', { timeout: 30000 }, async () => {
  const root = dir(), go = join(root, 'go');
  // Baseline processes of the same user, counted into the user-ID limit at launch time.
  const baseline = Array.from({ length: 12 }, () => spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' }));
  const forker = script(root, 'forker.mjs', `import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const wait = () => existsSync(process.argv[2]) ? run() : setTimeout(wait, 25);
const run = () => { const kids = []; let refused = 0;
  for (let i = 0; i < 8; i++) { const c = spawn('/bin/sleep', ['5'], { stdio: 'ignore' }); c.on('error', () => { refused++; }); kids.push(c); }
  setTimeout(() => { const started = kids.filter(c => c.pid).length; kids.forEach(c => { try { c.kill('SIGKILL'); } catch {} });
    process.stdout.write(JSON.stringify({ started, refused })); }, 300); };
wait();`);
  try {
    await settle(150);
    // No sampler acts: only what the kernel holds is in play.
    const owner = createResourceOwner({ ...ceilings({ launch: { processCount: 4 } }), sampleMs: 60000 });
    await owner.attach({});
    const first = owner.execute(input(root, forker, [go]), 'answer');
    const second = owner.execute(input(root, forker, [go]), 'review');
    await settle(700);
    // Churn: unrelated processes of the same user exit after both limits were set.
    baseline.forEach(child => { try { process.kill(child.pid!, 'SIGKILL'); } catch { /* ended */ } });
    await settle(200);
    writeFileSync(go, '');
    const results = await Promise.all([first, second]);
    const started = results.map((r: { stdout: string }) => JSON.parse(r.stdout).started as number);
    // A tree grew past its own ceiling of 4 after the churn: the user-ID limit is not a tree bound.
    expect(Math.max(...started)).toBeGreaterThan(4);
    for (const r of results) {
      expect(r.resources.enforcement.processGrowth).not.toBe('hard');
      expect(r.resources.uidProcesses.subject).toMatch(/^uid:\d+$/u);
    }
    expect(HOST_BOUNDS).toMatchObject({ treeProcesses: 'sampled', treeMembership: 'working-area-joined', aggregateLaunches: 'hard',
      confinement: 'blocked-install-held' });
  } finally { baseline.forEach(child => { try { process.kill(child.pid!, 'SIGKILL'); } catch { /* ended */ } }); }
});

it('treats denied observation as unknown: no unhandled rejection, maintenance defers, the kernel bounds still hold', { timeout: 30000 }, async () => {
  const root = dir(), rejections: unknown[] = [];
  const onRejection = (reason: unknown) => { rejections.push(reason); };
  process.on('unhandledRejection', onRejection);
  try {
    const hold = script(root, 'hold.mjs', `setTimeout(() => process.stdout.write('done'), 1200);`);
    const denied = () => Promise.reject(Object.assign(Error('spawn EPERM'), { code: 'EPERM' }));
    const owner = createResourceOwner(ceilings({ aggregate: { launches: 3 }, reserveLaunches: 1 }));
    const attached = await owner.attach({ query: denied, statePath: join(root, 'resources.json'), priorityGate: shouldRunScheduledPriority });
    expect(attached.inherited).toEqual({ state: 'unknown' });
    const answer = owner.execute(input(root, hold), 'answer');
    await settle(500);
    expect(owner.snapshot().usage).toMatchObject({ observation: 'failed', level: 'unknown' });
    expect(shouldRunScheduledPriority('medium', 'unknown')).toBe(false);
    const maintenance = await owner.execute(input(root, hold, [], 300), 'maintenance');
    expect(maintenance).toMatchObject({ limited: true, localLimit: 'capacity' });
    const done = await answer;
    expect(done).toMatchObject({ code: 0, stdout: 'done' });
    // Unknown process count: the user-ID bound is reported unavailable, and no tree bound is claimed hard.
    expect(done.resources.enforcement).toMatchObject({ cpuPerProcess: 'hard', processGrowth: 'sampled', treeHandles: 'unsupported' });
    expect(done.resources.uidProcesses).toEqual({ state: 'unavailable', subject: null, limit: null });
    // Unverifiable cleanup (every query denied) is unresolved, never verified.
    expect(done.resources.cleanup).toBe('unresolved');
    expect(owner.snapshot().counters.observationFailures).toBeGreaterThan(0);
    await settle(100);
    expect(rejections).toEqual([]);
  } finally { process.off('unhandledRejection', onRejection); }
});

it('keeps sampled points in the measurement contract shape and the bounded view across restart', { timeout: 30000 }, async () => {
  const root = dir(), statePath = join(root, 'resources.json');
  const hold = script(root, 'hold.mjs', `const b = Buffer.alloc(8 * 1024 * 1024, 1); setTimeout(() => process.stdout.write(String(b.length)), 900);`);
  const owner = createResourceOwner(ceilings());
  await owner.attach({ statePath });
  const running = owner.execute(input(root, hold), 'answer');
  await settle(650);
  const sample = owner.snapshot().sample;
  expect(sample).toMatchObject({ census: { state: 'complete', omitted: 0 }, machine: expect.stringMatching(/^machine:/u),
    hardwareProfile: expect.stringMatching(/^hardware:/u) });
  expect(sample.points[0]).toMatchObject({ state: 'observed', sourceSample: sample.sourceSample,
    processIncarnation: expect.stringMatching(/^\d+:/u), rssBytes: expect.any(Number) });
  await running;
  expect(owner.snapshot().observer.ticks).toBeGreaterThan(0);
  const before = owner.snapshot().counters.completed;
  const restarted = createResourceOwner(ceilings());
  expect((await restarted.attach({ statePath })).counters.completed).toBe(before);
});

it('records an owned launch in the durable ledger while it runs', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json');
  const hold = script(root, 'hold.mjs', `setTimeout(() => {}, 800);`);
  const owner = createResourceOwner(ceilings());
  await owner.attach({ ledgerPath, allocation: six(root) });
  const running = owner.execute(input(root, hold), 'answer');
  await settle(400);
  const rows = Object.values(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches) as { pid: number; start: string; members: object; owner: { pid: number } }[];
  expect(rows).toHaveLength(1);
  expect(rows[0]!.start).toMatch(/\d{4}/u);
  expect(rows[0]!.owner.pid).toBe(process.pid);
  expect(rows[0]!.members).toMatchObject({ [rows[0]!.pid]: rows[0]!.start });
  const finished = await running;
  // A healthy completion: every joined member observed gone, the Six debit returned, the row closed.
  expect(finished.resources).toMatchObject({ cleanup: 'verified', leakedDescendants: 0, admission: { work: 'answer', concurrent: 1 },
    allocation: { state: 'returned', settlement: expect.stringMatching(/^cleanup-verified:/u) } });
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

it('lowers the process limit without forking under it: a launch already at its limit still execs, and a later fork is refused', () => {
  // A limit of 1 sits below every real user's process count: exactly the state a transport child
  // reaches when other processes started after its headroom was counted. The shim must still exec
  // (it once forked `$(ulimit -H)` after lowering the soft limit, so the send read UNKNOWN).
  const launch = (executable: string, args: string[]) => execFileSync('/bin/sh', limitedFileArgv({ label: 'REQUEST', executable,
    args, handles: 64, cpuSeconds: 5, processLimit: 1, env: { PATH: '/usr/bin:/bin' } }), { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
  expect(launch('/bin/echo', ['launched']).trim()).toBe('launched');
  expect(() => launch('/bin/sh', ['-c', '(/bin/echo forked); /bin/echo after'])).toThrow();
});

it('keeps the file shim identical to the one limit script, and holds the transport child\'s handles with argv[1] preserved', () => {
  expect(readFileSync(LIMIT_FILE, 'utf8')).toBe(LIMIT_FILE_TEXT);
  const root = dir();
  const report = script(root, 'report.mjs', `import { closeSync, openSync } from 'node:fs'; const held = [];
try { while (held.length < 999) held.push(openSync('/dev/null', 'r')); } catch {}
held.forEach(fd => closeSync(fd)); process.stdout.write(JSON.stringify({ args: process.argv.slice(2), handles: held.length }));`);
  const argv = limitedFileArgv({ label: 'REQUEST', executable: process.execPath, args: [report, 'REQUEST'], handles: 64, cpuSeconds: 5,
    processLimit: null, env: { PATH: '/usr/bin:/bin' } });
  expect(argv[1]).toBe('REQUEST');
  const out = JSON.parse(execFileSync('/bin/sh', argv, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } }));
  expect(out.args).toEqual(['REQUEST']);
  expect(out.handles).toBeLessThan(64);
});

it('admits every launch through its Six allocation: a Six capacity refusal waits, spawning nothing, and the returned debit admits the next', { timeout: 30000 }, async () => {
  const root = dir(), marks = join(root, 'marks');
  const hold = script(root, 'hold.mjs', `import { appendFileSync } from 'node:fs'; appendFileSync(process.argv[2], 'start\\n');
setTimeout(() => { appendFileSync(process.argv[2], 'end\\n'); process.stdout.write('ok'); }, 600);`);
  // The Six installation domain holds one launch slot; the owner's local slot count would admit three.
  const allocation = six(root, ceilings({ aggregate: { launches: 1 } }));
  const owner = createResourceOwner(ceilings());
  await owner.attach({ ledgerPath: join(root, 'owned-launches.json'), allocation });
  const both = [owner.execute(input(root, hold, [marks]), 'answer'), owner.execute(input(root, hold, [marks]), 'review')];
  await settle(300);
  // Only one launch started: the other is waiting on the Six domain, not spawned.
  expect(readFileSync(marks, 'utf8').trim().split('\n')).toEqual(['start']);
  expect(owner.snapshot().waiting).toHaveLength(1);
  expect(owner.snapshot().allocation.lastRefusal).toMatch(/capacity exhausted/u);
  const results = await Promise.all(both);
  expect(results.map((r: { stdout: string }) => r.stdout)).toEqual(['ok', 'ok']);
  // Strictly serial under the Six ceiling, and every debit returned once.
  expect(readFileSync(marks, 'utf8').trim().split('\n')).toEqual(['start', 'end', 'start', 'end']);
  expect(results.every((r: { resources: { allocation: { state: string } } }) => r.resources.allocation.state === 'returned')).toBe(true);
  expect(allocation.open()).toEqual([]);
  // The other side: a roomy domain admits both at once.
  const roomyRoot = dir(), roomyMarks = join(roomyRoot, 'marks');
  const roomy = createResourceOwner(ceilings());
  await roomy.attach({ ledgerPath: join(roomyRoot, 'owned-launches.json'), allocation: six(roomyRoot) });
  const hold2 = script(roomyRoot, 'hold.mjs', readFileSync(hold, 'utf8'));
  await Promise.all([roomy.execute(input(roomyRoot, hold2, [roomyMarks]), 'answer'), roomy.execute(input(roomyRoot, hold2, [roomyMarks]), 'review')]);
  expect(readFileSync(roomyMarks, 'utf8').trim().split('\n').slice(0, 2)).toEqual(['start', 'start']);
});

it('keeps the Six debit reserved while cleanup is unresolved, across restart, and returns it once recovery observes the survivor gone', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json'), pids = join(root, 'pids');
  const leave = script(root, 'leave.mjs', `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], String(spawn('/bin/sleep', ['30'], { stdio: 'ignore' }).pid)); setTimeout(() => process.exit(0), 300);`);
  const denied = (target: number, name: string) => {
    if (name === 'SIGKILL') throw Object.assign(Error('kill EPERM'), { code: 'EPERM' });
    process.kill(target, name);
  };
  const first = six(root);
  const owner = createResourceOwner(ceilings());
  await owner.attach({ ledgerPath, signal: denied, allocation: first });
  const result = await owner.execute(input(root, leave, [pids]), 'maintenance');
  const survivor = Number(readFileSync(pids, 'utf8'));
  try {
    expect(result.resources).toMatchObject({ cleanup: 'unresolved', allocation: { state: 'reserved' } });
    expect(first.open()).toEqual([{ set: result.resources.allocation.set, launch: expect.any(String) }]);
    // Restart while the survivor lives: recovery observes it and the debit stays reserved.
    const rows = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    for (const r of Object.values(rows.launches) as Array<Record<string, unknown>>) r.owner = { pid: 999999, start: 'gone' };
    writeFileSync(ledgerPath, JSON.stringify(rows));
    const second = six(root);
    await createResourceOwner(ceilings()).attach({ ledgerPath, allocation: second });
    expect(second.open()).toHaveLength(1);
  } finally { try { process.kill(survivor, 'SIGKILL'); } catch { /* ended */ } }
  await settle(200);
  // Survivor gone: the next recovery returns the debit once and closes the row.
  const third = six(root);
  await createResourceOwner(ceilings()).attach({ ledgerPath, allocation: third });
  expect(third.open()).toEqual([]);
  expect(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches).toEqual({});
});

it('returns a Six set whose launch has no durable row as never-launched: the row precedes the gate', { timeout: 30000 }, async () => {
  const root = dir(), ledgerPath = join(root, 'owned-launches.json');
  const crashed = six(root);
  // A launcher that died after its allocation and before its launch row: the provider never ran.
  const reserved = crashed.reserve({ launch: 'lost-launch', work: 'answer', memoryBytes: 1024, processCount: 1 });
  expect(reserved.ok).toBe(true);
  expect(crashed.open()).toHaveLength(1);
  const next = six(root);
  await createResourceOwner(ceilings()).attach({ ledgerPath, allocation: next });
  expect(next.open()).toEqual([]);
  // The other side: a set whose launch row exists (its owner still judged live) is not touched.
  const live = six(root);
  const held = live.reserve({ launch: 'held-launch', work: 'answer', memoryBytes: 1024, processCount: 1 });
  expect(held.ok).toBe(true);
  writeFileSync(ledgerPath, JSON.stringify({ version: 1, launches: { 'held-launch': { pid: process.pid,
    start: execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(process.pid)], { encoding: 'utf8' }).trim(),
    owner: { pid: process.pid, start: execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(process.pid)], { encoding: 'utf8' }).trim() },
    allocation: held.ok ? held.handle.set : null } } }));
  const after = six(root);
  await createResourceOwner(ceilings()).attach({ ledgerPath, allocation: after });
  expect(after.open()).toHaveLength(1);
});

it('reads a single-digit-day start as the same incarnation the census records, and a different start as different', () => {
  // ps pads "Oct  1"; the census row collapses whitespace. Both must name one incarnation.
  expect(startIdentity('Thu Oct  1 00:29:51 2026    ')).toBe('Thu Oct 1 00:29:51 2026');
  expect(startIdentity('Wed Sep 30 23:59:59 2026')).toBe('Wed Sep 30 23:59:59 2026');
  expect(startIdentity('Thu Oct  1 00:29:51 2026')).not.toBe(startIdentity('Thu Oct  1 00:29:52 2026'));
  expect(startIdentity(null)).toBe(null);
});

it('retries an unknown cleanup census inside its bounded wait, instead of ending the wait on the first one', { timeout: 60000 }, async () => {
  // Live 2026-10-05 (sb-w4-rollback full-suite gate): under the parallel suite a census can be briefly incomplete or
  // failed (a candidate's working directory or start evidence unreadable while the host is loaded). The bounded wait
  // ended on the first such reading, so a launch whose members were in fact reclaimed was recorded `unresolved`: its
  // durable row stayed and its Six debit stayed reserved. Only the census is injected here; the owner, the wait and
  // the ledger are real. The census call is the one carrying `-ww`; the user-ID process query is a different one.
  const quiet = (root: string) => { const path = join(root, 'quick.mjs'); writeFileSync(path, 'process.stdout.write("done");'); return path; };
  const run = async (unknownCensuses: number) => {
    const root = dir(), ledgerPath = join(root, 'owned-launches.json');
    let unknown = 0, censuses = 0;
    const query = async (file: string, args: string[]) => {
      if (file === '/bin/ps' && args[2] === '-ww') { censuses++; return unknown-- > 0 ? null : ''; }
      return hostQuery(file, args);
    };
    const owner = createResourceOwner({ ...ceilings(), sampleMs: 60000 });
    await owner.attach({ ledgerPath, allocation: six(root), query });
    unknown = unknownCensuses;
    const result = await owner.execute(input(root, quiet(root)), 'maintenance');
    return { result, censuses, rows: Object.keys(JSON.parse(readFileSync(ledgerPath, 'utf8')).launches) };
  };
  // Two unknown readings, then a complete one: the launch is verified gone and its debit returns.
  const healed = await run(2);
  expect(healed.censuses).toBeGreaterThanOrEqual(3);
  expect(healed.result.resources).toMatchObject({ cleanup: 'verified', leakedDescendants: 0, membership: 'working-area-joined',
    allocation: { state: 'returned' } });
  expect(healed.rows).toEqual([]);
  // The other side: a census that never clears is never read as quiescence. Cleanup stays unresolved, and the row
  // and the debit are kept so recovery settles them later.
  const blind = await run(Number.MAX_SAFE_INTEGER);
  expect(blind.result.resources).toMatchObject({ cleanup: 'unresolved', allocation: { state: 'reserved' } });
  expect(blind.rows).toHaveLength(1);
});

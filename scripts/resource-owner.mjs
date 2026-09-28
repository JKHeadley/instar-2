// The one physical resource owner of a host process (Rules 60, 61).
//
// Every provider launch passes this owner's admission. An admitted launch runs
// under OS per-process CPU-time and open-handle ceilings, and its observed
// descendant tree is held to per-launch and aggregate memory/process ceilings.
// Self-triggered maintenance keeps a reserved launch for answer work and yields
// under pressure through the injected scheduled-priority brake, so maintenance
// settles instead of competing forever. Output size and elapsed time remain
// separate bounds; neither is treated as a memory or process ceiling.
//
// Observation is confined to owned launches: queries name the owned process
// group or owned parent pids, and signals reach only processes attributed to an
// owned launch in the same sample. Unrelated host applications are neither
// listed nor signalled.
//
// Build 8 seam: `outcomes` in the persisted snapshot (and readResourceOutcomes)
// are the waste (limit kills, capacity refusals) and repair (leaked-descendant
// cleanup, orphan reclaim) records a retrospective consumer reads.
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const GiB = 1024 ** 3;
/** Ceilings use the NativeLaunchLimits field names of the effect doorway. */
export const RESOURCE_CEILINGS = Object.freeze({
  launch: Object.freeze({ memoryBytes: 2 * GiB, processCount: 32, handleCount: 1024, cpuMilliseconds: 600_000 }),
  aggregate: Object.freeze({ memoryBytes: 4 * GiB, processCount: 64, launches: 3 }),
  reserveLaunches: 1,
  sampleMs: 1000,
});
const WORK = Object.freeze({ answer: 'critical', review: 'critical', maintenance: 'medium' });
const OUTCOME_LIMIT = 32;
const QUERY_TIMEOUT_MS = 2000;

// Lower (never raise) the inherited soft and hard limits, then replace the shell
// with the provider, keeping its pid, process group and descendants under the
// ceiling. The hard limit matters: runtimes such as Node raise their own soft
// file limit to the hard limit at startup.
const LIMIT_SCRIPT = [
  'lim() {',
  '  s=$(ulimit -S "$1") || exit 125',
  '  if [ "$s" = unlimited ] || [ "$s" -gt "$2" ]; then ulimit -S "$1" "$2" || exit 125; fi',
  '  h=$(ulimit -H "$1") || exit 125',
  '  if [ "$h" = unlimited ] || [ "$h" -gt "$2" ]; then ulimit -H "$1" "$2" || exit 125; fi',
  '}',
  'lim -n "$1"; lim -t "$2"; shift 2',
  'exec "$@"'].join('\n');

const plainCompare = (left, right) => {
  if (left.subject.kind !== right.subject.kind || left.subject.instance !== right.subject.instance
    || left.unit !== right.unit) throw Error('resource comparison: subject, instance, or unit mismatch');
  return left.value - right.value;
};
const measured = (kind, instance, unit, value, at) => ({ subject: { kind, instance }, unit, value, at });

function query(file, args) {
  return new Promise(resolve => execFile(file, args, { timeout: QUERY_TIMEOUT_MS, maxBuffer: 1024 * 1024,
    env: { PATH: '/usr/bin:/bin' } }, (error, stdout) => {
    // pgrep exits 1 when nothing matches; ps may exit 1 when a listed pid ended.
    if (error && (typeof error.code !== 'number' || error.code > 1)) resolve(null);
    else resolve(String(stdout));
  }));
}
const pids = text => text === null ? null : text.split(/\s+/u).filter(Boolean).map(Number).filter(Number.isSafeInteger);
/** ps `time`: [[dd-]hh:]mm:ss[.cc] on both macOS and Linux. */
export function cpuMilliseconds(text) {
  const [days, clock] = text.includes('-') ? text.split('-') : ['0', text];
  const parts = clock.split(':').map(Number);
  if (parts.some(n => !Number.isFinite(n)) || !Number.isFinite(Number(days))) return null;
  const seconds = parts.reverse().reduce((total, part, index) => total + part * 60 ** index, 0);
  return Math.round((Number(days) * 86400 + seconds) * 1000);
}

function durableWrite(path, document) {
  const temporary = join(dirname(path), `.resource-${randomUUID()}.pending`);
  const fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(document), 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path);
  const directory = openSync(dirname(path), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

export function readResourceOutcomes(statePath) {
  try { const state = JSON.parse(readFileSync(statePath, 'utf8')); return state.version === 1 ? state.outcomes : []; }
  catch { return []; }
}

export function createResourceOwner(ceilings = RESOURCE_CEILINGS) {
  const launches = new Map(), waiters = [];
  const counters = { admitted: 0, waited: 0, refusedCapacity: 0, completed: 0, killed: {}, leakedDescendants: 0,
    reclaimed: 0, observationFailures: 0 };
  const outcomes = [];
  let ports = { compare: plainCompare, priorityGate: null, reconcile: null, now: () => Date.now() };
  let attached = null, inherited = { state: 'unobserved' }, usage = { level: 'normal', observation: 'idle',
    memoryBytes: 0, processes: 0, sampledAt: null };
  let sampling = false, sampler = null, pump = null, lastPersist = 0;

  const priorityOf = work => WORK[work] ?? 'medium';
  const level = () => {
    if (!launches.size) return 'normal';
    if (usage.observation === 'failed') return 'unknown';
    const fraction = Math.max(usage.memoryBytes / ceilings.aggregate.memoryBytes,
      usage.processes / ceilings.aggregate.processCount);
    return fraction >= 1 ? 'shutdown' : fraction >= 0.85 ? 'critical' : fraction >= 0.6 ? 'elevated' : 'normal';
  };
  const eligible = work => {
    if (launches.size >= ceilings.aggregate.launches) return false;
    // The minimal reserve: maintenance never takes the last launch an answer needs.
    if (priorityOf(work) !== 'critical' && launches.size >= ceilings.aggregate.launches - ceilings.reserveLaunches) return false;
    const current = level();
    if (ports.priorityGate) return ports.priorityGate(priorityOf(work), current);
    return current !== 'shutdown' && (priorityOf(work) === 'critical' || current === 'normal');
  };
  const record = outcome => {
    outcomes.push({ at: ports.now(), ...outcome });
    if (outcomes.length > OUTCOME_LIMIT) outcomes.shift();
    persist(true);
  };
  function snapshot() {
    return { version: 1, at: ports.now(), ceilings, inherited, usage: { ...usage, level: level() },
      active: [...launches.values()].map(l => ({ id: l.id, work: l.work, pid: l.pid ?? null, startedAt: l.startedAt,
        memoryBytes: l.memoryBytes, processes: l.processes, cpuMilliseconds: l.cpuMilliseconds })),
      waiting: waiters.map(w => w.work), counters, outcomes };
  }
  function persist(force = false) {
    if (!attached?.statePath) return;
    const now = ports.now();
    if (!force && now - lastPersist < 5000) return;
    lastPersist = now;
    try { durableWrite(attached.statePath, snapshot()); } catch { /* status is a view; enforcement never depends on it */ }
  }
  function ledger(update) {
    if (!attached?.ledgerPath) return;
    const rows = existsSync(attached.ledgerPath) ? JSON.parse(readFileSync(attached.ledgerPath, 'utf8')).launches : {};
    update(rows);
    durableWrite(attached.ledgerPath, { version: 1, launches: rows });
  }
  function wake() {
    waiters.sort((a, b) => Number(priorityOf(b.work) === 'critical') - Number(priorityOf(a.work) === 'critical') || a.order - b.order);
    for (const waiter of [...waiters]) {
      if (waiter.stopped?.() || ports.now() >= waiter.deadline) { settleWaiter(waiter, null); continue; }
      if (eligible(waiter.work)) settleWaiter(waiter, reserve(waiter.work));
    }
    if (!waiters.length && pump) { clearInterval(pump); pump = null; }
  }
  function settleWaiter(waiter, lease) {
    waiters.splice(waiters.indexOf(waiter), 1);
    if (!lease && !waiter.stopped?.()) {
      counters.refusedCapacity++;
      record({ kind: 'capacity-refused', work: waiter.work, level: level() });
    }
    waiter.resolve(lease);
  }
  function reserve(work) {
    const lease = { id: randomUUID(), work, startedAt: ports.now(), pid: null, memoryBytes: 0, processes: 0,
      cpuMilliseconds: 0, members: [], limit: null };
    launches.set(lease.id, lease); counters.admitted++;
    if (!sampler) sampler = setInterval(() => { void sample(); }, ceilings.sampleMs);
    return lease;
  }
  function admit(work, timeout, stopped) {
    if (eligible(work)) return Promise.resolve(reserve(work));
    counters.waited++;
    return new Promise(resolve => {
      waiters.push({ work, stopped, resolve, order: counters.waited, deadline: ports.now() + Math.max(0, timeout) });
      pump ??= setInterval(wake, 100);
      persist(true);
    });
  }
  function release(lease) {
    launches.delete(lease.id);
    if (!launches.size && sampler) { clearInterval(sampler); sampler = null; usage = { ...usage, observation: 'idle',
      memoryBytes: 0, processes: 0 }; }
    wake(); persist(true);
  }
  function terminate(lease, reason, members = lease.members) {
    if (lease.limit) return;
    lease.limit = reason;
    counters.killed[reason] = (counters.killed[reason] ?? 0) + 1;
    if (lease.pid) try { process.kill(-lease.pid, 'SIGKILL'); } catch { /* the group may have ended */ }
    for (const pid of members) try { process.kill(pid, 'SIGKILL'); } catch { /* ended between sample and signal */ }
    record({ kind: 'limit-kill', work: lease.work, reason, memoryBytes: lease.memoryBytes, processes: lease.processes });
  }
  /** Owned trees only: the owned groups plus descendants of owned pids. */
  async function ownedTree(roots) {
    const members = new Set(roots.map(l => l.pid));
    const group = pids(await query('/usr/bin/pgrep', ['-g', roots.map(l => l.pid).join(',')]));
    if (group === null) return null;
    group.forEach(pid => members.add(pid));
    let frontier = [...members];
    for (let depth = 0; depth < 16 && frontier.length; depth++) {
      const children = pids(await query('/usr/bin/pgrep', ['-P', frontier.join(',')]));
      if (children === null) return null;
      frontier = children.filter(pid => !members.has(pid));
      frontier.forEach(pid => members.add(pid));
    }
    const table = await query('/bin/ps', ['-o', 'pid=,ppid=,pgid=,rss=,time=', '-p', [...members].join(',')]);
    if (table === null) return null;
    const rows = new Map();
    for (const line of table.split('\n')) {
      const [pid, ppid, pgid, rss, time] = line.trim().split(/\s+/u);
      const cpu = time === undefined ? null : cpuMilliseconds(time);
      if (!pid || cpu === null || ![pid, ppid, pgid, rss].every(n => Number.isSafeInteger(Number(n)))) continue;
      rows.set(Number(pid), { ppid: Number(ppid), pgid: Number(pgid), rssBytes: Number(rss) * 1024, cpu });
    }
    return rows;
  }
  function ownerOf(pid, rows, roots) {
    for (let current = pid, hops = 0; current && hops < 64; hops++) {
      const root = roots.find(l => l.pid === current || rows.get(current)?.pgid === l.pid);
      if (root) return root;
      current = rows.get(current)?.ppid;
    }
    return null;
  }
  async function sample() {
    const roots = [...launches.values()].filter(l => l.pid);
    if (sampling || !roots.length) return;
    sampling = true;
    try {
      const rows = await ownedTree(roots);
      const at = ports.now();
      if (rows === null) {
        counters.observationFailures++; usage = { ...usage, observation: 'failed', sampledAt: at }; return;
      }
      for (const lease of roots) Object.assign(lease, { memoryBytes: 0, processes: 0, cpuMilliseconds: 0, members: [] });
      for (const [pid, row] of rows) {
        const lease = ownerOf(pid, rows, roots);
        if (!lease) continue;
        lease.memoryBytes += row.rssBytes; lease.processes++; lease.cpuMilliseconds += row.cpu; lease.members.push(pid);
      }
      usage = { observation: 'observed', sampledAt: at,
        memoryBytes: roots.reduce((sum, l) => sum + l.memoryBytes, 0), processes: roots.reduce((sum, l) => sum + l.processes, 0) };
      for (const lease of roots) {
        const over = (kind, unit, value, ceiling) => ports.compare(measured(kind, `launch:${lease.id}`, unit, value, at),
          measured(kind, `launch:${lease.id}`, unit, ceiling, at)) > 0;
        if (over('owned-process-memory', 'bytes', lease.memoryBytes, ceilings.launch.memoryBytes)) terminate(lease, 'memory');
        else if (over('owned-process-count', 'processes', lease.processes, ceilings.launch.processCount)) terminate(lease, 'processes');
      }
      const aggregate = (kind, unit, value, ceiling) => ports.compare(measured(kind, 'host-owned-launches', unit, value, at),
        measured(kind, 'host-owned-launches', unit, ceiling, at)) > 0;
      if (aggregate('owned-process-memory', 'bytes', usage.memoryBytes, ceilings.aggregate.memoryBytes)
        || aggregate('owned-process-count', 'processes', usage.processes, ceilings.aggregate.processCount)) {
        // Reclaim the newest maintenance launch first: answer work is preserved.
        const live = roots.filter(l => !l.limit);
        const victim = live.filter(l => priorityOf(l.work) !== 'critical').at(-1) ?? live.at(-1);
        if (victim) terminate(victim, 'aggregate');
      }
    } catch { counters.observationFailures++; usage = { ...usage, observation: 'failed' }; }
    finally { sampling = false; persist(); wake(); }
  }
  async function startEvidence(pid) {
    const text = await query('/bin/ps', ['-o', 'lstart=', '-p', String(pid)]);
    return text?.trim() || null;
  }
  async function cleanupGroup(lease) {
    // Descendants left behind after the provider exits keep the group id alive, so
    // the id cannot have been reused: every remaining member is owned.
    const left = pids(await query('/usr/bin/pgrep', ['-g', String(lease.pid)]));
    if (left?.length) {
      try { process.kill(-lease.pid, 'SIGKILL'); } catch { /* ended meanwhile */ }
      counters.leakedDescendants += left.length;
      record({ kind: 'leaked-descendants', work: lease.work, processes: left.length });
    }
  }
  function run(input, lease) {
    const handles = String(Math.max(16, ceilings.launch.handleCount));
    const cpuSeconds = String(Math.max(1, Math.ceil(ceilings.launch.cpuMilliseconds / 1000)));
    return new Promise(resolve => {
      const child = spawn('/bin/sh', ['-c', LIMIT_SCRIPT, 'instar-launch', handles, cpuSeconds, input.executable, ...input.args], {
        cwd: input.cwd, env: { ...input.env, __CF_USER_TEXT_ENCODING: undefined, NODE_V8_COVERAGE: undefined },
        shell: false, detached: true, stdio: ['pipe', 'pipe', 'ignore'] });
      lease.pid = child.pid ?? null;
      let chunks = [], size = 0, limited = false, localLimit = null;
      const fail = reason => { if (limited) return; limited = true; localLimit = reason; chunks = [];
        if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch { /* A group may be gone or unavailable. */ }
        try { child.kill('SIGKILL'); } catch { /* Timer and stop callbacks must never throw. */ }
      };
      if (lease.pid) {
        const owner = attached?.owner;
        void startEvidence(lease.pid).then(start => {
          if (start && launches.has(lease.id)) try { ledger(rows => { rows[lease.id] = { pid: lease.pid, start, owner }; }); }
          catch { /* the timeout and ceilings still hold this launch */ }
        });
      }
      const timer = setTimeout(() => fail('timeout'), input.timeout);
      const stopTimer = input.stopped ? setInterval(() => { if (input.stopped()) fail(null); }, 25) : undefined;
      child.on('error', () => { clearTimeout(timer); clearInterval(stopTimer); resolve({ code: null, limited: true, localLimit: null, stdout: '', stdoutBytes: new Uint8Array() }); });
      child.stdin.on('error', () => fail(null));
      child.stdout.on('data', chunk => {
        size += chunk.length;
        if (size > input.maxBytes) fail('size'); else if (!limited) chunks.push(chunk);
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer); clearInterval(stopTimer);
        if (lease.limit) { limited = true; localLimit = lease.limit; chunks = []; }
        else if (signal === 'SIGXCPU' && !limited) {
          limited = true; localLimit = 'cpu'; chunks = [];
          counters.killed.cpu = (counters.killed.cpu ?? 0) + 1;
          record({ kind: 'limit-kill', work: lease.work, reason: 'cpu' });
        }
        const stdoutBytes = Buffer.concat(chunks);
        const done = () => {
          try { ledger(rows => { delete rows[lease.id]; }); } catch { /* reclaimed at the next attach */ }
          resolve({ code, limited, localLimit, stdout: stdoutBytes.toString('utf8'), stdoutBytes: new Uint8Array(stdoutBytes) });
        };
        if (lease.pid) void cleanupGroup(lease).finally(done); else done();
      });
      child.stdin.end(input.stdin, 'utf8');
    });
  }
  async function reclaim() {
    if (!attached?.ledgerPath || !existsSync(attached.ledgerPath)) return;
    let rows;
    try { rows = JSON.parse(readFileSync(attached.ledgerPath, 'utf8')).launches ?? {}; }
    catch { return; }
    for (const [id, row] of Object.entries(rows)) {
      if (!Number.isSafeInteger(row?.pid) || row.pid <= 1 || typeof row.start !== 'string') continue;
      const current = await startEvidence(row.pid);
      const verdict = ports.reconcile ? ports.reconcile(row, current)
        : current === null ? 'missing' : current === row.start ? 'same' : 'new-incarnation';
      // A pid now naming another incarnation is not ours: never signal it.
      if (verdict === 'new-incarnation') continue;
      const members = pids(await query('/usr/bin/pgrep', ['-g', String(row.pid)])) ?? [];
      if (verdict === 'same' || members.length) {
        try { process.kill(-row.pid, 'SIGKILL'); } catch { /* ended meanwhile */ }
        if (verdict === 'same') try { process.kill(row.pid, 'SIGKILL'); } catch { /* ended meanwhile */ }
        counters.reclaimed++;
        record({ kind: 'reclaimed-orphan', launch: id, processes: members.length + Number(verdict === 'same' && !members.includes(row.pid)) });
      }
    }
    ledger(all => { for (const id of Object.keys(all)) delete all[id]; });
  }
  async function observeInherited() {
    const text = await query('/bin/sh', ['-c', 'ulimit -S -n; ulimit -H -n; ulimit -S -t; ulimit -H -t; ulimit -S -u; ulimit -H -u']);
    const values = text?.trim().split('\n').map(v => v.trim() === 'unlimited' ? 'unlimited' : Number(v));
    if (!values || values.length !== 6 || values.some(v => v !== 'unlimited' && !Number.isSafeInteger(v))) {
      inherited = { state: 'unknown' }; return inherited;
    }
    const pair = (soft, hard) => ({ soft, hard });
    const effective = (hard, ceiling) => hard === 'unlimited' ? ceiling : Math.min(hard, ceiling);
    inherited = { state: 'observed', at: ports.now(), handles: pair(values[0], values[1]), cpuSeconds: pair(values[2], values[3]),
      userProcesses: pair(values[4], values[5]),
      effectivePerLaunch: { handleCount: effective(values[1], ceilings.launch.handleCount),
        cpuSeconds: effective(values[3], Math.ceil(ceilings.launch.cpuMilliseconds / 1000)) } };
    return inherited;
  }
  return Object.freeze({
    ceilings,
    /** One owner per process: a second attach is refused. */
    async attach(options = {}) {
      if (attached) throw Error('resource owner already attached');
      attached = { ledgerPath: options.ledgerPath ?? null, statePath: options.statePath ?? null,
        owner: { pid: process.pid, start: Math.floor(performance.timeOrigin) } };
      ports = { compare: options.compare ?? plainCompare, priorityGate: options.priorityGate ?? null,
        reconcile: options.reconcile ?? null, now: options.now ?? (() => Date.now()) };
      await observeInherited();
      await reclaim();
      persist(true);
      return snapshot();
    },
    async execute(input, work = 'answer') {
      if (input.stopped?.()) return { code: null, limited: true, localLimit: null, stdout: '', stdoutBytes: new Uint8Array() };
      const lease = await admit(work, input.timeout, input.stopped);
      if (!lease) return { code: null, limited: true, localLimit: input.stopped?.() ? null : 'capacity', stdout: '', stdoutBytes: new Uint8Array() };
      try { return await run(input, lease); }
      finally { counters.completed++; release(lease); }
    },
    observeInherited,
    snapshot,
  });
}

/** The single owner of this host process. */
export const hostResources = createResourceOwner();

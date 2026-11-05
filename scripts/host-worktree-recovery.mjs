// Row 03: physical observation under the installed, separate harness identity.
// No process label, old mtime, or absence from the session list proves abandonment.
import { execFile } from 'node:child_process';
import { watch, realpathSync } from 'node:fs';
import { createProcessInventory } from './process-inventory.mjs';
import { createWorktreeInventory } from './worktree-inventory.mjs';

const inside = (path, scope) => path === scope || path.startsWith(`${scope}/`);
const queryHost = (file, args) => new Promise(resolve => {
  const executable = file === '/usr/sbin/lsof' && process.platform === 'linux' ? '/usr/bin/lsof' : file;
  execFile(executable, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 },
    (error, stdout, stderr) => {
      // ps uses status 1 for a successful empty selection. Diagnostics, signals,
      // timeouts and every other failure remain unknown, never an empty census.
      const emptySelection = file === '/bin/ps' && error?.code === 1 && stdout === '' && stderr === '';
      resolve(error && !emptySelection ? null : stdout);
    });
});
// Match the resource owner's existing settlement read: the runner cannot read
// another UID's cwd on Darwin. This uses the installed read authority only;
// denied observation stays unknown and never changes installation permissions.
export const queryWorktreeHost = async (file, args) => {
  if (process.platform === 'darwin' && file === '/usr/sbin/lsof')
    return await queryHost('/usr/bin/sudo', ['-n', file, ...args]) ?? queryHost(file, args);
  return queryHost(file, args);
};

/** The owner calls tick on its existing cycle. Scope and UID come from the held
 * harness installation, not from a checkout or a model. Unknown installation,
 * lineage, activity coverage and process census all retain the classifier's refusal.
 * The encrypted host store keeps checkout-to-original-intake lineage across restart.
 * Rules 2/8/26/42/63/83/116. Machine-local evidence never transfers a topic lease. */
export async function createHostWorktreeRecovery(ports) {
  const { createWorktreeRecovery } = await import('../src/assembly/worktree-recovery.js')
    .catch(() => import('../dist/assembly/worktree-recovery.js'));
  let closed = false;
  const stopped = () => closed || ports.stopped();
  const query = ports.query ?? queryWorktreeHost;
  const processInventory = createProcessInventory({ query, now: ports.now, monotonic: ports.monotonic,
    identity: ports.identity, uid: null, uids: () => {
      const uid = ports.workerUid();
      return Number.isSafeInteger(uid) && uid > 0 ? [uid] : [];
    }, limit: 4096, freshForMs: 30000 });
  let state = ports.store.load() ?? { version: 1, checkouts: {} };
  if (state.version !== 1 || !state.checkouts || Object.keys(state.checkouts).length > 64)
    throw Error('worktree recovery observation state invalid');
  const watched = new Map();
  const persist = () => ports.store.save(state);
  const watchCheckout = path => {
    if (closed || watched.has(path)) return;
    const coverage = { from: ports.now(), valid: true, watcher: null };
    watched.set(path, coverage);
    try {
      coverage.watcher = (ports.watch ?? watch)(path, { recursive: true }, () => {
        try {
          state = { ...state, checkouts: { ...state.checkouts, [path]: { ...state.checkouts[path], lastActivity: ports.now() } } };
          persist();
        } catch { coverage.valid = false; }
      });
      coverage.watcher.on('error', () => { coverage.valid = false; });
    } catch { coverage.valid = false; }
  };
  for (const path of Object.keys(state.checkouts)) {
    if (!inside(path, ports.scope)) throw Error('checkout observation escaped installed scope');
    try { if (realpathSync(path) === path) watchCheckout(path); } catch { /* Missing checkout has no activity coverage. */ }
  }
  let flight = null, lastTick = -Infinity;
  const sourceFor = path => state.checkouts[path]?.source ?? null;
  const intake = ports.intake(sourceFor);
  const observe = async () => {
    const deadline = ports.now() + 30000;
    const guard = () => { if (stopped() || ports.now() > deadline) throw Error('checkout observation stopped or exceeded its bound'); };
    const snapshot = await processInventory.census(); guard();
    const live = snapshot.processes.filter(row => !row.zombie);
    const cwd = await processInventory.workingDirectories(live.map(row => row.pid));
    const processes = { ...snapshot, processes: snapshot.processes.map(row => ({ ...row,
      cwd: row.zombie ? row.cwd : cwd.get(row.pid) ?? { state: 'unavailable' } })) };
    // These roots are checked against the driver's exact live tmux identity by the
    // host immediately before use. An unrelated process remains unknown, even if
    // its command happens to contain a worker or branch name.
    const roots = await ports.liveSources(); guard();
    // sudo/run-as ancestors can have a different UID from the confined worker.
    // Read parent links separately; this supplies ancestry only, never absence.
    const ancestryText = await query('/bin/ps', ['-e', '-ww', '-o', 'pid=,ppid=']); guard();
    const ancestryLines = typeof ancestryText === 'string' ? ancestryText.split('\n').filter(line => line.trim()) : [];
    const parents = new Map();
    let ancestryComplete = ancestryText !== null && ancestryLines.length > 0 && ancestryLines.length <= 4096;
    for (const line of ancestryLines.slice(0, 4096)) {
      const fields = line.trim().split(/\s+/u);
      if (fields.length !== 2 || fields.some(field => !/^\d+$/u.test(field))
        || fields.some(field => !Number.isSafeInteger(Number(field)))) { ancestryComplete = false; break; }
      const [pid, ppid] = fields.map(Number);
      if (parents.has(pid)) { ancestryComplete = false; break; }
      parents.set(pid, ppid);
    }
    const sourceOf = pid => {
      const seen = new Set();
      for (let hops = 0; hops < 64 && !seen.has(pid); hops++) {
        seen.add(pid);
        const root = roots.find(item => item.pid === pid);
        if (root) return root.source;
        if (!ancestryComplete || !parents.has(pid)) return null;
        pid = parents.get(pid);
      }
      return null;
    };
    if (snapshot.status === 'complete' && snapshot.omitted === 0) for (const row of live) {
      guard();
      const source = sourceOf(row.pid), directory = cwd.get(row.pid);
      if (!source || directory?.state !== 'observed' || !inside(directory.path, ports.scope)) continue;
      const top = await query('git', ['--no-optional-locks', '-C', directory.path, 'rev-parse', '--show-toplevel']);
      guard(); if (!top) continue;
      const path = top.trim();
      if (!inside(path, ports.scope) || realpathSync(path) !== path) continue;
      const prior = state.checkouts[path];
      if (!prior && Object.keys(state.checkouts).length >= 64) continue;
      // A checkout shared by distinct admitted turns has ambiguous provenance. No
      // most-recent label guesses which topic owns the remaining edits.
      const nextSource = prior && prior.source !== source && (!prior.source || !ports.sameTopic(prior.source, source)) ? null : source;
      state = { ...state, checkouts: { ...state.checkouts, [path]: {
        ...prior, source: nextSource, lastActivity: prior?.source === nextSource ? prior.lastActivity : ports.now(),
      } } };
      persist(); watchCheckout(path);
    }
    const inventories = [];
    for (const path of Object.keys(state.checkouts)) {
      guard();
      const census = createWorktreeInventory({ machine: ports.identity.machine, now: ports.now,
        freshForMs: 30000, limit: 64, query, observe: async checkout => {
          const known = state.checkouts[checkout], coverage = watched.get(checkout);
          return { owner: known?.source && live.length === 0 && roots.length === 0 ? 'absent' : 'unknown',
            activity: known?.source && coverage?.valid ? { coveredFrom: coverage.from,
              coveredThrough: ports.now(), lastActivity: known.lastActivity } : null };
        } });
      inventories.push(await census.census(path));
    }
    const worktrees = { machine: ports.identity.machine, sourceTime: Math.min(ports.now(), ...inventories.map(i => i.sourceTime)),
      freshForMs: 30000, status: inventories.every(i => i.status === 'complete') ? 'complete' : 'partial',
      worktrees: [...new Map(inventories.flatMap(i => i.worktrees).map(row => [row.path, row])).values()]
        // Existing durable intake already owns this source's reconciliation, even
        // if its worker writes more files. Its own activity must not enqueue itself.
        .filter(row => !state.checkouts[row.path]?.admittedSource
          || state.checkouts[row.path].admittedSource !== state.checkouts[row.path].source) };
    // A nonempty harness census never establishes non-ownership. All such rows
    // remain unknown, including a worker whose cwd is outside this checkout.
    return { quietMs: 30000, worktrees, processes, ownership: () => new Map(live.map(row => [row.pid, 'unknown'])) };
  };
  const recovery = createWorktreeRecovery({ intake, route: ports.route, machine: ports.identity.machine,
    now: ports.now, stopped, observe });
  const controller = Object.freeze({
    sourceFor,
    async tick(force = false) {
      if (flight) {
        if (!force) return flight;
        await flight.catch(() => {});
        return controller.tick(true);
      }
      if (stopped() || !force && ports.now() - lastTick < 30000) return [];
      lastTick = ports.now(); flight = recovery.tick();
      try {
        const results = await flight;
        for (const result of results) if (result.disposition.kind === 'Success') {
          const path = result.finding.path, current = state.checkouts[path];
          if (current?.source) state = { ...state, checkouts: { ...state.checkouts,
            [path]: { ...current, admittedSource: current.source } } };
        }
        if (results.some(result => result.disposition.kind === 'Success')) persist();
        return results;
      }
      finally { flight = null; }
    },
    close() { closed = true; for (const entry of watched.values()) entry.watcher?.close(); watched.clear(); },
  });
  return controller;
}

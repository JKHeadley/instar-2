// Physical tmux and durable journal boundary for unconfined operator sessions.
import { execFile, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, chmodSync, constants,
  openSync, closeSync, fsyncSync, fstatSync, lstatSync, realpathSync, statSync, unlinkSync, readSync, rmSync, linkSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { constants as osConstants } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAgentPaths } from './agent-paths.mjs';

/** Adapted from 1.x DegradedTmuxGuard: fixed ring, EWMA and one episode. Signal-only.
 * The resource owner supplies measured host headroom; load average is never a busy claim.
 * Missing/stale evidence keeps corroboration unknown, never refreshes or kills a server. */
export function createSessionControlPlaneObserver({ now, resourceObservation }) {
  const ring = new Array(64).fill(0);
  const inFlight = new Map();
  let unreachable = false, unreachableEpisode = 0;
  let write = 0, count = 0, ewmaMs = null, cycles = 0, episode = 0, openedAt = null;
  let lastRaisedAt = null, refreshedAt = null, escalations = 0, state = 'unknown';
  let totalSamples = 0, slowCallCount = 0, killedClientCount = 0, unavailableCount = 0;
  const status = () => ({ state, episode, ewmaMs, consecutiveSlowCycles: cycles,
    ageMs: openedAt === null ? 0 : Math.max(0, now() - openedAt), escalations,
    windowSize: ring.length, ringCount: count, totalSamples, slowCallCount, killedClientCount, unavailableCount,
    unreachable, unreachableEpisode });
  /** 1.x DegradedTmuxGuard raise: one deduplicated agent-health line per episode, re-raised with its age at the
   * inherited thirty-minute cadence (the key changes only then), closed by a clean cycle. A refresh is the
   * operator's explicit act; nothing here touches the shared server. */
  const notices = () => state !== 'degraded' || openedAt === null ? [] : [{ key: `degraded-tmux:${episode}:${escalations}`,
    line: `Shared terminal control plane degraded (episode ${episode}${escalations ? `, raised again after ${Math.round((now() - openedAt) / 60_000)} min` : ''}; `
      + `recent calls average ${Math.round(ewmaMs ?? 0)} ms over ${cycles} slow cycles). A tmux refresh is your explicit action; no worker is killed for this.` }];
  return Object.freeze({ status, notices,
    reachability(reachable) {
      if (!reachable && !unreachable) unreachableEpisode++;
      unreachable = !reachable;
    },
    coalesce(key, invoke) {
      if (inFlight.has(key)) return inFlight.get(key);
      if (inFlight.size >= 8) return Promise.resolve(null);
      const pending = Promise.resolve().then(invoke).finally(() => inFlight.delete(key));
      inFlight.set(key, pending); return pending;
    },
    refresh() { refreshedAt = now(); },
    observe(duration, outcome) {
      const at = now();
      if (!Number.isFinite(duration) || duration < 0) { state = 'unknown'; return; }
      ring[write] = duration; write = (write + 1) % 64; count = Math.min(64, count + 1);
      ewmaMs = ewmaMs === null ? duration : .3 * duration + .7 * ewmaMs;
      totalSamples++; if (duration >= 9000) slowCallCount++;
      if (outcome === 'killed-client') killedClientCount++;
      if (outcome === 'indeterminate') unavailableCount++;
      if (refreshedAt !== null && at - refreshedAt < 60_000) return;
      let resource = null;
      try { resource = resourceObservation?.(); } catch { /* unavailable remains unknown */ }
      if (!resource || !Number.isFinite(resource.at) || !Number.isFinite(resource.freshForMs)
        || resource.freshForMs <= 0 || at < resource.at || at - resource.at > resource.freshForMs
        || !['available', 'pressured'].includes(resource.state)) { state = 'unknown'; return; }
      // Preserve 1.x's purpose: host contention is not evidence that the shared socket is sick.
      if (resource.state === 'pressured') { state = 'unknown'; return; }
      if (ewmaMs < 9000 && outcome !== 'indeterminate') {
        cycles = 0; openedAt = null; lastRaisedAt = null; state = 'healthy'; return;
      }
      if (outcome === 'indeterminate' && duration < 9000) { state = 'unknown'; return; }
      cycles++;
      if (cycles < 3) { state = 'unknown'; return; }
      state = 'degraded';
      if (openedAt === null) { episode++; openedAt = at; lastRaisedAt = at; }
      else if (at - lastRaisedAt >= 30 * 60_000) { lastRaisedAt = at; escalations++; }
    },
  });
}

export function createProductionSessionIO({ stateDirectory, tmuxPath = '/opt/homebrew/bin/tmux',
  home, configHome, cwd, lifecycleDirectory, now = () => Date.now(), resourceObservation, resourceProgress, retainedExposure, controlPlaneObserver }) {
  for (const value of [stateDirectory, tmuxPath, home, configHome, cwd]) {
    if (typeof value !== 'string' || !value.startsWith('/')) throw Error('absolute session IO paths required');
  }
  assertAgentPaths({ state: stateDirectory, home, configuration: configHome, workspace: cwd,
    ...(lifecycleDirectory ? { inbox: lifecycleDirectory } : {}) });
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  if (!lstatSync(stateDirectory).isDirectory()) throw Error('session state directory must be a real directory');
  chmodSync(stateDirectory, 0o700);
  const file = join(stateDirectory, 'sessions.json');
  const lockFile = join(stateDirectory, 'sessions.lock');
  const inboxDirectory = lifecycleDirectory ?? join(stateDirectory, 'inbox');
  if (!inboxDirectory.startsWith('/')) throw Error('absolute lifecycle inbox required');
  mkdirSync(inboxDirectory, { recursive: true, mode: 0o700 });
  if (!lstatSync(inboxDirectory).isDirectory()) throw Error('session inbox must be a real directory');
  const base = { sessions: [], deliveries: [], resumes: {} };
  // The delegated working scope, as the host resolves it once: a result is read only from a file inside it.
  const scope = realpathSync(cwd);
  const env = Object.freeze({ PATH: '/usr/bin:/bin:/opt/homebrew/bin', HOME: home,
    CLAUDE_CONFIG_DIR: configHome, CODEX_HOME: configHome, LANG: 'en_US.UTF-8' });
  // An independent deadline must not wait for a stalled journal owner. Keep its
  // exact worker cause separately, and fold it into every later journal read/write.
  const haltPath = identity => join(stateDirectory, `deadline-${createHash('sha256').update(identity).digest('hex')}.json`);
  const withHalts = journal => ({ ...journal, sessions: journal.sessions.map(row => {
    const path = haltPath(row.identity);
    if (!existsSync(path)) return row;
    const halt = JSON.parse(readFileSync(path, 'utf8'));
    if (halt.identity !== row.identity || !Number.isSafeInteger(halt.deadline) || !Number.isSafeInteger(halt.at))
      throw Error('invalid independent deadline evidence');
    return { ...row, deadlineHalt: { deadline: halt.deadline, at: halt.at } };
  }) });
  const controlPlane = controlPlaneObserver ?? createSessionControlPlaneObserver({ now, resourceObservation });
  let depth = 0;
  let censusPromise = null, lastCensus = null;
  const asyncTmux = command => {
    const key = JSON.stringify([tmuxPath, command]);
    return controlPlane.coalesce(key, () => {
      const started = now();
      return new Promise(resolve => {
        try {
          execFile(tmuxPath, command, { cwd, env, encoding: 'utf8', timeout: 9000,
            killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 }, (error, stdout) => {
            controlPlane.observe(Math.max(0, now() - started), error?.signal === 'SIGKILL' ? 'killed-client'
              : error ? 'indeterminate' : 'success');
            resolve(error ? null : { stdout: String(stdout), at: now() });
          });
        } catch { controlPlane.observe(Math.max(0, now() - started), 'indeterminate'); resolve(null); }
      });
    });
  };
  const census = () => {
    if (censusPromise) return censusPromise;
    if (lastCensus && now() >= lastCensus.at && now() - lastCensus.at < 1000) return Promise.resolve(lastCensus);
    censusPromise = asyncTmux(['list-sessions', '-F', '#{session_name}']).then(result => {
      controlPlane.reachability(result !== null);
      lastCensus = result; return result;
    }).finally(() => { censusPromise = null; });
    return censusPromise;
  };
  return Object.freeze({ inboxDirectory,
    exclusive(run, timeoutMs = 5000) {
      if (depth) { depth++; try { return run(); } finally { depth--; } }
      const limit = Date.now() + timeoutMs;
      let fd;
      while (fd === undefined) {
        try {
          fd = openSync(lockFile, 'wx', 0o600);
          writeFileSync(fd, String(process.pid)); fsyncSync(fd);
        } catch (error) {
          if (fd !== undefined) { closeSync(fd); unlinkSync(lockFile); fd = undefined; }
          if (error?.code !== 'EEXIST') throw error;
          let stale = false;
          try {
            const pid = Number(readFileSync(lockFile, 'utf8'));
            if (Number.isSafeInteger(pid) && pid > 0) {
              try { process.kill(pid, 0); } catch (probe) { stale = probe?.code === 'ESRCH'; }
            } else stale = Date.now() - statSync(lockFile).mtimeMs > 1000;
          } catch { stale = false; }
          if (stale) {
            const moved = `${lockFile}.stale.${process.pid}.${Date.now()}`;
            try { renameSync(lockFile, moved); unlinkSync(moved); } catch { /* another process won */ }
          }
          if (Date.now() >= limit) throw Error('session journal lock unavailable');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
        }
      }
      depth = 1;
      try { return run(); } finally { depth = 0; closeSync(fd); unlinkSync(lockFile); }
    },
    armDeadline(name, identity, deadline) {
      if (!/^instar20-[a-f0-9]{24}$/.test(name) || !identity.startsWith(`${name}:`)
        || !Number.isSafeInteger(deadline)) throw Error('invalid exact session deadline');
      const worker = fileURLToPath(new URL('./session-deadline-watchdog.mjs', import.meta.url));
      const child = spawn(process.execPath, [worker, file, inboxDirectory, tmuxPath, name, identity, String(deadline)],
        { cwd, env, stdio: 'ignore', detached: true });
      child.on('error', () => {
        const current = spawnSync(tmuxPath, ['display-message', '-p', '-t', `=${name}:`, '#{pane_pid}:#{session_created}'],
          { cwd, env, encoding: 'utf8', timeout: 3000 });
        if (current.status === 0 && `${name}:${current.stdout.trim()}` === identity)
          spawnSync(tmuxPath, ['kill-session', '-t', `=${name}:`], { cwd, env, timeout: 3000 });
      });
      if (!child.pid) throw Error('independent session deadline failed to start');
      child.unref();
    },
    tmux(args) {
      if (!['has-session', 'list-sessions', 'display-message', 'capture-pane'].includes(args[0])) lastCensus = null;
      // 1.x tmux resilience: bound the exact client, never the shared server.
      // A timeout or failed exec is an unavailable observation, not exit code 1
      // (which the session owner would otherwise mistake for a missing worker).
      const execute = command => {
        const started = now();
        const result = spawnSync(tmuxPath, command, { cwd, env, encoding: 'utf8', timeout: 9000,
          killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 });
        controlPlane.observe(Math.max(0, now() - started), result.signal ? 'killed-client'
          : result.error || result.status !== 0 ? 'indeterminate' : 'success');
        if (result.error || result.signal || result.status === null)
          throw Error('session control plane unavailable; worker state unknown');
        return result;
      };
      const result = execute(args);
      if (args[0] === 'has-session' && result.status !== 0) {
        // StaleSessionBackstop's tri-state distinction: a refused/unreachable
        // server is not a census proving that this worker disappeared.
        const target = args[args.indexOf('-t') + 1];
        const match = typeof target === 'string' && /^=(instar20-[a-f0-9]{24}):$/u.exec(target);
        if (!match) throw Error('exact session liveness target required');
        const census = execute(['list-sessions', '-F', '#{session_name}']);
        if (census.status === 0)
          return { code: census.stdout.split('\n').includes(match[1]) ? 0 : 1, stdout: '' };
        // A last session can take its server away. Independent local evidence
        // that its recorded pane process is gone still permits ordinary cleanup.
        // A reused PID, permission error, missing identity or live pane is UNKNOWN.
        const journal = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : base;
        const session = journal.sessions.find(row => row.name === match[1]);
        const identity = session?.identity?.startsWith(`${match[1]}:`)
          ? session.identity.match(/^instar20-[a-f0-9]{24}:(\d+):\d+$/u) : null;
        const pid = identity ? Number(identity[1]) : 0;
        if (Number.isSafeInteger(pid) && pid > 0) {
          try { process.kill(pid, 0); }
          catch (error) { if (error?.code === 'ESRCH') return { code: 1, stdout: '' }; }
        }
        throw Error('session control plane unavailable; worker state unknown');
      }
      if (result.status === 0 && args[0] === 'refresh-client') controlPlane.refresh();
      return { code: result.status, stdout: result.stdout ?? '' };
    },
    retainedExposure(identity) { return retainedExposure?.(identity) === true; },
    controlPlaneStatus() { return controlPlane.status(); },
    async observeSession(name, expectedIdentity) {
      if (!/^instar20-[a-f0-9]{24}$/u.test(name) || !expectedIdentity.startsWith(`${name}:`))
        throw Error('exact observation identity required');
      const unknown = reachable => ({ state: 'indeterminate', identity: expectedIdentity, pane: null, at: now(), reachable });
      const population = await census();
      if (!population) {
        // Preserve the last-server exit neighbor: ESRCH for this exact recorded
        // pane proves absence even while the shared socket cannot be queried.
        const match = /^instar20-[a-f0-9]{24}:(\d+):\d+$/u.exec(expectedIdentity);
        const pid = match ? Number(match[1]) : 0;
        if (Number.isSafeInteger(pid) && pid > 0) try { process.kill(pid, 0); }
        catch (error) { if (error?.code === 'ESRCH') return { state: 'dead', identity: expectedIdentity, pane: null, at: now(), reachable: false }; }
        return unknown(false);
      }
      if (!population.stdout.split('\n').includes(name)) return { state: 'dead', identity: expectedIdentity, pane: null, at: population.at, reachable: true };
      const args = ['display-message', '-p', '-t', `=${name}:`, '#{pane_pid}:#{session_created}'];
      const before = await asyncTmux(args);
      if (!before || `${name}:${before.stdout.trim()}` !== expectedIdentity) return unknown(true);
      const pane = await asyncTmux(['capture-pane', '-p', '-t', `=${name}:`, '-S', '-80']);
      const after = await asyncTmux(args);
      if (!pane || !after || before.stdout !== after.stdout || now() - pane.at > 9000) return unknown(true);
      return { state: 'alive', identity: expectedIdentity, pane: pane.stdout.trim(), at: pane.at, reachable: true };
    },
    progressSnapshot(framework, id, project, directory, identity) {
      let resources = { descendantCpuSeconds: null, mainProcessActive: null };
      try { resources = resourceProgress?.(identity) ?? resources; } catch { /* unavailable observation */ }
      const unknown = { transcriptSize: null, transcriptTail: null, ...resources };
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return unknown;
      let path;
      if (framework === 'claude-code') path = join(directory, 'projects', project.replace(/[\/.]/g, '-'), `${id}.jsonl`);
      else if (framework === 'codex-cli') {
        // Date-partitioned native transcripts; an exact id, never a newest-file guess.
        let examined = 0; const matches = [];
        const scan = (folder, depth) => {
          if (depth > 4 || !existsSync(folder)) return;
          for (const entry of readdirSync(folder, { withFileTypes: true })) {
            if (++examined > 4096) throw Error('transcript enumeration incomplete');
            if (entry.isDirectory()) scan(join(folder, entry.name), depth + 1);
            else if (entry.isFile() && entry.name.endsWith(`-${id}.jsonl`)) matches.push(join(folder, entry.name));
          }
        };
        try { scan(join(directory, 'sessions'), 0); } catch { return unknown; }
        if (matches.length !== 1) return unknown;
        path = matches[0];
      } else return unknown;
      let fd;
      try {
        fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        const stat = fstatSync(fd);
        if (!stat.isFile() || stat.nlink !== 1) return unknown;
        const tail = Buffer.alloc(Math.min(512, stat.size));
        const read = readSync(fd, tail, 0, tail.length, Math.max(0, stat.size - tail.length));
        if (read !== tail.length || fstatSync(fd).size !== stat.size) return unknown;
        return { ...unknown, transcriptSize: stat.size, transcriptTail: createHash('sha256').update(tail).digest('hex') };
      } catch { return unknown; } finally { if (fd !== undefined) closeSync(fd); }
    },
    sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); },
    load() { return withHalts(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : base); },
    recordDeadlineHalt(identity, deadline, at) {
      const path = haltPath(identity), temporary = `${path}.${process.pid}.tmp`;
      const fd = openSync(temporary, 'w', 0o600);
      try { writeFileSync(fd, JSON.stringify({ identity, deadline, at })); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temporary, path);
      const dir = openSync(stateDirectory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
    },
    save(journal) {
      const temporary = join(stateDirectory, `sessions.${process.pid}.tmp`);
      writeFileSync(temporary, JSON.stringify(withHalts(journal)), { mode: 0o600 });
      const fd = openSync(temporary, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temporary, file);
      const dir = openSync(stateDirectory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
    },
    readInbox(name) {
      if (!/^instar20-[a-f0-9]{24}$/.test(name)) throw Error('invalid inbox session name');
      return readdirSync(inboxDirectory).filter(file => file.startsWith(`${name}.`) && file.endsWith('.json'))
        .slice(-100).flatMap(file => { try { return [JSON.parse(readFileSync(join(inboxDirectory, file), 'utf8'))]; } catch { return []; } });
    },
    readTerminal(name) {
      if (!/^instar20-[a-f0-9]{24}$/u.test(name)) return null;
      const path = join(dirname(inboxDirectory), 'terminal-reports', `${name}.json`);
      try {
        const meta = lstatSync(path);
        if (!meta.isFile() || meta.nlink !== 1 || meta.size > 4096) return null;
        const value = JSON.parse(readFileSync(path, 'utf8'));
        if (value.v !== 1 || value.name !== name) return null;
        const validCode = code => Number.isSafeInteger(code) && code >= 0 && code <= 255;
        const validSignal = signal => typeof signal === 'string' && Object.hasOwn(osConstants.signals, signal);
        return { code: validCode(value.code) ? value.code : null,
          signal: validSignal(value.signal) ? value.signal : null,
          workerExitClaim: value.workerExitClaim && Number.isSafeInteger(value.workerExitClaim.workerPid) && value.workerExitClaim.workerPid > 0
            ? { workerPid: value.workerExitClaim.workerPid,
              code: validCode(value.workerExitClaim.code) ? value.workerExitClaim.code : null,
              signal: validSignal(value.workerExitClaim.signal) ? value.workerExitClaim.signal : null }
            : null };
      } catch { return null; }
    },
    /**
     * At most `maxBytes + 1` bytes of a delegated step's result file; null when it does not exist. The child controls
     * the destination, and this read runs with the host's broader authority, so custody is enforced here: the final
     * name is never followed (a symbolic link refuses), the opened file must be a regular file with no other link,
     * inside the delegated scope by real path, and still the file the name points at. A special file refuses without
     * blocking the host (opened non-blocking). A refusal throws, so the step settles as not complete.
     */
    readResult(path, maxBytes) {
      let fd;
      try { fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
      catch (error) {
        if (error?.code === 'ENOENT') return null;
        if (error?.code === 'ELOOP') throw Error('result refused: the destination is a symbolic link');
        throw Error(`result refused: the destination cannot be opened as a file (${error?.code ?? 'unknown'})`);
      }
      try {
        const opened = fstatSync(fd);
        if (!opened.isFile()) throw Error('result refused: the destination is not a regular file');
        if (opened.nlink !== 1) throw Error('result refused: the destination has another link');
        const folder = realpathSync(dirname(path));
        if (folder !== scope && !folder.startsWith(`${scope}${sep}`)) throw Error('result refused: the destination lies outside the delegated scope');
        const named = lstatSync(path);
        if (named.dev !== opened.dev || named.ino !== opened.ino) throw Error('result refused: the destination changed while it was opened');
        const buffer = Buffer.alloc(maxBytes + 1);
        let total = 0;
        while (total < buffer.length) { const read = readSync(fd, buffer, total, buffer.length - total, total); if (!read) break; total += read; }
        return buffer.subarray(0, total).toString('utf8');
      } finally { closeSync(fd); }
    },
    /** Removes a leftover result; any failure but absence throws, so a stale file is never read as new. */
    clearResult(path) { rmSync(path, { force: true }); },
    /**
     * Rules 60, 75: how many model calls a delegated session in `project` has made since `since`,
     * counted from its harness's own transcript — a Claude Code session's distinct assistant request
     * ids, a Codex session's `token_count` events (one per model response) — in files written since
     * then. Null when a transcript cannot be read or is past its size bound: unknown is not zero.
     */
    modelCalls(framework, project, directory, since) {
      const LIMIT = 64 * 1024 * 1024;
      const lines = file => { const info = statSync(file); if (info.size > LIMIT) throw Error('transcript past its bound');
        return readFileSync(file, 'utf8').split('\n'); };
      const parse = line => { try { const value = JSON.parse(line); return value && typeof value === 'object' ? value : null; } catch { return null; } };
      try {
        if (framework === 'claude-code') {
          const folder = join(directory, 'projects', project.replace(/[\/.]/g, '-'));
          if (!existsSync(folder)) return 0;
          const requests = new Set();
          for (const name of readdirSync(folder)) {
            const file = join(folder, name);
            if (!name.endsWith('.jsonl') || !lstatSync(file).isFile() || statSync(file).mtimeMs < since) continue;
            for (const row of lines(file).map(parse))
              if (row?.type === 'assistant') requests.add(row.requestId ?? row.message?.id ?? `${file}:${requests.size}`);
          }
          return requests.size;
        }
        // Codex: date-partitioned rollouts in this login home, from the step's start date to today,
        // each attributed to the session by the working directory its own first record names.
        let calls = 0;
        const visitedFolders = new Set();
        const day = 86_400_000;
        for (let at = since - day; at <= Date.now() + day; at += day) {
          const date = new Date(at);
          const folder = join(directory, 'sessions', String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'));
          // A fall-back day is 25 hours long. Two 24-hour samples can name the
          // same local calendar folder, but its calls still count only once.
          if (visitedFolders.has(folder)) continue;
          visitedFolders.add(folder);
          if (!existsSync(folder)) continue;
          for (const name of readdirSync(folder)) {
            const file = join(folder, name);
            if (!name.endsWith('.jsonl') || !lstatSync(file).isFile() || statSync(file).mtimeMs < since) continue;
            const rows = lines(file).map(parse);
            if (rows[0]?.type !== 'session_meta' || rows[0]?.payload?.cwd !== project) continue;
            calls += rows.filter(row => row?.type === 'event_msg' && row.payload?.type === 'token_count').length;
          }
        }
        return calls;
      } catch { return null; }
    },
    /** Adapter-owned transcript layout; only an exact copy may be reused. A divergent
     * destination survives untouched and the caller grounds a new worker from the journal. */
    carryTranscript({ framework, id, project, source, target }) {
      if (framework !== 'claude-code') return 'unsupported';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return 'missing';
      const folder = project.replace(/[\/.]/g, '-');
      const safeFolder = (base, create) => {
        if (!base.startsWith('/') || realpathSync(base) !== base || !lstatSync(base).isDirectory()) throw Error('unsafe transcript home');
        let at = base;
        for (const part of ['projects', folder]) {
          at = join(at, part);
          if (create) try { mkdirSync(at, { mode: 0o700 }); } catch (error) { if (error?.code !== 'EEXIST') throw error; }
          if (!lstatSync(at).isDirectory() || realpathSync(at) !== at) throw Error('unsafe transcript folder');
        }
        return at;
      };
      const readTranscript = path => {
        const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const info = fstatSync(fd);
          if (!info.isFile() || info.nlink !== 1 || info.size > 64 * 1024 * 1024) throw Error('unsafe transcript');
          const bytes = readFileSync(fd);
          if (bytes.length !== info.size) throw Error('transcript changed');
          return bytes;
        } finally { closeSync(fd); }
      };
      let temporary;
      try {
        const bytes = readTranscript(join(safeFolder(source, false), `${id}.jsonl`));
        const destination = join(safeFolder(target, true), `${id}.jsonl`);
        try { return readTranscript(destination).equals(bytes) ? 'identical' : 'divergent'; }
        catch (error) { if (error?.code !== 'ENOENT') return 'unavailable'; }
        temporary = `${destination}.${randomUUID()}.tmp`;
        const fd = openSync(temporary, 'wx', 0o600);
        try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
        // No replacement, even if another writer created the destination after the read.
        try { linkSync(temporary, destination); }
        catch (error) { if (error?.code === 'EEXIST') return 'divergent'; throw error; }
        unlinkSync(temporary); temporary = undefined;
        const directory = openSync(dirname(destination), 'r');
        try { fsyncSync(directory); } finally { closeSync(directory); }
        return 'copied';
      } catch { return 'unavailable'; }
      finally { if (temporary) try { unlinkSync(temporary); } catch { /* Retain a failed temporary copy; never remove a destination. */ } }
    },
    transcriptExists(framework, id, project, directory) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false;
      if (framework === 'claude-code') {
        try { return lstatSync(join(directory, 'projects', project.replace(/[\/.]/g, '-'), `${id}.jsonl`)).isFile(); }
        catch { return false; }
      }
      // Codex stores date-partitioned rollout files. Search only the supplied login home.
      const root = join(directory, 'sessions');
      const scan = (path, depth) => {
        if (depth > 4 || !existsSync(path)) return false;
        return readdirSync(path, { withFileTypes: true }).some(entry => entry.isDirectory()
          ? scan(join(path, entry.name), depth + 1)
          : entry.isFile() && entry.name.endsWith(`-${id}.jsonl`));
      };
      return scan(root, 0);
    },
  });
}

// Physical tmux and durable journal boundary for unconfined operator sessions.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, chmodSync, constants,
  openSync, closeSync, fsyncSync, fstatSync, lstatSync, realpathSync, statSync, unlinkSync, readSync, rmSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function createProductionSessionIO({ stateDirectory, tmuxPath = '/opt/homebrew/bin/tmux',
  home, configHome, cwd }) {
  for (const value of [stateDirectory, tmuxPath, home, configHome, cwd]) {
    if (typeof value !== 'string' || !value.startsWith('/')) throw Error('absolute session IO paths required');
  }
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  if (!lstatSync(stateDirectory).isDirectory()) throw Error('session state directory must be a real directory');
  chmodSync(stateDirectory, 0o700);
  const file = join(stateDirectory, 'sessions.json');
  const lockFile = join(stateDirectory, 'sessions.lock');
  const inboxDirectory = join(stateDirectory, 'inbox');
  mkdirSync(inboxDirectory, { recursive: true, mode: 0o700 });
  if (!lstatSync(inboxDirectory).isDirectory()) throw Error('session inbox must be a real directory');
  const base = { sessions: [], deliveries: [], resumes: {} };
  // The delegated working scope, as the host resolves it once: a result is read only from a file inside it.
  const scope = realpathSync(cwd);
  const env = Object.freeze({ PATH: '/usr/bin:/bin:/opt/homebrew/bin', HOME: home,
    CLAUDE_CONFIG_DIR: configHome, CODEX_HOME: configHome, LANG: 'en_US.UTF-8' });
  let depth = 0;
  return Object.freeze({ inboxDirectory,
    exclusive(run) {
      if (depth) { depth++; try { return run(); } finally { depth--; } }
      const limit = Date.now() + 5000;
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
      const result = spawnSync(tmuxPath, args, { cwd, env, encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 });
      return { code: result.status ?? 1, stdout: result.stdout ?? '' };
    },
    sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); },
    load() { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : base; },
    save(journal) {
      const temporary = join(stateDirectory, `sessions.${process.pid}.tmp`);
      writeFileSync(temporary, JSON.stringify(journal), { mode: 0o600 });
      const fd = openSync(temporary, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temporary, file);
      const dir = openSync(stateDirectory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
    },
    readInbox(name) {
      if (!/^instar20-[a-f0-9]{24}$/.test(name)) throw Error('invalid inbox session name');
      return readdirSync(inboxDirectory).filter(file => file.startsWith(`${name}.`) && file.endsWith('.json'))
        .slice(-100).flatMap(file => { try { return [JSON.parse(readFileSync(join(inboxDirectory, file), 'utf8'))]; } catch { return []; } });
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
        const day = 86_400_000;
        for (let at = since - day; at <= Date.now() + day; at += day) {
          const date = new Date(at);
          const folder = join(directory, 'sessions', String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'));
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

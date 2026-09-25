// Physical tmux and durable journal boundary for unconfined operator sessions.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, chmodSync,
  openSync, closeSync, fsyncSync, lstatSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
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
    transcriptExists(framework, id, project, directory) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false;
      if (framework === 'claude-code') return existsSync(join(directory, 'projects', project.replace(/[\/.]/g, '-'), `${id}.jsonl`));
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

// Independent one-turn deadline. Survives the parent server process.
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createProductionSessionIO } from './production-session-io.mjs';

/** Use the same journal lock as the driver: renewal and halt cannot race past each other.
 * Record the cause before actuation; a crash retains the unfinished turn for reconciliation. */
export function enforceSessionDeadline(io, name, identity, deadline, now) {
  return io.exclusive(() => {
    const journal = io.load();
    const session = journal.sessions.find(row => row.name === name && row.identity === identity);
    if (!session || session.turnDeadline !== deadline || session.closedAt !== null || now < deadline) return false;
    const closed = io.readInbox(name).some(event => event.kind === 'turn-closed'
      && event.at >= session.turnStartedAt && event.at <= deadline
      && (event.receiptId ? !session.turnReceiptIds?.includes(event.receiptId) : event.at > session.turnStartedAt));
    if (closed) return false;
    const current = io.tmux(['display-message', '-p', '-t', `=${name}:`, '#{pane_pid}:#{session_created}']);
    if (current.code !== 0 || `${name}:${current.stdout.trim()}` !== identity) return false;
    io.save({ ...journal, sessions: journal.sessions.map(row => row === session
      ? { ...row, deadlineHalt: { deadline, at: now } } : row) });
    const stopped = io.tmux(['kill-session', '-t', `=${name}:`]);
    if (stopped.code !== 0) throw Error('deadline closure unconfirmed');
    return true;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [journalFile, inbox, tmuxPath, name, identity, deadlineText] = process.argv.slice(2);
  const deadline = Number(deadlineText);
  if (!/^instar20-[a-f0-9]{24}$/.test(name ?? '') || !identity?.startsWith(`${name}:`)
    || !Number.isSafeInteger(deadline) || deadline < Date.now() - 1000 || deadline > Date.now() + 3_600_000)
    process.exit(2);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now())));
  try {
    const stateDirectory = dirname(journalFile);
    const io = createProductionSessionIO({ stateDirectory, lifecycleDirectory: inbox, tmuxPath,
      home: process.env.HOME ?? stateDirectory, configHome: process.env.CODEX_HOME ?? stateDirectory, cwd: process.cwd() });
    enforceSessionDeadline(io, name, identity, deadline, Date.now());
  } catch { process.exitCode = 1; }
}

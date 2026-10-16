// Independent one-turn deadline. Survives the parent server process.
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createProductionSessionIO } from './production-session-io.mjs';

/** The journal lock serializes the normal path. If its owner is stalled, the
 * original durable turn is still the ceiling: retain a separate exact-worker halt
 * and actuate without waiting. Bookkeeping failure cannot cancel that ceiling. */
export function enforceSessionDeadline(io, name, identity, deadline, now) {
  const expired = () => {
    const journal = io.load();
    const session = journal.sessions.find(row => row.name === name && row.identity === identity);
    if (!session || session.turnDeadline !== deadline || session.closedAt !== null || now < deadline) return null;
    const closed = io.readInbox(name).some(event => event.kind === 'turn-closed'
      && event.at >= session.turnStartedAt && event.at <= deadline
      && (event.receiptId ? !session.turnReceiptIds?.includes(event.receiptId) : event.at > session.turnStartedAt));
    return closed ? null : { journal, session };
  };
  const enforce = locked => {
    if (!expired()) return false;
    const current = io.tmux(['display-message', '-p', '-t', `=${name}:`, '#{pane_pid}:#{session_created}']);
    if (current.code !== 0 || `${name}:${current.stdout.trim()}` !== identity) return false;
    // Re-read after physical IO: a renewal or timely closure wins over an old timer.
    const fresh = expired();
    if (!fresh) return false;
    let recordingError;
    try {
      if (!locked) io.recordDeadlineHalt(identity, deadline, now);
      else try {
        io.save({ ...fresh.journal, sessions: fresh.journal.sessions.map(row => row === fresh.session
          ? { ...row, deadlineHalt: { deadline, at: now } } : row) });
      } catch { io.recordDeadlineHalt(identity, deadline, now); }
    } catch (error) { recordingError = error; }
    // Emergency enforcement relies on the already-durable admission even if every
    // new write fails. Leave the open turn uncertain, never forge closure/completion.
    const stopped = io.tmux(['kill-session', '-t', `=${name}:`]);
    if (stopped.code !== 0) throw Error('deadline closure unconfirmed');
    if (recordingError) throw recordingError;
    return true;
  };
  let entered = false;
  try { return io.exclusive(() => { entered = true; return enforce(true); }, 0); }
  catch (error) { if (entered) throw error; return enforce(false); }
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

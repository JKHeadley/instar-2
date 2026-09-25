// Independent one-turn deadline. Survives the parent server process.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const [journalFile, inbox, tmuxPath, name, identity, deadlineText] = process.argv.slice(2);
const deadline = Number(deadlineText);
if (!/^instar20-[a-f0-9]{24}$/.test(name ?? '') || !identity?.startsWith(`${name}:`)
  || !Number.isSafeInteger(deadline) || deadline < Date.now() - 1000 || deadline > Date.now() + 3_600_000)
  process.exit(2);
await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now())));
try {
  if (!existsSync(journalFile)) process.exit(0);
  const journal = JSON.parse(readFileSync(journalFile, 'utf8'));
  const session = journal.sessions.find(row => row.name === name && row.identity === identity);
  if (!session || session.turnDeadline !== deadline || session.closedAt !== null) process.exit(0);
  const closed = readdirSync(inbox).filter(file => file.startsWith(`${name}.`) && file.endsWith('.json'))
    .some(file => { try { const event = JSON.parse(readFileSync(join(inbox, file), 'utf8'));
      return event.kind === 'turn-closed' && event.at >= session.turnStartedAt && event.at <= deadline;
    } catch { return false; } });
  if (closed) process.exit(0);
  const env = { PATH: '/usr/bin:/bin:/opt/homebrew/bin' };
  const current = spawnSync(tmuxPath, ['display-message', '-p', '-t', `=${name}:`, '#{pane_pid}:#{session_created}'],
    { env, encoding: 'utf8', timeout: 3000 });
  if (current.status === 0 && `${name}:${current.stdout.trim()}` === identity)
    spawnSync(tmuxPath, ['kill-session', '-t', `=${name}:`], { env, encoding: 'utf8', timeout: 3000 });
} catch { process.exit(1); }

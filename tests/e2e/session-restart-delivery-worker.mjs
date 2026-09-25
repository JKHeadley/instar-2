import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
import { createProductionSessionDriver } from '../../dist/assembly/production-session-driver.js';

const input = JSON.parse(Buffer.from(process.argv[2], 'base64url').toString('utf8'));
const physical = createProductionSessionIO({ stateDirectory: input.root, tmuxPath: input.tmux,
  home: input.root, configHome: input.root, cwd: input.root });
const io = { ...physical,
  tmux: args => physical.tmux(['-L', input.socket, ...args]),
  save(journal) {
    physical.save(journal);
    if (journal.deliveries.some(row => row.operation === 'delivery' && row.state === 'prepared'))
      process.kill(process.pid, 'SIGKILL');
  },
};
const driver = createProductionSessionDriver({ operatorOwnUse: true, confinement: 'unconfined', framework: 'claude-code',
  executable: input.executable, cwd: input.root, home: input.root, configHome: input.root,
  context: input.context, io, now: Date.now, stopped: () => false, resolveIntake: () => 'restart message',
  maxSessions: 1, turnDeadlineMs: 3000, readyTimeoutMs: 3000, protectedSessions: [] });
driver.deliver({ operation: 'delivery', processIdentity: input.identity, intake: 'input',
  digest: input.digest, incarnation: 'inc' });
process.exit(3);

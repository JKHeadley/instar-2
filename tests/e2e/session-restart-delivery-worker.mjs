import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
const [root, encoded] = process.argv.slice(2);
const record = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
const io = createProductionSessionIO({ stateDirectory: root, tmuxPath: '/opt/homebrew/bin/tmux',
  home: root, configHome: root, cwd: root });
const journal = io.load();
io.save({ ...journal, deliveries: [...journal.deliveries, record] });
process.kill(process.pid, 'SIGKILL');

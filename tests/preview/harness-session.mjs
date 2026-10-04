// A delegated session's harness as its own macOS user (desk unit harness-user): the command a session's tmux pane runs in
// place of the harness when the runner launches it as the harness user. Runs as the runner's account inside the pane, so
// it can read the login custody; it then hands the login (never a file, an argument or the environment) to the launcher
// through the one sudoers rule, exactly as a tool turn's command does (production-boot-io.mjs harnessCommand), in the
// launcher's terminal mode, so the harness reads the pane's keys and draws on it. The environment it was started with
// (the session driver's clean `env -i` set: HOME, the config home, the model checkpoint's address, the admitted-session
// variables) is the harness's, passed as launcher arguments.
//
//   node harness-session.mjs [--custody LOGIN.json] USER PROFILE.json -- EXECUTABLE ARG ...
//
// `--custody` names another custody file (a test's synthetic login, laid out and checked exactly as the real one).
//
// It ends with the harness: its exit status, or the signal's. A pane closed under it (tmux kill-session) hangs up sudo,
// which relays the hang-up to the launcher, which ends the harness's whole tree.
import { spawn } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { harnessCommand } from '../../scripts/production-boot-io.mjs';
import { HARNESS_LAUNCHER, HARNESS_LOGIN, readHarnessLogin } from './harness-user.mjs';

/** The sudo command for one interactive harness launch: harnessCommand's, in the launcher's terminal mode. */
export function harnessSessionCommand({ user, profile, executable, args, env, login = readHarnessLogin }) {
  const command = harnessCommand({ executable, args, env, stdin: '' },
    { user, launcher: HARNESS_LAUNCHER, login: () => login(profile), plan: profile.plan });
  const at = command.args.indexOf('--handoff');
  if (at < 0) throw Error('preview: the harness command has no hand-off');
  return { ...command, args: [...command.args.slice(0, at + 1), '--tty', ...command.args.slice(at + 1)] };
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const words = process.argv.slice(2);
  const custody = words[0] === '--custody' ? words.splice(0, 2)[1] : HARNESS_LOGIN;
  const [user, profilePath, split, executable, ...args] = words;
  if (!custody?.startsWith('/') || !user || !profilePath || split !== '--' || !executable) {
    process.stderr.write('usage: harness-session.mjs [--custody LOGIN.json] USER PROFILE.json -- EXECUTABLE ARG ...\n');
    process.exit(125);
  }
  let command;
  try {
    command = harnessSessionCommand({ user, profile: JSON.parse(readFileSync(profilePath, 'utf8')), executable, args,
      env: { ...process.env }, login: profile => readHarnessLogin(profile, custody) });
  } catch (error) { process.stderr.write(`harness-session: ${String(error?.message ?? error)}\n`); process.exit(125); }
  const child = spawn(command.executable, command.args, { env: command.env, stdio: ['pipe', 'inherit', 'inherit'] });
  child.stdin.on('error', () => {});
  child.stdin.end(command.stdin, 'utf8');
  child.on('error', () => process.exit(126));
  child.on('exit', (code, signal) => { if (signal) process.kill(process.pid, signal); process.exit(code ?? 1); });
}

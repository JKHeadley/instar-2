#!/usr/bin/env node
import { register } from 'node:module';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
register('../scripts/slice-ts-loader.mjs', import.meta.url);
const [command, root = join(homedir(), '.instar2'), ...extra] = process.argv.slice(2);
if (command === 'signin' && (extra.length === 1 || extra.length === 2)) {
  try {
    const { runHarnessSignin } = await import('../scripts/harness-signin.mjs');
    const result = await runHarnessSignin(root, extra[0], { browser: extra[1], write: text => process.stdout.write(text) });
    process.stdout.write(`Sign-in: ${result.phase}${result.reason ? ` (${result.reason})` : ''}.\n`);
    process.exitCode = ['succeeded', 'healthy'].includes(result.phase) ? 0 : 2;
  } catch {
    // Login/CLI/native errors can carry secret bytes. The pull record names the
    // fixed failure class; raw exceptions never reach the terminal.
    process.stderr.write('Sign-in could not start. Check the installed account, its private browser binding, stop state, and repair record.\n');
    process.exitCode = 1;
  }
} else if (command !== 'setup' || extra.length) {
  process.stderr.write('Usage: instar2 setup [installation-directory]\n       instar2 signin <installation-directory> <installed-profile-reference> [dedicated-browser-directory]\n');
  process.exitCode = 1;
} else {
  const { runOnboarding } = await import('../scripts/onboarding.mjs');
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  try {
    process.exitCode = await runOnboarding(root, {
      write: text => process.stdout.write(text),
      read: async () => { const line = await iterator.next(); return line.done ? null : line.value; },
    }, `local-installer:uid:${process.getuid()}`);
  } catch (error) {
    process.stderr.write(`Setup stopped: ${error.message}\nRun the same command to resume saved answers.\n`);
    process.exitCode = 1;
  } finally { lines.close(); process.stdin.destroy(); }
}

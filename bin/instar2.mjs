#!/usr/bin/env node
import { register } from 'node:module';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
const [command, root = join(homedir(), '.instar2'), ...extra] = process.argv.slice(2);
if (command === 'update') {
  try {
    const { updateRoot } = await import('../scripts/update.mjs');
    let directory = root, release;
    if (root === '--release' && extra.length === 1) { directory = join(homedir(), '.instar2'); release = extra[0]; }
    else if (extra.length === 2 && extra[0] === '--release') release = extra[1];
    else if (extra.length || root.startsWith('--')) throw Error('Usage: instar2 update [installation-directory] [--release <tag>]');
    const result = await updateRoot(directory, { release });
    process.stdout.write(result.status === 'unchanged' ? 'Already on this release.\n' : 'Update installed. Restart is a separate step.\n');
  } catch {
    process.stderr.write('Update stopped; check the release tag and saved update state before retrying.\n');
    process.exitCode = 1;
  }
} else if (!['setup', 'run'].includes(command) || extra.length) {
  process.stderr.write('Usage: instar2 <setup|run> [installation-directory] | update [installation-directory] [--release <tag>]\n');
  process.exitCode = 1;
} else if (command === 'run') {
  register('../scripts/slice-ts-loader.mjs', import.meta.url);
  const { runProduct, RunRefused } = await import('../scripts/product-run.mjs');
  try { await runProduct(root); }
  catch (error) {
    process.stderr.write(`${error instanceof RunRefused ? error.message : 'Run refused: installation could not be read; details suppressed.'}\n`);
    process.exitCode = 1;
  }
} else {
  register('../scripts/slice-ts-loader.mjs', import.meta.url);
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

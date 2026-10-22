#!/usr/bin/env node
import { register } from 'node:module';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
register('../scripts/slice-ts-loader.mjs', import.meta.url);
const [command, root = join(homedir(), '.instar2'), ...extra] = process.argv.slice(2);
if (!['setup', 'run'].includes(command) || extra.length) {
  process.stderr.write('Usage: instar2 <setup|run> [installation-directory]\n');
  process.exitCode = 1;
} else if (command === 'run') {
  const { runProduct, RunRefused } = await import('../scripts/product-run.mjs');
  try { await runProduct(root); }
  catch (error) {
    process.stderr.write(`${error instanceof RunRefused ? error.message : 'Run refused: installation could not be read; details suppressed.'}\n`);
    process.exitCode = 1;
  }
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

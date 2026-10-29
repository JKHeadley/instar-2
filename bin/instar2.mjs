#!/usr/bin/env node
import { register } from 'node:module';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
const [command, root = join(homedir(), '.instar2'), ...extra] = process.argv.slice(2);
if (command === 'prepare-login') {
  const { prepareLogin, promptLoginPreparation, LOGIN_PREPARATION_SAVED, LoginPreparationRefused } = await import('../scripts/login-preparation.mjs');
  try {
    if (extra.length) throw Error('one nonsecret selection required');
    if (process.stdin.isTTY) {
      const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
      const iterator = lines[Symbol.asyncIterator]();
      try {
        process.exitCode = await promptLoginPreparation(root, {
          write: text => process.stdout.write(text),
          read: async () => { const line = await iterator.next(); return line.done ? null : line.value; },
        });
      } finally { lines.close(); process.stdin.destroy(); }
    } else {
      let input = '';
      for await (const chunk of process.stdin) {
        input += chunk;
        if (input.length > 4096) throw Error('selection too large');
      }
      prepareLogin(root, JSON.parse(input));
      process.stdout.write(LOGIN_PREPARATION_SAVED);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof LoginPreparationRefused ? error.message
      : 'Login preparation refused. Check the installation and supply only provider and account; details suppressed.'}\n`);
    process.exitCode = 1;
  }
} else if (command === 'mcp-add') {
  try {
    if (extra.length || process.stdin.isTTY) throw Error('pipe one server configuration through stdin');
    register('../scripts/slice-ts-loader.mjs', import.meta.url);
    const { installMcp } = await import('../scripts/mcp-setup.mjs');
    const { createSecretCustody } = await import('../tests/preview/secret-custody.js');
    let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 1048576) throw Error('input too large'); }
    const { secretEnv = {}, ...config } = JSON.parse(input);
    if (Object.keys(config.mcpServers ?? {}).length !== 1) throw Error('add exactly one server');
    const value = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY ?? '';
    const custody = Object.keys(secretEnv).length ? createSecretCustody(root,
      Buffer.from(value, /^[a-f0-9]{64}$/iu.test(value) ? 'hex' : 'base64'), Date.now) : undefined;
    installMcp(root, config, secretEnv, custody);
    process.stdout.write('MCP server recorded. Restart to use the updated configuration.\n');
  } catch { process.stderr.write('MCP setup refused; existing configuration retained. Details suppressed.\n'); process.exitCode = 1; }
} else if (command === 'update') {
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
  process.stderr.write('Usage: instar2 <setup|run|prepare-login> [installation-directory] | update [installation-directory] [--release <tag>]\n');
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

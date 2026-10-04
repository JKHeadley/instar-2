#!/usr/bin/env node
// Launches one of the root's MCP servers whose environment names a credential by SecretRef (tool-turn.mjs readRootMcp).
// argv: <socket> <server> <nonce> <command> [args...]. The runner resolves the server's SecretRefs from its custody and
// serves them, once, on the turn's socket (tool-turn.mjs serveMcpSecrets); this launcher takes them and starts the
// server with them in its environment. The value is held in memory only: it is never written to a file.
import { spawn } from 'node:child_process';
import { connect } from 'node:net';

const [socket, server, nonce, command, ...args] = process.argv.slice(2);
const fail = why => { process.stderr.write(`mcp launch refused: ${why}\n`); process.exit(1); };
if (!socket || !server || !nonce || !command) fail('usage: <socket> <server> <nonce> <command> [args...]');
const received = await new Promise((resolve, reject) => {
  let text = '';
  const link = connect(socket);
  link.setEncoding('utf8');
  link.on('connect', () => link.end(`${server} ${nonce}\n`));
  link.on('data', chunk => { text += chunk; });
  link.on('end', () => resolve(text));
  link.on('error', reject);
}).catch(error => fail(error?.message ?? String(error)));
let env;
try { env = JSON.parse(received); } catch { fail(`no credentials served for ${server}`); }
if (!env || typeof env !== 'object' || Array.isArray(env) || !Object.values(env).every(value => typeof value === 'string'))
  fail(`no credentials served for ${server}`);
const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => child.kill(signal));
child.on('error', error => fail(error.message));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

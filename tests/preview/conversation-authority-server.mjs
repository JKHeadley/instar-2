#!/usr/bin/env node
// The shared conversation authority's launcher (Rules 31, 63, 113): one process on the authority machine,
// one append-only log, one conversation. Both machines' runners reach it over its bearer-authenticated
// HTTP face. Only this file owns the process, the clock and the listening socket.
//
//   node --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/conversation-authority-server.mjs \
//     --path <log file> --bot-id <id> --chat-id <id> --host <address> --port <port> [--term-ms 30000]
//
// The shared secret is bound by the host as INSTAR_SECRET_PREVIEW_AUTHORITY_SECRET (never an argument, never logged).
import { resolve } from 'node:path';
import { openConversationAuthority, serveConversationAuthority } from './conversation-authority.js';

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!process.argv[i]?.startsWith('--') || process.argv[i + 1] === undefined) throw Error('authority: malformed arguments');
  options[process.argv[i].slice(2)] = process.argv[i + 1];
}
const required = name => { if (!options[name]) throw Error(`authority: missing --${name}`); return options[name]; };
const number = (value, name, minimum, maximum) => {
  const n = Number(value); if (!Number.isSafeInteger(n) || n < minimum || n > maximum) throw Error(`authority: invalid ${name}`); return n;
};
const secret = process.env.INSTAR_SECRET_PREVIEW_AUTHORITY_SECRET;
if (!secret || secret.length < 16) throw Error('authority: SecretRef unavailable');
// The same conversation key the runner derives from its journal's genesis.
const conversation = `telegram/bot-${required('bot-id')}/chat-${required('chat-id')}`;
const authority = openConversationAuthority({ path: resolve(required('path')), conversation,
  termMs: number(options['term-ms'] ?? '30000', 'term-ms', 1000, 300000), monotonic: () => performance.now() });
const server = await serveConversationAuthority({ authority, token: secret, host: required('host'),
  port: number(required('port'), 'port', 0, 65535) });
const address = server.address();
process.stdout.write(`${JSON.stringify({ listening: typeof address === 'object' && address ? address.port : null, conversation })}\n`);
const stop = () => { server.close(() => { authority.close(); process.exit(0); }); server.closeAllConnections?.(); };
process.once('SIGINT', stop); process.once('SIGTERM', stop); process.once('SIGHUP', stop);

// Claude Stop and SessionStart(compact) hook. Writes one atomic, local receipt.
import { mkdirSync, writeFileSync, renameSync, readFileSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const name = process.env.INSTAR_SESSION_NAME;
const inbox = process.env.INSTAR_SESSION_INBOX;
if (!/^instar20-[a-f0-9]{24}$/.test(name ?? '') || !inbox?.startsWith('/')) process.exit(2);
let body = '';
for await (const part of process.stdin) {
  body += part;
  if (body.length > 65536) process.exit(2);
}
let parsed;
try { parsed = JSON.parse(body); } catch { process.exit(2); }
if (typeof parsed.session_id !== 'string') process.exit(2);
const kind = process.argv[2] === 'compact' ? 'compact' : 'turn-closed';
mkdirSync(inbox, { recursive: true, mode: 0o700 });
const filename = `${name}.${Date.now()}.${randomUUID()}.json`;
const temp = join(inbox, `${filename}.tmp`);
writeFileSync(temp, JSON.stringify({ kind, sessionId: parsed.session_id, at: Date.now() }), { mode: 0o600 });
const fd = openSync(temp, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
renameSync(temp, join(inbox, filename));
const directory = openSync(inbox, 'r'); try { fsyncSync(directory); } finally { closeSync(directory); }
if (kind === 'compact') {
  const path = process.env.INSTAR_SESSION_GROUNDING_FILE;
  if (!path?.startsWith('/')) process.exit(2);
  const context = readFileSync(path, 'utf8');
  if (!context || Buffer.byteLength(context) > 65536) process.exit(2);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'SessionStart', additionalContext: context,
  } }));
}

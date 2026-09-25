// Claude Code SessionStart hook for EVERY source (startup, resume, clear, compact).
// Injects the session's grounding file as additionalContext and writes one atomic
// `grounded` receipt records hook emission. The session owner separately records
// consumption; absence leaves recovery unconfirmed. Fail-open for session startup.
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_BYTES = 65_536;
export const MARKER = '=== INSTAR GROUNDING';
/** Must equal src/awareness/grounding.ts groundingDigest (tested). */
export function groundingDigest(text) {
  const stable = text.split('\n').filter((line, index) => !(index === 1 && line.startsWith('Trigger: '))).join('\n');
  return `sha256:${createHash('sha256').update(stable).digest('hex')}`;
}

async function main() {
  const name = process.env.INSTAR_SESSION_NAME ?? '';
  const inbox = process.env.INSTAR_SESSION_INBOX ?? '';
  const file = process.env.INSTAR_SESSION_GROUNDING_FILE ?? '';
  if (!/^instar20-[a-f0-9]{24}$/.test(name) || !inbox.startsWith('/') || !file.startsWith('/')) return;
  let body = '';
  for await (const part of process.stdin) { body += part; if (body.length > 65_536) return; }
  let hook;
  try { hook = JSON.parse(body); } catch { return; }
  const source = ['startup', 'resume', 'clear', 'compact'].includes(hook?.source) ? hook.source : 'unknown';
  const sessionId = typeof hook?.session_id === 'string' ? hook.session_id : null;
  mkdirSync(inbox, { recursive: true, mode: 0o700 });
  const resetId = randomUUID();
  const writeReceipt = row => {
    const receipt = `${name}.${Date.now()}.${randomUUID()}.json`;
    const temp = join(inbox, `${receipt}.tmp`);
    writeFileSync(temp, JSON.stringify({ ...row, sessionId, at: Date.now() }), { mode: 0o600 });
    const fd = openSync(temp, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, join(inbox, receipt));
    const dir = openSync(inbox, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
  };
  // The reset exists even when loading or injecting grounding fails.
  writeReceipt({ kind: 'context-reset', source, id: resetId });
  let text;
  try {
    if (!lstatSync(file).isFile() || lstatSync(file).size > MAX_BYTES) return;
    text = readFileSync(file, 'utf8');
  } catch { return; }
  if (!text.startsWith(MARKER)) return;
  const digest = groundingDigest(text);
  const lines = text.split('\n');
  if (lines[1]?.startsWith('Trigger: ')) lines[1] = lines[1].replace(/^Trigger: [a-z]+\./,
    `Trigger: SessionStart:${source}. Reset-ID ${resetId}. Injected ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`);
  const context = lines.join('\n');
  if (Buffer.byteLength(context) > MAX_BYTES) return;
  writeReceipt({ kind: 'grounded', source, digest, resetId });
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main().catch(() => { process.exitCode = 0; });

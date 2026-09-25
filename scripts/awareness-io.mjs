// Physical boundary for session awareness: per-claim grounding files, receipt reads,
// sentinel state and the signal log. Pure decisions live in src/awareness.
import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { groundingDigest, MAX_BYTES, MARKER } from './session-hooks/grounding.mjs';

export { groundingDigest };

function atomicWrite(directory, path, text) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, text, { mode: 0o600 });
  const fd = openSync(temp, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path);
  const dir = openSync(directory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
}

export function createAwarenessIO({ stateDirectory, inboxDirectory }) {
  for (const value of [stateDirectory, inboxDirectory])
    if (typeof value !== 'string' || !value.startsWith('/')) throw Error('absolute awareness paths required');
  const groundingDirectory = join(stateDirectory, 'grounding');
  mkdirSync(groundingDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(inboxDirectory, { recursive: true, mode: 0o700 });
  if (!lstatSync(groundingDirectory).isDirectory()) throw Error('grounding directory must be a real directory');
  const stateFile = join(stateDirectory, 'awareness-sentinel.json');
  const signalFile = join(stateDirectory, 'awareness-signals.jsonl');
  const groundingFileFor = claim => join(groundingDirectory, `${createHash('sha256').update(String(claim)).digest('hex').slice(0, 24)}.md`);
  return Object.freeze({
    groundingFileFor,
    writeGrounding(claim, text) {
      if (!text.startsWith(MARKER) || Buffer.byteLength(text) > MAX_BYTES) throw Error('refusing a non-grounding or oversize file');
      atomicWrite(groundingDirectory, groundingFileFor(claim), text);
      return groundingDigest(text);
    },
    readGroundingDigest(claim) {
      const path = groundingFileFor(claim);
      if (!existsSync(path)) return null;
      const text = readFileSync(path, 'utf8');
      return text.startsWith(MARKER) ? groundingDigest(text) : null;
    },
    readReceipts(name) {
      if (!/^instar20-[a-f0-9]{24}$/.test(name)) throw Error('invalid inbox session name');
      const rows = readdirSync(inboxDirectory).filter(file => file.startsWith(`${name}.`) && file.endsWith('.json')).sort().slice(-200)
        .flatMap(file => { try { return [JSON.parse(readFileSync(join(inboxDirectory, file), 'utf8'))]; } catch { return []; } })
        .filter(row => row && Number.isFinite(row.at));
      return {
        grounded: rows.filter(row => row.kind === 'grounded' && typeof row.digest === 'string')
          .map(row => ({ at: row.at, source: String(row.source), digest: row.digest, resetId: row.resetId, sessionId: row.sessionId })),
        contextConsumed: rows.filter(row => row.kind === 'context-consumed' && typeof row.digest === 'string')
          .map(row => ({ at: row.at, source: String(row.source), digest: row.digest, resetId: row.resetId, sessionId: row.sessionId })),
        resets: rows.filter(row => row.kind === 'context-reset' && typeof row.id === 'string')
          .map(row => ({ at: row.at, source: String(row.source), id: row.id, sessionId: row.sessionId })),
        deliveriesConsumed: rows.filter(row => row.kind === 'delivery-consumed' && typeof row.operation === 'string')
          .map(row => ({ at: row.at, operation: row.operation, lastInboundMessageId: row.lastInboundMessageId ?? null,
            sessionId: row.sessionId })),
        compactions: rows.filter(row => row.kind === 'compact').map(row => row.at),
        turnsClosed: rows.filter(row => row.kind === 'turn-closed').map(row => row.at),
      };
    },
    loadState() { return existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { sessions: [] }; },
    saveState(state) { atomicWrite(stateDirectory, stateFile, JSON.stringify(state)); },
    signal(row) { appendFileSync(signalFile, `${JSON.stringify(row)}\n`, { mode: 0o600 }); },
    readSignals() {
      return existsSync(signalFile) ? readFileSync(signalFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    },
  });
}

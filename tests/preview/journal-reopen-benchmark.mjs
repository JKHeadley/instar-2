/** Offline scaling probe for the real encrypted journal reader and compactor. */
import { createCipheriv } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, realpathSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { Session } from 'node:inspector';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(7);
const genesis = turns => ({ kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: turns * 3, maxReplies: turns, maxTurns: turns, maxBytes: 262144, cursor: 0 });

function frame(row, offset) {
  // Fixed nonce is safe only for this throwaway fixture: each AES-GCM key/nonce pair
  // is made unique by the offset-derived nonce. This key never protects live data.
  const nonce = Buffer.alloc(12);
  nonce.writeBigUInt64BE(BigInt(offset), 4);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`preview-journal:${offset}`));
  const body = Buffer.concat([cipher.update(JSON.stringify(row), 'utf8'), cipher.final()]);
  const sealed = Buffer.concat([nonce, cipher.getAuthTag(), body]);
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32BE(sealed.length);
  return Buffer.concat([prefix, sealed]);
}

function makeFixture(path, turns) {
  const fd = openSync(path, 'wx', 0o600);
  let offset = 0;
  const append = row => {
    const packet = frame(row, offset);
    let written = 0;
    while (written < packet.length) written += writeSync(fd, packet, written, packet.length - written, offset + written);
    offset += packet.length;
  };
  try {
    append(genesis(turns));
    for (let n = 1; n <= turns; n++) {
      const id = `telegram:12345678:update:${n}`;
      const text = `Synthetic turn ${n}: remember detail ${n % 97}.`;
      append({ kind: 'intake', id, update: n, text, raw: JSON.stringify({ update_id: n,
        message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } }),
      accepted: true, cursor: n + 1, at: 1000 + n * 10 });
      append({ kind: 'reserve', id, prompt: `Offline answer packet for ${n}: ${text}`, at: 1001 + n * 10 });
      append({ kind: 'answer', id, text: `Answer ${n}`, state: 'complete', at: 1002 + n * 10 });
      append({ kind: 'intent', id, text: `PREVIEW — Answer ${n}`, chat: '7654321', update: n,
        grant: 'grant:offline', at: 1003 + n * 10 });
      append({ kind: 'sent', id, message: n, at: 1004 + n * 10 });
      if (n % 4 === 0) {
        append({ kind: 'summary-reserve', through: n, prompt: `Summary through ${n}`, at: 1005 + n * 10 });
        append({ kind: 'summary', through: n, text: `Summary through ${n}`, state: 'complete', at: 1006 + n * 10 });
      }
    }
  } finally { closeSync(fd); }
}

const turns = Number(process.argv[2] ?? 10000);
if (![1000, 10000, 50000].includes(turns)) throw Error('expected 1000, 10000 or 50000 turns');
const root = realpathSync(mkdtempSync(join(tmpdir(), 'journal-reopen-scale-')));
const path = join(root, 'journal.encrypted');
const profileDir = process.env.JOURNAL_PROFILE_DIR;
async function profiled(label, work) {
  if (!profileDir) return work();
  const session = new Session();
  session.connect();
  await new Promise((resolve, reject) => session.post('Profiler.enable', error => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => session.post('Profiler.start', error => error ? reject(error) : resolve()));
  try { return work(); }
  finally {
    const profile = await new Promise((resolve, reject) => session.post('Profiler.stop', (error, result) => error ? reject(error) : resolve(result.profile)));
    writeFileSync(join(profileDir, `${turns}-${label}.cpuprofile`), JSON.stringify(profile));
    session.disconnect();
  }
}
try {
  makeFixture(path, turns);
  const rawBytes = statSync(path).size;
  if (global.gc) global.gc();
  const rawBefore = process.memoryUsage();
  const rawStart = performance.now();
  const raw = await profiled('raw-open', () => openPreviewJournal(path, key, undefined, undefined, true));
  const rawMs = performance.now() - rawStart;
  const rawAfter = process.memoryUsage();
  if (raw.view.order.length !== turns || raw.view.summaries.length !== turns / 4) throw Error('raw replay differed');
  raw.close();
  if (global.gc) global.gc();
  const writer = openPreviewJournal(path, key, undefined, undefined, false, Number.MAX_SAFE_INTEGER);
  await profiled('compact', () => writer.compact()); writer.close();
  const compactBytes = statSync(path).size;
  if (global.gc) global.gc();
  const before = process.memoryUsage();
  const start = performance.now();
  const replay = await profiled('compacted-open', () => openPreviewJournal(path, key, undefined, undefined, true));
  const openMs = performance.now() - start;
  if (replay.view.order.length !== turns || replay.view.summaries.length !== turns / 4
    || replay.view.order.at(-1)?.sent !== turns || replay.view.cursor !== turns + 1)
    throw Error('compacted replay differed');
  const after = process.memoryUsage();
  replay.close();
  process.stdout.write(`${JSON.stringify({ turns, rawBytes, rawMs: Number(rawMs.toFixed(1)),
    rawHeapDeltaMb: Number(((rawAfter.heapUsed - rawBefore.heapUsed) / 1048576).toFixed(1)),
    compactBytes, openMs: Number(openMs.toFixed(1)),
    heapDeltaMb: Number(((after.heapUsed - before.heapUsed) / 1048576).toFixed(1)),
    rssDeltaMb: Number(((after.rss - before.rss) / 1048576).toFixed(1)),
    peakRssMb: Number((process.resourceUsage().maxRSS / 1024).toFixed(1)) })}\n`);
} finally { rmSync(root, { recursive: true, force: true }); }

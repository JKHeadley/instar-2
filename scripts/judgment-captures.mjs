import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Local capture custody, not a second judgment journal. No raw network reads,
// deletion, timeout retention or automatic pin release. Files are content-addressed.
export function createJudgmentCaptures(directory, metadata, result, capacity = 1048576, decodeCaptures = {}) {
  const root = join(directory, 'captures'); mkdirSync(root, { recursive: true });
  const hash = bytes => `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;
  const path = cap => {
    if (!/^sha256:[a-f0-9]{64}$/.test(cap.hash) || cap.reference !== `judgment-capture:${cap.hash}`) throw new Error('invalid local capture reference');
    return join(root, cap.hash.slice(7));
  };
  const read = cap => {
    const file = path(cap);
    if (!existsSync(file)) { metadata[cap.reference] = { hash: cap.hash, bytes: null, byteLength: 0, status: 'missing' }; delete decodeCaptures[cap.reference]; throw new Error('local capture missing'); }
    const bytes = readFileSync(file, 'utf8'); if (hash(bytes) !== cap.hash) throw new Error('local capture hash mismatch');
    metadata[cap.reference] = { hash: cap.hash, bytes, byteLength: Buffer.byteLength(bytes), status: 'available' };
    decodeCaptures[cap.reference] = bytes;
    return bytes;
  };
  // Reconstruct metadata from signed fact references, not a mutable capture index.
  const journal = join(directory, 'facts.json');
  if (existsSync(journal)) for (const fact of JSON.parse(readFileSync(journal, 'utf8'))) {
    const row = fact.body?.record;
    if (String(fact.kind).startsWith('judgment-')) for (const key of ['question', 'context', 'submitted', 'receipt']) {
      if (row?.[key]) { try { read(row[key]); } catch { /* Historical status stays missing; authoritative use refuses. */ } }
    }
  }
  return Object.freeze({ owner: 'part-ten', read: cap => result(() => read(cap)),
    put: (bytes, maxBytes) => result(() => {
      if (typeof bytes !== 'string' || !Number.isSafeInteger(maxBytes) || maxBytes < 0 || Buffer.byteLength(bytes) > maxBytes) throw new Error('capture byte bound');
      if (!Number.isSafeInteger(capacity) || capacity < 0) throw new Error('finite capture capacity required');
      const cap = { reference: `judgment-capture:${hash(bytes)}`, hash: hash(bytes) }, file = path(cap);
      const lock = join(root, 'capture.lock'); mkdirSync(lock);
      try {
        if (!existsSync(file)) {
          const used = readdirSync(root).filter(n => /^[a-f0-9]{64}$/.test(n)).reduce((n, f) => n + statSync(join(root, f)).size, 0);
          if (used + Buffer.byteLength(bytes) > capacity) throw new Error('capture capacity exhausted; existing evidence retained');
          const fd = openSync(file, 'wx', 0o600);
          try { writeFileSync(fd, bytes, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
          const dir = openSync(root, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
        }
        if (read(cap) !== bytes) throw new Error('capture collision'); return cap;
      } finally { rmdirSync(lock); }
    }),
  });
}

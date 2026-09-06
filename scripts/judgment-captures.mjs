import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Local capture custody, not a second judgment journal. No raw network reads,
// deletion, timeout retention or automatic pin release. Files are content-addressed.
export function createJudgmentCaptures(directory, metadata, result, capacity = 1048576, decodeCaptures = {}) {
  const root = join(directory, 'captures'); mkdirSync(root, { recursive: true });
  const slots = join(root, 'capacity'); mkdirSync(slots, { recursive: true });
  const issued = new WeakSet();
  const syncDir = dir => { const fd = openSync(dir, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
  const locked = run => { const lock = join(root, 'capture.lock'); mkdirSync(lock); try { return run(); } finally { rmdirSync(lock); } };
  const writeRecord = (file, record) => {
    const temporary = join(slots, `${randomUUID()}.pending`), fd = openSync(temporary, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify(record)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, file); syncDir(slots);
  };
  // Every writer of this custody directory shares one durable capacity ceiling.
  locked(() => {
    if (!Number.isSafeInteger(capacity) || capacity < 0) throw new Error('finite capture capacity required');
    const policy = join(slots, 'policy.json');
    if (!existsSync(policy)) writeRecord(policy, { capacity });
    if (JSON.parse(readFileSync(policy, 'utf8')).capacity !== capacity) throw new Error('capture capacity policy differs');
    syncDir(root); syncDir(directory);
  });
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
  const reservations = () => readdirSync(slots).filter(n => n.endsWith('.json') && n !== 'policy.json').map(n => {
    const r = JSON.parse(readFileSync(join(slots, n), 'utf8'));
    if (n !== `${r.id}.json` || !Number.isSafeInteger(r.maxBytes) || r.maxBytes < 0 || (r.hash !== null && !/^sha256:[a-f0-9]{64}$/.test(r.hash)))
      throw new Error('invalid capture capacity commitment');
    return r;
  });
  const used = () => {
    const held = reservations(), covered = new Set(held.map(r => r.hash?.slice(7)));
    const files = readdirSync(root).filter(n => /^[a-f0-9]{64}$/.test(n) && !covered.has(n));
    return held.reduce((n, r) => n + r.maxBytes, 0) + files.reduce((n, f) => n + statSync(join(root, f)).size, 0);
  };
  const checkBytes = (bytes, maxBytes) => {
    if (typeof bytes !== 'string' || !Number.isSafeInteger(maxBytes) || maxBytes < 0 || Buffer.byteLength(bytes) > maxBytes) throw new Error('capture byte bound');
  };
  const capture = bytes => { const h = hash(bytes); return { reference: `judgment-capture:${h}`, hash: h }; };
  const writeCapture = (bytes, cap) => {
    const file = path(cap);
    if (!existsSync(file)) {
      const fd = openSync(file, 'wx', 0o600);
      try { writeFileSync(fd, bytes, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
      syncDir(root);
    }
    if (read(cap) !== bytes) throw new Error('capture collision'); return cap;
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
    reserve: maxBytes => result(() => locked(() => {
      if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('positive finite receipt capacity required');
      if (used() + maxBytes > capacity) throw new Error('capture capacity exhausted; receipt capacity must precede invocation');
      const token = Object.freeze({ id: randomUUID(), maxBytes });
      writeRecord(join(slots, `${token.id}.json`), { ...token, hash: null }); issued.add(token); return token;
    })),
    putReserved: (token, bytes) => result(() => locked(() => {
      if (!issued.has(token)) throw new Error('unissued receipt capacity commitment');
      checkBytes(bytes, token.maxBytes);
      const file = join(slots, `${token.id}.json`), slot = JSON.parse(readFileSync(file, 'utf8')), cap = capture(bytes);
      if (slot.id !== token.id || slot.maxBytes !== token.maxBytes || (slot.hash !== null && slot.hash !== cap.hash)) throw new Error('receipt capacity already bound to different bytes');
      // Bind the content before writing it. The FULL reserved budget stays held
      // even after receipt capture (no release API). General writers exclude
      // this exact hash from used bytes, because the durable slot already pays
      // for it. Crashes can strand capacity, never make it appear free again.
      if (slot.hash === null) writeRecord(file, { ...slot, hash: cap.hash });
      return writeCapture(bytes, cap);
    })),
    put: (bytes, maxBytes) => result(() => {
      checkBytes(bytes, maxBytes); const cap = capture(bytes), file = path(cap);
      return locked(() => {
        if (!existsSync(file)) {
          if (used() + Buffer.byteLength(bytes) > capacity) throw new Error('capture capacity exhausted; existing evidence retained');
        }
        return writeCapture(bytes, cap);
      });
    }),
  });
}

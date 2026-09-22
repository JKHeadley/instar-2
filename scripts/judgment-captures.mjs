import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';

// Local capture custody, not a second judgment journal. No raw network reads,
// deletion, timeout retention or automatic pin release. Files are content-addressed.
export function createJudgmentCaptures(directory, metadata, result, capacity = 1048576, decodeCaptures = {}) {
  const root = join(directory, 'captures'); mkdirSync(root, { recursive: true });
  const slots = join(root, 'capacity'); mkdirSync(slots, { recursive: true });
  const issued = new WeakSet();
  const syncDir = dir => { const fd = openSync(dir, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
  const lock = join(root, 'capture.lock');
  const reapDeadOwner = () => {
    const names = readdirSync(lock);
    // Empty/partial/legacy/foreign locks are ambiguous, not proof of quiescence.
    // They block writes, never opening or reading existing receipts below.
    if (names.length !== 1 || !/^owner-[a-f0-9-]{36}\.json$/.test(names[0])) throw new Error('capture writer owner unknown');
    const marker = join(lock, names[0]), owner = JSON.parse(readFileSync(marker, 'utf8'));
    if (owner.host !== hostname() || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || names[0] !== `owner-${owner.id}.json`)
      throw new Error('capture writer owner unknown');
    try { process.kill(owner.pid, 0); throw new Error('capture writer still live'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    // Only the remover of this UNIQUE owner's marker may remove the now-empty
    // directory. A competing reaper loses at unlink (ENOENT) and cannot remove a
    // replacement owner's lock. No age timeout or blind recursive deletion.
    unlinkSync(marker); rmdirSync(lock); syncDir(root);
  };
  const locked = run => {
    try { mkdirSync(lock); }
    catch (error) { if (error.code !== 'EEXIST') throw error; reapDeadOwner(); mkdirSync(lock); }
    const owner = { id: randomUUID(), pid: process.pid, host: hostname() }, marker = join(lock, `owner-${owner.id}.json`);
    try {
      const fd = openSync(marker, 'wx', 0o600);
      try { writeFileSync(fd, JSON.stringify(owner)); fsyncSync(fd); } finally { closeSync(fd); }
      syncDir(lock); syncDir(root);
      ensurePolicy(); return run();
    } finally { if (existsSync(marker)) unlinkSync(marker); rmdirSync(lock); }
  };
  const writeRecord = (file, record) => {
    const temporary = join(slots, `${randomUUID()}.pending`), fd = openSync(temporary, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify(record)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, file); syncDir(slots);
  };
  if (!Number.isSafeInteger(capacity) || capacity < 0) throw new Error('finite capture capacity required');
  // Policy initialization belongs to exclusive WRITE admission. Reopening the
  // read capability must not acquire a writer lock, including after SIGKILL in
  // mkdir before an owner could be recorded, or during stale-lock reclamation.
  const ensurePolicy = () => {
    const policy = join(slots, 'policy.json');
    if (!existsSync(policy)) writeRecord(policy, { capacity });
    if (JSON.parse(readFileSync(policy, 'utf8')).capacity !== capacity) throw new Error('capture capacity policy differs');
    syncDir(root); syncDir(directory);
  };
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
  const reservations = () => readdirSync(slots).filter(n => n.endsWith('.json') && n !== 'policy.json' && !n.endsWith('.release.json')).map(n => {
    const r = JSON.parse(readFileSync(join(slots, n), 'utf8'));
    if (n !== `${r.id}.json` || !Number.isSafeInteger(r.maxBytes) || r.maxBytes < 0 || (r.hash !== null && !/^sha256:[a-f0-9]{64}$/.test(r.hash)))
      throw new Error('invalid capture capacity commitment');
    return r;
  });
  const used = () => {
    const held = reservations(), charged = held.filter(r => {
      const releaseFile = join(slots, `${r.id}.release.json`);
      if (!existsSync(releaseFile)) return true;
      const marker = JSON.parse(readFileSync(releaseFile, 'utf8'));
      if (marker.id !== r.id || marker.maxBytes !== r.maxBytes || r.hash !== null)
        throw new Error('invalid or bound capture capacity release');
      return false;
    }), covered = new Set(held.map(r => r.hash?.slice(7)));
    const files = readdirSync(root).filter(n => /^[a-f0-9]{64}$/.test(n) && !covered.has(n));
    return charged.reduce((n, r) => n + r.maxBytes, 0) + files.reduce((n, f) => n + statSync(join(root, f)).size, 0);
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
      if (existsSync(join(slots, `${token.id}.release.json`))) throw new Error('released receipt capacity commitment');
      if (slot.id !== token.id || slot.maxBytes !== token.maxBytes || (slot.hash !== null && slot.hash !== cap.hash)) throw new Error('receipt capacity already bound to different bytes');
      // Bind the content before writing it. The FULL reserved budget stays held
      // even after receipt capture (no release API). General writers exclude
      // this exact hash from used bytes, because the durable slot already pays
      // for it. Crashes can strand capacity, never make it appear free again.
      if (slot.hash === null) writeRecord(file, { ...slot, hash: cap.hash });
      return writeCapture(bytes, cap);
    })),
    releaseReserved: token => result(() => locked(() => {
      if (!issued.has(token)) throw new Error('unissued receipt capacity commitment');
      const file = join(slots, `${token.id}.json`), slot = JSON.parse(readFileSync(file, 'utf8'));
      if (slot.id !== token.id || slot.maxBytes !== token.maxBytes) throw new Error('receipt capacity commitment changed');
      const releaseFile = join(slots, `${token.id}.release.json`);
      if (existsSync(releaseFile)) {
        const marker = JSON.parse(readFileSync(releaseFile, 'utf8'));
        if (marker.id !== token.id || marker.maxBytes !== token.maxBytes) throw new Error('capture capacity release changed');
        return;
      }
      if (slot.hash !== null) throw new Error('bound receipt capacity cannot be released');
      writeRecord(releaseFile, { id: token.id, maxBytes: token.maxBytes });
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

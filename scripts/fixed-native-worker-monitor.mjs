// Fixed monitor wire and journal primitives. The installed service must refuse
// launch until the genuine cross-process owner reader and native guard are bound.
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, fsyncSync, openSync, readFileSync, readSync, writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { canonicalText } from '../dist/decode/canonical.js';

// The strict v1 wire codec is S8's (src/assembly/production-launch-boundary.ts);
// this service imports the built bytes instead of keeping a second copy.
export { MONITOR_MAX_FRAME as MAX_FRAME, monitorFrame as frame, monitorUnframe as unframe,
  monitorRequest as request, monitorReceipt as receipt, monitorLaunchIdentity as launchIdentity,
  signMonitorReply as signReply, verifyMonitorReply as verifyReply } from '../dist/assembly/production-launch-boundary.js';
import { MONITOR_MAX_FRAME as MAX_FRAME, monitorFrame as frame, monitorUnframe as unframe } from '../dist/assembly/production-launch-boundary.js';

function assert(condition, message) { if (!condition) throw Error(message); }
function id(value) { return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 512; }
function nonnegative(value) { return Number.isSafeInteger(value) && value >= 0; }

// Testable journal cut. fsync is sufficient for offline crash modeling only.
// Installed power-loss durability requires the native F_FULLFSYNC path.
export class OfflineJournal {
  constructor(path, limit = 16 * 1024 * 1024) {
    assert(typeof path === 'string' && path.length > 0 && nonnegative(limit), 'invalid journal');
    this.path = path; this.limit = limit; this.entries = [];
    if (existsSync(path)) this.reopen();
  }
  reopen() {
    const bytes = readFileSync(this.path);
    assert(bytes.length <= this.limit, 'journal-full');
    const entries = []; let offset = 0; let sequence = 0;
    while (offset < bytes.length) {
      assert(offset + 4 <= bytes.length, 'journal-untrusted');
      const length = bytes.readUInt32BE(offset); offset += 4;
      assert(length > 0 && length <= MAX_FRAME && offset + length + 32 <= bytes.length,
        'journal-untrusted');
      const payload = bytes.subarray(offset, offset + length); offset += length;
      const checksum = bytes.subarray(offset, offset + 32); offset += 32;
      assert(createHash('sha256').update(payload).digest().equals(checksum), 'journal-untrusted');
      const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload));
      assert(canonicalText(value) === payload.toString('utf8')
        && value.sequence === ++sequence, 'journal-untrusted');
      entries.push(value);
    }
    this.entries = entries; return entries;
  }
  append(kind, identity, value) {
    assert(['dispatch-decided', 'armed', 'released', 'terminal'].includes(kind)
      && id(identity), 'invalid journal entry');
    const entry = { sequence: this.entries.length + 1, kind, identity, value };
    const payload = Buffer.from(canonicalText(entry));
    assert(payload.length <= MAX_FRAME, 'journal record too large');
    const packet = Buffer.alloc(4 + payload.length + 32);
    packet.writeUInt32BE(payload.length); payload.copy(packet, 4);
    createHash('sha256').update(payload).digest().copy(packet, 4 + payload.length);
    let size = 0;
    if (existsSync(this.path)) {
      const readFd = openSync(this.path, 'r');
      try { size = fstatSync(readFd).size; } finally { closeSync(readFd); }
    }
    assert(size + packet.length <= this.limit, 'journal-full');
    const fd = openSync(this.path, 'a', 0o600);
    try { assert(writeSync(fd, packet) === packet.length, 'short journal append'); fsyncSync(fd); }
    finally { closeSync(fd); }
    this.entries.push(entry); return entry;
  }
  original(identity) { return this.entries.find(row => row.kind === 'dispatch-decided' && row.identity === identity) ?? null; }
  decide(identity, originalKey, value) {
    assert(id(originalKey), 'invalid original key');
    const existing = this.entries.find(row => row.kind === 'dispatch-decided'
      && (row.identity === identity || row.value?.originalKey === originalKey));
    if (existing) {
      assert(existing.identity === identity && canonicalText(existing.value) === canonicalText({ originalKey, value }),
        'original launch conflicts');
      return { entry: existing, newDecision: false };
    }
    return { entry: this.append('dispatch-decided', identity, { originalKey, value }), newDecision: true };
  }
}

// ---- S8's installed synchronous client ---------------------------------------

/** MonitorClientPort over the pinned enforcer's unprivileged `client` role: one
 * frame on stdin, one bounded reply on stdout, 1,000 ms. Any failure refuses;
 * there is no retry, no shell and no local worker-spawn fallback. */
export function createMonitorClient(enforcerPath) {
  assert(typeof enforcerPath === 'string' && isAbsolute(enforcerPath), 'absolute pinned enforcer path required');
  return Object.freeze({ exchange(requestBytes) {
    try {
      return execFileSync(enforcerPath, ['client'], { input: Buffer.from(requestBytes), timeout: 1_000,
        maxBuffer: MAX_FRAME + 4, env: {}, stdio: ['pipe', 'pipe', 'ignore'], shell: false });
    } catch { throw Error('monitor client refused'); }
  } });
}

// ---- worker channel (seam 3) -------------------------------------------------

/** Owner-side host IO over the monitor's end of the one inherited channel. The
 * descriptor is non-blocking (the supervisor sets O_NONBLOCK before exec). */
export function createChannelIO(fd) {
  assert(Number.isSafeInteger(fd) && fd >= 0, 'channel descriptor required');
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  let open = true;
  return Object.freeze({
    read(max) {
      if (!open) return new Uint8Array(0);
      const buffer = Buffer.alloc(max);
      try { const n = readSync(fd, buffer, 0, max, null); return buffer.subarray(0, n); }
      catch (error) { if (error.code === 'EAGAIN' || error.code === 'EWOULDBLOCK') return null; throw error; }
    },
    write(bytes) {
      let offset = 0;
      while (offset < bytes.length) {
        try { offset += writeSync(fd, bytes, offset, bytes.length - offset); }
        catch (error) { if (error.code !== 'EAGAIN') throw error; Atomics.wait(sleeper, 0, 0, 1); }
      }
    },
    close() { if (open) { open = false; try { closeSync(fd); } catch { /* already closed */ } } },
    now: () => Number(process.hrtime.bigint() / 1_000_000n),
    wait: ms => Atomics.wait(sleeper, 0, 0, ms),
  });
}

function readExact(fd, length) {
  const buffer = Buffer.alloc(length); let offset = 0;
  while (offset < length) {
    const n = readSync(fd, buffer, offset, length - offset, null);
    if (n === 0) throw Error('channel closed');
    offset += n;
  }
  return buffer;
}

/**
 * The fixed loading-worker role (runs confined, fd 3 only). It pulls exactly one
 * admitted delivery chunk by chunk, verifies each chunk is the next offset of
 * the same delivery, returns the digest of the bytes it actually read, and
 * exits. It has no other method, path, URL or command.
 */
export function runLoadingWorker({ fd = 3, handle, delivery }) {
  assert(id(handle) && id(delivery), 'fixed handle and delivery required');
  let sequence = 0, offset = 0, total = null;
  const chunks = [];
  const send = body => {
    const bytes = frame({ v: 1, sequence: ++sequence, handle, method: 'loadContext',
      authorityReference: delivery, body });
    let written = 0;
    while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written);
  };
  const receive = () => {
    const header = readExact(fd, 4), length = header.readUInt32BE(0);
    assert(length > 0 && length <= MAX_FRAME, 'invalid reply length');
    return unframe(Buffer.concat([header, readExact(fd, length)]));
  };
  for (;;) {
    const complete = total !== null && offset === total;
    const received = complete ? Buffer.concat(chunks) : null;
    send({ delivery, offset, readback: complete
      ? `sha256:${createHash('sha256').update(received).digest('hex')}` : null });
    const reply = receive();
    assert(reply.v === 1 && reply.sequence === sequence, 'reply sequence differs');
    if (reply.disposition === 'accepted') { assert(complete, 'accepted before complete input'); return 0; }
    assert(reply.disposition === 'data' && reply.body.delivery === delivery && reply.body.offset === offset,
      'unexpected channel reply');
    const bytes = Buffer.from(reply.body.bytes, 'base64');
    assert(bytes.toString('base64') === reply.body.bytes && bytes.length > 0 && bytes.length <= 32_768, 'invalid chunk');
    assert(total === null || total === reply.body.totalBytes, 'delivery length changed');
    total = reply.body.totalBytes; chunks.push(bytes); offset += bytes.length;
    assert(offset <= total, 'delivery overrun');
  }
}

// Fixed package entry mode (not a remote selector): `loading-worker <handle> <delivery>`.
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'loading-worker') {
  try { process.exitCode = runLoadingWorker({ handle: process.argv[3], delivery: process.argv[4] }); }
  catch { process.exitCode = 3; }
}

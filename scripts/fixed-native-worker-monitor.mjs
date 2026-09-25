// Fixed monitor wire and journal primitives. The installed service must refuse
// launch until the genuine cross-process owner reader and native guard are bound.
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, fsyncSync, openSync, readFileSync, readSync, unlinkSync, writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { canonicalText } from '../dist/decode/canonical.js';

// The strict v1 wire codec is S8's (src/assembly/production-launch-boundary.ts);
// this service imports the built bytes instead of keeping a second copy.
export { MONITOR_MAX_FRAME as MAX_FRAME, monitorFrame as frame, monitorUnframe as unframe,
  monitorRequest as request, monitorReceipt as receipt, monitorLaunchIdentity as launchIdentity,
  signMonitorReply as signReply, verifyMonitorReply as verifyReply } from '../dist/assembly/production-launch-boundary.js';
import { MONITOR_MAX_FRAME as MAX_FRAME, monitorFrame as frame, monitorUnframe as unframe, monitorRequest,
  monitorLaunchIdentity, signMonitorReply } from '../dist/assembly/production-launch-boundary.js';
import { consumeResult } from '../dist/index.js';

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
    if (!existsSync(this.path)) { this.entries = []; return this.entries; }  // no decision yet
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

// ---- launch/observe service (M1) ---------------------------------------------

/**
 * Offline cross-process exclusion around a journal decision: an O_EXCL lock
 * file, re-read of the journal under the lock, decide, release the lock. A
 * lock left by a crashed holder is NOT reclaimed automatically (maintenance
 * decides), so it refuses rather than risk a second release. The installed
 * build must use M2's native exclusive lock + F_FULLFSYNC primitive.
 */
function withJournalLock(journal, run, waitMs = 1_000) {
  const lock = `${journal.path}.lock`, sleeper = new Int32Array(new SharedArrayBuffer(4));
  const end = Date.now() + waitMs;
  let fd;
  for (;;) {
    try { fd = openSync(lock, 'wx', 0o600); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= end) throw Error('journal-untrusted');
      Atomics.wait(sleeper, 0, 0, 5);
    }
  }
  try { journal.reopen(); return run(); }
  finally { closeSync(fd); unlinkSync(lock); }
}

/**
 * The fixed launch/observe decision service. `context` is the fixed installed
 * reader (createProductionMonitorContext); `release` is the native release leaf
 * (M2). Either absent refuses BEFORE any dispatch decision exists. Once a
 * decision is durable, every later answer for that original tuple is the
 * retained receipt or `unknown`; recovery never releases again.
 */
export function createMonitorService(config) {
  const { installation, machine, bootId, digests, clockReference, now, keyId, privateKey, journal } = config;
  assert(id(installation) && id(machine) && id(bootId) && id(keyId) && journal instanceof OfflineJournal,
    'monitor service configuration incomplete');
  const base = (request, fields) => ({
    installation: request.installation, machine: request.machine, bootId: null,
    releaseDigest: digests.releaseDigest, request: request.body.request, operation: request.body.operation,
    digest: request.body.digest,
    claim: request.method === 'launch' ? request.body.claim : null,
    consumed: request.method === 'launch' ? request.body.consumed : null,
    specification: request.method === 'launch' ? request.body.specification : null,
    launchIdentity: null, uid: null, pid: null, processStartIdentity: null,
    artifactDigest: digests.artifactDigest, profileDigest: digests.profileDigest,
    handlePolicyDigest: digests.handlePolicyDigest, limitsDigest: digests.limitsDigest,
    originalDeadline: null, state: 'unknown', reason: 'not-observed', sequence: journal.entries.length,
    observedAt: { clockReference, value: now() }, freshForMs: 1_000, currentBootId: bootId,
    evidenceReferences: [], ...fields });
  const owner = (result) => consumeResult(result, { Success: value => ({ ok: true, value }),
    Refused: refusal => ({ ok: false, detail: refusal.detail }) });
  const originalKey = request => `${request.installation}/${request.body.request}/${request.body.operation}`;
  const retained = key => {
    const decided = journal.entries.find(row => row.kind === 'dispatch-decided' && row.value.originalKey === key);
    if (!decided) return null;
    const released = journal.entries.filter(row => row.kind === 'released' && row.identity === decided.identity).at(-1);
    return { decided, receipt: released?.value.receipt ?? null };
  };
  const launch = request => {
    if (request.installation !== installation || request.machine !== machine)
      return base(request, { state: 'refused-before-release', reason: 'binding' });
    const key = originalKey(request);
    let decision;
    try {
      decision = withJournalLock(journal, () => {
        const prior = retained(key);
        if (prior) {
          if (canonicalText(prior.decided.value.value.body) !== canonicalText(request.body))
            return { reply: base(request, { state: 'unknown', reason: 'binding' }) };          // conflicting duplicate
          return { reply: prior.receipt ?? base(request, { state: 'unknown', reason: 'identity-unknown',
            launchIdentity: prior.decided.identity }) };                                      // same body: original only
        }
        if (!config.context) return { reply: base(request, { state: 'refused-before-release', reason: 'authority' }) };
        const resolved = owner(config.context.resolveLaunch(request.body));
        if (!resolved.ok) return { reply: base(request, { state: 'refused-before-release', reason: 'authority' }) };
        if (!config.release) return { reply: base(request, { state: 'refused-before-release', reason: 'unsupported' }) };
        const identity = monitorLaunchIdentity(request, bootId);
        journal.decide(identity, key, { body: request.body, bundle: resolved.value.bundle });  // durable BEFORE any child
        return { identity, closure: resolved.value };
      });
    } catch (error) {
      const reason = /journal-full/.test(error.message) ? 'journal-full' : 'journal-untrusted';
      return base(request, { state: retained(key) ? 'unknown' : 'refused-before-release', reason });
    }
    if (decision.reply) return decision.reply;
    // Decided. From here a failure is uncertainty, never permission to retry.
    const current = owner(config.context.recheck(decision.closure));
    if (!current.ok) return base(request, { state: 'unknown', reason: 'authority', launchIdentity: decision.identity });
    let evidence;
    try { evidence = config.release.start(decision.closure, decision.identity); }
    catch { return base(request, { state: 'unknown', reason: 'guard-lost', launchIdentity: decision.identity }); }
    const receipt = base(request, { state: 'running', reason: 'ok', bootId, launchIdentity: decision.identity,
      uid: evidence.uid, pid: evidence.pid, processStartIdentity: evidence.processStartIdentity,
      originalDeadline: evidence.originalDeadline, evidenceReferences: evidence.evidenceReferences });
    try { journal.append('released', decision.identity, { receipt }); } catch { /* retained as uncertainty */ }
    return receipt;
  };
  const observe = request => {
    if (request.installation !== installation || request.machine !== machine)
      return base(request, { reason: 'binding' });
    if (!config.context || !owner(config.context.resolveObservation(request.body)).ok)
      return base(request, { reason: 'authority' });                                  // no private receipt disclosed
    const prior = retained(originalKey(request));
    if (!prior) return base(request, { reason: 'not-observed' });                     // absence is not non-occurrence
    if (request.body.launchIdentity !== null && request.body.launchIdentity !== prior.decided.identity)
      return base(request, { reason: 'binding' });
    const state = config.release?.observe(prior.decided.identity) ?? null;
    if (!state || !prior.receipt) return base(request, { reason: 'not-observed', launchIdentity: prior.decided.identity });
    return { ...prior.receipt, state: state.state, reason: state.reason,
      evidenceReferences: state.evidenceReferences ?? prior.receipt.evidenceReferences,
      sequence: journal.entries.length, observedAt: { clockReference, value: now() } };
  };
  return Object.freeze({
    /** One canonical request frame in, one signed reply frame out. Invalid input throws (connection closes). */
    handle(requestBytes) {
      const request = monitorRequest(unframe(Buffer.from(requestBytes)));
      const receipt = request.method === 'launch' ? launch(request) : observe(request);
      return frame(signMonitorReply(request, receipt, keyId, privateKey));
    },
  });
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

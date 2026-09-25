// Fixed monitor wire and journal primitives. The installed service must refuse
// launch until the genuine cross-process owner reader and native guard are bound.
import { createHash, sign, verify } from 'node:crypto';
import { closeSync, existsSync, fstatSync, fsyncSync, openSync, readFileSync, readSync, writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalText, hashText } from '../dist/decode/canonical.js';

export const MAX_FRAME = 65_536;
const receiptDomain = 'instar2-worker-monitor/receipt/v1\n';
const hex64 = /^[a-f0-9]{64}$/;
const hash = /^sha256:[a-f0-9]{64}$/;
const states = new Set(['refused-before-release', 'running', 'exited', 'expired', 'stopped', 'unknown']);
const reasons = new Set(['ok', 'authority', 'binding', 'capacity', 'deadline', 'stop',
  'guard-lost', 'worker-exit', 'journal-full', 'journal-untrusted', 'identity-unknown',
  'unsupported', 'not-observed']);
const requestFields = ['body', 'challenge', 'installation', 'machine', 'method', 'v'];
const launchFields = ['claim', 'consumed', 'digest', 'operation', 'request', 'specification'];
const observeFields = ['digest', 'launchIdentity', 'observationAuthority', 'operation', 'request'];
const replyFields = ['challenge', 'keyId', 'receipt', 'requestHash', 'signature', 'v'];
const receiptFields = ['artifactDigest', 'bootId', 'claim', 'consumed', 'currentBootId',
  'digest', 'evidenceReferences', 'freshForMs', 'handlePolicyDigest', 'installation',
  'launchIdentity', 'limitsDigest', 'machine', 'observedAt', 'operation',
  'originalDeadline', 'pid', 'processStartIdentity', 'profileDigest', 'reason',
  'releaseDigest', 'request', 'sequence', 'specification', 'state', 'uid'];

function assert(condition, message) { if (!condition) throw Error(message); }
function exact(value, fields) {
  assert(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === fields.slice().sort().join(','), 'closed shape required');
}
function id(value) { return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 512; }
function digest(value) { return typeof value === 'string' && hash.test(value); }
function unsigned(value) { return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value); }
function nonnegative(value) { return Number.isSafeInteger(value) && value >= 0; }
function nullable(value, predicate) { return value === null || predicate(value); }

export function frame(value) {
  const bytes = Buffer.from(canonicalText(value), 'utf8');
  assert(bytes.length <= MAX_FRAME, 'frame too large');
  const result = Buffer.allocUnsafe(bytes.length + 4);
  result.writeUInt32BE(bytes.length);
  bytes.copy(result, 4);
  return result;
}

export function unframe(input) {
  assert(Buffer.isBuffer(input) && input.length >= 4, 'truncated frame');
  const length = input.readUInt32BE(0);
  assert(length <= MAX_FRAME && input.length === length + 4, 'invalid frame length');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(4));
  const value = JSON.parse(text);
  assert(canonicalText(value) === text, 'noncanonical frame');
  return value;
}

export function request(input) {
  exact(input, requestFields);
  assert(input.v === 1 && (input.method === 'launch' || input.method === 'observe'),
    'unsupported method');
  assert(hex64.test(input.challenge) && id(input.installation) && id(input.machine),
    'invalid request envelope');
  const body = input.body;
  exact(body, input.method === 'launch' ? launchFields : observeFields);
  assert(id(body.request) && id(body.operation) && digest(body.digest), 'invalid operation identity');
  if (input.method === 'launch')
    assert(id(body.specification) && id(body.claim) && id(body.consumed), 'incomplete launch locators');
  else assert(id(body.observationAuthority)
    && nullable(body.launchIdentity, digest), 'incomplete observation locators');
  return input;
}

export function receipt(input) {
  exact(input, receiptFields);
  for (const field of ['installation', 'machine', 'bootId', 'request',
    'operation', 'claim', 'consumed', 'specification', 'currentBootId'])
    assert(nullable(input[field], id), `invalid receipt ${field}`);
  for (const field of ['releaseDigest', 'digest', 'launchIdentity',
    'artifactDigest', 'profileDigest', 'handlePolicyDigest', 'limitsDigest'])
    assert(nullable(input[field], digest), `invalid receipt ${field}`);
  assert(nullable(input.uid, nonnegative) && nullable(input.pid, nonnegative)
    && nonnegative(input.sequence) && nonnegative(input.freshForMs)
    && input.freshForMs <= 1000 && states.has(input.state) && reasons.has(input.reason),
  'invalid receipt observation');
  exact(input.observedAt, ['clockReference', 'value']);
  assert(id(input.observedAt.clockReference) && Number.isFinite(input.observedAt.value),
    'invalid observation clock');
  if (input.originalDeadline !== null) {
    exact(input.originalDeadline, ['bootId', 'continuousTicks', 'ownerClockReference',
      'ownerValidUntil', 'timebaseDenom', 'timebaseNumer']);
    assert(id(input.originalDeadline.bootId) && id(input.originalDeadline.ownerClockReference)
      && Number.isFinite(input.originalDeadline.ownerValidUntil)
      && unsigned(input.originalDeadline.continuousTicks)
      && unsigned(input.originalDeadline.timebaseNumer)
      && unsigned(input.originalDeadline.timebaseDenom)
      && input.originalDeadline.timebaseDenom !== '0', 'invalid original deadline');
  }
  if (input.processStartIdentity !== null) {
    exact(input.processStartIdentity, ['bootId', 'startTicks', 'uniqueId']);
    assert(id(input.processStartIdentity.bootId) && unsigned(input.processStartIdentity.startTicks)
      && unsigned(input.processStartIdentity.uniqueId), 'invalid process identity');
  }
  assert(Array.isArray(input.evidenceReferences) && input.evidenceReferences.length <= 64
    && input.evidenceReferences.every(id), 'invalid evidence references');
  if (['running', 'exited', 'expired', 'stopped'].includes(input.state))
    assert(input.launchIdentity !== null && input.originalDeadline !== null
      && input.uid !== null && input.pid !== null && input.processStartIdentity !== null
      && input.bootId === input.processStartIdentity.bootId
      && input.evidenceReferences.length > 0, 'attributable process evidence required');
  return input;
}

export function launchIdentity(input, originalBootId) {
  request(input);
  assert(input.method === 'launch' && id(originalBootId), 'launch identity requires original boot');
  const body = input.body;
  return hashText(canonicalText(['instar2-worker-monitor/v1', input.installation, input.machine,
    originalBootId, body.request, body.operation, body.digest, body.specification,
    body.claim, body.consumed]));
}

export function signReply(input, record, keyId, privateKey) {
  request(input); receipt(record);
  assert(id(keyId), 'invalid key ID');
  const requestHash = hashText(canonicalText(input));
  const signed = Buffer.from(receiptDomain + canonicalText([record, input.challenge, requestHash]));
  return Object.freeze({ v: 1, challenge: input.challenge, requestHash, keyId,
    receipt: record, signature: sign(null, signed, privateKey).toString('base64') });
}

export function verifyReply(input, reply, trust) {
  request(input); exact(reply, replyFields); receipt(reply.receipt);
  exact(trust, ['artifactDigest', 'authorityValidUntil', 'clockReference', 'currentBootId',
    'handlePolicyDigest', 'keyId', 'limitsDigest', 'millisecondsPerUnit', 'now',
    'profileDigest', 'publicKey', 'releaseDigest']);
  assert(reply.v === 1 && reply.challenge === input.challenge
    && reply.requestHash === hashText(canonicalText(input)) && reply.keyId === trust.keyId,
  'reply request or trust binding differs');
  assert(reply.receipt.installation === input.installation && reply.receipt.machine === input.machine
    && reply.receipt.request === input.body.request
    && reply.receipt.operation === input.body.operation && reply.receipt.digest === input.body.digest,
  'reply subject differs');
  if (input.method === 'launch')
    assert(reply.receipt.specification === input.body.specification
      && reply.receipt.claim === input.body.claim && reply.receipt.consumed === input.body.consumed,
    'launch subject differs');
  if (input.method === 'launch' && reply.receipt.bootId !== null
    && reply.receipt.launchIdentity !== null)
    assert(reply.receipt.launchIdentity === launchIdentity(input, reply.receipt.bootId),
      'original launch identity differs');
  else if (input.body.launchIdentity !== null)
    assert(reply.receipt.launchIdentity === input.body.launchIdentity, 'launch identity differs');
  for (const field of ['artifactDigest', 'handlePolicyDigest', 'limitsDigest',
    'profileDigest', 'releaseDigest', 'currentBootId'])
    assert(reply.receipt[field] === trust[field], `trusted ${field} differs`);
  assert(reply.receipt.observedAt.clockReference === trust.clockReference
    && Number.isFinite(trust.now) && Number.isFinite(trust.authorityValidUntil)
    && Number.isFinite(trust.millisecondsPerUnit) && trust.millisecondsPerUnit > 0
    && trust.now >= reply.receipt.observedAt.value
    && (trust.now - reply.receipt.observedAt.value) * trust.millisecondsPerUnit <= reply.receipt.freshForMs
    && trust.now <= trust.authorityValidUntil, 'receipt observation is stale, future or unauthorized');
  assert(typeof reply.signature === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(reply.signature),
    'invalid signature encoding');
  const signature = Buffer.from(reply.signature, 'base64');
  assert(signature.toString('base64') === reply.signature, 'noncanonical signature');
  const signed = Buffer.from(receiptDomain
    + canonicalText([reply.receipt, reply.challenge, reply.requestHash]));
  assert(verify(null, signed, trust.publicKey, signature), 'invalid receipt signature');
  return reply.receipt;
}

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

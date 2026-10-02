/**
 * Rules 2, 7, 31, 32, 63, 95, 113 — the smallest replication of the preview journal to one peer machine.
 *
 * The purpose document: once a second machine is enrolled, `replicated(1)` is the default demand, and an
 * irreversible act needs "an acknowledged copy on that second independently failing machine" before
 * dispatch; local durability is never selected automatically when the peer is lost. Design 06 names the
 * mechanism (peers receive the segment slice, verify it and acknowledge); design 12 §5 lets causal
 * predecessors covered by one verified durable prefix share its acknowledgement. The smallest form of
 * that for the preview's one append-only sealed journal:
 *
 *   - the OWNER ships the journal file's sealed bytes, in order, to the other machine (`createJournalShipper`);
 *   - the PEER appends them to its copy, checks the whole-prefix digest, fsyncs, and returns an
 *     acknowledgement authenticated with the two machines' shared secret (`openReplicaStore`);
 *   - a send waits until the acknowledgement covers the journal through that send's signed intent
 *     (`awaitReplicated`), so a reply's whole causal record is on two machines before it is sent;
 *   - a machine that takes the conversation over continues from the newest copy it holds
 *     (`adoptReceivedCopy`), so the successor has the history, and its own older journal is set aside
 *     as a file, never deleted.
 *
 * One lineage, one writer: only the lease holder writes the journal; the other machine holds the copy.
 * The journal's compaction rewrites the file; the first frame's bytes change with it, so the copy is
 * re-sent whole into a second file and replaces the old copy only once it is complete.
 *
 * Fail directions (Rule 95): no acknowledgement means the send waits (never a fallback to local
 * durability); a copy that does not verify refuses takeover rather than serving from older history.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Hash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, ftruncateSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync,
  statSync, unlinkSync, writeSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { basename, dirname, join } from 'node:path';
import type { AuthorityClient, ClaimOutcome, Fence } from './conversation-authority.js';
import { durablePreviewWrite } from './durable-write.js';
import type { LeaseHolder } from './two-machine-serving.js';

/** The peer's complete copy: which lineage (`mark`), how many bytes, their digest, and who sent them under which lease epoch. */
export type CopyState = Readonly<{ epoch: number; machine: string; mark: string; size: number; digest: string }>;
export type ReplicaRequest =
  | { op: 'state'; nonce: string }
  | { op: 'append'; nonce: string; epoch: number; machine: string; mark: string; offset: number; bytes: string; digest: string; final: boolean };
export type ReplicaRefusal = 'owner' | 'stale' | 'same-machine' | 'offset' | 'digest' | 'invalid' | 'damaged' | 'unauthorized' | 'unreachable';
export type ReplicaAnswer =
  | Readonly<{ ok: true; machine: string; copy: CopyState | null; nonce: string; mac: string }>
  | Readonly<{ ok: false; reason: ReplicaRefusal }>;
export interface ReplicaClient { request(request: ReplicaRequest): Promise<ReplicaAnswer> }
export interface ReplicaStore {
  readonly conversation: string;
  handle(request: ReplicaRequest): ReplicaAnswer;
  /** The complete copy this machine holds, or null. */
  copy(): CopyState | null;
  readonly copyPath: string;
  /** Detected loss (Rule 2): a recorded copy whose bytes no longer match its record. */
  damaged(): string | null;
  /** This machine became the owner: it stops accepting the other machine's bytes. */
  seal(): void;
  close(): void;
}

export const REPLICA_CHUNK_BYTES = 256 * 1024;
const MARK_BYTES = 32;
const sha = () => createHash('sha256');
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const hex64 = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
/** A journal generation's identity: the digest of its first frame's leading bytes (length, nonce, tag). */
export const markOf = (leading: Uint8Array) => sha().update(leading.subarray(0, MARK_BYTES)).digest('hex');
const acknowledgement = (secret: string, conversation: string, machine: string, nonce: string, copy: CopyState | null) =>
  createHmac('sha256', secret).update(JSON.stringify([conversation, machine, nonce,
    copy ? [copy.epoch, copy.machine, copy.mark, copy.size, copy.digest] : null])).digest('hex');
const syncDirectory = (directory: string) => { const fd = openSync(directory, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
const hashFile = (path: string, bytes: number): Hash => {
  const hash = sha(), fd = openSync(path, 'r'), buffer = Buffer.alloc(Math.min(1024 * 1024, Math.max(1, bytes)));
  try {
    for (let at = 0; at < bytes;) {
      const read = readSync(fd, buffer, 0, Math.min(buffer.length, bytes - at), at);
      if (read === 0) throw Error('journal replication: file shorter than recorded');
      hash.update(buffer.subarray(0, read)); at += read;
    }
  } finally { closeSync(fd); }
  return hash;
};

/** The receiving side: one complete copy (`journal.copy`) plus, during a whole re-send, a second file that
 * replaces it only when complete. Every accepted chunk is fsynced, and its record made durable, before the answer. */
export function openReplicaStore(input: Readonly<{ directory: string; conversation: string; machine: string; secret: string }>): ReplicaStore {
  if (!text(input.conversation, 200) || !text(input.machine, 120) || input.secret.length < 16)
    throw Error('journal replication: invalid configuration');
  mkdirSync(input.directory, { recursive: true, mode: 0o700 });
  const copyPath = join(input.directory, 'journal.copy'), nextPath = `${copyPath}.next`, statePath = join(input.directory, 'copy-state.json');
  let copy: CopyState | null = null, copyHash: Hash | null = null, damaged: string | null = null, sealed = false;
  let next: { mark: string; size: number; hash: Hash } | null = null;
  // A whole re-send cut off by a restart starts again from zero: its partial file is never a copy.
  if (existsSync(nextPath)) unlinkSync(nextPath);
  if (existsSync(statePath)) {
    try {
      const saved = JSON.parse(readFileSync(statePath, 'utf8')) as { conversation?: unknown } & Partial<CopyState>;
      if (saved.conversation !== input.conversation || !count(saved.epoch) || !text(saved.machine, 120) || !hex64(saved.mark)
        || !count(saved.size) || !hex64(saved.digest)) throw Error('record malformed');
      const size = statSync(copyPath).size;
      if (size < saved.size) throw Error('copy shorter than its record');
      // Bytes past the record were written but never acknowledged: cut, exactly like a torn tail.
      if (size > saved.size) { const fd = openSync(copyPath, 'r+'); try { ftruncateSync(fd, saved.size); fsyncSync(fd); } finally { closeSync(fd); } }
      const hash = hashFile(copyPath, saved.size);
      if (hash.copy().digest('hex') !== saved.digest) throw Error('copy differs from its record');
      copy = Object.freeze({ epoch: saved.epoch, machine: saved.machine, mark: saved.mark, size: saved.size, digest: saved.digest });
      copyHash = hash;
    } catch (error) { damaged = error instanceof Error ? error.message : 'unreadable'; }
  }
  const record = (state: CopyState) => durablePreviewWrite(statePath, { conversation: input.conversation, ...state });
  const answer = (nonce: string): ReplicaAnswer => ({ ok: true, machine: input.machine, copy, nonce,
    mac: acknowledgement(input.secret, input.conversation, input.machine, nonce, copy) });
  const write = (path: string, flags: string, offset: number, bytes: Buffer) => {
    const fd = openSync(path, flags, 0o600);
    try {
      if (flags === 'r+') ftruncateSync(fd, offset);
      let written = 0; while (written < bytes.length) written += writeSync(fd, bytes, written, bytes.length - written, offset + written);
      fsyncSync(fd);
    } finally { closeSync(fd); }
  };
  const cut = (path: string, size: number) => { const fd = openSync(path, 'r+'); try { ftruncateSync(fd, size); fsyncSync(fd); } finally { closeSync(fd); } };
  function handle(request: ReplicaRequest): ReplicaAnswer {
    if (sealed) return { ok: false, reason: 'owner' };
    if (damaged) return { ok: false, reason: 'damaged' };
    if (!text(request?.nonce, 64)) return { ok: false, reason: 'invalid' };
    if (request.op === 'state') return answer(request.nonce);
    if (request.op !== 'append' || !count(request.epoch) || !text(request.machine, 120) || !hex64(request.mark) || !count(request.offset)
      || !hex64(request.digest) || typeof request.final !== 'boolean' || typeof request.bytes !== 'string') return { ok: false, reason: 'invalid' };
    // A second process on the same machine is not a peer (the purpose document).
    if (request.machine === input.machine) return { ok: false, reason: 'same-machine' };
    if (copy && request.epoch < copy.epoch) return { ok: false, reason: 'stale' };
    const bytes = Buffer.from(request.bytes, 'base64');
    if (bytes.length === 0 || bytes.length > REPLICA_CHUNK_BYTES || bytes.toString('base64') !== request.bytes) return { ok: false, reason: 'invalid' };
    if (copy && copyHash && copy.mark === request.mark && request.offset === copy.size) {
      // The ordinary case: the next bytes of the copy this machine already holds.
      const hash = copyHash.copy().update(bytes), digest = hash.copy().digest('hex');
      if (digest !== request.digest) return { ok: false, reason: 'digest' };
      write(copyPath, 'r+', copy.size, bytes);
      copy = Object.freeze({ epoch: request.epoch, machine: request.machine, mark: copy.mark, size: copy.size + bytes.length, digest });
      copyHash = hash; record(copy);
      return answer(request.nonce);
    }
    if (request.offset === 0) {
      // A whole re-send (a first copy, a compacted journal, or a different lineage) goes to a second file.
      if (bytes.length < MARK_BYTES || markOf(bytes) !== request.mark) return { ok: false, reason: 'invalid' };
      next = { mark: request.mark, size: 0, hash: sha() };
      write(nextPath, 'w', 0, Buffer.alloc(0));
    } else if (!next || next.mark !== request.mark || request.offset !== next.size) return { ok: false, reason: 'offset' };
    const hash = next.hash.copy().update(bytes), digest = hash.copy().digest('hex');
    if (digest !== request.digest) { cut(nextPath, next.size); return { ok: false, reason: 'digest' }; }
    write(nextPath, 'r+', next.size, bytes);
    next = { mark: next.mark, size: next.size + bytes.length, hash };
    if (request.final) {
      // Complete: it replaces the old copy in one rename. The old copy's content lives on in the sender's lineage.
      renameSync(nextPath, copyPath); syncDirectory(input.directory);
      copy = Object.freeze({ epoch: request.epoch, machine: request.machine, mark: next.mark, size: next.size, digest });
      copyHash = next.hash; next = null; record(copy);
    }
    return answer(request.nonce);
  }
  return Object.freeze({ conversation: input.conversation, copyPath,
    handle(request: ReplicaRequest): ReplicaAnswer {
      try { return handle(request); } catch (error) { damaged ??= error instanceof Error ? error.message : 'write failed'; return { ok: false, reason: 'damaged' }; }
    },
    copy: () => copy, damaged: () => damaged, seal() { sealed = true; }, close() { sealed = true; } });
}

const MAX_BODY = 512 * 1024;
const tokenMatches = (header: string | undefined, token: string) => {
  const supplied = Buffer.from(header ?? '', 'utf8'), expected = Buffer.from(`Bearer ${token}`, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};

/** The receiving side's network face: one POST route, the shared bearer secret, a bounded body. */
export function serveReplicaStore(input: Readonly<{ store: ReplicaStore; token: string; host: string; port: number }>): Promise<Server> {
  if (input.token.length < 16) throw Error('journal replication: the shared secret is too short');
  const server = createServer((request, response) => {
    const reply = (status: number, answer: ReplicaAnswer) => {
      response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(answer));
    };
    if (request.method !== 'POST' || request.url !== '/journal-replica') { reply(404, { ok: false, reason: 'invalid' }); request.resume(); return; }
    if (!tokenMatches(request.headers.authorization, input.token)) { reply(401, { ok: false, reason: 'unauthorized' }); request.resume(); return; }
    const chunks: Buffer[] = []; let size = 0, refused = false;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY && !refused) { refused = true; reply(413, { ok: false, reason: 'invalid' }); request.destroy(); }
      else if (!refused) chunks.push(chunk);
    });
    request.on('end', () => {
      if (refused) return;
      let body: { conversation?: unknown; request?: ReplicaRequest };
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as typeof body; } catch { reply(400, { ok: false, reason: 'invalid' }); return; }
      if (body.conversation !== input.store.conversation) { reply(409, { ok: false, reason: 'invalid' }); return; }
      reply(200, input.store.handle(body.request as ReplicaRequest));
    });
  });
  return new Promise((done, fail) => { server.once('error', fail); server.listen(input.port, input.host, () => done(server)); });
}

/** The sending side's network face. Any failure to obtain a well-formed answer is `unreachable`, never success. */
export function connectReplicaPeer(input: Readonly<{ url: string; token: string; conversation: string; timeoutMs: number;
  fetch?: typeof fetch }>): ReplicaClient {
  const call = input.fetch ?? fetch;
  return Object.freeze({ async request(request: ReplicaRequest): Promise<ReplicaAnswer> {
    try {
      const response = await call(`${input.url.replace(/\/$/u, '')}/journal-replica`, { method: 'POST',
        headers: { authorization: `Bearer ${input.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ conversation: input.conversation, request }), signal: AbortSignal.timeout(input.timeoutMs) });
      const answer = await response.json() as ReplicaAnswer;
      return typeof answer === 'object' && answer !== null && typeof answer.ok === 'boolean' ? answer : { ok: false, reason: 'unreachable' };
    } catch { return { ok: false, reason: 'unreachable' }; }
  } });
}
export const localReplicaClient = (store: ReplicaStore): ReplicaClient =>
  Object.freeze({ request: async (request: ReplicaRequest) => store.handle(request) });

/** A point in the journal: the generation it was taken in and the bytes it must cover. */
export type ReplicationToken = Readonly<{ generation: number; size: number }>;
export type PeerStatus = Readonly<{ current: boolean; reason: string; acknowledgedBytes: number; journalBytes: number; lastContactMs: number | null }>;
export interface JournalShipper {
  /** Send what the peer lacks. Never throws; a failure is the status reason. */
  pump(): Promise<void>;
  /** The journal as of now. */
  token(): ReplicationToken;
  /** True when the peer's complete copy holds every byte of the token (or a later generation's whole file). */
  covers(token: ReplicationToken): boolean;
  /** The peer answered within `freshMs` and holds the whole journal. */
  status(freshMs: number): PeerStatus;
}

/** The owner's side. `size()` is the journal's committed size (complete frames only); the file is read up to it. */
export function createJournalShipper(input: Readonly<{ path: string; size: () => number; peer: ReplicaClient; conversation: string;
  machine: string; secret: string; epoch: () => number | null; monotonic: () => number; chunkBytes?: number }>): JournalShipper {
  const chunkBytes = Math.min(input.chunkBytes ?? REPLICA_CHUNK_BYTES, REPLICA_CHUNK_BYTES);
  let generation = 0, mark: string | null = null, synced = false, offset = 0, hash: Hash = sha();
  let acknowledged: { generation: number; size: number; digest: string } | null = null;
  let lastContact: number | null = null, reason = 'not yet contacted', busy: Promise<void> | null = null, failures = 0, retryAt = 0;
  const readAt = (at: number, length: number) => {
    const buffer = Buffer.alloc(length), fd = openSync(input.path, 'r');
    try { let read = 0; while (read < length) { const got = readSync(fd, buffer, read, length - read, at + read); if (got === 0) break; read += got; }
      if (read !== length) throw Error('journal shorter than its committed size'); } finally { closeSync(fd); }
    return buffer;
  };
  /** A compaction rewrote the journal: a new generation, sent whole. */
  const refresh = () => {
    if (input.size() < MARK_BYTES) return;
    const now = markOf(readAt(0, MARK_BYTES));
    if (now !== mark) { mark = now; generation += 1; synced = false; }
  };
  const failed = (why: string) => {
    synced = false; reason = why; failures += 1;
    // Rule 55: an absent peer is asked again with backoff, never in a tight loop.
    retryAt = input.monotonic() + Math.min(15_000, 250 * 2 ** Math.min(failures - 1, 6));
  };
  const ask = async (request: ReplicaRequest): Promise<Extract<ReplicaAnswer, { ok: true }> | null> => {
    const answer = await input.peer.request(request);
    if (!answer.ok) { failed(answer.reason === 'same-machine' ? 'the other end reports this same machine; a second process here is not a peer'
      : answer.reason === 'owner' ? 'the other machine is serving as the owner' : `the other machine refused: ${answer.reason}`); return null; }
    const expected = Buffer.from(acknowledgement(input.secret, input.conversation, String(answer.machine), request.nonce, answer.copy ?? null), 'hex');
    const supplied = Buffer.from(typeof answer.mac === 'string' ? answer.mac : '', 'hex');
    if (answer.nonce !== request.nonce || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      failed('the acknowledgement did not authenticate'); return null; }
    if (answer.machine === input.machine) { failed('the other end reports this same machine; a second process here is not a peer'); return null; }
    lastContact = input.monotonic();
    return answer;
  };
  const nonce = () => randomBytes(12).toString('hex');
  const run = async () => {
    const epoch = input.epoch();
    if (epoch === null) { reason = 'this runner does not hold the conversation'; return; }
    if (input.monotonic() < retryAt) return;
    refresh();
    if (mark === null) { reason = 'the journal is empty'; return; }
    if (!synced || offset >= input.size()) {
      // What does the peer hold? A copy that is a byte-prefix of this journal is continued; anything else is re-sent whole.
      const answer = await ask({ op: 'state', nonce: nonce() });
      if (!answer) return;
      const held = answer.copy;
      refresh();
      if (synced && held && acknowledged?.generation === generation && held.mark === mark && held.size === acknowledged.size
        && held.digest === acknowledged.digest) { /* the peer still holds exactly what it acknowledged */ }
      else {
        const prefix = held && held.mark === mark && held.size <= input.size() ? hashFile(input.path, held.size) : null;
        if (held && prefix && prefix.copy().digest('hex') === held.digest) {
          offset = held.size; hash = prefix; acknowledged = { generation, size: held.size, digest: held.digest };
        } else { offset = 0; hash = sha(); if (acknowledged?.generation === generation) acknowledged = null; }
      }
      synced = true;
    }
    while (offset < input.size()) {
      const sent = generation;
      refresh();
      if (generation !== sent) return;
      const size = input.size(), length = Math.min(chunkBytes, size - offset), bytes = readAt(offset, length);
      const forward = hash.copy().update(bytes), digest = forward.copy().digest('hex');
      const answer = await ask({ op: 'append', nonce: nonce(), epoch, machine: input.machine, mark, offset,
        bytes: bytes.toString('base64'), digest, final: offset + length === size });
      if (!answer) return;
      refresh();
      if (generation !== sent) return;
      hash = forward; offset += length;
      const held = answer.copy;
      if (held && held.mark === mark && held.size === offset && held.digest === digest) acknowledged = { generation, size: offset, digest };
      else if (offset === size) { failed('the other machine\'s copy did not match after a complete send'); return; }
    }
    failures = 0; retryAt = 0;
    reason = acknowledged?.generation === generation && acknowledged.size >= input.size() ? 'acknowledged' : 'sending';
  };
  const covers = (token: ReplicationToken) => acknowledged !== null
    && (acknowledged.generation > token.generation || acknowledged.generation === token.generation && acknowledged.size >= token.size);
  return Object.freeze({
    pump: () => busy ??= run().catch(error => { failed(error instanceof Error ? error.message : 'send failed'); }).finally(() => { busy = null; }),
    token: () => { refresh(); return Object.freeze({ generation, size: input.size() }); },
    covers,
    status(freshMs: number): PeerStatus {
      const journalBytes = input.size(), whole = covers({ generation, size: journalBytes });
      const fresh = lastContact !== null && input.monotonic() - lastContact <= freshMs;
      return Object.freeze({ current: whole && fresh, reason: whole && fresh ? 'acknowledged' : whole ? 'the other machine has not answered recently' : reason,
        acknowledgedBytes: acknowledged?.generation === generation ? acknowledged.size : 0, journalBytes,
        lastContactMs: lastContact === null ? null : Math.max(0, Math.round(input.monotonic() - lastContact)) });
    } });
}

export const REPLICATION_UNMET = 'the other machine did not acknowledge the record before dispatch';
/** The dispatch gate. Resolves null once the peer's copy covers `token`; otherwise the refusal `refusal()` names
 * (stop, expiry, ownership lost) or, for a bounded wait, `REPLICATION_UNMET`. It never falls back to local durability. */
export async function awaitReplicated(input: Readonly<{ token: ReplicationToken; shipper: Pick<JournalShipper, 'pump' | 'covers'>;
  refusal: () => string | null; sleep: (ms: number) => Promise<void>; elapsed: () => number; maxWaitMs?: number;
  waiting?: () => void }>): Promise<string | null> {
  const started = input.elapsed();
  for (let attempt = 0; ; attempt++) {
    const refused = input.refusal();
    if (refused !== null) return refused;
    await input.shipper.pump();
    if (input.shipper.covers(input.token)) return null;
    if (input.maxWaitMs !== undefined && input.elapsed() - started >= input.maxWaitMs) return REPLICATION_UNMET;
    input.waiting?.();
    await input.sleep(Math.min(5000, 250 * 2 ** Math.min(attempt, 5)));
  }
}

export type DispatchOutcome = Readonly<{ kind: 'refused' | 'unknown'; reason: string }>;
export interface ReplicatedDispatch {
  /** The dispatch gate, immediately before a physical send: null admits it; anything else is its closed outcome. */
  admit(target: string, refusal: () => string | null, maxWaitMs?: number): Promise<DispatchOutcome | null>;
  /** The same demand for a provider call (its reservation row is in the journal): null once the peer holds the
   * journal as of now; otherwise the refusal `refusal()` names. No claim: a call is not a conversation send. */
  replicated(refusal: () => string | null): Promise<string | null>;
  /** Records what happened to an admitted send; an unreachable authority is retried by `flush`. */
  outcome(target: string, kind: 'accepted' | 'refused' | 'unknown'): Promise<void>;
  /** Retries outcomes the authority has not recorded yet. */
  flush(): Promise<void>;
  /** Moves the shared cursor to `cursor` once the peer holds the journal through `token`; returns the settled cursor. */
  settle(token: ReplicationToken, cursor: number): Promise<number>;
  readonly cursor: number;
  readonly waiting: number;
}

/**
 * The owner's admission point for a conversation served by two machines (Rule 63 and the replicated(1) default):
 * first the other machine must hold the journal through this send's intent, then the one dispatch-claim for the
 * target is taken under the current fence. A target another runner already claimed is never sent again, even when
 * its outcome is unknown (design 10 §4). An unreachable authority is waited out; a stale fence is a refusal.
 */
export function createReplicatedDispatch(input: Readonly<{ authority: AuthorityClient; lease: Pick<LeaseHolder, 'fence' | 'drop'>;
  shipper: Pick<JournalShipper, 'pump' | 'covers' | 'token'>; cursor: number; sleep: (ms: number) => Promise<void>; elapsed: () => number;
  waiting?: () => void }>): ReplicatedDispatch {
  const claims = new Map<string, Fence>(), unrecorded: { fence: Fence; key: string; state: ClaimOutcome }[] = [];
  let cursor = input.cursor, waiting = 0;
  const LOST = 'conversation ownership lost before dispatch';
  return Object.freeze({
    get cursor() { return cursor; }, get waiting() { return waiting; },
    async admit(target: string, refusal: () => string | null, maxWaitMs?: number): Promise<DispatchOutcome | null> {
      waiting += 1;
      try {
        const unmet = await awaitReplicated({ token: input.shipper.token(), shipper: input.shipper, refusal, sleep: input.sleep,
          elapsed: input.elapsed, ...(maxWaitMs === undefined ? {} : { maxWaitMs }), ...(input.waiting ? { waiting: input.waiting } : {}) });
        if (unmet !== null) return { kind: 'refused', reason: unmet };
        for (let attempt = 0; ; attempt++) {
          const refused = refusal(), held = input.lease.fence();
          if (refused !== null || !held) return { kind: 'refused', reason: refused ?? LOST };
          const claim = await input.authority.request({ op: 'claim', fence: held, key: target });
          if (claim.ok) { claims.set(target, held); return null; }
          if (claim.reason === 'already-claimed')
            return { kind: 'unknown', reason: `another runner already claimed this send (${claim.state ?? 'claimed'}); it is not sent again` };
          if (claim.reason === 'stale') { input.lease.drop(); return { kind: 'refused', reason: LOST }; }
          if (claim.reason !== 'unreachable') return { kind: 'refused', reason: `the conversation authority refused the dispatch-claim (${claim.reason})` };
          await input.sleep(Math.min(5000, 250 * 2 ** Math.min(attempt, 5)));
        }
      } finally { waiting -= 1; }
    },
    async replicated(refusal: () => string | null): Promise<string | null> {
      waiting += 1;
      try { return await awaitReplicated({ token: input.shipper.token(), shipper: input.shipper, refusal, sleep: input.sleep,
        elapsed: input.elapsed, ...(input.waiting ? { waiting: input.waiting } : {}) }); }
      finally { waiting -= 1; }
    },
    async outcome(target: string, kind: 'accepted' | 'refused' | 'unknown'): Promise<void> {
      const held = claims.get(target);
      if (!held) return;
      claims.delete(target);
      const record = { fence: held, key: target, state: kind === 'accepted' ? 'sent' as const : kind };
      const answer = await input.authority.request({ op: 'outcome', ...record });
      if (!answer.ok && answer.reason === 'unreachable') unrecorded.push(record);
    },
    async flush(): Promise<void> {
      for (const pending of [...unrecorded]) {
        const answer = await input.authority.request({ op: 'outcome', ...pending });
        if (answer.ok || answer.reason !== 'unreachable') unrecorded.splice(unrecorded.indexOf(pending), 1);
      }
    },
    async settle(token: ReplicationToken, next: number): Promise<number> {
      const held = input.lease.fence();
      // The cursor passes an update only once the other machine holds its intake record: Telegram may then drop it.
      if (held && next > cursor && input.shipper.covers(token)) {
        const answer = await input.authority.request({ op: 'settle', fence: held, cursor: next });
        if (answer.ok) cursor = next; else if (answer.reason === 'stale') input.lease.drop();
      }
      return cursor;
    } });
}

/** Which lease epoch this machine last wrote the journal under. Present only on a machine enrolled in the shared history. */
export type Lineage = Readonly<{ epoch: number; seeded?: true; adopted?: Readonly<{ machine: string; epoch: number; size: number; digest: string }> }>;
const lineagePath = (root: string) => join(root, 'journal-lineage.json');
export function readLineage(root: string): Lineage | null {
  if (!existsSync(lineagePath(root))) return null;
  const saved = JSON.parse(readFileSync(lineagePath(root), 'utf8')) as Lineage;
  if (!count(saved?.epoch)) throw Error('journal replication: lineage record malformed');
  return saved;
}
/** Journals this machine set aside when it adopted the other machine's newer copy: kept, never deleted (Rule 7). */
export const setAsideJournals = (journalPath: string): string[] => {
  try { return readdirSync(dirname(journalPath)).filter(name => name.startsWith(`${basename(journalPath)}.set-aside-`)).sort(); }
  catch { return []; }
};
export type TakeoverResult = Readonly<{ ok: true; how: 'continued' | 'adopted' | 'seeded'; setAside?: string }> | Readonly<{ ok: false; reason: string }>;

/** May this machine serve at all? Decided BEFORE asking for the lease, so an ineligible machine never churns epochs. */
export function takeoverEligibility(input: Readonly<{ root: string; store: Pick<ReplicaStore, 'copy' | 'damaged'> }>):
  { eligible: true } | { eligible: false; reason: string; seedable: boolean } {
  if (input.store.damaged()) return { eligible: false, reason: `the copy received from the other machine is damaged (${input.store.damaged()})`, seedable: false };
  if (readLineage(input.root) !== null || input.store.copy() !== null) return { eligible: true };
  return { eligible: false, seedable: true,
    reason: 'this machine holds no enrolled copy of the conversation history; it waits to receive one from the other machine' };
}

/**
 * Run after the lease is granted (fence epoch `epoch`) and before the journal is opened for writing.
 *   - a received copy from a LATER epoch than this machine last wrote under is the newer history: it is verified
 *     by a full replay (`verify` throws otherwise), this machine's journal is set aside, and the copy installed;
 *   - otherwise this machine's own enrolled journal continues;
 *   - `seed` enrolls this machine's journal (or a new one) as the shared history, only for the first lease ever.
 */
export function adoptReceivedCopy(input: Readonly<{ root: string; journalPath: string; store: Pick<ReplicaStore, 'copy' | 'copyPath' | 'damaged'>;
  epoch: number; seed: boolean; verify: (path: string) => void }>): TakeoverResult {
  if (input.store.damaged()) return { ok: false, reason: `the copy received from the other machine is damaged (${input.store.damaged()})` };
  const lineage = readLineage(input.root), copy = input.store.copy(), present = existsSync(input.journalPath);
  if (copy && copy.epoch > (lineage?.epoch ?? -1)) {
    try { input.verify(input.store.copyPath); }
    catch { return { ok: false, reason: 'the newer copy received from the other machine does not verify; serving from older history is refused' }; }
    let setAside: string | undefined;
    if (present) {
      const taken = new Set(setAsideJournals(input.journalPath));
      let name = `${basename(input.journalPath)}.set-aside-${String(input.epoch)}`;
      for (let n = 2; taken.has(name); n++) name = `${basename(input.journalPath)}.set-aside-${String(input.epoch)}-${String(n)}`;
      renameSync(input.journalPath, join(dirname(input.journalPath), name)); syncDirectory(dirname(input.journalPath));
      setAside = name;
    }
    const staging = `${input.journalPath}.adopting`, bytes = readFileSync(input.store.copyPath).subarray(0, copy.size);
    if (sha().update(bytes).digest('hex') !== copy.digest) return { ok: false, reason: 'the copy changed while it was being installed' };
    if (existsSync(staging)) unlinkSync(staging);
    const fd = openSync(staging, 'wx', 0o600);
    try { let written = 0; while (written < bytes.length) written += writeSync(fd, bytes, written); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(staging, input.journalPath); syncDirectory(dirname(input.journalPath));
    durablePreviewWrite(lineagePath(input.root), { epoch: input.epoch,
      adopted: { machine: copy.machine, epoch: copy.epoch, size: copy.size, digest: copy.digest } });
    return { ok: true, how: 'adopted', ...(setAside ? { setAside } : {}) };
  }
  if (lineage) {
    // Rule 2: an enrolled machine whose journal is gone has lost history; it never starts a fresh one over it.
    if (!present) return { ok: false, reason: 'the journal this machine was enrolled with is missing' };
    if (lineage.epoch !== input.epoch) durablePreviewWrite(lineagePath(input.root), { ...lineage, epoch: input.epoch });
    return { ok: true, how: 'continued' };
  }
  if (input.seed && input.epoch === 1) {
    durablePreviewWrite(lineagePath(input.root), { epoch: 1, seeded: true });
    return { ok: true, how: 'seeded' };
  }
  return { ok: false, reason: input.seed ? 'seeding is only for the first lease ever; this machine must receive the history from the other machine'
    : 'this machine holds no enrolled copy of the conversation history' };
}

/** Read-only summary for the status pull: null when this root was never part of a two-machine conversation. */
export function sharedHistoryStatus(root: string, journalPath: string): Record<string, unknown> | null {
  const read = (path: string) => { try { return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>; } catch { return null; } };
  const lineage = read(lineagePath(root)), copy = read(join(root, 'replica', 'copy-state.json')), replication = read(join(root, 'replication.json'));
  const setAside = setAsideJournals(journalPath);
  if (!lineage && !copy && !replication && !setAside.length) return null;
  return { lineage, copy: copy && { epoch: copy.epoch, machine: copy.machine, size: copy.size }, replication, setAside };
}

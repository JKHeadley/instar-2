/**
 * Rules 31, 63, 95, 113 — the shared conversation authority for a two-machine preview.
 *
 * Design 10 (§2, §3, §4, §9, §16): conversation ownership is a lease issued only by a committed
 * conditional transition at ONE serialized authority, with a monotonic epoch that a restore never
 * resets. Every dispatch first takes a one-use dispatch-claim under the current fence, so a stale
 * or partitioned holder cannot send. This is the design's "one voter with explicitly unavailable
 * failover" realization (§16): the authority lives on one machine (the authority machine) and both
 * machines' runners reach it, the local one over loopback. If the NON-authority machine goes away
 * the authority machine takes over after one term; if the authority machine goes away nothing is
 * admitted anywhere and input waits at Telegram (§9: preserve and queue, never a second voice).
 * Symmetric failover needs three voters (§2) and is not built here.
 *
 * Shared truth (one append-only, hash-chained, fsynced log on the authority machine):
 *   - the lease: epoch, holder machine and process incarnation;
 *   - one dispatch-claim per send target (a Telegram update's reply is `update:<id>`), and its outcome;
 *   - the settled intake cursor: the Telegram offset below which every update is handled.
 * Nothing else crosses machines: message text, journals and model work stay local.
 *
 * Lease expiry is measured only by the authority's own injected monotonic clock. A restart treats a
 * recorded live lease as held for one full term from the restart (§3: old deadlines are suspect).
 * Renewals are not logged; an epoch, a claim, an outcome and the cursor are. A log whose chain does
 * not verify leaves the authority unable to issue anything (§3 Restore); it is never reset.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { closeSync, constants, existsSync, fsyncSync, ftruncateSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { dirname } from 'node:path';

export type Fence = Readonly<{ epoch: number; incarnation: string }>;
/** `refused` is a definite refusal by the platform: nothing was delivered (Rule 42). */
export type ClaimState = 'claimed' | 'sent' | 'unknown' | 'refused';
export type ClaimOutcome = Exclude<ClaimState, 'claimed'>;
export type AuthorityRecord =
  | { t: 'genesis'; conversation: string; termMs: number }
  | { t: 'acquire'; epoch: number; machine: string; incarnation: string }
  | { t: 'expire'; epoch: number }
  | { t: 'release'; epoch: number }
  | { t: 'claim'; epoch: number; incarnation: string; key: string }
  | { t: 'outcome'; key: string; state: ClaimOutcome }
  | { t: 'settle'; epoch: number; cursor: number };
export type AuthorityRequest =
  | { op: 'acquire'; machine: string; incarnation: string }
  | { op: 'renew' | 'release'; fence: Fence }
  | { op: 'claim'; fence: Fence; key: string }
  | { op: 'outcome'; fence: Fence; key: string; state: ClaimOutcome }
  | { op: 'settle'; fence: Fence; cursor: number }
  | { op: 'read' };
export type Holder = Readonly<{ epoch: number; machine: string; incarnation: string }>;
export type AuthorityView = Readonly<{ conversation: string; termMs: number; epoch: number; holder: Holder | null;
  remainingMs: number; cursor: number; unresolved: readonly string[]; claims: number }>;
export type AuthorityAnswer =
  | Readonly<{ ok: true; fence?: Fence; termMs?: number; state?: ClaimState; view?: AuthorityView }>
  | Readonly<{ ok: false; reason: 'held' | 'stale' | 'already-claimed' | 'not-claimant' | 'invalid' | 'corrupt' | 'unauthorized' | 'unreachable';
    holder?: Holder | null; remainingMs?: number; state?: ClaimState }>;

export interface ConversationAuthority { readonly conversation: string; handle(request: AuthorityRequest): AuthorityAnswer; close(): void }

const MAX_TERM_MS = 300_000;
const hashOf = (previous: string, body: string) => createHash('sha256').update(`${previous}\n${body}`, 'utf8').digest('hex');
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const fenceOk = (value: unknown): value is Fence => typeof value === 'object' && value !== null
  && count((value as Fence).epoch) && text((value as Fence).incarnation, 200);

/** Opens (or creates) the authority for exactly one conversation key. Single-voter, single-process. */
export function openConversationAuthority(input: Readonly<{ path: string; conversation: string; termMs: number;
  monotonic: () => number }>): ConversationAuthority {
  if (!text(input.conversation, 200) || !count(input.termMs) || input.termMs < 1000 || input.termMs > MAX_TERM_MS)
    throw Error('conversation authority: invalid configuration');
  mkdirSync(dirname(input.path), { recursive: true, mode: 0o700 });
  let corrupt: string | null = null, head = 'genesis', seq = 0;
  let epoch = 0, holder: Holder | null = null, live = false, expiresAt = 0, cursor = 0, termMs = input.termMs;
  const claims = new Map<string, { epoch: number; incarnation: string; state: ClaimState }>();
  const apply = (record: AuthorityRecord) => {
    switch (record.t) {
      case 'genesis': if (record.conversation !== input.conversation) throw Error('conversation differs'); termMs = record.termMs; return;
      case 'acquire': if (record.epoch !== epoch + 1 || live) throw Error('epoch out of order');
        epoch = record.epoch; holder = { epoch: record.epoch, machine: record.machine, incarnation: record.incarnation }; live = true; return;
      case 'expire': case 'release': if (record.epoch !== epoch || !live) throw Error('loss out of order'); live = false; return;
      case 'claim': if (claims.has(record.key) || record.epoch !== epoch || !live) throw Error('claim out of order');
        claims.set(record.key, { epoch: record.epoch, incarnation: record.incarnation, state: 'claimed' }); return;
      case 'outcome': { const claim = claims.get(record.key);
        if (!claim || claim.state !== 'claimed') throw Error('outcome out of order'); claim.state = record.state; return; }
      case 'settle': if (record.epoch !== epoch || !live || record.cursor <= cursor) throw Error('settle out of order'); cursor = record.cursor; return;
    }
  };
  // Replay. A final line without its newline was never acknowledged (the ack follows fsync of the full line) and is cut.
  if (existsSync(input.path)) {
    const bytes = readFileSync(input.path, 'utf8');
    const complete = bytes.endsWith('\n') ? bytes : bytes.slice(0, bytes.lastIndexOf('\n') + 1);
    try {
      for (const line of complete.split('\n').filter(Boolean)) {
        const row = JSON.parse(line) as { seq: number; prev: string; hash: string; rec: AuthorityRecord };
        const body = JSON.stringify(row.rec);
        if (row.seq !== seq + 1 || row.prev !== head || row.hash !== hashOf(head, body)) throw Error('chain broken');
        if ((seq === 0) !== (row.rec.t === 'genesis')) throw Error('genesis misplaced');
        apply(row.rec); seq = row.seq; head = row.hash;
      }
      if (complete.length !== bytes.length) {
        const fd = openSync(input.path, 'r+'); try { ftruncateSync(fd, Buffer.byteLength(complete)); fsyncSync(fd); } finally { closeSync(fd); }
      }
    } catch (error) { corrupt = error instanceof Error ? error.message : 'unreadable'; }
  }
  // A recorded live lease survives a restart as held for one full term from now: its old deadline is suspect.
  if (live) expiresAt = input.monotonic() + termMs;
  const fd = corrupt ? -1 : openSync(input.path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT, 0o600);
  const append = (record: AuthorityRecord) => {
    // Any failure here leaves memory ahead of disk, so the authority stops issuing until a verified reopen.
    try {
      apply(record);
      const body = JSON.stringify(record), hash = hashOf(head, body);
      writeSync(fd, `${JSON.stringify({ seq: seq + 1, prev: head, hash, rec: record })}\n`); fsyncSync(fd);
      seq += 1; head = hash;
    } catch (error) { corrupt = `append failed: ${error instanceof Error ? error.message : 'unknown'}`; throw error; }
  };
  if (!corrupt && seq === 0) {
    append({ t: 'genesis', conversation: input.conversation, termMs: input.termMs });
    const directory = openSync(dirname(input.path), 'r'); try { fsyncSync(directory); } finally { closeSync(directory); }
  }
  const remaining = (now: number) => live ? Math.max(0, expiresAt - now) : 0;
  const view = (now: number): AuthorityView => Object.freeze({ conversation: input.conversation, termMs, epoch,
    holder: live && remaining(now) > 0 ? holder : null, remainingMs: remaining(now), cursor,
    unresolved: Object.freeze([...claims].filter(([, claim]) => claim.state === 'claimed').map(([key]) => key).sort()),
    claims: claims.size });
  /** The fence is current only for the live, unexpired assignment with this exact epoch AND incarnation. */
  const current = (fence: Fence, now: number) => live && holder !== null && fence.epoch === epoch
    && fence.incarnation === holder.incarnation && now < expiresAt;
  let closed = false;
  return Object.freeze({ conversation: input.conversation,
    handle(request: AuthorityRequest): AuthorityAnswer {
      try { return handle(request); } catch { return { ok: false, reason: 'corrupt' }; }
    },
    close() { if (closed) return; closed = true; if (fd >= 0) closeSync(fd); } });
  function handle(request: AuthorityRequest): AuthorityAnswer {
    if (corrupt || closed) return { ok: false, reason: 'corrupt' };
    const now = input.monotonic();
    switch (request?.op) {
      case 'read': return { ok: true, view: view(now) };
      case 'acquire': {
        if (!text(request.machine, 120) || !text(request.incarnation, 200)) return { ok: false, reason: 'invalid' };
        if (live && now < expiresAt) {
          // The holder asking again (a lost acknowledgement) gets its original fence and a renewed term.
          if (holder!.incarnation === request.incarnation) { expiresAt = now + termMs; return { ok: true, fence: { epoch, incarnation: holder!.incarnation }, termMs }; }
          return { ok: false, reason: 'held', holder, remainingMs: remaining(now) };
        }
        // Break before make: the old epoch's loss is committed before the new assignment.
        if (live) append({ t: 'expire', epoch });
        append({ t: 'acquire', epoch: epoch + 1, machine: request.machine, incarnation: request.incarnation });
        expiresAt = now + termMs;
        return { ok: true, fence: { epoch, incarnation: request.incarnation }, termMs };
      }
      case 'renew': case 'release': {
        if (!fenceOk(request.fence)) return { ok: false, reason: 'invalid' };
        if (!current(request.fence, now)) return { ok: false, reason: 'stale', holder: view(now).holder };
        if (request.op === 'release') { append({ t: 'release', epoch }); return { ok: true }; }
        expiresAt = now + termMs;
        return { ok: true, termMs };
      }
      case 'claim': {
        if (!fenceOk(request.fence) || !text(request.key, 200)) return { ok: false, reason: 'invalid' };
        if (!current(request.fence, now)) return { ok: false, reason: 'stale', holder: view(now).holder };
        const prior = claims.get(request.key);
        if (prior) {
          // A lost acknowledgement: the same claimant gets its original answer back, once, while still current.
          if (prior.state === 'claimed' && prior.epoch === request.fence.epoch && prior.incarnation === request.fence.incarnation)
            return { ok: true, state: 'claimed' };
          return { ok: false, reason: 'already-claimed', state: prior.state };
        }
        append({ t: 'claim', epoch, incarnation: request.fence.incarnation, key: request.key });
        return { ok: true, state: 'claimed' };
      }
      case 'outcome': {
        // An admitted in-flight dispatch reports its outcome even after its lease is gone (design 10 §4).
        if (!fenceOk(request.fence) || !text(request.key, 200) || !['sent', 'unknown', 'refused'].includes(request.state))
          return { ok: false, reason: 'invalid' };
        const claim = claims.get(request.key);
        if (!claim || claim.epoch !== request.fence.epoch || claim.incarnation !== request.fence.incarnation)
          return { ok: false, reason: 'not-claimant' };
        if (claim.state !== 'claimed') return claim.state === request.state ? { ok: true, state: claim.state } : { ok: false, reason: 'invalid', state: claim.state };
        append({ t: 'outcome', key: request.key, state: request.state });
        return { ok: true, state: request.state };
      }
      case 'settle': {
        if (!fenceOk(request.fence) || !count(request.cursor)) return { ok: false, reason: 'invalid' };
        if (!current(request.fence, now)) return { ok: false, reason: 'stale', holder: view(now).holder };
        if (request.cursor > cursor) append({ t: 'settle', epoch, cursor: request.cursor });
        return { ok: true, view: view(now) };
      }
      default: return { ok: false, reason: 'invalid' };
    }
  }
}

const MAX_BODY = 4096;
const tokenMatches = (header: string | undefined, token: string) => {
  const supplied = Buffer.from(header ?? '', 'utf8'), expected = Buffer.from(`Bearer ${token}`, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};

/** The authority's network face: one POST route, a shared bearer secret, a bounded body. */
export function serveConversationAuthority(input: Readonly<{ authority: ConversationAuthority; token: string;
  host: string; port: number }>): Promise<Server> {
  if (input.token.length < 16) throw Error('conversation authority: the shared secret is too short');
  const server = createServer((request, response) => {
    const reply = (status: number, answer: AuthorityAnswer) => {
      response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(answer));
    };
    if (request.method !== 'POST' || request.url !== '/conversation-authority') { reply(404, { ok: false, reason: 'invalid' }); request.resume(); return; }
    if (!tokenMatches(request.headers.authorization, input.token)) { reply(401, { ok: false, reason: 'unauthorized' }); request.resume(); return; }
    const chunks: Buffer[] = []; let size = 0, refused = false;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY && !refused) { refused = true; reply(413, { ok: false, reason: 'invalid' }); request.destroy(); }
      else if (!refused) chunks.push(chunk);
    });
    request.on('end', () => {
      if (refused) return;
      let body: { conversation?: unknown; request?: AuthorityRequest };
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as typeof body; } catch { reply(400, { ok: false, reason: 'invalid' }); return; }
      if (body.conversation !== input.authority.conversation) { reply(409, { ok: false, reason: 'invalid' }); return; }
      reply(200, input.authority.handle(body.request as AuthorityRequest));
    });
  });
  return new Promise((done, fail) => { server.once('error', fail); server.listen(input.port, input.host, () => done(server)); });
}

export interface AuthorityClient { request(request: AuthorityRequest): Promise<AuthorityAnswer> }

/** The other side of the network face. Any failure to obtain a well-formed answer is `unreachable`, never success. */
export function connectConversationAuthority(input: Readonly<{ url: string; token: string; conversation: string;
  timeoutMs: number; fetch?: typeof fetch }>): AuthorityClient {
  const call = input.fetch ?? fetch;
  return Object.freeze({ async request(request: AuthorityRequest): Promise<AuthorityAnswer> {
    try {
      const response = await call(`${input.url.replace(/\/$/u, '')}/conversation-authority`, { method: 'POST',
        headers: { authorization: `Bearer ${input.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ conversation: input.conversation, request }), signal: AbortSignal.timeout(input.timeoutMs) });
      const answer = await response.json() as AuthorityAnswer;
      return typeof answer === 'object' && answer !== null && typeof answer.ok === 'boolean' ? answer : { ok: false, reason: 'unreachable' };
    } catch { return { ok: false, reason: 'unreachable' }; }
  } });
}

/** The same face for a runner on the authority machine without a socket (tests and loopback-free composition). */
export const localAuthorityClient = (authority: ConversationAuthority): AuthorityClient =>
  Object.freeze({ request: async (request: AuthorityRequest) => authority.handle(request) });

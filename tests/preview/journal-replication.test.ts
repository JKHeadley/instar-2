/** The purpose's replicated(1) default (D1(a)), Rules 2, 7, 31, 32, 95: the journal's bytes reach the other
 * machine and are acknowledged before a send; a successor continues from the newest copy; nothing falls back
 * to local durability and nothing is deleted. Real journals, real files, a real HTTP round trip. */
import { expect, it } from 'vitest';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectionDigest } from './journal.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { localAuthorityClient, openConversationAuthority } from './conversation-authority.js';
import type { AuthorityClient, AuthorityRequest } from './conversation-authority.js';
import { adoptReceivedCopy, awaitReplicated, connectReplicaPeer, createJournalShipper, createReplicatedDispatch, localReplicaClient, markOf,
  openReplicaStore, readLineage, REPLICATION_UNMET, serveReplicaStore, setAsideJournals, sharedHistoryStatus, takeoverEligibility } from './journal-replication.js';
import { createLeaseHolder } from './two-machine-serving.js';
import type { ReplicaClient, ReplicaRequest } from './journal-replication.js';

const SECRET = 'replication-test-secret-0123456789', CONVERSATION = 'telegram/bot-12345678/chat-7654321';
const key = new Uint8Array(32).fill(7);
const place = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-replication-')));
const genesis = () => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0 });
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: `question ${id}` } });

/** One machine's root with a real preview journal and a worker that answers. */
function machine(root: string) {
  mkdirSync(root, { recursive: true });
  const journalPath = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(journalPath, key, genesis());
  let sends = 0;
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, model: async input => `answer ${input.question}`,
    send: async () => ++sends, checkOutbound: () => undefined });
  return { root, journalPath, journal, worker, exchange: async (id: number) => { worker.intake([update(id)]); await worker.drain(); } };
}
const storeAt = (root: string, name = 'laptop') => openReplicaStore({ directory: join(root, 'replica'), conversation: CONVERSATION, machine: name, secret: SECRET });
/** A shipper over a real journal, with a clock the test moves. */
function shipping(owner: ReturnType<typeof machine>, peer: ReplicaClient, options: { machine?: string; secret?: string; chunkBytes?: number; epoch?: () => number | null } = {}) {
  const clock = { now: 0 };
  const shipper = createJournalShipper({ path: owner.journalPath, size: () => owner.journal.size, peer, conversation: CONVERSATION,
    machine: options.machine ?? 'studio', secret: options.secret ?? SECRET, epoch: options.epoch ?? (() => 1), monotonic: () => clock.now,
    ...(options.chunkBytes ? { chunkBytes: options.chunkBytes } : {}) });
  return { shipper, clock };
}
/** A peer link the test can cut, and that counts what crossed it. */
function link(store: ReturnType<typeof storeAt>) {
  const state = { up: true, requests: [] as ReplicaRequest[] };
  const client: ReplicaClient = { request: async request => {
    if (!state.up) return { ok: false, reason: 'unreachable' };
    state.requests.push(request); return store.handle(request);
  } };
  return { state, client };
}
const viewOf = (path: string) => { const copy = openPreviewJournal(path, key, undefined, undefined, true); try { return projectionDigest(copy.view); } finally { copy.close(); } };

it('ships a real journal to the other machine: the copy replays to the same history, and a token is covered only once acknowledged', async () => {
  const dir = place();
  try {
    const owner = machine(join(dir, 'studio')), store = storeAt(join(dir, 'laptop')), wire = link(store);
    const { shipper } = shipping(owner, wire.client);
    await owner.exchange(10);
    const token = shipper.token();
    expect(shipper.covers(token)).toBe(false);
    await shipper.pump();
    expect(shipper.covers(token)).toBe(true);
    expect(store.copy()).toMatchObject({ epoch: 1, machine: 'studio', size: owner.journal.size });
    expect(viewOf(store.copyPath)).toBe(projectionDigest(owner.journal.view));
    expect(shipper.status(1000)).toMatchObject({ current: true, reason: 'acknowledged', acknowledgedBytes: owner.journal.size });
    // New records are NOT covered until they too are acknowledged; the earlier token stays covered.
    await owner.exchange(11);
    const later = shipper.token();
    expect(shipper.covers(later)).toBe(false);
    expect(shipper.covers(token)).toBe(true);
    expect(shipper.status(1000).current).toBe(false);
    const before = wire.state.requests.length;
    await shipper.pump();
    expect(shipper.covers(later)).toBe(true);
    // Only the new bytes crossed, as an extension of the held copy.
    const sent = wire.state.requests.slice(before).filter(request => request.op === 'append');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ offset: token.size, final: true });
    expect(viewOf(store.copyPath)).toBe(projectionDigest(owner.journal.view));
    owner.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('a lost peer is never covered and never a fallback: the gate waits, a bounded wait refuses, a stop refuses, and a returning peer admits', async () => {
  const dir = place();
  try {
    const owner = machine(join(dir, 'studio')), store = storeAt(join(dir, 'laptop')), wire = link(store);
    const { shipper, clock } = shipping(owner, wire.client);
    await shipper.pump();
    await owner.exchange(10);
    wire.state.up = false;
    const token = shipper.token();
    await shipper.pump();
    expect(shipper.covers(token)).toBe(false);
    expect(shipper.status(1000)).toMatchObject({ current: false, reason: 'the other machine refused: unreachable' });
    // Rule 55: inside the backoff no request is even attempted.
    wire.state.up = true;
    const asked = wire.state.requests.length;
    await shipper.pump();
    expect(wire.state.requests.length).toBe(asked);
    wire.state.up = false;
    // A bounded wait (the minimal path) ends as a refusal naming the unmet demand.
    let time = 0;
    const sleep = async (ms: number) => { time += ms; clock.now += ms; };
    expect(await awaitReplicated({ token, shipper, refusal: () => null, sleep, elapsed: () => time, maxWaitMs: 10_000 })).toBe(REPLICATION_UNMET);
    expect(time).toBeGreaterThanOrEqual(10_000);
    // A stop (or lost ownership) ends an unbounded wait with ITS reason; the demand is never waived.
    let waits = 0;
    expect(await awaitReplicated({ token, shipper, refusal: () => waits >= 3 ? 'stopped before dispatch' : null,
      sleep: async ms => { waits++; clock.now += ms; }, elapsed: () => time })).toBe('stopped before dispatch');
    expect(shipper.covers(token)).toBe(false);
    // An unbounded wait lasts as long as the peer is away, then admits (null) once it acknowledged.
    let rounds = 0, noticed = 0;
    const admitted = await awaitReplicated({ token, shipper, refusal: () => null, elapsed: () => time, waiting: () => { noticed++; },
      sleep: async ms => { clock.now += ms; if (++rounds === 6) wire.state.up = true; } });
    expect(admitted).toBe(null);
    expect(rounds).toBeGreaterThanOrEqual(6);
    expect(noticed).toBeGreaterThanOrEqual(6);
    expect(shipper.covers(token)).toBe(true);
    // Covered at once: no wait, no notice.
    expect(await awaitReplicated({ token, shipper, refusal: () => null, sleep: async () => { throw Error('must not wait'); }, elapsed: () => 0 })).toBe(null);
    // Freshness: a peer that acknowledged everything but has been silent since is not "current".
    expect(shipper.status(1000).current).toBe(true);
    clock.now += 5000;
    expect(shipper.status(1000)).toMatchObject({ current: false, reason: 'the other machine has not answered recently' });
    owner.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('a compacted journal is re-sent whole: the old copy stays the copy until the new one is complete, and earlier tokens are covered by it', async () => {
  const dir = place();
  try {
    const owner = machine(join(dir, 'studio')), store = storeAt(join(dir, 'laptop')), wire = link(store);
    const { shipper } = shipping(owner, wire.client, { chunkBytes: 200 });
    await owner.exchange(10);
    await shipper.pump();
    const old = store.copy()!, before = shipper.token();
    await owner.exchange(11);
    const pending = shipper.token();
    owner.journal.compact();
    expect(markOf(readFileSync(owner.journalPath))).not.toBe(old.mark);
    // Cut the link after two chunks of the re-send: the peer still holds the OLD complete copy, and nothing new is covered.
    let appends = 0;
    const flaky: ReplicaClient = { request: async request => {
      if (request.op === 'append' && ++appends > 2) return { ok: false, reason: 'unreachable' };
      return store.handle(request);
    } };
    const cut = shipping(owner, flaky, { chunkBytes: 200 });
    const token = cut.shipper.token();
    await cut.shipper.pump();
    expect(appends).toBe(3);
    expect(store.copy()).toEqual(old);
    expect(cut.shipper.covers(token)).toBe(false);
    expect(viewOf(store.copyPath)).not.toBe(projectionDigest(owner.journal.view));
    // The original shipper notices the new generation and sends it whole; the complete file replaces the copy.
    expect(shipper.covers(pending)).toBe(false);
    await shipper.pump();
    expect(store.copy()).toMatchObject({ size: owner.journal.size, mark: markOf(readFileSync(owner.journalPath)) });
    expect(viewOf(store.copyPath)).toBe(projectionDigest(owner.journal.view));
    expect(shipper.covers(pending)).toBe(true);
    expect(shipper.covers(before)).toBe(true);
    expect(shipper.covers(shipper.token())).toBe(true);
    owner.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('a restarted owner continues the copy the peer holds; a copy that is not a prefix of its journal is replaced whole', async () => {
  const dir = place();
  try {
    const owner = machine(join(dir, 'studio')), store = storeAt(join(dir, 'laptop')), wire = link(store);
    await owner.exchange(10);
    await shipping(owner, wire.client).shipper.pump();
    const held = store.copy()!.size;
    await owner.exchange(11);
    // A new owner process (no memory of what was sent): it asks, verifies the prefix, and sends only the rest.
    const mark = wire.state.requests.length, resumed = shipping(owner, wire.client, { epoch: () => 2 });
    await resumed.shipper.pump();
    const appended = wire.state.requests.slice(mark).filter(request => request.op === 'append');
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ offset: held, epoch: 2 });
    expect(store.copy()).toMatchObject({ epoch: 2, size: owner.journal.size });
    // Another lineage for the same conversation: its bytes are not a prefix, so the whole file is sent and replaces the copy.
    const other = machine(join(dir, 'other'));
    await other.exchange(20);
    const foreign = shipping(other, wire.client, { epoch: () => 3 });
    const at = wire.state.requests.length;
    await foreign.shipper.pump();
    expect(wire.state.requests.slice(at).filter(request => request.op === 'append')[0]).toMatchObject({ offset: 0 });
    expect(store.copy()).toMatchObject({ epoch: 3, size: other.journal.size });
    expect(viewOf(store.copyPath)).toBe(projectionDigest(other.journal.view));
    owner.journal.close(); other.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('the receiver refuses what is not the next verified bytes from the other machine, and an unauthenticated acknowledgement covers nothing', async () => {
  const dir = place();
  try {
    const owner = machine(join(dir, 'studio')), store = storeAt(join(dir, 'laptop'));
    await owner.exchange(10);
    await shipping(owner, localReplicaClient(store)).shipper.pump();
    const copy = store.copy()!, bytes = Buffer.from('next bytes').toString('base64');
    const append = (change: Record<string, unknown>) => store.handle({ op: 'append', nonce: 'n', epoch: 1, machine: 'studio', mark: copy.mark,
      offset: copy.size, bytes, digest: 'f'.repeat(64), final: true, ...change } as ReplicaRequest);
    expect(append({})).toEqual({ ok: false, reason: 'digest' });
    expect(append({ offset: copy.size + 1 })).toEqual({ ok: false, reason: 'offset' });
    expect(append({ epoch: 0 })).toEqual({ ok: false, reason: 'stale' });
    // A second process on the same machine is not a peer.
    expect(append({ machine: 'laptop' })).toEqual({ ok: false, reason: 'same-machine' });
    expect(append({ bytes: '' })).toEqual({ ok: false, reason: 'invalid' });
    expect(append({ bytes: Buffer.alloc(300 * 1024).toString('base64') })).toEqual({ ok: false, reason: 'invalid' });
    expect(append({ nonce: '' })).toEqual({ ok: false, reason: 'invalid' });
    // A whole re-send must begin with the bytes its mark names.
    expect(append({ offset: 0, bytes: Buffer.alloc(64, 1).toString('base64'), mark: 'a'.repeat(64) })).toEqual({ ok: false, reason: 'invalid' });
    expect(store.handle({ op: 'nothing', nonce: 'n' } as unknown as ReplicaRequest)).toEqual({ ok: false, reason: 'invalid' });
    // None of the refusals changed the copy.
    expect(store.copy()).toEqual(copy);
    expect(readFileSync(store.copyPath).length).toBe(copy.size);
    // The same machine name on both ends: the owner is never covered.
    const same = shipping(owner, localReplicaClient(store), { machine: 'laptop' });
    await owner.exchange(11);
    const token = same.shipper.token();
    await same.shipper.pump();
    expect(same.shipper.covers(token)).toBe(false);
    expect(same.shipper.status(1000).reason).toContain('a second process here is not a peer');
    // A different secret on the owner: the bytes are stored, but the acknowledgement does not authenticate.
    const wrong = shipping(owner, localReplicaClient(store), { secret: 'another-secret-0123456789' });
    await wrong.shipper.pump();
    expect(wrong.shipper.covers(token)).toBe(false);
    expect(wrong.shipper.status(1000).reason).toBe('the acknowledgement did not authenticate');
    // A runner that does not hold the conversation sends nothing.
    const idle = link(store), standby = shipping(owner, idle.client, { epoch: () => null });
    await standby.shipper.pump();
    expect(idle.state.requests).toHaveLength(0);
    // Once this machine is the owner it accepts no more of the other machine's bytes.
    store.seal();
    expect(store.handle({ op: 'state', nonce: 'n' })).toEqual({ ok: false, reason: 'owner' });
    expect(() => openReplicaStore({ directory: join(dir, 'x'), conversation: CONVERSATION, machine: 'laptop', secret: 'short' })).toThrow('invalid configuration');
    owner.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('the copy survives a restart: an unfinished re-send is dropped, unacknowledged bytes are cut, and a short or changed copy is detected as damaged', async () => {
  const dir = place();
  try {
    const owner = machine(join(dir, 'studio')), peerRoot = join(dir, 'laptop');
    let store = storeAt(peerRoot);
    await owner.exchange(10);
    await shipping(owner, localReplicaClient(store)).shipper.pump();
    const copy = store.copy()!;
    // Bytes written past the record (a crash before the acknowledgement) and a half re-send left behind.
    appendFileSync(store.copyPath, Buffer.from('unacknowledged'));
    writeFileSync(`${store.copyPath}.next`, 'partial');
    store = storeAt(peerRoot);
    expect(store.copy()).toEqual(copy);
    expect(readFileSync(store.copyPath).length).toBe(copy.size);
    expect(existsSync(`${store.copyPath}.next`)).toBe(false);
    expect(store.damaged()).toBe(null);
    expect(takeoverEligibility({ root: peerRoot, store })).toEqual({ eligible: true });
    // Rule 2: a copy shorter than its record is lost history, detected and refused, never silently served.
    truncateSync(store.copyPath, copy.size - 1);
    store = storeAt(peerRoot);
    expect(store.copy()).toBe(null);
    expect(store.damaged()).toBe('copy shorter than its record');
    expect(store.handle({ op: 'state', nonce: 'n' })).toEqual({ ok: false, reason: 'damaged' });
    expect(takeoverEligibility({ root: peerRoot, store })).toMatchObject({ eligible: false, seedable: false });
    expect(adoptReceivedCopy({ root: peerRoot, journalPath: join(peerRoot, 'journal.encrypted'), store, epoch: 2, seed: true, verify: () => undefined }))
      .toMatchObject({ ok: false, reason: expect.stringContaining('damaged') });
    // Same length, different bytes.
    writeFileSync(store.copyPath, Buffer.alloc(copy.size, 9));
    expect(storeAt(peerRoot).damaged()).toBe('copy differs from its record');
    // Another conversation's record is not this conversation's copy.
    expect(openReplicaStore({ directory: join(peerRoot, 'replica'), conversation: 'telegram/bot-1/chat-2', machine: 'laptop', secret: SECRET }).damaged()).toBe('record malformed');
    owner.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('takeover: a newer copy is installed and the old journal set aside; an older copy is ignored; an unverifiable one refuses; seeding is first-lease only', async () => {
  const dir = place();
  try {
    const studio = machine(join(dir, 'studio')), laptopRoot = join(dir, 'laptop'), journalPath = join(laptopRoot, 'journal.encrypted');
    mkdirSync(laptopRoot, { recursive: true });
    const store = storeAt(laptopRoot);
    const verify = (path: string) => { viewOf(path); };
    // A machine with no enrolled history and no copy may not serve, and may be seeded only for the first lease ever.
    expect(takeoverEligibility({ root: laptopRoot, store })).toMatchObject({ eligible: false, seedable: true });
    expect(adoptReceivedCopy({ root: laptopRoot, journalPath, store, epoch: 2, seed: false, verify })).toMatchObject({ ok: false,
      reason: 'this machine holds no enrolled copy of the conversation history' });
    expect(adoptReceivedCopy({ root: laptopRoot, journalPath, store, epoch: 2, seed: true, verify })).toMatchObject({ ok: false,
      reason: expect.stringContaining('seeding is only for the first lease ever') });
    expect(readLineage(laptopRoot)).toBe(null);
    expect(sharedHistoryStatus(laptopRoot, journalPath)).toBe(null);
    // The first owner seeds its own journal as the shared history.
    expect(adoptReceivedCopy({ root: studio.root, journalPath: studio.journalPath, store: storeAt(studio.root, 'studio'), epoch: 1, seed: true, verify }))
      .toEqual({ ok: true, how: 'seeded' });
    expect(readLineage(studio.root)).toEqual({ epoch: 1, seeded: true });
    await studio.exchange(10);
    await shipping(studio, localReplicaClient(store)).shipper.pump();
    expect(takeoverEligibility({ root: laptopRoot, store })).toEqual({ eligible: true });
    // A copy that does not replay refuses takeover (fail closed): nothing is installed.
    expect(adoptReceivedCopy({ root: laptopRoot, journalPath, store, epoch: 2, seed: false, verify: () => { throw Error('does not replay'); } }))
      .toMatchObject({ ok: false, reason: expect.stringContaining('does not verify') });
    expect(existsSync(journalPath)).toBe(false);
    // The successor installs the verified copy: it now has the history.
    expect(adoptReceivedCopy({ root: laptopRoot, journalPath, store, epoch: 2, seed: false, verify })).toEqual({ ok: true, how: 'adopted' });
    expect(readLineage(laptopRoot)).toMatchObject({ epoch: 2, adopted: { machine: 'studio', epoch: 1, size: store.copy()!.size } });
    expect(viewOf(journalPath)).toBe(projectionDigest(studio.journal.view));
    // It serves and writes on from there; the same (now older) copy is not installed again, and the journal continues.
    const laptop = machine(laptopRoot);
    await laptop.exchange(11);
    const grown = readFileSync(journalPath);
    expect(adoptReceivedCopy({ root: laptopRoot, journalPath, store, epoch: 4, seed: false, verify })).toEqual({ ok: true, how: 'continued' });
    expect(readFileSync(journalPath).equals(grown)).toBe(true);
    expect(readLineage(laptopRoot)).toMatchObject({ epoch: 4 });
    expect(setAsideJournals(journalPath)).toEqual([]);
    // The first machine returns, receives the successor's journal, and takes over: its own older journal is set aside, never deleted.
    const studioStore = storeAt(studio.root, 'studio'), original = readFileSync(studio.journalPath);
    await shipping(laptop, localReplicaClient(studioStore), { machine: 'laptop', epoch: () => 4 }).shipper.pump();
    studio.journal.close();
    expect(adoptReceivedCopy({ root: studio.root, journalPath: studio.journalPath, store: studioStore, epoch: 5, seed: false, verify }))
      .toEqual({ ok: true, how: 'adopted', setAside: 'journal.encrypted.set-aside-5' });
    expect(readFileSync(join(studio.root, 'journal.encrypted.set-aside-5')).equals(original)).toBe(true);
    expect(viewOf(studio.journalPath)).toBe(projectionDigest(laptop.journal.view));
    expect(sharedHistoryStatus(studio.root, studio.journalPath)).toMatchObject({ lineage: { epoch: 5, adopted: { machine: 'laptop', epoch: 4 } },
      copy: { epoch: 4, machine: 'laptop' }, setAside: ['journal.encrypted.set-aside-5'] });
    // Rule 2: an enrolled machine whose journal is gone refuses instead of starting a fresh one over the loss.
    rmSync(studio.journalPath);
    expect(adoptReceivedCopy({ root: studio.root, journalPath: studio.journalPath, store: studioStore, epoch: 6, seed: true, verify }))
      .toEqual({ ok: false, reason: 'the journal this machine was enrolled with is missing' });
    expect(existsSync(studio.journalPath)).toBe(false);
    laptop.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('crosses a real HTTP face: the bearer secret and the conversation are checked, and a dead peer is unreachable', async () => {
  const dir = place();
  try {
    const owner = machine(join(dir, 'studio')), store = storeAt(join(dir, 'laptop'));
    const server = await serveReplicaStore({ store, token: SECRET, host: '127.0.0.1', port: 0 });
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      await owner.exchange(10);
      const good = shipping(owner, connectReplicaPeer({ url, token: SECRET, conversation: CONVERSATION, timeoutMs: 5000 }));
      const token = good.shipper.token();
      await good.shipper.pump();
      expect(good.shipper.covers(token)).toBe(true);
      expect(viewOf(store.copyPath)).toBe(projectionDigest(owner.journal.view));
      const ask = (client: ReplicaClient) => client.request({ op: 'state', nonce: 'n' });
      expect(await ask(connectReplicaPeer({ url, token: 'wrong-secret-0123456789', conversation: CONVERSATION, timeoutMs: 5000 }))).toEqual({ ok: false, reason: 'unauthorized' });
      expect(await ask(connectReplicaPeer({ url, token: SECRET, conversation: 'telegram/bot-1/chat-2', timeoutMs: 5000 }))).toEqual({ ok: false, reason: 'invalid' });
      expect((await fetch(`${url}/other`, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` }, body: '{}' })).status).toBe(404);
      expect((await fetch(`${url}/journal-replica`, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` }, body: 'x'.repeat(600 * 1024) }).catch(() => ({ status: 413 }))).status).toBe(413);
    } finally { await new Promise(done => { server.close(done); server.closeAllConnections(); }); }
    expect(await connectReplicaPeer({ url, token: SECRET, conversation: CONVERSATION, timeoutMs: 2000 }).request({ op: 'state', nonce: 'n' })).toEqual({ ok: false, reason: 'unreachable' });
    owner.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('the dispatch gate: replicated first, then one claim; a claimed, stale or unreachable case never becomes a second send or a local-durability send', async () => {
  const dir = place();
  try {
    const owner = machine(join(dir, 'studio')), store = storeAt(join(dir, 'laptop')), wire = link(store);
    const time = { now: 0 };
    const log = openConversationAuthority({ path: join(dir, 'authority', 'log.jsonl'), conversation: CONVERSATION, termMs: 30_000, monotonic: () => time.now });
    const direct = localAuthorityClient(log), net = { up: true, asked: [] as AuthorityRequest[] };
    const authority: AuthorityClient = { request: async request => {
      if (!net.up) return { ok: false, reason: 'unreachable' };
      net.asked.push(request); return direct.request(request);
    } };
    const lease = createLeaseHolder({ authority, machine: 'studio', incarnation: 'studio:1', monotonic: () => time.now });
    expect((await lease.hold()).role).toBe('owner');
    const shipper = createJournalShipper({ path: owner.journalPath, size: () => owner.journal.size, peer: wire.client, conversation: CONVERSATION,
      machine: 'studio', secret: SECRET, epoch: () => lease.fence()?.epoch ?? null, monotonic: () => time.now });
    let slept = 0;
    const sleep = async (ms: number) => { slept += ms; time.now += ms; };
    const dispatch = createReplicatedDispatch({ authority, lease, shipper, cursor: 0, sleep, elapsed: () => time.now });
    const view = () => { const answer = log.handle({ op: 'read' }); if (!answer.ok || !answer.view) throw Error('no view'); return answer.view; };
    const go = () => null;
    await owner.exchange(10);

    // Both up: the journal crosses first, then exactly one claim; the outcome closes it.
    expect(await dispatch.admit('reply:a', go)).toBe(null);
    expect(store.copy()!.size).toBe(owner.journal.size);
    expect(view()).toMatchObject({ claims: 1, unresolved: ['reply:a'] });
    await dispatch.outcome('reply:a', 'accepted');
    expect(view().unresolved).toEqual([]);
    // A definite platform refusal is recorded as a refusal, not as unknown (Rule 42).
    expect(await dispatch.admit('reply:b', go)).toBe(null);
    await dispatch.outcome('reply:b', 'refused');
    expect(log.handle({ op: 'claim', fence: lease.fence()!, key: 'reply:b' })).toMatchObject({ ok: false, reason: 'already-claimed', state: 'refused' });
    // An outcome for a target this gate never admitted records nothing.
    await dispatch.outcome('reply:never', 'accepted');
    expect(view().claims).toBe(2);

    // The peer is away: no claim is even asked for, a bounded wait refuses, and a stop refuses with its own reason.
    wire.state.up = false;
    await owner.exchange(11);
    const asked = net.asked.length;
    expect(await dispatch.admit('limited:c', go, 10_000)).toEqual({ kind: 'refused', reason: REPLICATION_UNMET });
    let checks = 0;
    expect(await dispatch.admit('reply:c', () => ++checks > 3 ? 'stopped before dispatch' : null)).toEqual({ kind: 'refused', reason: 'stopped before dispatch' });
    expect(net.asked.slice(asked).filter(request => request.op === 'claim')).toHaveLength(0);
    // The same demand for a provider call: it waits while the peer is away and ends only with the caller's own reason.
    let asks = 0;
    expect(await dispatch.replicated(() => ++asks > 3 ? 'stopped' : null)).toBe('stopped');
    expect(asks).toBeGreaterThan(3);
    expect(view().claims).toBe(2);
    expect(dispatch.waiting).toBe(0);
    // The cursor does not pass an update the peer does not hold; once it holds it, the cursor moves.
    const token = shipper.token();
    expect(await dispatch.settle(token, 12)).toBe(0);
    expect(view().cursor).toBe(0);
    wire.state.up = true;
    time.now += 60_000; await lease.hold();
    expect(await dispatch.replicated(go)).toBe(null);
    expect(await dispatch.admit('reply:c', go)).toBe(null);
    expect(await dispatch.settle(token, 12)).toBe(12);
    expect(dispatch.cursor).toBe(12);
    expect(view().cursor).toBe(12);
    expect(await dispatch.settle(token, 11)).toBe(12);

    // The authority is unreachable at the outcome: it is kept and recorded by a later flush, never dropped.
    net.up = false;
    await dispatch.outcome('reply:c', 'unknown');
    await dispatch.flush();
    expect(view().unresolved).toEqual(['reply:c']);
    net.up = true;
    await dispatch.flush();
    expect(view().unresolved).toEqual([]);
    expect(log.handle({ op: 'claim', fence: lease.fence()!, key: 'reply:c' })).toMatchObject({ ok: false, state: 'unknown' });

    // The authority is unreachable at the claim: the send waits (it is not refused, and not sent); when it answers, it is admitted.
    net.up = false; slept = 0;
    let rounds = 0;
    expect(await dispatch.admit('reply:d', () => { if (++rounds === 5) net.up = true; return null; })).toBe(null);
    expect(slept).toBeGreaterThan(0);
    await dispatch.outcome('reply:d', 'accepted');

    // The claimant's own acknowledgement is lost: the authority records the claim but the answer never arrives, so the
    // gate asks again under the same fence. The repeated claim is already-claimed, never fresh send authority (no second send).
    let lostAck = true;
    const lossy: AuthorityClient = { request: async request => {
      const answer = await authority.request(request);
      if (request.op === 'claim' && lostAck) { lostAck = false; return { ok: false, reason: 'unreachable' }; }
      return answer;
    } };
    const own = createReplicatedDispatch({ authority: lossy, lease, shipper, cursor: 12, sleep, elapsed: () => time.now });
    expect(await own.admit('reply:h', go)).toEqual({ kind: 'unknown', reason: 'another runner already claimed this send (claimed); it is not sent again' });
    expect(view().unresolved).toContain('reply:h');
    // The claimant never learned it was admitted, so its outcome stays unknown, recorded as such (closed, never sent).
    expect(log.handle({ op: 'outcome', fence: lease.fence()!, key: 'reply:h', state: 'unknown' })).toMatchObject({ ok: true });

    // Another runner already claimed the target: never sent again, and reported as unknown rather than refused.
    log.handle({ op: 'claim', fence: lease.fence()!, key: 'reply:e' });
    const other = createReplicatedDispatch({ authority, lease: { fence: () => ({ epoch: lease.fence()!.epoch, incarnation: 'studio:1' }), drop: () => undefined },
      shipper, cursor: 12, sleep, elapsed: () => time.now });
    log.handle({ op: 'outcome', fence: lease.fence()!, key: 'reply:e', state: 'sent' });
    expect(await other.admit('reply:e', go)).toEqual({ kind: 'unknown', reason: 'another runner already claimed this send (sent); it is not sent again' });

    // The lease moved to the other machine: a stale fence is refused at the claim and at the settle, and dropped locally.
    const stale = lease.fence()!;
    time.now += 60_000;
    expect(log.handle({ op: 'acquire', machine: 'laptop', incarnation: 'laptop:1' })).toMatchObject({ ok: true, fence: { epoch: stale.epoch + 1 } });
    let dropped = 0;
    const late = createReplicatedDispatch({ authority, lease: { fence: () => stale, drop: () => { dropped++; } }, shipper, cursor: 12, sleep, elapsed: () => time.now });
    expect(await late.admit('reply:f', go)).toEqual({ kind: 'refused', reason: 'conversation ownership lost before dispatch' });
    expect(await late.settle(shipper.token(), 20)).toBe(12);
    expect(dropped).toBe(2);
    expect(view()).toMatchObject({ cursor: 12, holder: { machine: 'laptop' } });
    // No fence at all (the local term ran out): refused without asking.
    const none = createReplicatedDispatch({ authority, lease: { fence: () => null, drop: () => undefined }, shipper, cursor: 12, sleep, elapsed: () => time.now });
    expect(await none.admit('reply:g', go)).toEqual({ kind: 'refused', reason: 'conversation ownership lost before dispatch' });
    owner.journal.close(); log.close();
    // The recorded refusal replays: the reopened log verifies and still knows the target as refused.
    const reopened = openConversationAuthority({ path: join(dir, 'authority', 'log.jsonl'), conversation: CONVERSATION, termMs: 30_000, monotonic: () => time.now });
    const again = reopened.handle({ op: 'read' });
    expect(again.ok && again.view?.unresolved).toEqual([]);
    expect(reopened.handle({ op: 'outcome', fence: { epoch: 1, incarnation: 'studio:1' }, key: 'reply:b', state: 'refused' })).toEqual({ ok: true, state: 'refused' });
    expect(reopened.handle({ op: 'outcome', fence: { epoch: 1, incarnation: 'studio:1' }, key: 'reply:b', state: 'sent' })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(reopened.handle({ op: 'outcome', fence: { epoch: 1, incarnation: 'studio:1' }, key: 'reply:b', state: 'lost' } as never)).toEqual({ ok: false, reason: 'invalid' });
    reopened.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

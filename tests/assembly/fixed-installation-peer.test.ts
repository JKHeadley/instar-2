import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFactStore, hashBytes } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope, SegmentStoragePort } from '../../src/facts/index.js';
import { createEffectDoorway } from '../../src/effects/index.js';
import { createFixedPeerReplication, receiveFixedPeerRequest } from '../../src/assembly/production-replication.js';
import type { PeerDescriptor, PeerRequest, PeerResponse } from '../../src/assembly/production-replication.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { effectFixture } from '../effects/fixture.js';
// @ts-expect-error fixed host transport is JavaScript outside the pure core.
import { createPinnedSshPeerTransport, pinnedSshTrustOptions } from '../../scripts/fixed-installation-peer-client.mjs';

const descriptor = (): PeerDescriptor => ({ installation: 'install:one', studio: 'machine-a', laptop: 'm_cc2ec651a91f',
  store: 'facts:one', epoch: 0, trust: 'ssh:installed-pin', custody: 'policy:one', captureReferences: [],
  capturePrefixes: [],
  limits: { maxRequestBytes: 100000, maxResponseBytes: 10000, maxFacts: 8, maxCaptures: 4,
    maxCaptureBytes: 1000, maxDiskBytes: 100000, maxQueue: 1, timeoutMs: 1000, maxAttempts: 1 } });
function harness(limitChanges: Partial<PeerDescriptor['limits']> = {}) {
  const f = factsFixture(), first = f.fact(), second = f.next(first);
  const available = Object.fromEntries(Object.entries(f.captures).map(([reference, bytes]) =>
    [reference, { hash: hashBytes(bytes), bytes, byteLength: Buffer.byteLength(bytes), status: 'available' as const }]));
  const context = { ...f.ctx, captures: available };
  const d = { ...descriptor(), captureReferences: Object.keys(f.captures),
    limits: { ...descriptor().limits, maxCaptures: Object.keys(f.captures).length + 1, ...limitChanges } };
  const localRows: FactEnvelope[] = [first, second], remoteRows: FactEnvelope[] = [];
  const storage = (rows: FactEnvelope[]): SegmentStoragePort => ({ owner: 'part-ten', read: () => rows,
    append: (bytes, expected) => {
      if ((rows.at(-1)?.contentHash ?? null) !== expected) throw Error('compare-head');
      rows.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' });
    } });
  const remote = storage(remoteRows), captureRows = new Map<string, string>();
  const captures = { preserve: (reference: string, bytes: string) => {
    if (captureRows.has(reference) && captureRows.get(reference) !== bytes) return false;
    captureRows.set(reference, bytes); return true; }, read: (reference: string) => captureRows.get(reference) ?? null,
    owner: 'part-ten' as const };
  let receiverContext: FactContext = context;
  const receive = (request: PeerRequest) => value(receiveFixedPeerRequest({ request, descriptor: d,
    authenticatedStudio: d.studio, context: receiverContext, storage: remote, captures, boundary: f.c, reserve: () => {} }));
  let alter: (response: PeerResponse, request: PeerRequest) => PeerResponse = response => response;
  const transport = { owner: 'part-ten' as const, roundTrip: (request: PeerRequest) => ({ peer: d.laptop,
    trust: d.trust, response: alter(receive(request), request) }) };
  const adapter = value(createFixedPeerReplication({ descriptor: d, local: storage(localRows), context,
    captures: () => available, transport, boundary: f.c }));
  return { f, d, context, available, first, second, localRows, remoteRows, captureRows, adapter, receive,
    receiverContext: (next: FactContext) => { receiverContext = next; },
    alter: (fn: typeof alter) => { alter = fn; } };
}
it('R3-P2 exact full prefix is admitted through real Two storage, projection and receipt ports', () => {
  const h = harness();
  const receipts = value(h.adapter.durability.ensure([h.first, h.second]));
  expect(receipts.map(r => [r.fact.id, r.durability])).toEqual([
    [h.first.id, { kind: 'replicated', n: 1, peers: [h.d.laptop] }],
    [h.second.id, { kind: 'replicated', n: 1, peers: [h.d.laptop] }],
  ]);
  expect(value(createFactStore(h.context, { owner: 'part-ten', read: () => h.remoteRows,
    append: () => h.f.success({ kind: 'local-durable' }) }).read()).map(f => f.contentHash))
    .toEqual([h.first.contentHash, h.second.contentHash]);
  expect(value(h.adapter.verify())).toHaveLength(2);
  expect(h.remoteRows).toHaveLength(2);
});
it.each([
  ['wrong machine', (r: PeerResponse) => ({ ...r, laptop: 'machine-a' })],
  ['wrong store', (r: PeerResponse) => ({ ...r, store: 'facts:other' })],
  ['replayed challenge', (r: PeerResponse) => ({ ...r, challenge: '0'.repeat(64) })],
  ['wrong frontier', (r: PeerResponse) => ({ ...r, prefixDigest: 'sha256:' + '0'.repeat(64) })],
  ['partial prefix', (r: PeerResponse) => ({ ...r, persistedFacts: r.persistedFacts.slice(0, 1) })],
  ['changed hash', (r: PeerResponse) => ({ ...r, persistedFacts: [{ ...r.persistedFacts[0]!, hash: 'changed' }, ...r.persistedFacts.slice(1)] })],
] as const)('R3-P2 refuses %s response despite remote bytes', (_label, tamper) => {
  const h = harness(); h.alter(r => tamper(r)); refused(h.adapter.durability.ensure([h.first, h.second]), 'peer response differs');
});
it('R3-P2 missing ancestor, same machine alias and finite bounds refuse before receipt', () => {
  const h = harness(); refused(h.adapter.durability.ensure([h.second]), 'required causal ancestor missing');
  refused(createFixedPeerReplication({ descriptor: { ...h.d, studio: h.d.laptop }, local: h.adapter.storage,
    context: h.context, captures: () => h.available, transport: { owner: 'part-ten', roundTrip: () => { throw Error('must not call'); } }, boundary: h.f.c }), 'distinct enrolled Laptop');
  refused(createFixedPeerReplication({ descriptor: { ...h.d, limits: { ...h.d.limits, timeoutMs: 0 } },
    local: h.adapter.storage, context: h.context, captures: () => h.available, transport: { owner: 'part-ten', roundTrip: () => { throw Error('must not call'); } },
    boundary: h.f.c }), 'finite peer bounds');
});
it('R3-P2 a smaller Eight closure transfers the entire segment prefix and receipts only its requested facts', () => {
  const h = harness(), later = h.f.next(h.second);
  h.localRows.push(later);
  const receipts = value(h.adapter.durability.ensure([h.first, h.second]));
  expect(receipts.map(r => r.fact.id)).toEqual([h.first.id, h.second.id]);
  expect(h.remoteRows.map(f => f.id)).toEqual([h.first.id, h.second.id, later.id]);
});
it('R3-P2 wrong authenticated channel and unavailable receiver hold', () => {
  const h = harness();
  const wrong = value(createFixedPeerReplication({ descriptor: h.d,
    local: { owner: 'part-ten', read: () => h.localRows, append: () => h.f.success({ kind: 'local-durable' }) },
    context: h.context, captures: () => h.available, boundary: h.f.c,
    transport: { owner: 'part-ten', roundTrip: request => ({ peer: 'machine-a', trust: h.d.trust, response: h.receive(request) }) } }));
  refused(wrong.durability.ensure([h.first, h.second]), 'authenticated Laptop');
  const offline = value(createFixedPeerReplication({ descriptor: h.d,
    local: { owner: 'part-ten', read: () => h.localRows, append: () => h.f.success({ kind: 'local-durable' }) },
    context: h.context, captures: () => h.available, boundary: h.f.c,
    transport: { owner: 'part-ten', roundTrip: () => { throw Error('peer offline'); } } }));
  refused(offline.durability.ensure([h.first, h.second]), 'peer offline');
});
it('R3-P2 unknown receiver schema, missing capture and changed descriptor limits hold', () => {
  const unknown = harness(); unknown.receiverContext({ ...unknown.context, schemas: [] });
  refused(unknown.adapter.durability.ensure([unknown.first, unknown.second]), 'unknown kind');
  const missing = harness();
  const reference = Object.keys(missing.available)[0]!;
  const captures = { ...missing.available, [reference]: { ...missing.available[reference]!, status: 'missing' as const } };
  const candidate = value(createFixedPeerReplication({ descriptor: missing.d,
    local: { owner: 'part-ten', read: () => missing.localRows, append: () => missing.f.success({ kind: 'local-durable' }) },
    context: missing.context, captures: () => captures, boundary: missing.f.c,
    transport: { owner: 'part-ten', roundTrip: request => ({ peer: missing.d.laptop,
      trust: missing.d.trust, response: missing.receive(request) }) } }));
  refused(candidate.durability.ensure([missing.first, missing.second]), 'required capture unavailable');
  const changed = harness(); changed.alter(r => ({ ...r, descriptorDigest: 'sha256:' + '0'.repeat(64) }));
  refused(changed.adapter.durability.ensure([changed.first, changed.second]), 'peer response differs');
  const tombstoned = harness();
  const receiverRef = Object.keys(tombstoned.available)[0]!;
  tombstoned.receiverContext({ ...tombstoned.context, captures: { ...tombstoned.available,
    [receiverRef]: { ...tombstoned.available[receiverRef]!, status: 'tombstoned' as const, bytes: null } } });
  refused(tombstoned.adapter.durability.ensure([tombstoned.first, tombstoned.second]), 'receiver capture status conflict');
});
it('R3-P2 request, response, fact, attempt and deadline bounds refuse without hidden retry', () => {
  const h = harness();
  const make = (limits: PeerDescriptor['limits']) => createFixedPeerReplication({ descriptor: { ...h.d, limits },
    local: { owner: 'part-ten', read: () => h.localRows, append: () => h.f.success({ kind: 'local-durable' }) },
    context: h.context, captures: () => h.available, boundary: h.f.c,
    transport: { owner: 'part-ten', roundTrip: request => ({ peer: h.d.laptop, trust: h.d.trust,
      response: h.receive(request) }) } });
  refused(make({ ...h.d.limits, maxAttempts: 2 }), 'retry/queue');
  refused(make({ ...h.d.limits, timeoutMs: 0 }), 'finite peer bounds');
  refused(make({ ...h.d.limits, timeoutMs: undefined } as unknown as PeerDescriptor['limits']), 'finite peer bounds');
  refused(value(make({ ...h.d.limits, maxFacts: 1 })).durability.ensure([h.first, h.second]), 'fact count bound');
  refused(value(make({ ...h.d.limits, maxRequestBytes: 1 })).durability.ensure([h.first, h.second]), 'request byte bound');
  const smallResponse = harness({ maxResponseBytes: 1 });
  refused(smallResponse.adapter.durability.ensure([smallResponse.first, smallResponse.second]), 'response byte bound');
});
it('R3-P2 descriptor refuses a different source epoch before remote receipt', () => {
  const h = harness();
  const wrong = value(createFixedPeerReplication({ descriptor: { ...h.d, epoch: 1 },
    local: { owner: 'part-ten', read: () => h.localRows, append: () => h.f.success({ kind: 'local-durable' }) },
    context: h.context, captures: () => h.available, boundary: h.f.c,
    transport: { owner: 'part-ten', roundTrip: () => { throw Error('remote must not be called'); } } }));
  refused(wrong.durability.ensure([h.first, h.second]), 'peer source/epoch differs');
});
it('R3 host wrapper requires exact installed host-key file and restricted Studio key before any socket', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'instar-peer-host-pin-')));
  try {
    const knownHosts = join(root, 'known-hosts'), identityFile = join(root, 'identity');
    const unrelatedSystemHosts = join(root, 'system-known-hosts');
    const known = 'laptop-fixed ssh-ed25519 VEVTVEtFWQ==\n';
    writeFileSync(knownHosts, known, { mode: 0o600 }); writeFileSync(identityFile, 'test-only', { mode: 0o600 });
    writeFileSync(unrelatedSystemHosts, 'laptop-fixed ssh-ed25519 T1RIRVJLRVk=\n', { mode: 0o600 });
    const knownHostsDigest = `sha256:${createHash('sha256').update(known).digest('hex')}`;
    const config = { host: 'laptop.example', port: 22, user: 'instar-custody', knownHosts,
      knownHostsDigest, hostKeyAlias: 'laptop-fixed', identityFile, peer: 'm_cc2ec651a91f',
      trust: knownHostsDigest, timeoutMs: 1000, maxRequestBytes: 100000, maxResponseBytes: 10000 };
    expect(createPinnedSshPeerTransport(config).owner).toBe('part-ten');
    const effective = spawnSync('/usr/bin/ssh', ['-G', ...pinnedSshTrustOptions(knownHosts, 'laptop-fixed'),
      '-i', identityFile, 'laptop.example'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' } });
    expect(effective.status).toBe(0);
    expect(effective.stdout).toContain(`userknownhostsfile ${knownHosts}`);
    expect(effective.stdout).toContain('globalknownhostsfile /dev/null');
    expect(effective.stdout).toContain('hostkeyalgorithms ssh-ed25519');
    expect(pinnedSshTrustOptions(knownHosts, 'laptop-fixed')).toContain('KnownHostsCommand=none');
    expect(effective.stdout).not.toMatch(/^knownhostscommand [^\n]+/m);
    expect(effective.stdout).toContain('verifyhostkeydns false');
    expect(effective.stdout).toContain('updatehostkeys false');
    const withSystemTrust = spawnSync('/usr/bin/ssh', ['-G', ...pinnedSshTrustOptions(knownHosts, 'laptop-fixed'),
      '-o', `GlobalKnownHostsFile=${unrelatedSystemHosts}`, '-i', identityFile, 'laptop.example'],
    { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' } });
    expect(withSystemTrust.status).toBe(0);
    expect(withSystemTrust.stdout).toContain('globalknownhostsfile /dev/null');
    expect(withSystemTrust.stdout).not.toContain(unrelatedSystemHosts);
    expect(() => createPinnedSshPeerTransport({ ...config, trust: 'wrong-pin' })).toThrow('enrolled host trust');
    writeFileSync(knownHosts, 'laptop-fixed ssh-ed25519 OTHERKEY\n');
    expect(() => createPinnedSshPeerTransport(config)).toThrow('pinned SSH peer configuration invalid');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
it('R3 owner-derived Intent.raw custody survives cold receiver and refuses context-only bytes', () => {
  const f = factsFixture(), intent = f.intentInput(), rawHash = intent.raw as string;
  const captures = Object.fromEntries(Object.entries(f.captures).map(([reference, bytes]) =>
    [reference, { hash: hashBytes(bytes), bytes, byteLength: Buffer.byteLength(bytes), status: 'available' as const }]));
  const schema = { ...f.schema, fields: { ...f.schema.fields, intent: { kind: 'constitutional' as const, type: 'Intent' as const } } };
  const context: FactContext = { ...f.ctx, schemas: [schema], captures };
  const fact = f.fact({ body: { identity: 'one', amount: '10', intent } }, context);
  const d: PeerDescriptor = { ...descriptor(), captureReferences: Object.keys(captures),
    limits: { ...descriptor().limits, maxCaptures: 64, maxCaptureBytes: 100000,
      maxRequestBytes: 1000000, maxDiskBytes: 3000000 } };
  const rows: FactEnvelope[] = [], persisted = new Map<string, string>();
  const remote: SegmentStoragePort = { owner: 'part-ten', read: () => rows,
    append: wire => { rows.push(JSON.parse(wire)); return f.success({ kind: 'local-durable' }); } };
  const port = { owner: 'part-ten' as const,
    preserve: (reference: string, bytes: string) => { persisted.set(reference, bytes); return true; },
    read: (reference: string) => persisted.get(reference) ?? null };
  const cold: FactContext = { ...context, captures: Object.fromEntries(Object.entries(captures).map(([reference, c]) =>
    [reference, { ...c, bytes: null, status: 'missing' as const }])) };
  let sent: PeerRequest | undefined;
  const adapter = value(createFixedPeerReplication({ descriptor: d,
    local: { owner: 'part-ten', read: () => [fact], append: () => f.success({ kind: 'local-durable' }) },
    context, captures: () => captures, boundary: f.c,
    transport: { owner: 'part-ten', roundTrip: request => {
      sent = request;
      return { peer: d.laptop, trust: d.trust, response: value(receiveFixedPeerRequest({ request, descriptor: d,
        authenticatedStudio: d.studio, context: cold, storage: remote, captures: port, boundary: f.c, reserve: () => {} })) };
    } } }));
  expect(value(adapter.durability.ensure([fact]))).toHaveLength(1);
  expect(sent?.captures.some(c => c.reference === rawHash && c.bytes === f.captures[rawHash])).toBe(true);
  expect(persisted.get(rawHash)).toBe(f.captures[rawHash]);
  expect(value(adapter.verify())).toHaveLength(1);
  const withoutRaw = Object.fromEntries(Object.entries(captures).filter(([reference]) => reference !== rawHash));
  const contextOnly = value(createFixedPeerReplication({ descriptor: d,
    local: { owner: 'part-ten', read: () => [fact], append: () => f.success({ kind: 'local-durable' }) },
    context, captures: () => withoutRaw, boundary: f.c,
    transport: { owner: 'part-ten', roundTrip: () => { throw Error('context bytes must not authorize transport'); } } }));
  refused(contextOnly.durability.ensure([fact]), 'required capture unavailable');
  const omitted = { ...sent!, captures: sent!.captures.filter(c => c.reference !== rawHash) };
  refused(receiveFixedPeerRequest({ request: omitted, descriptor: d, authenticatedStudio: d.studio,
    context, storage: remote, captures: { ...port, read: () => null }, boundary: f.c, reserve: () => {} }));
});
it('R3 sender capture memo invalidates on approved hash or prefix change and falls back when a removed capture becomes required', () => {
  const f = factsFixture(), intent = f.intentInput(), raw = intent.raw as string;
  const available = Object.fromEntries(Object.entries(f.captures).map(([reference, bytes]) =>
    [reference, { hash: hashBytes(bytes), bytes, byteLength: Buffer.byteLength(bytes), status: 'available' as const }]));
  const captured = { ...f.schema, kind: 'note-captured', fields: { ...f.schema.fields,
    intent: { kind: 'constitutional' as const, type: 'Intent' as const } } };
  const context: FactContext = { ...f.ctx, schemas: [f.schema, captured], captures: available };
  const first = f.fact({}, context), second = f.next(first,
    { kind: 'note-captured', body: { identity: 'two', amount: '10', intent } }, context);
  const d: PeerDescriptor = { ...descriptor(), captureReferences: Object.keys(available),
    limits: { ...descriptor().limits, maxFacts: 4, maxCaptures: 64, maxCaptureBytes: 100000,
      maxRequestBytes: 1000000, maxDiskBytes: 3000000 } };
  const localRows = [first], remoteRows: FactEnvelope[] = [], saved = new Map<string, string>();
  let reads = 0, sent: PeerRequest | undefined;
  const local: SegmentStoragePort = { owner: 'part-ten', read: () => { reads++; return localRows; },
    append: () => f.success({ kind: 'local-durable' }) };
  const remote: SegmentStoragePort = { owner: 'part-ten', read: () => remoteRows,
    append: bytes => { remoteRows.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' }); } };
  const adapter = value(createFixedPeerReplication({ descriptor: d, local, context, captures: () => available,
    boundary: f.c, transport: { owner: 'part-ten', roundTrip: request => {
      sent = request;
      return { peer: d.laptop, trust: d.trust, response: value(receiveFixedPeerRequest({ request, descriptor: d,
        authenticatedStudio: d.studio, context, storage: remote,
        captures: { owner: 'part-ten', preserve: (reference, bytes) => { saved.set(reference, bytes); return true; },
          read: reference => saved.get(reference) ?? null }, boundary: f.c, reserve: () => {} })) };
    } } }));
  value(adapter.durability.ensure([first]));
  expect(sent?.captures.some(c => c.reference === raw)).toBe(false);
  reads = 0; value(adapter.durability.ensure([first]));
  const cachedReads = reads;
  const original = available[raw]!;
  const changed = 'different approved candidate bytes';
  available[raw] = { ...original, bytes: changed, hash: hashBytes(changed), byteLength: Buffer.byteLength(changed) };
  reads = 0; value(adapter.durability.ensure([first]));
  expect(reads).toBeGreaterThan(cachedReads);
  available[raw] = original;
  localRows.push(second);
  value(adapter.durability.ensure([first, second]));
  expect(sent?.captures.some(c => c.reference === raw && c.hash === original.hash)).toBe(true);
  expect(remoteRows.map(row => row.id)).toEqual([first.id, second.id]);
});
function eightPeerHarness(online: boolean, stopAfterRemote = false) {
  const f = effectFixture(), request = f.prepare(), rows: FactEnvelope[] = [], captureRows = new Map<string, string>();
  const allCaptures = { ...Object.fromEntries(Object.entries(f.ctx.decode.captures).map(([reference, bytes]) =>
    [reference, { hash: hashBytes(bytes), bytes, byteLength: Buffer.byteLength(bytes), status: 'available' as const }])),
    ...f.ctx.captures };
  const d: PeerDescriptor = { ...descriptor(), captureReferences: Object.keys(allCaptures),
    capturePrefixes: ['record:', 'capture:', 'sha256:', 'effect-capture:'],
    limits: { ...descriptor().limits, maxRequestBytes: 2000000, maxResponseBytes: 20000,
      maxFacts: 128, maxCaptures: 128, maxCaptureBytes: 1000000, maxDiskBytes: 4000000 } };
  const remote: SegmentStoragePort = { owner: 'part-ten', read: () => rows, append: (wire, expected) => {
    if ((rows.at(-1)?.contentHash ?? null) !== expected) throw Error('remote compare-head');
    rows.push(JSON.parse(wire)); return f.success({ kind: 'local-durable' });
  } };
  const captures = { owner: 'part-ten' as const, preserve: (reference: string, bytes: string) => {
    if (captureRows.has(reference) && captureRows.get(reference) !== bytes) return false;
    captureRows.set(reference, bytes); return true; }, read: (reference: string) => captureRows.get(reference) ?? null };
  const transport = { owner: 'part-ten' as const, roundTrip: (wire: PeerRequest) => {
    if (!online) throw Error('Laptop disconnected');
    const response = value(receiveFixedPeerRequest({ request: wire, descriptor: d, authenticatedStudio: d.studio,
      context: f.ctx, storage: remote, captures, boundary: f.host.boundary, reserve: () => {} }));
    if (stopAfterRemote) f.stop();
    return { peer: d.laptop, trust: d.trust, response };
  } };
  const peer = value(createFixedPeerReplication({ descriptor: d, local: f.replicas.storage,
    context: f.ctx, captures: () => ({ ...Object.fromEntries(Object.entries(f.ctx.decode.captures).map(([reference, bytes]) =>
      [reference, { hash: hashBytes(bytes), bytes, byteLength: Buffer.byteLength(bytes), status: 'available' as const }])),
      ...f.ctx.captures }), transport, boundary: f.host.boundary }));
  const doorway = createEffectDoorway({ ...f.composition, durability: peer.durability });
  return { f, request, rows, doorway, peer };
}
it('R3-P8 real Eight replicated operation refuses peer loss before fixture effect', () => {
  const { f, request, doorway } = eightPeerHarness(false);
  refused(doorway.dispatch(request, f.fence), 'Laptop disconnected'); expect(f.calls()).toBe(0);
});
it('R3-P8 fresh real Eight operation dispatches once after exact remote Two receipts', () => {
  const { f, request, doorway, rows } = eightPeerHarness(true);
  const observation = value(doorway.dispatch(request, f.fence));
  expect(observation.stage).toBe('response'); expect(f.calls()).toBe(1);
  expect(rows.length).toBeGreaterThan(0);
  expect(value(doorway.dispatch(request, f.fence)).id).toBe(observation.id);
  expect(f.calls()).toBe(1);
});
it('R3-P8 stop after remote fsync is rechecked before any physical effect', () => {
  const { f, request, doorway, rows } = eightPeerHarness(true, true);
  refused(doorway.dispatch(request, f.fence), 'stop');
  expect(rows.length).toBeGreaterThan(0);
  expect(f.calls()).toBe(0);
});

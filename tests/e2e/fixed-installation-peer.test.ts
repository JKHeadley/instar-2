/** Desk-only Studio/Laptop proof. Default offline runs do not open any peer socket.
 * The installed module is pinned outside the repository and must provide the
 * genuine R4/R6 context and a safe Eight operation whose adapter is replaced
 * below with an in-process sentinel. No provider or Telegram method is called. */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { createFixedPeerReplication, receiveFixedPeerRequest } from '../../src/assembly/production-replication.js';
import type { PeerDescriptor, PeerRequest } from '../../src/assembly/production-replication.js';
import { hashBytes } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createEffectDoorway } from '../../src/effects/index.js';
import { boundary } from '../../src/assembly/boundary.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
// @ts-expect-error fixed host transport is JavaScript outside the pure core.
import { createPinnedSshPeerTransport } from '../../scripts/fixed-installation-peer-client.mjs';

const physical = process.env.INSTAR_PEER_PHYSICAL_CONFIG;
it('R6 offline e2e receiver holds unapproved bytes and verifies only durably retained approved extras', () => {
  const f = factsFixture(), fact = f.fact();
  const available = Object.fromEntries(Object.entries(f.captures).map(([reference, bytes]) =>
    [reference, { hash: hashBytes(bytes), bytes, byteLength: Buffer.byteLength(bytes), status: 'available' as const }]));
  const extra = { reference: 'extra:approved', bytes: 'bounded extra', hash: hashBytes('bounded extra') };
  const d: PeerDescriptor = { installation: 'offline:e2e', studio: 'machine-a', laptop: 'm_cc2ec651a91f',
    store: 'facts:offline-e2e', epoch: 0, trust: 'ssh:offline-test', custody: 'policy:offline-test',
    captureReferences: [...Object.keys(available), extra.reference], capturePrefixes: [],
    limits: { maxRequestBytes: 100000, maxResponseBytes: 10000, maxFacts: 8, maxCaptures: 64,
      maxCaptureBytes: 10000, maxDiskBytes: 300000, maxQueue: 1, timeoutMs: 1000, maxAttempts: 1 } };
  const context = { ...f.ctx, captures: available };
  const rows: FactEnvelope[] = [], retained = new Map<string, string>();
  const storage = { owner: 'part-ten' as const, read: () => rows,
    append: (wire: string) => { rows.push(JSON.parse(wire)); return f.success({ kind: 'local-durable' as const }); } };
  const captures = { owner: 'part-ten' as const,
    preserve: (reference: string, bytes: string) => { retained.set(reference, bytes); return true; },
    read: (reference: string) => retained.get(reference) ?? null };
  const receive = (request: PeerRequest) => receiveFixedPeerRequest({ request, descriptor: d,
    authenticatedStudio: d.studio, context, storage, captures, boundary: f.c, reserve: () => {} });
  let sent: PeerRequest | undefined;
  const sender = value(createFixedPeerReplication({ descriptor: d,
    local: { owner: 'part-ten', read: () => [fact],
      append: () => f.success({ kind: 'local-durable' }) }, context,
    captures: () => ({ ...available, [extra.reference]: { ...extra,
      byteLength: Buffer.byteLength(extra.bytes), status: 'available' as const } }), boundary: f.c,
    transport: { owner: 'part-ten', roundTrip: request => { sent = request; throw Error('offline probe'); } } }));
  refused(sender.durability.ensure([fact]), 'offline probe');
  expect(sent!.captures.some(c => c.reference === extra.reference)).toBe(false);
  refused(receive({ ...sent!, captures: [...sent!.captures,
    { ...extra, reference: 'extra:unapproved' }] }), 'capture policy/hash bound');
  expect(rows).toHaveLength(0);
  const approved = { ...sent!, captures: [...sent!.captures, extra] };
  expect(value(receive(approved)).persistedCaptures).toEqual(approved.captures.map(c => ({ reference: c.reference, hash: c.hash })));
  expect(retained.get(extra.reference)).toBe(extra.bytes);
  expect(value(receive({ ...approved, operation: 'verify' })).persistedFacts).toHaveLength(1);
  retained.delete(extra.reference);
  refused(receive({ ...approved, operation: 'verify' }), 'capture readback differs');
});
it.skipIf(!physical)('R3 PHYSICAL Studio/Laptop exact-prefix and Eight gate, desk provisioned only', async () => {
  const pin = process.env.INSTAR_PEER_PHYSICAL_CONFIG_DIGEST;
  if (!physical?.startsWith('/') || realpathSync(physical) !== physical || !lstatSync(physical).isFile()
    || `sha256:${createHash('sha256').update(readFileSync(physical)).digest('hex')}` !== pin)
    throw Error('physical proof configuration pin missing or changed');
  const module = await import(pathToFileURL(physical).href);
  if (typeof module.openPhysicalPeerProof !== 'function') throw Error('physical proof factory missing');
  const proof = await module.openPhysicalPeerProof();
  if (proof.descriptor.laptop !== 'm_cc2ec651a91f' || proof.descriptor.studio === proof.descriptor.laptop
    || proof.studioIdentity !== proof.descriptor.studio || proof.laptopIdentity !== proof.descriptor.laptop
    || proof.independentRoots !== true || !proof.serviceDigest || !proof.artifactDigest)
    throw Error('physical two-machine identity/custody evidence missing');
  const transport = createPinnedSshPeerTransport(proof.ssh);
  const adapter = value(createFixedPeerReplication({ descriptor: proof.descriptor, local: proof.local,
    context: proof.context, captures: proof.captures, transport, boundary: proof.boundary }));
  // An actual round trip and genuine remote Two readback, including captures.
  const receipts = value(adapter.durability.ensure(proof.prefix));
  expect(receipts).toHaveLength(proof.prefix.length);
  expect(receipts.every(r => r.durability.kind === 'replicated'
    && r.durability.peers[0] === proof.descriptor.laptop)).toBe(true);
  expect(value(adapter.verify())).toHaveLength(proof.prefix.length);

  // Test only Eight's dispatch gate. The safe sentinel has no external route.
  let effects = 0;
  const sentinel = { ...proof.composition.adapter,
    invoke: () => boundary('PhysicalPeerEffectSentinel', null, proof.boundary, () => { effects++; return 'safe-test-observation'; }),
    observe: () => boundary('PhysicalPeerEffectSentinelRead', null, proof.boundary, () => 'safe-test-observation') };
  const offline = createEffectDoorway({ ...proof.composition, adapter: sentinel,
    durability: { owner: 'part-ten', ensure: () => boundary('PeerDisconnected', null, proof.boundary,
      () => { throw Error('peer disconnected'); }) } });
  refused(offline.dispatch(proof.request, proof.fence), 'peer disconnected');
  expect(effects).toBe(0);
  // A fresh approved operation supplied by the desk proves reconnected dispatch.
  // Reuse of the failed operation would violate Six/Eight uncertainty rules.
  const online = createEffectDoorway({ ...proof.freshComposition, adapter: sentinel, durability: adapter.durability });
  const observed = value(online.dispatch(proof.freshRequest, proof.freshFence));
  expect(observed).toBeDefined();
  expect(effects).toBe(1);
  expect(proof.secondVoterCreated).toBe(false);
  expect(proof.localFallbackConfigured).toBe(false);
}, 60000);

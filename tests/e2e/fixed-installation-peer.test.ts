/** Desk-only Studio/Laptop proof. Default offline runs do not open any peer socket.
 * The installed module is pinned outside the repository and must provide the
 * genuine R4/R6 context and a safe Eight operation whose adapter is replaced
 * below with an in-process sentinel. No provider or Telegram method is called. */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { createFixedPeerReplication } from '../../src/assembly/production-replication.js';
import { createEffectDoorway } from '../../src/effects/index.js';
import { boundary } from '../../src/assembly/boundary.js';
import { refused, value } from '../facts/fixtures.js';
// @ts-expect-error fixed host transport is JavaScript outside the pure core.
import { createPinnedSshPeerTransport } from '../../scripts/fixed-installation-peer-client.mjs';

const physical = process.env.INSTAR_PEER_PHYSICAL_CONFIG;
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

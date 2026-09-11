import { expect, it } from 'vitest';
import { exerciseP16MixedRuntimeProof } from '../measurement/mixed-runtime-proof.js';

it('P16-NF-16 P16-NF-24 P16-NF-33 P16-NF-36 P16-NF-37 P16-NF-38 P16-NF-46 P16-NF-47 P16-NF-48 P16-NF-50 P16-NF-53 MIXED-RUNTIME-PROOF integration executes every runnable mixed arm', () => {
  expect(exerciseP16MixedRuntimeProof()).toMatchObject({ projection: '1', copiedSnapshotRefused: true,
    sameMillisecondEventIds: ['rate:a', 'rate:b'], aggregateAmount: 100, aggregateMembers: 2,
    peerPool: { state: 'partial', missingPeers: [{ peer: 'offline', lastFrontier: 'frontier:old' }] },
    admittedEvidence: 'mixed-proof:evidence' });
});

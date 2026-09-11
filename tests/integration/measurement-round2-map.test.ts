import { expect, it } from 'vitest';
import { exerciseP16MixedRuntimeProof, verifyP16MixedRuntimeProof } from '../measurement/mixed-runtime-proof.js';

it('P16-NF-16 P16-NF-24 P16-NF-33 P16-NF-36 P16-NF-37 P16-NF-38 P16-NF-46 P16-NF-47 P16-NF-48 P16-NF-50 P16-NF-53 MIXED-RUNTIME-PROOF integration executes every runnable mixed arm', () => {
  expect(verifyP16MixedRuntimeProof(exerciseP16MixedRuntimeProof())).toMatchObject({ sourceHistory: { initial: '1', staleAfterAdvance: true, fresh: '2', persistedFacts: 2 },
    rateEvents: { ids: ['rate:a', 'rate:b'], collisionRefused: true }, aggregation: { amount: 100, members: 2 },
    peerUnion: { state: 'complete' }, missingPeer: { state: 'partial', missingPeers: [{ peer: 'offline', lastFrontier: 'frontier:old' }], skewRefused: true },
    historicalRead: { rows: 1, deterministic: true },
    burn: { currentAmount: 120 }, read: { privacyRefused: true }, resource: { legacyOrigins: expect.any(Array) },
    observerCost: { amount: 5 }, growth: { observations: 1 } });
});

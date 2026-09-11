import { expect, it } from 'vitest';
// @ts-expect-error Executable repository contract checker is intentionally JavaScript.
import { checkP16Architecture, p16Dispositions } from '../../scripts/check-p16-contract-map.mjs';
import { exerciseP16MixedRuntimeProof, verifyP16MixedRuntimeProof } from './mixed-runtime-proof.js';

it('P16-NF-52 P16-NF-53 contract map keeps all 53 fixtures and distinguishes mixed runnable arms from exact follow-ons', () => {
  const rows = p16Dispositions() as { id: string; status: string; dependencies: string[] }[];
  expect(rows).toHaveLength(53);
  expect(rows.filter(row => row.status === 'EXECUTABLE').map(row => row.id)).toEqual([
    'P16-NF-01', 'P16-NF-02', 'P16-NF-05', 'P16-NF-12', 'P16-NF-13', 'P16-NF-22', 'P16-NF-23',
    'P16-NF-25', 'P16-NF-26', 'P16-NF-27', 'P16-NF-28', 'P16-NF-29', 'P16-NF-30',
    'P16-NF-34', 'P16-NF-39', 'P16-NF-40', 'P16-NF-41', 'P16-NF-52',
  ]);
  expect(rows.filter(row => row.status.startsWith('MIXED-EXECUTABLE-')).map(row => row.id)).toEqual([
    'P16-NF-16', 'P16-NF-24', 'P16-NF-33', 'P16-NF-36', 'P16-NF-37', 'P16-NF-38', 'P16-NF-46',
    'P16-NF-47', 'P16-NF-48', 'P16-NF-50',
  ]);
  expect(rows.filter(row => row.status.startsWith('NON-EXECUTABLE-'))).toHaveLength(24);
  expect(rows.find(row => row.id === 'P16-NF-53')?.status).toBe('SUPPLEMENTAL-EXECUTABLE-NON-GOVERNING');
  expect(rows.filter(row => row.status.startsWith('NON-EXECUTABLE-') || row.status.startsWith('MIXED-EXECUTABLE-'))
    .every(row => row.dependencies.length > 0)).toBe(true);
  expect(checkP16Architecture()).toMatchObject({ declarations: 2 });
  expect(verifyP16MixedRuntimeProof(exerciseP16MixedRuntimeProof())).toMatchObject({ sourceHistory: { staleAfterAdvance: true, persistedFacts: 2 },
    aggregation: { amount: 100 }, missingPeer: { state: 'partial' } });
});

it('P16-NF-16 P16-NF-24 P16-NF-33 P16-NF-36 P16-NF-37 P16-NF-38 P16-NF-46 P16-NF-47 P16-NF-48 P16-NF-50 P16-NF-53 MIXED-RUNTIME-PROOF unit executes every runnable mixed arm', () => {
  expect(verifyP16MixedRuntimeProof(exerciseP16MixedRuntimeProof())).toMatchObject({
    sourceHistory: { initial: '1', staleAfterAdvance: true, fresh: '2', persistedFacts: 2 },
    rateEvents: { ids: ['rate:a', 'rate:b'], counts: { 'circuit-open': 1, '529': 1 }, breakerTripsPerHour: 1,
      collisionRefused: true },
    aggregation: { amount: 100, members: 2 }, peerUnion: { state: 'complete' },
    missingPeer: { state: 'partial', missingPeers: [{ peer: 'offline' }], skewRefused: true }, historicalRead: { rows: 1, deterministic: true },
    burn: { classification: 'activity', currentAmount: 120 }, read: { rows: 2, partial: true, privacyRefused: true },
    resource: { state: 'complete', rssDeltaBytes: 10,
      legacyOrigins: ['reported', 'reported', 'reported', 'legacy-origin-lost'] },
    observerCost: { state: 'resolved', amount: 5 }, growth: { observations: 1 }, cacheRows: 1,
  });
});

import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { exerciseP16MixedRuntimeProof, verifyP16MixedRuntimeProof } from '../measurement/mixed-runtime-proof.js';

it('P16-NF-16 P16-NF-24 P16-NF-33 P16-NF-36 P16-NF-37 P16-NF-38 P16-NF-46 P16-NF-47 P16-NF-48 P16-NF-50 P16-NF-53 MIXED-RUNTIME-PROOF lifecycle executes owner snapshots, same-ms events, aggregation, and partial peers', () => {
  const result = verifyP16MixedRuntimeProof(exerciseP16MixedRuntimeProof());
  expect(result.sourceHistory).toEqual({ initial: '1', staleAfterAdvance: true, fresh: '2', persistedFacts: 2 });
  expect(result.rateEvents).toMatchObject({ ids: ['rate:a', 'rate:b'], collisionRefused: true });
  expect(result.aggregation).toEqual({ amount: 100, members: 2 });
  expect(result.peerUnion).toMatchObject({ state: 'complete', members: [expect.any(String), expect.any(String)] });
  expect(result.missingPeer).toMatchObject({ state: 'partial', members: [expect.any(String)], missingPeers: [{ peer: 'offline' }], skewRefused: true });
  expect(result).toMatchObject({ burn: { currentAmount: 120 }, read: { privacyRefused: true },
    resource: { state: 'complete' }, historicalRead: { rows: 1, deterministic: true },
    observerCost: { amount: 5 }, growth: { observations: 1 }, cacheRows: 1 });
});

it('P16-NF-40 P16-NF-41 P16-NF-50 real SIGKILL cuts preserve signed source uncertainty and rebuild an empty disposable cache', () => {
  const rows = JSON.parse(execFileSync(process.execPath, ['scripts/slice-measurement-restart-cuts.mjs'], { encoding: 'utf8' })) as {
    cut: string; signal: string | null; recovered: { facts: number; values: Record<string, string>; cache: unknown[] }; equalRepeatedRead: boolean;
  }[];
  expect(rows).toHaveLength(10);
  expect(rows.filter(row => row.cut !== 'control').every(row => row.signal === 'SIGKILL')).toBe(true);
  expect(rows.every(row => row.equalRepeatedRead && row.recovered.cache.length === 0)).toBe(true);
  expect(rows.find(row => row.cut === 'before-rename')?.recovered.facts).toBe(0);
  expect(rows.find(row => row.cut === 'after-rename')?.recovered.values['note:one']).toBe('10');
}, 30_000);

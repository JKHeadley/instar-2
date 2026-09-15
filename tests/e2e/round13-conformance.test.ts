// @ts-nocheck -- adversarial provider rows and identity mutation intentionally violate the public contracts.
import { expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';

it('V107 P11-NF-25 P11-NF-28 P11-NF-43 P11-NF-45 P11-NF-49 matching fabricated digests cannot prove source reconstruction', async () => {
  const f = productionOperatorSlice();
  f.production.replay.rebuild = () => f.assembly.success(
    f.runtime.rebuildAll().map(row => ({ ...row,
      hash: hashBytes('unrelated bytes'), resumedHash: hashBytes('unrelated bytes') })),
  );
  await expect(f.runtime.drive()).rejects.toThrow('canonical source rebuild');
}, 300_000);

it('V108 P11-NF-43 P11-NF-47 P11-NF-49 P11-NF-51 a delivery-witness identity changed after boot is refused', async () => {
  const f = productionOperatorSlice();
  f.production.deliveryWitness.identity = f.production.requesterIdentity;
  await expect(f.runtime.drive()).rejects.toThrow('platform delivery witness');
}, 300_000);

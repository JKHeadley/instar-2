// @ts-nocheck -- adversarial replay rows intentionally violate the provider contract.
import { expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';

it('V57 P11-NF-25 P11-NF-28 P11-NF-43 P11-NF-45 P11-NF-49 differing genesis and checkpoint digests refuse slice acceptance', async () => {
  const f = productionOperatorSlice();
  f.production.replay.rebuild = () => f.assembly.success(
    f.runtime.rebuildAll().map(row => ({ ...row, resumedHash: hashBytes('wrong-checkpoint') })),
  );
  await expect(f.runtime.drive()).rejects.toThrow('matching digests at the current source vector');
}, 300_000);

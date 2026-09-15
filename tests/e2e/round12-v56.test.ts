// @ts-nocheck -- adversarial replay rows intentionally violate the provider contract.
import { expect, it } from 'vitest';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';

it('V56 P11-NF-25 P11-NF-28 P11-NF-43 P11-NF-45 P11-NF-49 rebuild evidence without digests or vectors refuses slice acceptance', async () => {
  const f = productionOperatorSlice();
  f.production.replay.rebuild = () => f.assembly.success(
    f.runtime.coordinator.handles.folds.map(row => ({ projection: row.definition.id, equal: 'equal' })),
  );
  await expect(f.runtime.drive()).rejects.toThrow('matching digests at the current source vector');
}, 300_000);

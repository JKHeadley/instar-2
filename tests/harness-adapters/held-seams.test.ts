import { it } from 'vitest';
// @ts-expect-error The contract-map checker is an executable JavaScript boundary.
import { p13Dispositions } from '../../scripts/check-p13-contract-map.mjs';

for (const row of p13Dispositions().filter((item: { status: string }) => item.status !== 'EXECUTABLE')) {
  it.skip(`${row.id} ${row.status}`, () => {
    throw new Error('an unlanded owner seam must never execute through a local stand-in');
  });
}

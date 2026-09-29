import { it, expect } from 'vitest';
// @ts-expect-error Native SIGKILL regression harness from the independent review.
import { cuts, runCut } from '../model-provider/review/cuts.mjs';
// @ts-expect-error Native assertion execution receipt.
import { runAssertions } from '../model-provider/review/assertions.mjs';
for (const cut of cuts as string[]) {
  it(`MODEL-PROVIDER-PATH REVIEW lifecycle SIGKILL ${cut}`, async () => {
    const result = await runAssertions(`cut-${cut}`, () => runCut(cut));
    expect(result.passed).toBe(true);
    expect(result.signal).toBe('SIGKILL');
    expect(result.pending).toBe(1);
  }, 240000);
}

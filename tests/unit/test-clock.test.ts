import { expect, it } from 'vitest';
import { testClockShift, TEST_CLOCK_MARGIN_MS } from '../setup/test-clock-env.js';
const END = 1_000_000_000_000;
it('leaves the clock alone until the margin, then holds tests at end minus the margin', () => {
  expect(testClockShift(END - TEST_CLOCK_MARGIN_MS - 1, END)).toBe(0);
  expect(testClockShift(END - TEST_CLOCK_MARGIN_MS, END)).toBe(0);
  for (const now of [END - TEST_CLOCK_MARGIN_MS + 1, END - 1, END, END + 86_400_000])
    expect(now + testClockShift(now, END)).toBe(END - TEST_CLOCK_MARGIN_MS);
});

it('pins historical fixture time even when the product window is renewed', async () => {
  const { TEST_FIXTURE_END } = await import('../setup/test-clock-env.js');
  for (const future of [Date.UTC(2026, 11, 12), Date.UTC(2030, 0, 1)])
    expect(future + testClockShift(future)).toBe(TEST_FIXTURE_END - TEST_CLOCK_MARGIN_MS);
});

// TEST-INFRASTRUCTURE: vitest globalSetup. Tests run real launchers on the real clock against a fixed fixture window, and
// the oldest common window is TEST_FIXTURE_END. Without this, a seven-day reminder appears a week before that end
// (2026-11-05: false reds on every head) and every launcher refuses after it. Once the real clock is within the margin
// of the end, tests run at end minus the margin. Product code and the shipped end are untouched; renewal must not advance this fixture anchor. Vitest captures
// process.env for the forks after globalSetup runs, as test-tmp.ts documents.
import { fileURLToPath } from 'node:url';
// Historical fixtures still use the November window. This is a fixture anchor, not product authority.
export const TEST_FIXTURE_END = 1794519600000;

export const TEST_CLOCK_MARGIN_MS = 21 * 86_400_000;

export function testClockShift(realNow: number, end = TEST_FIXTURE_END, margin = TEST_CLOCK_MARGIN_MS) {
  return realNow < end - margin ? 0 : end - margin - realNow;
}

export default function setup() {
  const shift = testClockShift(Date.now());
  process.env.INSTAR_TEST_CLOCK_SHIFT_MS = String(shift);
  if (!shift) return;
  const preload = fileURLToPath(new URL('./test-clock.mjs', import.meta.url));
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--import=${JSON.stringify(preload)}`].filter(Boolean).join(' ');
}

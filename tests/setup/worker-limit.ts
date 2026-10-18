// The desk caps the workers of one full-test run. Two concurrent full runs on the sixteen-core
// Studio ran twelve forks between them, saturated the host and cost the agent its own session
// (observer #192, 2026-10-05), so each full run is now launched with INSTAR_TEST_MAX_WORKERS.
// The requested cap only ever lowers the host formula in vitest.config.ts — a run can be made
// quieter, never louder — and an unusable value is reported rather than dropped in silence,
// because a cap that silently does not apply is the saturation it was set to prevent.

/** A plain decimal count: digits only, so no sign, point, exponent, space or trailing text. */
const DECIMAL_COUNT = /^[0-9]+$/;

export interface TestWorkerLimit {
  /** The worker count to run with: the host formula, or the requested cap when it is lower. */
  readonly limit: number;
  /** The unusable INSTAR_TEST_MAX_WORKERS text, or null when none was set or it was applied. */
  readonly ignoredValue: string | null;
}

/**
 * Resolve the worker count for one run. `requested` is the raw INSTAR_TEST_MAX_WORKERS text
 * (undefined when unset); `hostLimit` is the formula value, which is the ceiling and the
 * fallback. An unset or blank value keeps `hostLimit` exactly; anything that is not a positive
 * integer keeps it too and comes back named in `ignoredValue` for the caller to report.
 */
export function resolveTestWorkerLimit(requested: string | undefined, hostLimit: number): TestWorkerLimit {
  const text = requested === undefined ? '' : requested.trim();
  if (text === '') return { limit: hostLimit, ignoredValue: null };
  if (!DECIMAL_COUNT.test(text) || Number(text) < 1) return { limit: hostLimit, ignoredValue: requested ?? null };
  return { limit: Math.min(Number(text), hostLimit), ignoredValue: null };
}

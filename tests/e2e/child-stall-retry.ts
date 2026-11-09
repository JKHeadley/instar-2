// One retry for a whole, self-contained scenario whose fresh-process child the harness bound
// killed (Node's `code: 'ETIMEDOUT'`). See docs/defects/intake-restart-child-stall.md: twice on
// the Studio gate (2026-10-05 for 54 minutes, 2026-11-08 past its 20 s bound) one
// scripts/test-intake-restart.mjs child sat stalled while its siblings take about 100 ms.
// The caller must build the scenario fresh on each attempt (its own new directory), so the
// second attempt re-proves every assertion from nothing. Any other failure, including an
// assertion, is raised at once; a second stall is raised too, so a deterministic hang still fails.
export function isChildStall(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ETIMEDOUT';
}

export function retryOnceAfterChildStall<T>(label: string, scenario: () => T, note: (line: string) => void = line => process.stderr.write(line)): T {
  try { return scenario(); } catch (error) {
    if (!isChildStall(error)) throw error;
    note(`child-stall-retry: ${label}: a child hit its harness bound (ETIMEDOUT); rerunning the whole scenario once in a fresh directory\n`);
    return scenario();
  }
}

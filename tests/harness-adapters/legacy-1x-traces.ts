/**
 * Executable reproductions of the 1.x behaviors pinned by design section 10.
 * These functions are legacy trace fixtures only: none is a Part Four, Five,
 * Six, or Eight implementation and none can satisfy a governed positive arm.
 */
export function legacyPendingInjectList(enumerate: () => readonly string[]): Readonly<{
  records: readonly string[]; warnings: readonly string[]; losses: readonly string[];
}> {
  try { return { records: enumerate(), warnings: [], losses: [] }; }
  catch { return { records: [], warnings: [], losses: [] }; }
}

export function legacyNewestRolloutRecovery(baseline: number, newest: Readonly<{ worker: string; size: number }>): boolean {
  return newest.size > baseline;
}

export function legacyHasSession(tmuxAsyncEnabled: boolean, probe: () => boolean): boolean | 'indeterminate' {
  try { return probe(); }
  catch { return tmuxAsyncEnabled ? 'indeterminate' : false; }
}

export type LegacyGateMode = 'absent' | 'disabled' | 'unreadable' | 'dry-run' | 'enforcing';

export function legacyRefreshWorkGate(mode: LegacyGateMode, busy: boolean): Readonly<{
  action: 'proceed' | 'refuse'; loggedWouldRefuse: boolean;
}> {
  if (!busy || mode === 'absent' || mode === 'disabled' || mode === 'unreadable')
    return { action: 'proceed', loggedWouldRefuse: false };
  if (mode === 'dry-run') return { action: 'proceed', loggedWouldRefuse: true };
  return { action: 'refuse', loggedWouldRefuse: false };
}

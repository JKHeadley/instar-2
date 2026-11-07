// TEST-INFRASTRUCTURE: the host's wall clock, for evidence a gate compares with a run's start.
// A shifted run starts every worker at the same fixed test time, so a stamp on that clock cannot
// tell this run from an earlier one. The Vitest main process and the gate read the host clock.
// Captured at load so fake timers cannot move it. Unshifted runs have no Date.hostNow.
export const hostNow = Date.hostNow ?? Date.now.bind(Date);

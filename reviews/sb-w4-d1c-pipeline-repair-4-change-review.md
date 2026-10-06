# Change review — sb-w4-d1c pipeline repair 4: P2-OCC-07 measures each history's fastest turn

Subject base: 92518356f31f8b4e482439472dff32ef58ea79a9
Review state: open
Reviewed content: none
Outcome: the Studio full run of 92518356 failed one test, P2-OCC-07 in tests/facts/incremental-status.test.ts: `expected 3.2072760496223087 to be less than 3`. This branch changes nothing under src/facts or tests/facts (`git diff --stat origin/main...HEAD -- src/facts tests/facts` is empty), so the failure is the test's wall-clock ratio reading host load, not a cost regression: it compared the MEDIAN of five turns on a 50-fact history against the median of five on a 200-fact history, measured at different moments of a ~24-minute full suite on a shared gate host. The test now takes nine turns per history and compares the fastest turn of each. A load spike can only slow a turn, never speed one, so each side's minimum is its cost with the least outside interference. The bound (under 3x) and the two deterministic assertions (historical decodes and live owned decodes identical per turn across both sizes) are unchanged. Measured here: ratio 1.18 and 1.64 over two runs, three of three passes; a full re-derivation of every status per turn measured ~3.4x when the bound was set, so the bound still separates the two.
Affected rules: 37 (fixed at its source, the measurement, with no quarantine or skip), 36 (both sides: the deterministic counts still pin the per-turn work; the timing bound still sits between the measured ~1.2-1.6x and the ~3.4x re-derive-all cost), 116 (the simplest robust route: same test, same bound, a load-robust statistic)
Affected floors: secrets — untouched (test-only); spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: one test file; no src, record, prompt or generated change.
Side effects: P2-OCC-07 takes about four more turns per history (nine instead of five) and its `turns(size, rounds)` helper becomes `history(size)` returning a `turn()` step; no other test calls it.
Undo and recovery: revert the one commit; nothing is persisted.
Multi-machine posture: none; a unit test.
Layer below: createFactStore's running snapshot and prepareSnapshot (unchanged); the test's setup() fixture (unchanged).
Bug class: unit
Bug evidence: reproducer=tests/facts/incremental-status.test.ts
Hook bypass: none
Convergence: none
Decision: d1c-r4-min-not-median | compare each history's fastest of nine turns instead of the median of five: a minimum cannot be raised by a transient load spike and the measured ratio sits at 1.2-1.6x, well under the unchanged 3x bound, while re-deriving every status (~3.4x) still fails it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-d1c-repair-174307-PROGRESS.md
Decision: d1c-r4-no-interleave | the two histories keep running their turns one after the other rather than alternating turn by turn: tried first, interleaving two live stores changed the per-turn decode counts (small history 13,14,...,21 against large 14,14,...,16), so the two stores share decode state and the deterministic assertions stop meaning per-store work | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-d1c-repair-174307-PROGRESS.md

Subject (1 paths): tests/facts/incremental-status.test.ts

## Closing block

simplestRobustRoute: keep the test, its bound and its deterministic counts; change only the statistic from median-of-5 to min-of-9, the standard load-robust estimate of a cost.
80/20: 0 must-fix, 1 note: the ratio is still wall-clock; a fully deterministic cost counter for status derivations does not exist in the store, and adding one to src only for this test is more machinery than the failure warrants.
VERDICT: author submission; the independent verdict is recorded as a pass

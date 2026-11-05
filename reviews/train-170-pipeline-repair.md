# Change review — train-170 pipeline fixture repair

Subject base: 82cbd027e20b4991e2339116e0a87054884f59f9
Review state: open
Reviewed content: none
Outcome: Repair the old Eight/current Six compiler overlay, require actual completed HTTP at crash boundaries, and run the real volume lifecycle without blocking the Vitest IPC or wrapping a 60-second detach in a 10-second cleanup hook.
Affected rules: 26, 34, 35, 37, 49, 55, 60, 70, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — isolated loopback credential stays in child environment; spend cap — owner bounds unchanged; stop — product unchanged; no duplicate sends — crash reconstruction still refuses redispatch; durable intake — original pending work and retained exposure assertions preserved.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Test infrastructure repair only, including an existing defect record. No production prompt, parser, provider adapter, admission, capability, bound or storage format changes.
Side effects: The compiler overlay exposes only real current export modules absent from the pinned producer; every historical source and settlement brand remains pinned. The crash worker uses an explicit bounded physical HTTP adapter under the unchanged simulated owner clock, checks completion before its cut, and tests retained complete captures. The volume test moves its assertions and finally cleanup into one awaited process, preserving its 120-second case bound and adding an unmount check before directory removal.
Undo and recovery: Revert this repair to recover the former fixture behavior. No production migration or state rollback is needed. Failed unmount preserves the test root rather than removing a mounted volume; timeout remains a failing test, never success.
Multi-machine posture: Deliberately machine-local test processes, loopback HTTP and disk images. No production shared state or authority changes.
Layer below: Read providerFixture's simulated clock and 100ms fetch timer, confined dispatch's retained UNKNOWN result, the historical effects exports and nominal owner type, attachSessionVolume/detachSessionVolume and hdiutil bounds, the existing async-child helper and Vitest yield-worker setup.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Decision: train-170-repair-fixtures | Preserve producer ownership and all behavioral assertions while removing accidental coupling to an old export surface and real host scheduling. Use a 250ms injected HTTP delay, completed-response guard and negative uncertain neighbor; await the volume lifecycle through the existing child helper. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-170-repair-PROGRESS.md

Validation: The original settlement-types command reproduced the supplied missing-export diagnostics. The repaired targeted run passes all ten cases across model-provider-path, settlement and session-volume, including real HTTP/SIGKILL and real macOS volume ENOSPC/remount/cleanup. Typecheck, build and architecture pass. Final committed-head checks and regression sensitivity evidence are in the desk progress record.

Evidence limit: The supplied full run remains red. Its unattributed RPC timeout is recorded in the existing open defect, with no unsupported claim that the volume file caused it. No new full-suite or live feature acceptance is asserted. The pipeline reruns the full gate after push.

## Closing block

simplestRobustRoute: Keep the existing pinned compiler, real owner fixture, physical volume adapters and async child helper. Supplement only missing additive exports, separate physical HTTP scheduling from the injected clock for this completed-response crash proof, and await the unchanged volume assertions outside the IPC thread. This is the simplest robust route; no production subsystem or safeguard changes.
80/20: Repair the three named failures at their fixture sources, keep negative controls and original red evidence, run the touched tests plus cheap committed-head gates, and let the pipeline judge full-run closure.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

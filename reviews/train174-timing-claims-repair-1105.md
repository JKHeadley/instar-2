# Change review — qualify the owner-loss timing claim

Subject base: 282d2655bc70b8071181660a7f0bd13e2b817f7c
Review state: open
Reviewed content: none
Outcome: README, native comments, feasibility output, test wording and the original submission distinguish the 600 ms normal guard budget from the supervisor owner-loss backstop threshold of 850 ms. The additional interval also extends enforcement if the guard stalls before killing. Scheduling and termination latency apply; the implementation stays unchanged.
Affected rules: 1, 26, 37, 42, 49, 55, 60, 61, 70, 74, 95, 101, 102, 107, 113, 116
Affected floors: secrets — untouched; spend cap — untouched; stop — exact-child enforcement and thresholds unchanged, timing claims corrected; no duplicate sends — untouched; durable intake — untouched
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: correcting the evidence and resource timing claims of a native monitor repair, including its feasibility output consumer.
Side effects: feasibility output text changes and its test regex changes with it. No timing, protocol, authority, mapping, resource-owner or runtime enforcement changes. Post-termination stall cases explicitly do not establish a pre-termination bound.
Undo and recovery: revert this repair commit; no installed bytes or durable state are changed by this work.
Multi-machine posture: machine-local, deliberately; the guard and worker are a single host's process tree. No cross-machine behavior changes.
Layer below: guard_backstop requests OWNER only when attached and owner age exceeds OWNER_BACKSTOP_MS, with no observation of worker termination; the stopped and deadline checks remain prior to it. Existing boundary table checks 850/851 ms. The report-stall injection is after kill/reap.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: t174r-timing-qualification | retain the 850 ms threshold and correct the unsupported 600 ms hard termination claim rather than adding machinery; explicitly cover pre-kill stalls and scheduling latency | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train174-cleanup-assertions-1105-repair-121707-PROGRESS.md

1.x comparison: inherited from the reviewed repair, as the charter permits: JKHeadley/instar f3f94826, src/monitoring/SessionWatchdog.ts (separate deterministic ceiling and identity-matched signals) and docs/specs/launchd-process-ceiling-floor.md (same-UID RLIMIT_NPROC). Those behaviors remain adapted to the existing native guard; this repair changes claims, not the adaptation.
Verification: portable probe extracted the actual guard_backstop function and macros, compiled with cc -std=c11 -Wall -Wextra -Werror, and observed NONE/NONE/OWNER at owner ages 601/850/851 ms. This is decision-boundary evidence, not measured kernel termination latency. Native execution belongs to the Studio gate.

## Closing block

simplestRobustRoute: correct the claims and their existing consumer to match the retained implementation, with no new machinery or capability restrictions.
80/20: one must-fix, corrected at each named surface; portable checks and the native gate distinguish what was verified from what needs macOS.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

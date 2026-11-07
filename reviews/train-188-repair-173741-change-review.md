# Change review — retain the accepted native guard report

Subject base: a931f47df1124f42551c01a6712ee0c3a071b138
Review state: open
Reviewed content: none
Outcome: Integrate the native portion of accepted repair e7d5dbc538d47dc75c7344d51714a4c1943a9589 (including its implementation parent 282d2655b), preserving genuine guard termination evidence through the existing report grace.
Affected rules: 1, 26, 34, 36, 37, 42, 44, 49, 55, 60, 61, 66, 70, 74, 95, 101, 102, 105, 111, 112, 113, 116
Affected floors: secrets — custody unchanged; spend cap — no model or reservation change; stop — exact unreaped-child targeting preserved, supervisor owner-loss threshold explicitly extends from 600 to 850 ms; no duplicate sends — existing effect identities untouched; durable intake — journals and uncertainty untouched.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Existing native termination backstop repair and its original regression tests; no new service, authority, protocol or capability restriction.
Side effects: The supervisor requests enforcement only beyond 850 ms, including when a guard stalls before killing. The 600 ms figure is the normal guard budget, not a hard termination bound; scheduling and termination latency apply. Terminal 99 remains UNKNOWN. Feasibility wording and its test consumer change together. A test-only compiler define injects post-termination report stalls and is absent from production builds.
Undo and recovery: Revert this repair and regenerate derived publication; retain all prior evidence. Existing installed hosts keep their current bytes until a reviewed installation updates the enforcer through the existing installer. No host installation is performed here.
Multi-machine posture: Deliberately machine-local process ownership and guard evidence. Repository changes travel through git; macOS kernel behavior and installed-host conformance require Studio execution.
Layer below: Actual guard_backstop predicate, guard END kill/reap/report ordering, supervisor loop checking the backstop before polling, native terminal decoder and production phaseFor uncertainty mapping. Constitution at origin/main aa8cbc934 matches the worktree. Accepted independent round-2 review distinguishes unit acceptance from installed-host certification.
Bug class: integration
Bug evidence: reproducer=tests/assembly/fixed-worker-monitor-native.test.ts
Hook bypass: none
Convergence: none

1.x comparison: Inherited accepted repair comparison at JKHeadley/instar f3f94826: src/monitoring/SessionWatchdog.ts separates deterministic backstop timing and identity-matched signals; docs/specs/launchd-process-ceiling-floor.md establishes same-UID limits. Additionally searched actual origin/main 1723950ceca23f0ae516e4cb9d3e675ae1c1eea3 src/ and docs/specs/, read the same source/spec and history 9f5c9a9b, e4b4d2be, 6e287266, plus ONEX-LESSONS sections 2 and 6. Reuse bounded enforcement, real outcome evidence and identity-safe targeting; the session watchdog is not a replacement for the existing native ptrace guard. The accepted native implementation is reused unchanged.
Decision: train188-173741-native | Apply only the accepted repair's three native files, byte-identical to e7d5dbc, rather than merging unrelated train history or the separate resource-owner test repair. This is the smallest M1 fix and preserves browser/census work. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-173741-PROGRESS.md
Decision: train188-173741-evidence | Preserve UNKNOWN without a terminal report and accurate timing disclosure. Portable actual-function boundary assertions are distinguished from native kernel evidence; retain the original 150/500 ms regression cases for Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-173741-PROGRESS.md
Decision: train188-173741-publication | Recompute derived owner/register evidence with existing delegated tools; do not rewrite native certification to assert unrun macOS conformance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-173741-PROGRESS.md

Verification: Portable compilation of the extracted actual guard_backstop with -std=c11 -Wall -Wextra -Werror passes owner ages 601/850/851 as NONE/NONE/OWNER, unattached, stopped, and deadline threshold neighbors. Restoring the old predicate fails the same assertion at 601 ms. This is predicate evidence, not measured kernel termination latency. Targeted tests, typecheck and publication results are recorded in the report.
Residue: native-host | medium | Existing Studio-owned native conformance and full combined suite remain host work; no new certification is asserted.

## Closing block

simplestRobustRoute: Reuse the accepted backstop interval and existing guard report, tests and publication tooling. This is that route. Exact-child ownership is the start guard; a genuine terminal report is the end-state guard; existing deadline, stop, capacity and finite backstop thresholds remain the limit guards. No new watchdog or unattended completion claim.
80/20: One must-fix repaired at its existing source; no unrelated runtime or resource-test change. The accepted native tests and portable predicate mutation control establish distinct evidence tiers; Studio supplies physical native execution and combined qualification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

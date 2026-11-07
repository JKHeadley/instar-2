# Change review — native guard deadline case independent of arm-time scheduler gaps

Subject base: 5ebafc636c1397c10cc98051e7a7fb7ecfc78914
Review state: open
Reviewed content: none
Outcome: The guard feasibility 'deadline' case arms its deadline past the whole arm bound and judges both sides (alive before the deadline, ended no earlier than it), so Studio full-suite load during the guard spawn and sandbox bootstrap can no longer spend the deadline before the worker is observed; a portable regression compiles the shipped case with a slow-arming guard double.
Affected rules: 26, 37, 49, 55, 60, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged (no secret path touched); spend cap — unchanged; stop — unchanged (no production guard, lapse or stop behavior changed); no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Observation-only feasibility orchestration in the native probe plus a portable compiled-C regression. No production guard, supervisor backstop, installed policy, model or authority change; native verification stays with macOS.
Side effects: Only the 'guard' feasibility case changes. Its deadline fault now arms 3800 ms (3000 ms arm bound + 800 ms) from arm instead of 800 ms, and the supervisor simulation reports its deadline ticks to the observer, which requires the worker alive before the deadline and not ended before it. The arm read timeout and poll wait now use the same named arm bound (3000 ms read, 4000 ms poll, as before). The other four guard faults keep their 20000 ms deadline, their timing and their verdict. The guard case takes about 3 s longer on macOS.
Undo and recovery: Revert the two repair commits; no durable data, signature, installation or migration changed. A released enforcer binary is rebuilt only through the normal reviewed install.
Multi-machine posture: Machine-local native observation, deliberately: process liveness and the guard's deadline kill belong to the host running the probe. Shared source and tests add no replicated state or ownership path.
Layer below: Guard argv deadline (immutable continuous-clock ticks fixed before spawn); guard S report after worker spawn; the 3000 ms arm read bound in the supervisor simulation; the guard's deadline kill of its unreaped traced child; guard_backstop deadline grace (unchanged, still verified both sides by guard-backstop); alive() zombie-aware observation.
Bug class: unit
Bug evidence: reproducer=tests/assembly/fixed-worker-feasibility-handshake.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory holds samples only.
Convergence: none
Prompt review: No model-facing input, parser or judgment change; no recorded model shapes are involved in this native probe repair.
1.X FIRST: JKHeadley/instar main bfe143d6d searched (src/, docs/specs/, history) for sandbox-exec, RLIMIT_CPU, ptrace and mach_continuous: 1.x has no native worker enforcer or guard (OS sandbox isolation is only a deferred follow-up named in docs/specs/RELAY-SPAWN-GHOST-REPLY-CONTAINMENT-SPEC.md), and no ONEX-LESSONS.md exists there; nothing to reuse. The 2.0 precedent reused is train-107 repair 15a6bb97e (readiness instead of a guessed delay in the same probe).
Decision: train-197-repair-095540-arm-bound | Arm the deadline case past the named arm bound rather than via readiness: the guard deadline is immutable and must be fixed in argv before the guard and sandbox bootstrap exist, so readiness cannot arm it; the precedent's readiness route does not apply. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-repair-095540-PROGRESS.md
Decision: train-197-repair-095540-both-sides | Judge the deadline case on both sides (alive before its deadline, ended no earlier than it, within the backstop window) so a larger deadline cannot turn an early or missing end into PASS. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-repair-095540-PROGRESS.md
Decision: train-197-repair-095540-portable | Prove the case on Linux by compiling the shipped source slice with a slow-arming guard double, plus early-end, never-end and old-800ms-arming controls that must FAIL; Darwin ptrace/sandbox behavior stays an explicit Studio check. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-repair-095540-PROGRESS.md
Verification: Portable regression passes on WSL and its three negative controls fail as asserted, including the recorded "ended=yes after 0ms" defect under the old 800 ms arming. tsc, npm run lint, npm run register:check and git diff --check exit 0. The native test file is darwin-only and runs on the Studio.
simplestRobustRoute: This is the simplest robust route: a named arm bound already exists (the 3000 ms S read timeout), so arming the deadline beyond it removes the named race without touching the guard, the supervisor backstop or any production timing; the both-sides verdict keeps the check from loosening. No quarantine, retry or timeout-only bump on the assertion.
80/20: Repair only the probe orchestration that raced, keep every native assertion, add a portable regression with controls, run the cheap gates, and hand the native run to its host.
VERDICT: author submission for desk gate; no independent convergence or native acceptance claimed

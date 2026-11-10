# Change review — restore updater readiness after before-send review

Subject base: 075cbd62b2fa899a6f9c27e8fbe06eb9fb628600
Review state: open
Reviewed content: none
Outcome: Let the real updater drain and activate an installed release again. Both readiness closures still referenced the removed replyReviewJob variable and threw before restart; remove those references while retaining the ordinary lane guard that now owns before-send review.
Affected rules: 26, 34, 37, 44, 55, 60, 61, 70, 74, 101, 102, 111, 113, 116, 121
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Existing admission, stop, peer, active-work and session guards remain intact.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The shipped runner's automatic restart readiness changes, so this is a lifecycle repair despite its small diff.
Side effects: Installed releases can reach the existing restart handshake. Before-send review still holds the ordinary lane until its awaited drain finishes; background summary, step and retrospective jobs and active sessions still inhibit idle restart. Failure assertions now include actual child output and updater state from the isolated test root.
Undo and recovery: Revert the repair to restore the previous bytes; that also restores the demonstrated undefined-variable failure. The unchanged watchdog retains the last healthy release when a candidate cannot start.
Multi-machine posture: No host-specific branch or new authority. The existing lane admission still requires current peer and owner standing, and each runner uses its existing updater state.
Layer below: Inspected createOrdinaryLane in tests/preview/live-sentinels.ts, the runner's awaited worker.drain, createProductUpdater readiness and restart hold in scripts/update-product.mjs, drainUpdateRestart in scripts/update-runner.mjs and the real healthy-process handshake. A busy ordinary job makes lane.admissible false; no second review-job tracker is needed.
Bug class: integration
Bug evidence: reproducer=tests/preview/update-lifecycle.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only. Plain git commit.
Convergence: none
Prompt review: No model prompt, parser, review verdict or answer acceptance logic changes. The touched runner contains prompt sources, but this diff changes only updater readiness closures. Existing before-send review remains inside the ordinary drain; no live-model replay is claimed or needed for an undefined updater binding.
Decision: train-231-updater-lane | Remove the two dangling replyReviewJob references; the existing ordinary lane owns and guards the review, so a new tracker or timeout increase would add machinery without addressing the source failure. Retain diagnostic state on the failing assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-231-repair-PROGRESS.md

1.x FIRST: Searched actual JKHeadley/instar origin/main 6255068a82bf61d771b30f59883eed5a66e9ac58 src/ and docs/specs/ update paths and relevant git history. Read src/core/AutoUpdater.ts restart handshake, src/core/UpdateChecker.ts candidate validation and docs/specs/auto-updater-restart-activation-visibility.md; inspected 41bda81c08 (validate native candidate before restart), 4cba69a2ed (leftover backup recovery), and 015fa6cb16 (boot/update holds). Read ONEX-LESSONS.md section 6. Reuse the already-carried distinction between installed bytes and verified running release, real startup proof and retained prior release. This undefined binding belongs to the 2.0 runner's moved before-send review; retain the carried updater protocol and repair its readiness caller rather than importing unrelated 1.x code.

Verification: The unmodified targeted test and the diagnostic run both reproduced the exact missing handshake. Diagnostic update-state records lastError "replyReviewJob is not defined" after completing installation of 0.1.1. Targeted lifecycle, TypeScript and final cheap-check outputs are recorded in the linked progress report. The physical test exercises both successful candidate activation and failed-candidate rollback, including unchanged authority and zero model calls or sends. No full-suite result is claimed; the pipeline owns that run.

## Closing block

simplestRobustRoute: Remove two obsolete references and retain the existing lane and background-job guards. This is the simplest robust route: no new tracker, timeout, retry, weakened assertion or reduced agent ability.
80/20: Reproduce the single failing lifecycle, inspect its real updater state, repair its caller, then run the targeted physical test and mandatory cheap gates. Leave the full suite to the pipeline.
VERDICT: author submission; no independent acceptance or release claim

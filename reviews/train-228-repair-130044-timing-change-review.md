# Change review — Measure the backoff boundary independently of launcher startup

Subject base: d7ead0db1c998ff8a3c54ce0b9e3ab73f753d487
Review state: open
Reviewed content: none
Outcome: Once the twelve startup refusals were repaired, both backoff cases exited zero but failed the five-second whole-child stopwatch on WSL (6928 ms and 5940 ms). An isolated rerun reproduced that timing failure. Start the monotonic stopwatch at the first failed getUpdates call and record elapsed time on child exit. Retain the five-second ceiling, ten-second configured backoff, 25 ms interruption trigger, successful-exit assertion and durable error/stop assertions.
Affected rules: 26 (measure the boundary claimed), 37 (source repair, no quarantine), 60 (bounded child runtime retained), 74 (review record), 102 (reported decision), 116 (one local measurement)
Affected floors: secrets — only synthetic fixture values; spend cap — unchanged; stop — same five-second ceiling from failed poll to exit plus durable stop reason; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Correct a test observation boundary; no product behavior, timeout ceiling, skipped case, authority, or gate change.
Side effects: The two temporary test roots hold a numeric backoff-elapsed.json until the existing afterEach cleanup. It contains no secrets or user data.
Undo and recovery: Revert this commit; no product state or schema migration.
Multi-machine posture: performance.now is monotonic and remains real when the expiry preload replaces Date.now. Application startup speed no longer contaminates the backoff response measurement.
Layer below: tests/preview/agent.mjs backoff handling and scripts/slice-ts-loader.mjs content cache were inspected; neither is changed. The slow host still executes the original interruption logic.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train-228-130044-backoff-clock | Measure failed-poll-to-exit with the child's monotonic clock, preserving the existing five-second limit and durable stop assertions, because whole-process startup exceeded that limit before backoff began. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-228-repair-130044-PROGRESS.md

1.x comparison: Inherits the inspected references in reviews/train-228-repair-130044-change-review.md at JKHeadley/instar 6cbe44c819cd97aec1d9c7f470b04148fbca708d and ONEX-LESSONS sections 3/6: test the observable effect at its actual boundary and use host-correct measurements. No 1.x product behavior is transplanted.

Subject (1 path): tests/preview/preview.test.ts

## Closing block

simplestRobustRoute: One child-local monotonic interval, written into the existing disposable state root, replaces the parent startup stopwatch. No production hook, timing allowance increase, or new helper framework.
80/20: Both corrected cases pass while whole-child launch still takes over five seconds, demonstrating that the original failure measured startup. A temporary 5100 ms post-poll stall made the expiry case fail at 5207 ms against the unchanged 5000 ms ceiling; the stall was removed before commit. The existing 30-second child bound also remains active.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

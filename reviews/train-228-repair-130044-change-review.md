# Change review — Restore preview launcher fixtures after shell probing

Subject base: cafa190459be87b45b1c0c2c7cb4029ca7ff0b41
Review state: open
Reviewed content: none
Outcome: Seven recorded spawnSync preload definitions decoded every subprocess argv[1] as Telegram JSON. The resource owner's new shell probe therefore threw before getMe, refusing all twelve launcher cases. Match the exact Telegram limit-exec.sh path and delegate other subprocess calls to the original spawnSync with all options. Existing diagnostic, breaker, durable-state and signal assertions remain unchanged.
Affected rules: 26 (evidence reflects the actual failure), 37 (repair the cause rather than quarantine), 60 (real shell capability probing remains active), 74 (review record), 102 (reported decision), 116 (smallest repair at the fixture boundary)
Affected floors: secrets — synthetic test credentials only; spend cap — unchanged; stop — existing signal and expiry assertions retained; no duplicate sends — existing checks retained; durable intake — existing phase checks retained
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test fixture routing only; no product, authority, gate, declaration, timeout, assertion or skip changes.
Side effects: Non-Telegram child calls in the recorded test launchers now run on the actual host as production expects. Telegram requests retain their recorded outcomes.
Undo and recovery: Revert this commit to restore the prior fixtures; no runtime state migration exists.
Multi-machine posture: Exact absolute shim path is generated from the same cwd used by each child; no platform branch or fake shell-success response. Linux verification here; the desk repeats the gate on Studio.
Layer below: scripts/resource-owner.mjs selectLimitShell and scripts/production-boot-io.mjs createProductionTelegramIO were inspected and remain unchanged; the failure belongs to test interception, not resource enforcement.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train-228-130044-scope-transport | Delegate non-Telegram subprocess calls to native spawnSync, preserving options, instead of faking the shell probe or changing production limits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-228-repair-130044-PROGRESS.md

1.x comparison: Inspected JKHeadley/instar origin/main 6cbe44c819cd97aec1d9c7f470b04148fbca708d src/messaging/TelegramAdapter.ts, docs/specs/LIFELINE-MESSAGE-DROP-ROBUSTNESS-SPEC.md and adapter history b1faf3fc6. They cover async polling, counters and bounded fetch recovery, but not this 2.x shell transport preload; no runtime transplant. Studio ONEX-LESSONS.md sections 3 and 6 were also read: keep custody and terminal-failure evidence; test production assembly and observable effects (TESTING-INTEGRITY-SPEC), use host-correct resource measurements, and bound aggregate test concurrency. The repaired tests continue to launch the actual preview entry point and inspect its durable state and diagnostics.

Subject (1 path): tests/preview/preview.test.ts

## Closing block

simplestRobustRoute: Restrict all seven mocks at their existing subprocess interception boundary. Keep the real shell probe and every behavior assertion; introduce no new helper layer or product exception.
80/20: The twelve affected cases exercise error accounting, typed diagnostics and stop boundaries through the actual launcher. The full Studio gate remains the desk's qualification step under the builder brief.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

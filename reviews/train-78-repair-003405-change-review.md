# Change review — restore complete macOS test split inventory

Subject base: f435cba39d151070fb933de1143708f1f87933fb
Review state: open
Reviewed content: none
Outcome: Include telegram-files.test.ts in the macOS half of split test runs, matching its existing Darwin-only harness-user ACL proof and the existing detector.
Affected rules: Rules 26, 37, 49, 70, 74, 101, 102, 111, 112, 113 and 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement; this test inventory repair changes no runtime code or authority.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One missing test inventory entry, with no new mechanism or product behavior.
Side effects: Split runs schedule this entire test file on macOS, including its portable cases. Unsplit runs retain the same tests and existing Darwin guard.
Undo and recovery: Revert the inventory entry and this review together; the drift assertion will again expose the missing entry. No persistent state or migration is involved.
Multi-machine posture: Shared repository inventory directs Linux and macOS split runners consistently; macOS ACL evidence remains host-local and must be executed on the Studio.
Layer below: Read the platform detector, list reader, missing/stale negative controls, and telegram-files.test.ts actual harness-user ACL test. Its existing Darwin guard requires placement in the macOS half; no detector or test exclusion is added.
Bug class: none
Bug evidence: Test inventory metadata only; no code bug class. The unchanged tests/platform/macos-only.test.ts reproduces the supplied missing-entry assertion and verifies the repair with missing/stale controls.
Hook bypass: none
Convergence: none
Decision: train78-repair-macos-inventory | Add the already Darwin-gated telegram-files test to the existing sorted inventory, preserving the detector and ACL proof rather than suppressing the failing assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-78-repair-003405-PROGRESS.md

Subject (1 paths): tests/platform/macos-only.txt

## Closing block

simplestRobustRoute: This is the simplest robust route: correct the one missing inventory entry using the existing split-run mechanism. Start guard is the assigned clean branch and detected Darwin-only test; end guard is exact inventory equality with missing/stale controls; runtime floors remain unchanged. No new machinery or unattended product-completion claim.
80/20: Run the platform inventory tests, typecheck and cheap gates. The Studio owns the full-suite rerun and actual macOS ACL proof; no quarantine or weakened assertion.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

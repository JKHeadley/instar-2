# Change review — train-89 platform inventory repair

Subject base: 32a4107177f868669c2b200a969f36f8d8354009
Review state: open
Reviewed content: none
Outcome: Route the existing Telegram file ACL proof to the macOS half of split testing and restore exact platform inventory agreement.
Affected rules: 26, 34, 37, 49, 70, 74, 101, 102, 111, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain all existing enforcement; this change only adds a test inventory entry.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One missing path in the existing test platform inventory; no runtime or model-facing change.
Side effects: Split Linux runs exclude the whole Telegram files test file; split Mac runs include it. Unsplit runs retain the same tests.
Undo and recovery: Revert the inventory addition if the file ceases to need macOS, as enforced by the existing stale-entry check.
Multi-machine posture: Test scheduling only: Linux and Mac halves jointly cover the suite. No production state or coordination changes.
Layer below: Checked the detector, Vitest split configuration, and the actual darwin-gated ACL proof in telegram-files.test.ts; the proof uses /Users/Shared and harness-user ACL access checks.
Bug class: integration
Bug evidence: reproducer=tests/platform/macos-only.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains only sample hooks.
Convergence: none
Decision: train-89-repair-A | Add the missing path to the existing sorted inventory because the file contains a real macOS ACL proof; retain the detector and all assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-89-repair-201018-PROGRESS.md
Verification: Run the platform inventory tests, typecheck, architecture/lint, register check, change-review check and the required portable pinned tests; outcomes are recorded in the report.

simplestRobustRoute: This is the simplest robust route: add one missing inventory entry, using existing detection and split scheduling with no new mechanism. The existing equality test detects both missing and stale entries; no autonomous completion claim is made.
80/20: Targeted inventory coverage and required cheap gates; the Studio pipeline owns the full suite and actual macOS ACL proof.
VERDICT: author submission; no independent convergence or live acceptance claim

# Change review — restore the Telegram files platform-list entry

Subject base: d209a9397aeb880791a50b5a7a348d5eb3e28ab9
Review state: open
Reviewed content: none
Outcome: The checked-in macOS test list includes the existing Telegram file ACL test, matching automatic detection; assertion messages name missing and stale paths explicitly.
Affected rules: 1, 26, 37, 49, 70, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; this change only repairs test placement.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test-inventory entry and an explicit assertion diagnostic; no runtime or model-facing behavior changes.
Side effects: The split runner assigns telegram-files.test.ts to the macOS half, including its real separate-user ACL proof; unsplit runs retain every test.
Undo and recovery: Revert this repair commit; the existing list-drift assertion will again expose the missing entry. No runtime state migration.
Multi-machine posture: Shared checked-in test inventory determines host placement; no new machine-local runtime state or authority.
Layer below: Read both constitutional documents and compared them with origin/main; inspected the detector, list consumer and the actual darwin-gated ACL test using /Users/Shared and harness-user.mjs.
Bug class: unit
Bug evidence: reproducer=tests/platform/macos-only.test.ts
Hook bypass: none; core.hooksPath unset, common hooks directory contains sample files only.
Convergence: none
Decision: train-87-repair-181125-A | Add the missing sorted list entry, preserving detection and ACL assertions instead of weakening the gate or changing product behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-87-repair-181125-PROGRESS.md
Decision: train-87-repair-181125-B | Include the actual reproducer under Rule 70 and print its missing/stale paths in the assertion message, making bounded gate excerpts diagnostic while retaining the exact assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-87-repair-181125-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: add the omitted entry to the existing inventory. Existing exact drift detection covers missing and stale entries; no machinery or authority is added, and no unattended live outcome is claimed.
80/20: Run the focused inventory tests and required portable checks; the Studio owns its full-suite rerun and native ACL proof.
VERDICT: author submission; no independent acceptance claim

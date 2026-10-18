# Change review — train-71 shared repair merge and publication coverage

Subject base: 19b6cf7cd3a5dfcc4d3a0d64192591b3716bac22
Review state: open
Reviewed content: none
Outcome: Restore Rule 74 coverage for the desk-selected shared deadline repair merge a4bd0e49bb3c and register publication a5edbd28e249. This repair adds the missing review record only.
Affected rules: 26, 37, 49, 72, 73, 74, 90, 101, 102, 107, 111, 112, 113, 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake are unchanged. The reviewed merge changes a dark feature's deadline metadata, not execution authority or protection.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Retrospective coverage of an existing desk-selected merge and generated publication; this repair adds no runtime logic, model instruction or declaration change. The generator paths trigger the broad critical suggestion.
Side effects: The merged shared repair permits dated builds before 2026-10-21T00:00:00Z and still refuses at or after that deadline. Step-check remains dark, with no graduation stages claimed. Generated status follows that same deadline. This record makes those existing commits visible to the change-review gate without changing its enforcement.
Undo and recovery: Revert this record to restore the uncovered-commit refusal. To undo the covered merge, revert its declaration, promotion entry, documentation and expectations together and regenerate publication with the existing generator; do not erase prior history or hand-edit pins.
Multi-machine posture: Review and publication are shared through git. No machine-local runtime state is added. The Studio desk owns full-run acceptance and receives the local repair report at its prescribed absolute path.
Layer below: Read the full purpose and rule book, identical to origin/main, the actual first-parent merge diff, reviews/register-stepcheck-deadline-1018-change-review.md, reviews/train-71-change-review.md, and the check-change-review draft and coverage mechanism. The existing shared repair bbc554cb is retained exactly; no competing deadline repair is introduced.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: The covered promotion entry records the owner's deadline, reason and rollback; no model prompt, parser or semantic decision changes in this repair. No new recorded-model replay requirement is introduced by this paperwork change.
Deferral: generated/register.json:1 | not-a-deferral=Generated publication preserves the shared repair's explicit desk-owned graduation item; this record adds no postponed implementation or new deadline.
Decision: train-71-repair-081700-coverage | Add one review spanning the first parent of the two uncovered commits, preserving the desk-selected bbc554cb repair and the already generated publication. Fix coverage at its source without altering the checker or duplicating the owning repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-71-repair-081700-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: add the missing review to the existing coverage mechanism and run its consumer. The start guard is the exact two-commit failure and inspected merge diff; the end guard is restored commit coverage with honest host-specific evidence; existing deadline, stage, authority and resource guards remain intact. No new machinery or autonomous capability completion is claimed.
80/20: Run typecheck/build, the two deadline consumer test files, required pinned-text tests and architecture/register/change-review checks. Keep full-suite and native acceptance with the Studio desk.
VERDICT: author submission; independent desk review pending

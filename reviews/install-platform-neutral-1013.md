# Change review — installation review record repair

Subject base: c50a9fb46faf2c63a833ce08dcbda81633bbc817
Review state: open
Reviewed content: none
Outcome: Repair the invalid Rule 74 record while preserving the original installation design guide in docs/install-platform-neutral-review-guide-1013.md. No installation design or runtime behavior changes.
Affected rules: Rules 1, 26, 48, 49, 70, 74, 101, 102, 109, 111, 112, 113, 116; truthful evidence and unchanged authority.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; only review metadata and guide location change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Editorial record repair with the original design prose preserved and no executable or governing document edits.
Side effects: The design guide moves to docs/ with relative links adjusted. This review path remains as a pointer, preserving references from train-27. The checker now receives a real ancestor and a narrowly bounded nonempty subject.
Undo and recovery: Revert this repair commit to restore the original file location and reproduce the missing-subject-base error; no runtime state or migration is involved.
Multi-machine posture: Repository documentation travels through git on every host. The local report is copied to the named Studio report by the desk; no Studio write or runtime state changes.
Layer below: Read the complete constitution, original da99cd521f8eb7a11c0fee24961df13d47d19f9e design commit and parent 7ef8f158d4129a4cf90cf3c546701f32e348fdd3; inspected records(), subject range computation and validateRecord in the existing checker. Adding the old parent here would incorrectly widen this current record across unrelated changes.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train-27-repair-015450-D1 | Preserve the original design guide under docs and bind this record to the repair parent, avoiding an inaccurate review over unrelated intervening changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-27-repair-015450-PROGRESS.md

Original design guide: [installation on macOS and Linux](../docs/install-platform-neutral-review-guide-1013.md). Original design provenance: da99cd521f8eb7a11c0fee24961df13d47d19f9e; this repair asserts no new design approval.

Subject (1 paths): docs/install-platform-neutral-review-guide-1013.md

## Closing block

simplestRobustRoute: This is the simplest robust route: retain the design guide verbatim apart from relative links, and bind its relocation to the existing review schema. Start guard is the observed missing-base failure; end guard is the existing checker accepting the repaired record; scope excludes runtime, governance and checker edits. No new mechanism or autonomous runtime completion is claimed.
80/20: Run the existing consumer and cheap gate checks; leave independent acceptance to the desk. No new tests or checker exceptions for an editorial repair.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

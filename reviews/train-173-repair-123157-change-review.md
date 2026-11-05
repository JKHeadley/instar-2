# Change review — train-173 current-main merge repair

Subject base: 01a7906f2f04e63a7ac7f804769fdf6911a1f747
Review state: open
Reviewed content: none
Outcome: Merge c20b68d1d main into train-173 while retaining both histories and publishing the combined register.
Affected rules: 9, 26, 34, 37, 38, 43, 49, 69, 73, 74, 90, 91, 95, 101, 102, 111, 112, 113, 116, 119
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement. Offline register replay grants no runtime authority.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates main's approved Rule 121 and refreshes the shared register publication; no new policy or runtime design.
Side effects: Generated briefing now includes main's Rule 121. The combined anchor retains the candidate's live schema and main's constitution. Both changelog histories remain intact. No prompt parsing, accept/refuse path, provider call or runtime implementation is changed by the resolution.
Undo and recovery: Retain serving build until Studio acceptance; revert this repair if rejected. No effects are retried and no durable user state is migrated.
Multi-machine posture: Git-shared source and generated register. Build and verification are machine-local; macOS and full gate execution remain on Studio. No new replicated state or ownership path.
Layer below: Full main constitution, both parent histories, canonical anchor hashing and committed-source replay, owner-source pins, existing register tests, 1.x GitSync conflict detection and maintenance incident lessons.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset, common hooks directory contains samples only.
Convergence: none
Prompt review: Inherits main's approved constitutional wording and its existing review; preserves candidate model-facing behavior exactly. No new model-facing decision is introduced by this merge resolution.
Decision: train-173-repair-merge | Merge current main c20b68d1d into the candidate preserving ancestry and both changelog histories; derive the approval checksum from the combined canonical anchor and regenerate committed-source outputs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-173-repair-123157-PROGRESS.md
Decision: train-173-repair-checks | Run portable targeted checks and the cheap gates; leave full suite and macOS tests with the Studio as the assigned brief requires. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-173-repair-123157-PROGRESS.md
Deferral: generated/conversion.json:1 | not-a-deferral=Generated approved governing text, no new builder deferral.
Deferral: generated/register.json:1 | not-a-deferral=Generated approved governing text, no new builder deferral.

1.x comparison: JKHeadley/instar main ab256f684cda141db19abe8bba5300b980e1025b inspected in src/core/GitSync.ts (conflict detection), src/core/SafeGitExecutor.ts history (4b39a1059 and 6fb1db837), docs/specs/MULTI-MACHINE-SPEC.md and docs/specs/MULTI-USER-SETUP-SPEC.md. These preserve runtime sync conflicts; none supplies the 2.0 canonical register approval anchor. No source transplant fits. ONEX-LESSONS.md section 6 informs bounded test concurrency and verification of actual generated consumers. Reuse 2.0's existing canonical replay and desk regeneration tools.

simplestRobustRoute: This is the simplest robust route: preserve both parents, derive the single conflicting checksum from the combined anchor, and regenerate outputs with existing tools. No machinery is added. Pinned parents and unchanged safety floors guard entry; targeted verification and Studio review guard acceptance. No new autonomous runtime completion is claimed.
80/20: Repair the exact merge failure and verify the resulting register and briefing; the Studio owns full-suite and live acceptance.
VERDICT: author submission; no independent convergence claimed

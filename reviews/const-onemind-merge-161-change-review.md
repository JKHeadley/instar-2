# Change review — historical PR #161 merge: bounded progress replies

Subject base: d5d1ed518df784295f035b756baff5fe60cdab66
Review state: open
Reviewed content: none
Outcome: Repair missing Rule 74 coverage for merge 1b26222647ed2e5dab3b21a65f7d996106e60541 (PR #161), as directed by the desk on 2026-10-15 at 17:20. The merge adds Rule 87’s approved bounded-progress sentence, its versioned history and briefing digest, and republishes the replay register. It also fixes the launcher proof fixture to exercise its recorded activation window with an advancing injected clock and tests refusal after expiry; production activation bounds are unchanged.
Affected rules: Rule 87 and rules 12, 27, 37, 45, 47, 69, 74, 84, 90, 91, 111, 113 and 116; rules 101 and 112 preserve hooks and history.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their enforcement. This repair adds review records only; it grants no authority or runtime capability.
Operator questions: none for this historical record repair. PR #166 still requires Justin’s code-owner approval on its final head; this unit does not merge it.
Suggested tier: critical
Declared tier: critical
Tier rationale: The historical range includes governed constitutional changes and source pins, so the review retains their stricter tier even though this repair only records evidence.
Side effects: The briefing quotes the new sentence. The proof fixture exercises both valid and expired activation rather than extending production authority. Generated artifacts and owner fixture pins follow the source.
Undo and recovery: Correct this record through a new commit if its account is wrong. A product reversal would require a new governed revision and register regeneration; do not rewrite the merge or erase its evidence.
Multi-machine posture: Shared repository documentation and pins apply across machines; no runtime store or transport is introduced. One-machine operation preserves its local cause and enrolled-peer replication demands remain explicit.
Layer below: Both parents (d5d1ed518df784295f035b756baff5fe60cdab66 09bdaaf2f36f46f16dc5ea649372a387db3299c1), the actual first-parent merge diff, reviews/r87b-progress-1011-change-review.md; tests/preview/constitution-briefing-sync.test.ts, proofs-launcher.test.ts and successive.test.ts; the existing activation expiry and register generator; the Rule 74 checker’s base-to-record-edit coverage semantics.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: The cumulative record range includes the verbatim Rule 87 and Coherency excerpts, reviewed as constitutional quotations rather than fixture triggers or asserted dispatch answers. No output parser or accept/escalate/refuse policy is changed by this repair.

Historical scope: This is a retrospective, desk-directed author record, not a claim that a reviewer approved the merge at its original landing. The checker's subject runs from the first parent through this record's commit, so later already-recorded changes are also visible. Their accounts are in reviews/install-bootstrap-design-1013.md, reviews/amend-single-machine-1013.md, reviews/fix-guide-163-1013-change-review.md, reviews/const-onemind-1015-change-review.md and reviews/register-stepcheck-deadline-1014-change-review.md; the platform design guide lives at review-guides/install-platform-neutral-1013.md. The current PR's fresh Astra review judges this combined evidence and does not certify unperformed live proofs.

## Closing block

simplestRobustRoute: Add the missing historical record using the existing Rule 74 mechanism, inspect the actual merge and its foundation, and retain the original commits and author records. This is the simplest robust route; no history rewrite, new gate, safeguard change or runtime-completion claim is needed.
80/20: Check the repaired coverage with the existing checker, then submit the final combined head and required gate outputs for independent Astra review. Readiness remains separate from merge approval.
VERDICT: author submission; independent final-head judgment pending

# Change review — historical PR #163 merge: platform-neutral installation design

Subject base: 7ef8f158d4129a4cf90cf3c546701f32e348fdd3
Review state: open
Reviewed content: none
Outcome: Repair missing Rule 74 coverage for merge 05e71b03241923d137c218490a974f00ced08ece (PR #163), as directed by the desk on 2026-10-15 at 17:20. The merge makes the fresh-install design target macOS and headless Linux with the same enrollment, authority and recovery contracts. It names separate-user systemd custody, fresh polkit/sudo confirmation, setup supervision and six Linux build units as unimplemented commitments. It changes design documents and their histories, not executable installation behavior.
Affected rules: Purpose independent-safeguard and single-machine rules; rules 1, 28, 29, 31, 32, 49, 71, 74, 90, 91, 100, 111, 113 and 116; rules 101 and 112 preserve hooks and history.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their enforcement. This repair adds review records only; it grants no authority or runtime capability.
Operator questions: none for this historical record repair. PR #166 still requires Justin’s code-owner approval on its final head; this unit does not merge it.
Suggested tier: critical
Declared tier: critical
Tier rationale: The historical range includes governed constitutional changes and source pins, so the review retains their stricter tier even though this repair only records evidence.
Side effects: Each installation milestone now requires OS-specific positive and refusal evidence, including headless Linux. Neither existing OS facilities nor this design imply shipped compatibility. PR #165 subsequently relocated the informal guide out of formal review records.
Undo and recovery: Correct this record through a new commit if its account is wrong. A product reversal would require a new governed revision and register regeneration; do not rewrite the merge or erase its evidence.
Multi-machine posture: Shared repository documentation and pins apply across machines; no runtime store or transport is introduced. One-machine operation preserves its local cause and enrolled-peer replication demands remain explicit.
Layer below: Both parents (7ef8f158d4129a4cf90cf3c546701f32e348fdd3 da99cd521f8eb7a11c0fee24961df13d47d19f9e), the actual first-parent merge diff, PR #162 enrollment and genesis design; docs/06-the-fact-envelope.md, docs/14-the-assembly.md, docs/15-the-operator-surfaces.md and docs/17-harness-adapters/03-capability-account-quota-and-launch-pins.md; review-guides/install-platform-neutral-1013.md; the Rule 74 checker’s base-to-record-edit coverage semantics.
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

# Change review — historical PR #166 merge: concurrent-session coherence (Rule 117)

Subject base: 40de162c384b66613aa2700511e46a59cc762726
Review state: open
Reviewed content: none
Outcome: Repair missing Rule 74 coverage for merge d0944dbaee4acee514c53c25c3f1ba13026953d6 (PR #166), which left main failing the change-review check. The merge adds Rule 117 (One Agent, Many Sessions) and the matching purpose coherency clause, updates the briefing pin and its sync test, regenerates the replay register, extends the step-check graduation deadline and adds the historical records for merges #161, #163 and #164. This record adds evidence only; it changes no runtime behaviour.
Affected rules: Purpose coherency value; rules 31, 37, 45, 47, 49, 65, 69, 72, 73, 74, 84, 90, 91, 98, 101, 109, 111, 113 and 116, and Rule 117 as added by the merge; rules 101 and 112 preserve hooks and history.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their enforcement. This repair adds a review record only; it grants no authority or runtime capability.
Operator questions: none for this historical record repair.
Suggested tier: critical
Declared tier: critical
Tier rationale: The historical range includes governed constitutional changes and a model-facing source pin, so the record keeps their stricter tier even though the repair only records evidence.
Side effects: None at runtime. The merge's own account is reviews/const-onemind-1015-change-review.md and the records it names; this record does not restate or certify their live proofs.
Undo and recovery: Correct this record through a new commit if its account is wrong; never rewrite the merge or erase its evidence.
Multi-machine posture: Shared repository documentation and pins apply across machines; no runtime store or transport is introduced.
Layer below: Both parents (40de162c384b66613aa2700511e46a59cc762726 3670796c5de0d2b671d88e6116af6fede999f098) and the first-parent merge diff; reviews/const-onemind-1015-change-review.md; tests/preview/briefing.ts source selection and constitution-briefing-sync test; the Rule 74 checker's base-to-record-edit coverage semantics.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: The range changes one model-facing excerpt, the purpose coherency clause, pinned in tests/preview/briefing.ts and checked by its sync test; it is a constitutional quotation, not a fixture trigger or an asserted dispatch answer. No output parser or accept/escalate/refuse policy changes. The Rule 118 amendment that follows in the same range adds no model-facing excerpt.
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Historical scope: This is a retrospective author record, not a claim that a reviewer approved the merge at its original landing. The checker's subject runs from the first parent through this record's commit, so the Rule 118 amendment that follows is also visible; its account is reviews/constitution-single-provider-floor-change-review.md.

## Closing block

simplestRobustRoute: Add the missing historical record using the existing Rule 74 mechanism, as was done for merges #161, #163 and #164. No history rewrite, new gate or runtime change is needed.
80/20: Check the repaired coverage with the existing checker; independent review of the combined head remains separate from merge approval.
VERDICT: author submission; independent final-head judgment pending

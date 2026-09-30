# Change review — cint-L4: merge the held-correction wedge fix (unit-a2-findings) so one live switch carries both fixes

Subject base: 16c2f62f03ccb3351d0d907a409b9fcd926e3abb
Review state: open
Reviewed content: none
Outcome: cint-L4 now contains unit-a2-findings 13d89f79 (its own record reviews/unit-a2-findings-change-review.md covers the code); this record covers the merge commit and the register regeneration. Generated conflicts were resolved by regeneration (desk repin 0 pins changed; build-register --replay).
Affected rules: 10, 37, 74 (the fix itself is reviewed in the unit record)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — improved by the merged fix (later turns are no longer held behind an undecided correction)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a merge of an already-reviewed unit plus generated output; no code beyond the unit, no system-prompt, provider-policy or invocationPolicyDigest change
Side effects: a cued correction whose summary judgment is exhausted is answered with the fixed "couldn't record that memory change" notice when its own answer also fails to decide it, instead of being held; later answers carry the undecided warning
Undo and recovery: revert the merge commit and the regeneration commit; the unit record describes the journal compatibility
Multi-machine posture: single-machine preview runner only; no shared state changed
Layer below: tests/preview/journal.ts pendingMemory, settleExhaustedEdit, runSummary's exhausted-frontier return, and packetFor's undecidedEdits
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: the only prompt text changed is the undecidedEdits guidance sentence in the answer packet, widened from revisions to revisions and operator corrections; the system prompt is unchanged
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=regenerated register output after the merge; nothing is postponed

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-correction-wedge.test.ts, tests/preview/journal-memory-correction.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: merge the reviewed unit and regenerate; no other change
80/20: 0 must-fix, 0 notes — merge and generated output only
VERDICT: author submission; the independent verdict is recorded as a pass

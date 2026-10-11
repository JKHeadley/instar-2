# Change review — prepared tool evidence source wiring

Subject base: c330ac53bd7380dcf1baac1236933c897797b501
Review state: open
Reviewed content: none
Outcome: Generated register artifacts identify the committed prepared-tool evidence repair and its exact source digest.
Affected rules: 37, 49, 69, 74, 101, 111, 113, 116
Affected floors: secrets — no credential content added; spend cap — no runtime admission changes; stop — no runtime changes; no duplicate sends — no sends; durable intake — no runtime changes
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Mechanical source-wiring regeneration only; declarations, policy and capability status unchanged.
Side effects: Generated provenance now names c330ac53bd7380dcf1baac1236933c897797b501. No pin was hand-edited. The delegated owner-manifest and inventory repin tools found zero changed pins; build-register --replay --commit generated the seven published files.
Undo and recovery: Regenerate the same artifacts from a reviewed reverted source commit; do not hand-edit hashes. Existing operation and claim-bound recovery remains unchanged by publication.
Multi-machine posture: Generated source evidence is identical across machines; the repaired tool evidence itself remains deliberately machine-local.
Layer below: Read the generated diff and verified that only source commit, generation digest and the tool-turn source hash changed. The 16 targeted tool-prestart tests and recorded Group T replay verify the underlying repair.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the resolved common hooks directory contains sample files only
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Regenerated source provenance preserves existing declared prerequisites; this change introduces no deferral or postponed work.

## Closing block

simplestRobustRoute: Use the existing delegated repin tools and register generator to publish the tested source. No new machinery or authority; start guard is the committed source, end guard is matching generated wiring, and existing checks enforce the publication.
80/20: Targeted tests, typecheck, build and architecture passed. Seven saved-report contract checkers pass locally. Register, P5 and P11 saved-report checks pass in their original gate root; assembly coverage, grounding and boot recovery also pass there through read-only exports. A copied report retains its original root/revision/process-exit binding and is not represented as a fresh full run. Final lint, register and change-review checks are run after this record is committed.
VERDICT: author submission; no independent verdict claimed

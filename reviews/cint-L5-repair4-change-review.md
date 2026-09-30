# Change review — cint-L5 repair 4: the U12 Jev capture test names its held-evidence id

Subject base: 881e756957c54935e6601f34396f7e5b8b7ea20b
Review state: open
Reviewed content: none
Outcome: The post-test register contract map refused the cint-L5 results: U12 declared a Rule 36 hold on fixture PREVIEW-JEV-RESPONSE-ON-CAPTURE (tests/preview/jev-response-capture.test.ts), but no test in that file carried the id in its name, so the checker could not find passing evidence for it even though all four tests passed. The describe title now leads with the id, the convention the other held tests follow (for example PREVIEW-MODEL-JSON-ON-CAPTURE); the four assertions are unchanged and pass. The desk repin refreshes the one owner pin the rename moves, and the register is regenerated at the repin.
Affected rules: 36 (the hold's evidence is now findable in the run), 37 (fixed at source), 74, 116 (a title change, no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a test title and the generated pins/register that follow from it; no src/ or runner behavior changes
Side effects: none at runtime
Undo and recovery: revert the rename commit, the repin, the regeneration and this record
Multi-machine posture: none; repository artifacts only
Layer below: scripts/check-register-contract-map.mjs held-test lookup
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/jev-response-capture.test.ts

## Closing block

simplestRobustRoute: name the id in the test title as the other held tests do; the checker then finds four passing tests, and it still refuses if any fails
80/20: 0 must-fix, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass

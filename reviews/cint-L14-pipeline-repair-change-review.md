# Change review — cint-L14 pipeline repair: inventory test:split-checks as a scoped tool

Subject base: f4371a3af7482022a7fa237910827ec69b39561e
Review state: open
Reviewed content: none
Outcome: The cint-L14 full test run failed one test: tests/assembly/tool-inventory.test.ts (Rule 2) found the package script test:split-checks, carried in by w3-splitmerge, outside the development tool inventory. src/assembly/tool-inventory.ts now registers it as the review-phase tool split-report-checks (node scripts/split-checks.mjs) whose only parameters are at most two repository-relative .json report paths, so a harness can propose the merge but never widen it. Because tool-inventory.ts is an executed file of the self-host composition, the composition digest moved; the native harness contract (tests/preview/native-harness-contract.test.ts) was re-run 9/9 twice and the conformance digest in src/assembly/harness.declarations.json re-declared (sha256:c1904e05…). The desk chain then ran: the owner-reference rehash and inventory repin refreshed nothing, and the register was regenerated with --replay at af4f108b. tool-inventory and shipped-clients tests pass (6/6); lint and register:check exit 0.
Affected rules: 2 (every development script is an inventoried scoped tool), 115 (scoped parameters only), 105 (self-host conformance re-run before re-declaring), 74 (this record), 69 and 90 (register regenerated with --replay, never hand-edited), 37 (source fix, no quarantine), 116 (one inventory entry, no new mechanism)
Affected floors: secrets — unchanged (no credential, the tool takes none); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: one inventory entry for an already-reviewed development script plus the mechanical re-declaration and register regeneration it forces; no runtime, approval, intake or send path changes
Side effects: a harness may now propose split-report-checks with two .json report paths; nothing else
Undo and recovery: revert the three commits and this record
Multi-machine posture: unchanged; the split merge runs on one host over both halves as in the carried w3-splitmerge record
Layer below: reviews/cint-L14-change-review.md (the combine, carried); reviews/w3-splitmerge-change-review.md (the script's own review)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json, src/assembly/tool-inventory.ts

## Closing block

simplestRobustRoute: register the existing script as one scoped inventory entry, as test:gate and test:durability were; no test or checker edit
80/20: 0 must-fixes, 1 note (targeted tests only; the full gate reruns on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass

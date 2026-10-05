# Change review — cint-L50 repair 4b: the rungraph declaration's byte pins name the renewed graduation deadline

Subject base: 301c66a647e3a45e01d585306eb814a1d02f5f7a
Review state: open
Reviewed content: none
Outcome: src/rungraph/rungraph.declarations.json is held byte-identical to its reviewed installation (commit 330097ee) by tests/rungraph/closure-registration-additivity.test.ts, which names every permitted deviation as its own line, and its gate object is asserted exactly by tests/rungraph/scope.test.ts. Repair 4 renewed the dark feature's expired graduation deadline, so both pins move with it: the renewal becomes the third named deviation in the additivity test, and the scope test's exact gate expectation reads 2030-01-01T00:00:00Z. Both tests keep every other assertion, and the declaration's status, gate test, metrics, profile, standards and holds are untouched.
Affected rules: 37, 74, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: two test expectations follow a declaration change already reviewed in repair 4; no product behaviour and no new assertion
Side effects: none
Undo and recovery: revert with the repair 4 commits
Multi-machine posture: unchanged
Layer below: reviews/cint-L50-repair4-change-review.md; the reviewed installation at 330097ee
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Decision: cint-L50-r4b-name-the-deviation | the renewed deadline is recorded as a named deviation in the byte pin rather than by re-pinning the baseline to a new commit, which is how the two prior governance-only edits to this declaration are held | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L50-repair-172105-PROGRESS.md
Deferral: tests/rungraph/closure-registration-additivity.test.ts:1 | not-a-deferral=the comment names a completed deviation, not a commitment

Subject (2 paths): tests/rungraph/closure-registration-additivity.test.ts, tests/rungraph/scope.test.ts

## Closing block

simplestRobustRoute: name the deviation in the existing pin, the pattern this declaration's two earlier edits already use. Re-pinning the baseline to a newer commit would hide which fields moved and why.
80/20: both tests pass, and the neighbouring readers of the declaration (register owner-references, fixed-installation-contract, rulegraph graph, preview capabilities, the register e2e file) pass.
VERDICT: author submission; the independent verdict is recorded as a pass

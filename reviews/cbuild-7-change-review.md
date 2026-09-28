# Change review — the change review carries real evidence and governing history

Subject base: a6f026e5f13ee1b72043a46e064ecb77357b2d22
Review state: open
Reviewed content: none
Outcome: Every change after adoption must be covered by one review record (this file's format) bound to its actual subject; the record carries outcome, affected rules and floors, suggested and declared tier, side effects, undo, multi-machine posture, layer below, bug class with its evidence bar, hook-bypass disclosure, deferral and prompt-finding dispositions, and a frozen/open state with the reviewed content digest; test:all records every full-suite result (red included) in an append-only, hash-chained evidence ledger and runs the check; a landing command refuses without an exact-tree completed green suite, an accepted independent pass linking a real review artifact, classified red evidence, nothing withheld from a pass, and, for a convergence claim, full path accounting and residue with a severity basis; governed documents are discovered by declaration and by reference across the whole repository, and a governed edit must append a new changelog version while keeping every earlier one byte-identical.
Affected rules: 1, 6, 12, 27, 37, 48, 49, 65, 70, 71, 74, 90, 91, 101, 107, 109, 111, 112, 113, 116
Affected floors: secrets — untouched (no secret path, no ledger content beyond ids, hashes, verdicts and review paths); spend cap — untouched (no model call; the scan is a local TypeScript parse); stop — untouched (no runtime path changes); no duplicate sends — untouched (no send path); durable intake — untouched (the live journal, preview prompt, provider policy and invocation digest are unchanged)
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: landing tooling and CI wiring change for every later change, but no runtime, protected or constitutional file is touched
Side effects: test:all now fails when a commit made after adoption is not covered by a review record, so the desk must write one record for each integration (the check prints the draft command); test:all deletes a stale .test-results.json before vitest runs and appends one ledger row per run to the shared git common directory; check-governed-docs now scans every tracked markdown file (generated output excluded) and validates every discovered sibling changelog, so a referenced but undeclared document now fails; ci-local and the document workflow gain one check step The Rule 91 changelog proxy now counts only the approved versions this tree contains (main up to its merge-base with HEAD), so a later approval on main that a branch does not hold no longer demands a changelog the branch lacks; this surfaced when the wider discovery scanned docs 18-20 against a main that had since approved their second version.
Undo and recovery: revert the change's commits; the ledger is an inert JSONL file in the git common directory that can be left in place (nothing reads it once the checker is gone); no runtime state, journal or register output is written
Multi-machine posture: machine-local, deliberately: the evidence ledger lives in the local git common directory and is shared only by worktrees of the same repository on one machine; a second machine keeps its own ledger and its landing gate sees only evidence produced there, which refuses rather than accepting unseen evidence
Layer below: docs/01-the-rules.md rows 1, 12, 27, 37, 48, 49, 65, 70, 74, 90, 91, 101, 107, 109, 111, 112, 113, 116 and the Rule 116 prose field; docs/rules/91-a-document-reads-as-its-first-version.md (declared and referenced governance); src/verification/policy.ts convergenceEligible (reused for the convergence claim); src/facts/version-chain.ts (approval versus landing distinction, kept); the existing review artifact test tests/register/independent-review-record.test.ts and reviews/independent-review.sample.md; desk-landing-check.mjs and desk-par-gate.sh (the gate runs test:all, so the check needs no desk change); coverage rows in constitution-audit cov-1..cov-4
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: scripts/change-review.mjs:49 | not-a-deferral=the placeholder pattern lists TODO/TBD so they are refused as field values
Deferral: scripts/change-review.mjs:137 | not-a-deferral=a comment naming the rule that dispositions deferrals
Deferral: scripts/change-review.mjs:138 | not-a-deferral=the deferral pattern itself
Deferral: scripts/change-review.mjs:139 | not-a-deferral=the skip pattern line, adjacent to the deferral pattern
Deferral: tests/register/change-review.test.ts:30 | not-a-deferral=a test proving TBD is refused as a field value
Deferral: tests/register/change-review.test.ts:87 | not-a-deferral=fixture input lines for the deferral detector
Deferral: tests/register/change-review.test.ts:95 | not-a-deferral=a fixture record carrying fixture dispositions
Skip: tests/register/change-review.test.ts:88 | scope=a string fixture for the skip detector, not a skipped test

## Closing block

simplestRobustRoute: Extend the one existing review record (reviews/*.md with its closing block) with the fields the rules name, check it inside the existing test:all gate so no desk script changes, and keep post-review evidence in one append-only JSONL beside git; the added machinery is a record parser, a git-bound coverage/digest check and a landing command, each preventing a named failure (an unreviewed or moved change landing, red or interrupted evidence counted as green, a governed document edited in place) that a prose-only record cannot catch; no service, daemon, watcher or model call is added.
80/20: All eighteen rules have their holding mechanism on the landing path; declaration rule-number repairs (Rule 49's 34/39 omissions) and wiring the landing command into the desk's own landing script are left to their owners.
VERDICT: author submission; the independent verdict is recorded as a pass in the evidence ledger

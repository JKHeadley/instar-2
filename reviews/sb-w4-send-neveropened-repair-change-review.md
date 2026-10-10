# Change review — correct send replay evidence scope

Subject base: d35d6e0176b683df3b3c94a1ed7ec11e5d879eb9
Review state: open
Reviewed content: none
Outcome: Correct MUST-FIX 1 in the external combine report and preserve the corrected evidence statement in this pushed record: “The recorded candidate content, with the retired historical reply prefix removed, is rendered through the current journal and exercised through the real bridge against loopback transport; this is not a byte-identical historical wire replay.”
Affected rules: Rules 26/70 and purpose constraint 3 require evidence at its actual scope; Rules 48/74/111/116 support this minimal editorial repair; Rules 101/102/112/113 preserve hooks, recorded decisions, history and explicit machine posture.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: This is an editorial addendum to the existing integration publication review. Its subject includes the seven unchanged generated publication files from bb90c380; the repair itself changes evidence wording only, with no implementation, test, prompt or policy changes.
Side effects: Removes an overstated exact-byte replay claim. Preserves the recorded D1c update provenance and the warning that discarded historical native causes cannot prove non-delivery.
Undo and recovery: Correct any subsequent evidence error in a new report/review amendment; no runtime recovery is needed. Do not restore the false exact-byte claim.
Multi-machine posture: External desk report remains machine-local at the required absolute lanes path; this review records the correction in git for other machines. No runtime posture changes.
Layer below: The seven generated publication files are byte-identical to bb90c380 and register:check passes; their original review is reviews/sb-w4-send-neveropened-change-review.md. Inspected tests/preview/journal-send-outcome.test.ts:45–48: fixture.candidate equals PREVIEW prefix plus input.expectedText, while the bridge receives rendered input.text. Verified the external report now carries the exact requested sentence and retains provenance and the historical-unknown warning.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: send-replay-report-scope | correct the evidence report at its source and record its exact wording in this commit, without implementation changes or new tests | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-send-neveropened-repair-PROGRESS.md
Prompt review: No model-facing change. Existing recorded D1c provenance is updates 46039702 and 46039703; no new replay run, live mutation or full-suite result is asserted by this repair.

## Closing block

simplestRobustRoute: Replace the one false sentence and verify it against the existing test; preserve provenance and uncertainty warnings. This is the simplest robust route and adds no machinery or runtime decisions.
80/20: Direct evidence verification plus required typecheck, cheap gate checks and contract checkers against saved gate results; no full suite or additional test run for this editorial repair.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

# Change review — Rule 106 live-build integration repair

Subject base: e65ba9132277f5224086419ed340c9e255b3fd38
Review state: open
Reviewed content: none
Outcome: Merge live build a41053e80086d60309d76c837608a31cac122d6f normally into the requested branch. Preserve the existing shared historicalModule helper and retain both live source-digest assertions in the renewal compatibility tests. Preserve the live writer propagation and recorded replay tests unchanged. Regenerate the register using the desk chain. The Rule 106 status fix remains the existing one-sentence renderer change; this repair adds no production mechanism.
Affected rules: 29 (verified writer preserved on recovery); 26, 34, 36 and 70 (recorded replay and actual source digest); 37 (source repair without quarantine); 49 and 74 (scope and side effects); 66, 69 and 90 (standard register replay); 101 (plain git without bypass); 102 (decisions reported); 106 (retain readable status); 107 and 108 (saved evidence limit stated separately); 112 (ordinary merge preserves history); 113 (posture); 116 (one shared helper, no duplicate machinery)
Affected floors: secrets — no new disclosure or credential handling; spend cap — existing budgets unchanged; stop — existing halted checks unchanged; no duplicate sends — recorded recovery tests reopen and assert no repeated calls or sends; durable intake — journal schema and settlement unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The merged live change preserves the verified writer in model-facing recovery packets. The conflict resolution itself is test-only; register output is mechanical.
Side effects: Recovery packets keep their original writer. Renewal compatibility tests use the shared static-specifier relocator instead of the live branch's duplicate regular-expression helper; digest assertions prove checkout bytes stay unchanged. No prompt text, model-output parser, retry allowance, or acceptance predicate is added or narrowed. The saved Studio gate JSON is inaccessible through the authorized file API: HTTP 413, 2394209 bytes versus the 1048576-byte limit; local results are not a substitute for that saved gate.
Undo and recovery: Revert merge f12f56f9a5161636e79529fa08bb416d4429695a with parent 1 and replay the standard desk chain. No stored-state migration. This would remove the live writer repair and the additional digest assertions.
Multi-machine posture: Identical writer propagation on each worker host; ownership and replication unchanged. Test scratch is deliberately machine-local and outside each checkout. Report is written locally in state and copied to the exact Studio lanes path by the desk.
Layer below: sessionWriterOf, prepareJournalEnvelope, historicalModule and its parser/identity tests, productionGroundingSourceDigest, the recorded malformed/timeout fixtures, and live build a41053e8. No source checker or register criterion is relaxed.
Bug class: integration
Bug evidence: reproducer=tests/preview/renew-activation.test.ts; live=tests/preview/fixtures/x5-malformed-live-2026-10-06.json
Hook bypass: none
Convergence: none
Decision: rule106042520-merge | Merge the exact named live head; resolve overlapping fixture relocation by retaining the shared helper and both live digest assertions. Regenerate generated metadata rather than choosing its conflicting stamps. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule106-auto-p2-repair-042520-PROGRESS.md
Decision: rule106042520-scope | Keep the existing minimal Rule 106 fixed-status repair and live writer recovery; introduce no new production machinery. Run the specifically requested touched test files plus focused recovery and recorded-shape tests, not the whole journal importer closure or full suite. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule106-auto-p2-repair-042520-PROGRESS.md
Decision: rule106042520-evidence | Preserve the HTTP 413 saved-gate access failure as a blocked evidence requirement. Run the named checkers and report missing input honestly; do not reconstruct full-suite evidence or write to Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rule106-auto-p2-repair-042520-PROGRESS.md
Prompt review: The live build changes only propagation of an already verified writer. Its retry-writer test replays captured malformed and complete answers plus a recorded timeout through the actual reader and worker; summary-cascade-stall, handover-review-quotes-live and held-reply-live-rate replay recorded uncertainty, undecided Jev, reply reviews and held/unknown output. No new model-facing code is authored in this conflict resolution. Existing literals below are unchanged.
Prompt finding: 849db3a6296a | protocol-literal | Existing no-memory protocol wording unchanged, as dispositioned in the live sb-w4-flap-b review.
Prompt finding: bd01de21286a | protocol-literal | Existing source-label instruction unchanged, as dispositioned in the live sb-w4-flap-b review.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing operator-question instruction unchanged, as dispositioned in the live sb-w4-flap-b review.

Subject: tests/preview/journal.ts, tests/preview/renew-activation.test.ts, tests/preview/retry-writer.test.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary integration of the named live build, one existing shared fixture helper, and existing desk regeneration. The helper prevents transient checkout hashing mismatches without locks, retries or weakened checks. No new production mechanism is introduced. Start guards are the exact branch and live commit; end guards are targeted regression evidence, architecture/register validation and pushed-commit evidence; limits are one foreground worker, no load/full-suite run, no Studio writes and 90 minutes. No new unattended production-completion claim is made.
80/20: Preserve the one-sentence Rule 106 repair and the live writer fix. Resolve only the real merge conflict. Report the saved-gate evidence access failure as blocked, independently of local passing tests.
VERDICT: author submission; no independent verdict asserted

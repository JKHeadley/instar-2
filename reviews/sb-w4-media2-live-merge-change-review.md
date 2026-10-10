# Change review — Merge live recurring requests into media repair

Subject base: 54f94f0894318237350485f5a5d2c83af9a2cebe
Review state: open
Reviewed content: none
Outcome: Merge live build 398e732b into the media branch with ordinary history, preserve both capabilities in the briefing replay, and regenerate the register from the combined committed tree.
Affected rules: Purpose Rule 3 and ability constraint; 28, 34, 36, 37, 49, 69, 70, 74, 93, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — retain media custody and outbound scrub; spend cap — recurring actions consume the existing allowance; stop — checked before each due dispatch; no duplicate sends — durable occurrence identity and unknown-send behavior retained; durable intake — existing encrypted journal retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merge imports the live recurring-request scheduling and model-facing date instruction into the media intake branch; verify their interaction and historical model shapes.
Side effects: Combined capability briefing contains both media intake and recurring requests. Calendar schedules retain local-day identity through DST and collapse missed occurrences at recovery. Generated metadata comes from the combined committed source. Historical fixtures remain unchanged; the briefing expectation composes the declared deltas from both parents.
Undo and recovery: Revert the merge relative to its first parent and regenerate the register through desk tools. Existing recurring journals require compatibility review before deploying such a rollback; do not retry an uncertain send. No live deployment or journal mutation is performed by this repair.
Multi-machine posture: Repository merge and generated artifacts propagate through git. Existing single-owner journal, signed scheduler writer and effect admission remain in force; no new machine-local store or peer dependency.
Layer below: Inspected recurring calendar parsing, requestOccurrence binding, durable action-due and intent replay, existing media intake, capability generation and exact-source owner manifests. Desk rehash and inventory repin found zero stale hashes; register replay restores the combined declaration population.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: media2-live-merge | Combine media and recurring briefing expectations, preserve recorded fixtures, regenerate metadata with desk tools and exercise all seven captured shapes through the existing due path. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-media2-repair-PROGRESS.md
Prompt review: Imported live datedDecision retains exact operator quotes, recurrence and uncertainty with runner-resolved calendar interpretation. Existing literal scan findings are unchanged protocol guidance. Expanded the existing recurring due-path replay to all seven real captured summary, Jev, reply-review and delivered/empty shapes; all passed alongside daily/weekday, cancellation, restart, stop, spend and signed-occurrence controls.
Prompt finding: 849db3a6296a | protocol-literal | Existing journal response protocol guidance, unchanged by this merge — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | Existing journal response protocol guidance, unchanged by this merge — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing journal response protocol guidance, unchanged by this merge — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"
Deferral: generated/register.json:1 | not-a-deferral=Generated constitutional rule text, no new deferred work.

Subject (17 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/README.md, tests/preview/dated-memory.ts, tests/preview/journal-requested-action.test.ts, tests/preview/journal.declarations.json, tests/preview/journal.ts, tests/preview/recall-latency.test.ts, tests/preview/recurring-calendar.test.ts, tests/preview/requested-action-live-test.md, tests/preview/selfdesc-abilities.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the deployed implementation, combine the two briefing assertions, use existing desk generation and extend an existing recorded-shape test. No new runtime machinery or reduced ability. Start guards are the named parents and captured fixture identities; end guards are targeted tests, tsc, architecture, register and review checks. Existing spend, stop, custody and dispatch limits remain. No fresh full-run or unattended live-delivery claim.
80/20: Six targeted files passed (83 unique tests); requested-action was rerun after expanding its captured shapes. Eight historical contract checkers pass after checkout-path mapping and copying companion proofs; P5/assembly require a fresh exact-tree process receipt and P11 lacks the newly merged recurring-calendar file in the old full report. The automatic pipeline supplies fresh full evidence; no suite is run locally.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

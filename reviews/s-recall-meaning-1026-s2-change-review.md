# Change review — prove meaning lookup and honest search limits

Subject base: d003062f03965fff060b40b932d43d2fbecefd8f
Review state: open
Reviewed content: none
Outcome: Real model replays demonstrate that the revised instructions retrieve the original cabin-key source and communicate uncertainty when the horse name cannot be found. One further general sentence prevents treating a search miss as a claim about what was never said.
Affected rules: 1, 4, 10, 11, 12, 34, 35, 36, 37, 41, 49, 55, 58, 60, 70, 74, 75, 101, 113, 116
Affected floors: Secrets remain in existing custody; spend cap, output and two-call bounds remain; stop cancels through the existing provider. Fresh encrypted temporary journals preserve durable intake and lookup reservations. Local reply capture has no Telegram transport; duplicate-send checkpoints are unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: One sentence changes how the answer model describes a failed memory search.
Side effects: Search misses should describe the search's limits without concluding what the person never said. Answers still use the model's own words. Added instruction bytes can affect packet fitting; targeted packet and pinned-text tests cover the existing boundaries.
Undo and recovery: Revert the capability sentence and its evidence/tests. No stored-state migration or resend is needed.
Multi-machine posture: Same instruction on every machine through existing journal owners. Temporary encrypted replay journals are machine-local deliberately, removed after each question; recorded evidence travels with git. No production state or ownership changes.
Layer below: Astra round 1 verdict read in full. Inspected journal lookup admission, production envelope, readAnswer, subscription invocation bounds and harness custody. Reused the installed subscription route and permitted profile through the existing login guard; the archived activation's account observation and expiry remain unchanged in a scoped policy successor. The 1.x semantic-search comparison and existing-owner choice in the parent review remain applicable; no new retrieval engine.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/s-recall-meaning.test.ts; live=tests/preview/fixtures/s-recall-meaning-real-2026-10-26.json
Evidence boundary: Seven fresh questions per round: three paraphrases, three never-said questions and one early-fact control. Real model, production envelope/route/lookup, isolated reconstructed journal and local reply capture. This is bounded offline behavioral evidence, not Telegram delivery or complete Part 21 conformance. Desk live group S remains independent.
Decision: s-recall-search-claims | Round 1 horse repetition 2 acknowledged search uncertainty but then asserted the user had not told it the name. Strengthen the general search-evidence instruction, without test words or a response template, and replay the entire set again. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-recall-meaning-1026-s2-PROGRESS.md
Prompt review: The added sentence concerns what search evidence establishes. It contains no horse, cabin, barometer, source id or expected reply phrase; no output classifier is added.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged obligation evidence instruction, not a test-derived semantic decision.
Prompt finding: 85544c20941f | protocol-literal | Unchanged holding-notice protocol, not a keyword classifier.
Prompt finding: e8708c7fea24 | protocol-literal | Existing citation duty remains; its assertion verifies delivery of that duty.
Prompt finding: 849db3a6296a | protocol-literal | Existing inventory-empty rendering is unchanged by the recall instruction repair.
Hook bypass: none
Convergence: none

Verification:Round 1 has 6/7 passing cases and one disclosed failed horse answer; round 2 passes 7/7 with 13 complete model calls. Raw output fixtures retain every case and its judgment. The final prompt hashes match the replay capture. Targeted controls and fresh-output replay: 65/65 tests pass across five files; typecheck passes. Initial default-context admissions failed locally before provider commands and are retained in the desk report. The capability sentence is the only new product change.
Publication: Generated register pins refreshed from source commit 2b4aa2baad34d690c66033a4c782619b7bc734bf using the existing replay builder. Shape-only metadata; no authority or certificate changes.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the accepted lookup instruction and existing bounded lookup, add one general search-evidence sentence after a real failure, and capture the model's decisions on the recorded fixture. Seven fresh journals, at most fourteen answer calls per round, zero retries, existing stop/custody/charge controls, no messaging transport. Raw outputs and lookup results make the actual behavior reviewable without another runtime mechanism.
80/20: Repair the one demonstrated inference error and replay the same bounded set. Retain the failed round and existing stub controls, with the desk's independent verdict still required.
VERDICT: author submission; no independent verdict claimed

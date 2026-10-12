# Change review — preserve historical failed-save continuity

Subject base: 208a222111a384b04db9bff4ab7f02ba7d452703
Review state: open
Reviewed content: none
Outcome: Historical and current exact memory-failure notices remain pending after encrypted journal reopen and compaction; delivered successful answers remain addressed. Keep the current outbound notice.
Affected rules: Purpose coherent memory and retained ability; Rules 26/36/37/40/49/70/74/77/89/101/110/111/112/113/116.
Affected floors: secrets — unchanged disclosure and custody checkpoints; spend cap — unchanged durable reservations and UNKNOWN accounting; stop — unchanged pre-effect checks; no duplicate sends — unchanged durable intents and receipts; durable intake — unchanged authenticated encrypted intake.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: False continuity evidence becomes durable and model-visible; test the actual worker across encrypted reopen with captured notice bytes and both adjacent outcomes.
Side effects: The historical exact infrastructure notice is again recognized as an unsaved outcome. No wording, prompt, packet bound, memory validation, retry, authority, store, schema, gate or capability change. Ordinary successful answers retain their existing classification.
Undo and recovery: Revert the classifier comparison and test addition, then regenerate register publications. Original journal bytes remain untouched; no migration is required.
Multi-machine posture: The current journal owner classifies existing durable evidence identically after upgrade or reopen on any machine. Ownership, replication and audience admission are unchanged; no new state is introduced.
Layer below: Inspected continuityFor, replyBody, durable intent/sent evidence, memoryPending/memoryUndecided and encrypted replay. A receipt proves delivery only; the classifier must retain the prior exact failure notice as evidence of non-completion. The regression checks both the prepared continuity packet and the delivered disclosure, then reopens again to verify the recorded account. Existing source validation, bounded repair, infrastructure provenance and send admission remain unchanged.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/journal-boundaries.test.ts; live=tests/preview/fixtures/proofroom-memory-misfire-715672853-2026-09-30.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Decision: retain-historical-notice | Recognize both exact failure notices in the existing classifier; no new machinery is needed to preserve the historical outcome. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/memlive-1011-repair-PROGRESS.md
Prompt review: No prompt or outbound wording changes. Continuity state remains evidence-based for both notice versions. Captured summary writer, uncertain summary, Jev undecided/unsure, reply review, delivered reply and empty reply shapes still traverse the bounded memory repair in journal-memory-save-live.test.ts.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged exact memory-inventory response, not a semantic filter.
Prompt finding: bd01de21286a | protocol-literal | Unchanged source-label grounding instruction.
Prompt finding: fb5fa7e706c8 | protocol-literal | Unchanged semantic retrieval instruction.
Verification: Before the source fix the new historical-notice case failed (addressed instead of pending), while current notice and successful answer passed. After the fix, all 23 journal-boundaries tests and all 17 journal-memory-save-live tests pass, no skips. Historical notice and successful answer bytes come from captured updates 715672853 and 715672779. Existing live repair replay covers 969390379 and recorded writer summary:715672480, uncertain 715672483, Jev 715672482/969389570, review 969389923, delivered 715672479 and empty-context 715672550. Typecheck, build and architecture pass. Final cheap checks and saved gate evidence limitations are recorded in the desk progress report; no fresh full-suite run is claimed.

## Closing block

simplestRobustRoute: This is the simplest robust route: add the historical exact notice to the existing continuity comparison and prove pending versus addressed across encrypted reopen. It prevents the named false-completion regression without new state, migration, gate, retry or capability restriction. Existing intake, cap, stop, secret, ownership and send guards remain in place. Recorded real notice bytes exercise the shipped worker unattended offline; no new live deployment or model claim.
80/20: The supplied regression reproduces, the two notice versions retain pending outcomes, the successful-answer neighbor stays addressed and both affected test files pass. Full gate and independent acceptance remain with the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

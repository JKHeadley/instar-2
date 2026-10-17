# Change review — Align held live replay with accepted UNKNOWN notice handling

Subject base: 46098c00089141f79410b8bc128b0d4b7c47112d
Review state: open
Reviewed content: none
Outcome: Repair three stale assertions in the captured held-turn replay while preserving the accepted socket recovery behavior.
Affected rules: 26, 36, 37, 42, 49, 70, 74, 77, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing outbound checks unchanged; spend cap — assert zero paid reviews for exact UNKNOWN notices and one for rejected-answer fallback; stop — unchanged; no duplicate sends — assert one delivery and no replay after journal reopen; durable intake — original captured update identities and journal replay retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only correction to an accepted runtime contract; no production path, prompt, parser, policy, or source pin changes.
Side effects: The captured uncertain cases require the exact holding pass, absent release, uncertain model state, exact outbound notice and zero Jev/subscription calls. The rejected-answer neighbor retains unavailable subscription review and release. A misleading PASS test title now describes the path actually exercised and counts reviews. Captured historical outage metadata remains unchanged.
Undo and recovery: Revert this test and review commit; that restores the three stale failures but changes no runtime state. Never replay UNKNOWN effects.
Multi-machine posture: Portable offline journal replay only; no new durable or machine-local product state, transport or ownership behavior.
Layer below: Read the full constitution (identical to origin/main), journal-test-worker adapter, journal notice validation and outbound review branches, accepted commit 342a2c5d, the held-live capture provenance, and unknown-answer-notice neighboring tests. The accepted exact durable UNKNOWN notice takes a holding pass; ordinary model prose equal to the same notice still takes a paid review.
Bug class: none
Bug evidence: Test-contract drift, not a new product defect. Original targeted run reproduced exactly the three Studio failures; repaired targeted run passed 14/14 across held-reply-live-rate and unknown-answer-notice. Full-suite execution remains Studio-owned.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: train-55-repair-held-replay | Correct the stale replay expectation rather than undo accepted UNKNOWN notice handling; strengthen exact delivery, state, review-count and restart assertions on both uncertain and rejected outcomes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-55-repair-141337-PROGRESS.md

Subject: tests/preview/held-reply-live-rate.test.ts
Validation: Captured updates 969389576, 969389578 and 969389581 take the zero-paid-review holding path; 969389583 retains one unavailable paid review. The neighboring recorded-shape suite includes update 969390396 and the captured exhausted socket turn, plus the model-written identical-text negative control. These are portable captured-shape replays, not fresh provider or live-channel proof. The held capture explicitly substitutes personal text and lacks original candidate/reviewer text; no stronger provenance is claimed.

simplestRobustRoute: This is the simplest robust route: repair the test's obsolete contract using the existing captured fixtures and worker, with explicit checks for both outcomes and reopen non-repetition. No new machinery or runtime change. Start is durable captured intake, end is one exact delivered result with its truthful state, and existing call/stop/send floors remain. No autonomous product-completion claim.
80/20: Fix the one failing test file, retain accepted runtime behavior, and run targeted replay, typecheck and required cheap gates; independent review and full-suite acceptance remain with the desk.
VERDICT: author submission; independent landing review remains desk-owned

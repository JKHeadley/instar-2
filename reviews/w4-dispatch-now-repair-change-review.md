# Change review — Repair minimal responder recovery interleaving

Subject base: fc4f10ff6f6198cb5a663c7d99e6ecff6c8a5af9
Review state: open
Reviewed content: none
Outcome: keep immediate dispatch while preventing a minimal group collected before an awaited send from claiming a stop already owned by ordinary recovery.
Affected rules: 1, 4, 14, 15, 26, 37, 42, 46, 49, 63, 70, 74, 77, 95, 101, 111, 112, 113, 116
Affected floors: secrets — existing outbound checks and provenance remain; spend cap — existing reservations and caps remain; stop — current gates, latch and exclusive claim remain; no duplicate sends — durable intent validation and UNKNOWN fences remain; durable intake — journal custody before wake remains
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: concurrency repair at existing eligibility checks, without new authority, model decisions, durable formats or effects
Side effects: a group whose recipients change during request preparation is left for the next minimal pass to rebuild. Ordinary recovery can own a later stop while an earlier minimal send is pending. Other eligible groups retain their existing response route.
Undo and recovery: revert the six-line journal change and its regression additions; no migration. Restart recovers the same journal and durable intent ownership.
Multi-machine posture: machine-local scheduling deliberately; existing ownership, peer synchronization and effect admission continue to enforce cross-machine custody. No shared-state format changes.
Layer below: limitedReason eligibility, limited-intent replay validation, ordinary stop intent ownership, untilStopped propagation, and createOrdinaryLane serialization; no validation bypass
Bug class: integration
Bug evidence: reproducer=tests/preview/dispatch-now.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt, parser or model judgment changed; revalidate existing recorded-state eligibility around scheduling awaits
Prompt finding: 849db3a6296a | protocol-literal | unchanged fixed empty-memory status text; unrelated to scheduling
Prompt finding: bd01de21286a | protocol-literal | unchanged sourceLabel output-field instruction; unrelated to scheduling
Prompt finding: fb5fa7e706c8 | protocol-literal | unchanged recall-grounding instruction; unrelated to scheduling

Subject (2 paths): tests/preview/dispatch-now.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: this is the simplest robust route: reuse limitedReason before each collected group and after awaited request preparation. The credible failure is ordinary recovery taking a stop while an earlier minimal send is pending, causing a stale intent and launcher exit. Start guards, journal validation, exclusive stop claims, caps and durable intake remain; completed or UNKNOWN sends retain their existing recorded end states. No new mechanism or ability restriction is needed. This submission claims controlled scheduling evidence, not a live deployment.
80/20: reviewer reproduction fails before repair and both scheduling orders pass afterward. Unchanged and recovered allowance cases verify both sides of post-await eligibility revalidation. All 11 targeted tests pass; full-suite and live evidence remain with the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

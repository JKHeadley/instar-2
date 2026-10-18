# Change review — Canary startup synchronization repair

Subject base: 42d49d0c76de327b461bc78a2d36dffe69247738
Review state: open
Reviewed content: none
Outcome: the real canary startup waits for its poll within a bounded 30-second deadline and distinguishes exit from timeout, preserving every ownership assertion.
Affected rules: 26, 37, 49, 55, 63, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — fixture stderr only, no production path changed; spend cap — unchanged; stop — exact child PID cleanup retained; no duplicate sends — real ownership/refusal assertions retained; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: test harness synchronization only, no product or model-facing change.
Side effects: a genuinely stuck canary can take 30 seconds instead of five to fail; an exited child now fails promptly with a bounded stderr tail. All harness consumers keep the same default call shape.
Undo and recovery: revert the two test files; no durable production state or schema changes.
Multi-machine posture: machine-local test child coordination only; actual conversation ownership and cross-machine refusal paths are unchanged.
Layer below: checked the physical Telegram fixture writes the overlap marker only when getUpdates is invoked, and the owner test independently requires advancing service observations before exercising duplicate refusal.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-cutover-harness.test.ts
Hook bypass: none
Convergence: none
Decision: selfunblock-repair-startup-bound | preserve real poll readiness and ownership assertions while bounding slow boot and exposing failed boot | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/selfunblock-1016-repair-140832-PROGRESS.md

Subject (2 paths): tests/preview/journal-cutover-harness.mjs, tests/preview/journal-cutover-harness.test.ts

## Closing block

simplestRobustRoute: retain the existing real child and poll marker, replace the five-second scheduling assumption with the existing harness-scale 30-second startup bound and immediate exit diagnostics. This is the simplest route; no product machinery, retries, quarantine, or weakened assertions. Start guard checks the child, end guard observes actual poll entry, limit guard is a monotonic deadline. No autonomous product completion is claimed.
80/20: exercise injected slow polling, failed boot and stalled boot plus every direct harness consumer; the Studio runs the full gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

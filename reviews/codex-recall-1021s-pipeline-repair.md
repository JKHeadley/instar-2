# Change review — Preserve recall latency packet evidence after supersession guidance

Subject base: 4dfc4cf64496478cef6bc1194ec135347c4ef0b4
Review state: open
Reviewed content: none
Outcome: The recall latency regression verifies current supersession and unresolved-conflict guidance while retaining both original historical whole-packet digests.
Affected rules: Purpose constraints 2 and 3; Rules 26, 37, 49, 70, 74, 101, 111, 113, 116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair of a historical comparison; no runtime instructions, parsers, admission decisions or capabilities change.
Side effects: Adds a read of the existing immutable reminder-relative-1013 fixture to the latency test. Restoration changes only the comparison copy, outside the timed probes, and leaves current packet delivery unchanged. Both historical hashes, packet size, sibling evidence and full-turn checks stay intact.
Undo and recovery: Revert this test-only change; no durable state, deployment, migration or generated register changes require recovery.
Multi-machine posture: Machine-local deterministic test fixture and temporary journal only; no production state or cross-machine behavior changes.
Layer below: Compared tests/preview/journal.ts against 588332d9 and inspected the existing topic-awareness historical normalization. memoryDecision was already restored here, but the newly changed conflictDecision was not. Recorded frame 400 for update 6233124 contains the prior conflict instruction; restoring that field alone makes both original hashes pass. Current guidance independently requires same-fact supersession and refuses invented winners for unresolved alternatives.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Decision: historical-conflict-restoration | Reuse the recorded predecessor instruction for comparison and separately assert current guidance, preserving both historical digests instead of repinning. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/codex-recall-1021s-repair-PROGRESS.md

Subject (1 paths): tests/preview/recall-latency.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: apply the existing historical-field restoration pattern to the one omitted field and assert the current instruction before restoring it. It adds no runtime mechanism and preserves packet-size and evidence checks. The named failure is a stale historical comparison after a reviewed guidance change; no autonomous runtime completion is claimed.
80/20: The unchanged test reproduced the exact reported hash mismatch; the repair retains both historical digests and checks both supersession and unresolved alternatives. Typecheck and the targeted test verify this bounded test-only change; the Studio pipeline owns the full suite and independent review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

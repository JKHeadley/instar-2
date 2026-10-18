# Change review — Distinguish UNKNOWN answer and delivery notice timing

Subject base: 3dfac82da158f930ea4403137dd222b0adcdc1e5
Review state: open
Reviewed content: none
Outcome: Repair the deterministic phase-timing test failure by checking answer and delivery-notice operations separately, including their payloads and retry measurements.
Affected rules: Rules 13, 26, 37, 49, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — unchanged outbound checks; spend cap — unchanged reservations; stop — unchanged gates; no duplicate sends — assert one UNKNOWN answer and one separate UNKNOWN notice, with two attempts only for proved-not-sent; durable intake — unchanged journal and recovery.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test assertion repair only; no runtime, model, prompt, parser, authority or schema change.
Side effects: The test now rejects a missing notice, duplicate answer, duplicate notice, incorrect operation attribution or incorrect retry accounting instead of conflating all sends into one counter.
Undo and recovery: Revert the assertion repair; this restores the known failing test, without changing runtime or persisted data.
Multi-machine posture: Machine-local test fixture only; production ownership, replication, disclosure standing and recovery remain unchanged.
Layer below: Read journal dispatch phase recording and noticeUnknownReplies, plus send-unknown-notice tests. Each operation receives its own timing row; only proved-not-sent can retry, while a notice UNKNOWN cannot recursively create another notice.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample hooks only, verified before commit.
Convergence: none
Decision: jev-shape-repair-operation-accounting | Replace the stale total-send counter with exact operation/payload sequences and per-operation phase attempt accounting for UNKNOWN and proved-not-sent outcomes; retain the existing injected transport outcomes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-admission-shape-1012-repair-153627-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: repair only the stale test assertions using existing operation ids and the existing notice constant. No runtime machinery is added. Existing start gates, UNKNOWN non-repetition and two-attempt proved-not-sent limit stay intact; no autonomous production completion is claimed.
80/20: Run the phase-timing and delivery-notice files, typecheck, architecture, publication and change-review checks, plus the prescribed pinned tests. Studio owns full-suite acceptance.
VERDICT: author submission; independent convergence is not claimed

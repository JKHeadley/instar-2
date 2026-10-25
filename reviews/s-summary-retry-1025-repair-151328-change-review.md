# Change review — Keep revision overflow out of the ordinary summary cache

Subject base: 4960e59b96025ec9018ce4540c98df860c31955e
Review state: open
Reviewed content: none
Outcome: A rejected summary whose feedback-bearing revision cannot fit does not prevent the same worker from using its remaining ordinary attempt on a later pass.
Affected rules: 7, 34, 35, 36, 37, 42, 49, 55, 60, 70, 74, 75, 95, 96, 101, 102, 113, 116
Affected floors: secrets — existing projection and redaction unchanged; spend cap — reservations, two-attempt bound and prompt ceilings unchanged; stop — existing admission and dispatch checks unchanged; no duplicate sends — send path unchanged; durable intake — originals and failed verdicts retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs a summary freshness regression in the running worker without changing acceptance or prompt content.
Side effects: Repeated pass-local feedback overflow no longer caches a failure for an ordinary packet; a later pass prepares again within existing cooldown and attempt limits. Ordinary preparation failures still cache. No added scheduler, state store, provider call or acceptance shortcut.
Undo and recovery: Revert the conditional cache insertion and regression tests. Journal format is unchanged; original history and failed verdicts remain readable.
Multi-machine posture: The cache and revision are local to the owner worker; no new durable or replicated state. Reservations and failures continue through the existing journal. Recovery no longer requires worker recreation.
Layer below: Read origin/main constitution in full, inspected candidate fitting, prepared launcher envelope, summaryPreflightBlocked key, per-span attempts, reservations and acceptance cascade. The inherited 1.x CompactionSentinel bounded retry behavior remains the route; no session timer is transplanted.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/summary-retry.test.ts; live=tests/preview/fixtures/summary-retry-timing-2026-10-25.json
Evidence boundary: New capacity cases are explicitly synthetic and use the real encrypted journal and launcher envelope. Existing tests replay recorded writer, Jev, reviewer and delivered-reply shapes including uncertainty and empty replies. The timing fixture does not itself prove the cache defect. No unattended live success is claimed; combined and live group S verification remain with the desk.
Hook bypass: none
Convergence: none
Decision: revision-overflow-cache-scope | Do not cache a pass-local revision preparation failure under the ordinary packet key; keep ordinary failures cached and all existing resource and acceptance bounds. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-retry-1025-repair-151328-PROGRESS.md
Prompt review: No prompt wording or parser change. The same bounded feedback and full-context review remain; a cache insertion is conditional on absence of ephemeral revision feedback. Existing protocol literals are unchanged.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Validation: The 32768-byte boundary failed before the fix while the 40000-byte neighbor passed; both pass after it. The ordinary oversized-envelope control keeps preparation cached. The targeted summary replay suite verifies rejection, stop, spend, UNKNOWN recovery and real shapes. Portable gate results are recorded in the local desk-handoff report.

## Closing block

simplestRobustRoute: This is the simplest robust route: guard the existing cache insertion by the lifetime of the feedback it depends on. It prevents a transient revision overflow from becoming a permanent ordinary-attempt block without adding keys, schedulers or durable state. Existing idle admission, stop, reservation, prompt size and two-attempt guards remain; only passing summaries commit. Offline evidence is not an unattended shipped-path claim.
80/20: One runtime conditional with boundary, fitting-neighbor and ordinary-cache controls; generated source pins are refreshed through the delegated tools only.
VERDICT: author submission; no independent verdict asserted

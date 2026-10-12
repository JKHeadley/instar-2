# Change review — include worker disclosure in the Jev deadline

Subject base: 29608af1b2872aa8434bc753d7165b44d724b33b
Review state: open
Reviewed content: none
Outcome: Bound the worker's outer disclosure admission by the existing Jev attempt budget, pass only unspent time to the shipped client, and prevent a timed-out admission from ever entering that client.
Affected rules: Purpose least revelation and durable cause; Rules 1, 4, 34, 36, 49, 55, 60, 63, 67, 70, 74, 75, 76, 77, 86, 95, 101, 102, 111, 113, 116.
Affected floors: secrets — disclosure still admits every private-memory model call; spend cap — existing independent reservations and unknown charges remain; stop — unchanged reservation and worker checks; no duplicate sends — existing intent/restart custody remains; durable intake — no journal format or retention changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration repair on the shipped reply-check admission path; offline evidence establishes readiness for the desk gate, not live rollout.
Side effects: Admission uses the same 850 ms attempt allowance as the request, so an audience check consuming that allowance now produces unavailable/timeout and the existing contextual fallback. The late disclosure promise can settle, but has no continuation that enters the client. Summary callers omit timeoutMs and retain their existing admission behavior. No prompt, verdict schema, threshold, tool or capability changes. Synchronous event-loop stalls remain outside a hard real-time guarantee.
Undo and recovery: Revert this repair to restore prior admission behavior without journal migration; that restores the reviewed latency defect. Prefer a forward fix. Original retry reservation readers must remain deployed for journals already containing retry rows.
Multi-machine posture: No new durable state or authority. The existing conversation owner, disclosure authority, peer-held reservation and stop checks remain responsible for dispatch on every host. Timers are deliberately local to the executing attempt; no timer is replicated or replayed after restart.
Layer below: Inspected the worker's privateMemory/disclosure wrapper, elapsed-time port, shipped client's admission/AbortSignal/fetch path, durable retry reservation and unknown-call accounting, and contextual fallback. Promise.race surrounds only admission; the call is outside the losing branch. A second elapsed-time check refuses expiry even when an admission resolves before a delayed timer callback.
Bug class: integration
Bug evidence: reproducer=tests/preview/jev-retry.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample hooks only, checked during this repair.
Convergence: none
Decision: jev-outer-admission-budget | Bound admission at its owning worker checkpoint and subtract its elapsed time before entering the existing client; no new retry mechanism or relaxed disclosure. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-retry2-1011-repair-003103-PROGRESS.md
Decision: jev-admitted-latency-neighbor | Keep the loopback HTTP latency test as the admitted neighbor using 100 ms audience reads; the retry suite now covers 1500 ms and stalled outer admission plus late release. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-retry2-1011-repair-003103-PROGRESS.md
Decision: jev-repair-pins | Regenerate publication/source pins using the delegated desk scripts and register builder, preserving registry declarations and authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-retry2-1011-repair-003103-PROGRESS.md
Prompt review: No model-facing text or accepted output shape changes. Replays use recorded update 969390330 and unavailable rows 969390355, 969390371, 969390389, 969390397; timing and failures are explicitly injected. Existing group-carry recorded-shape tests exercise summary uncertain, Jev unsure/undecided, reply reviews and empty delivered replies; no live-root access is claimed.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory response in journal.ts, unchanged by this admission repair.
Prompt finding: bd01de21286a | protocol-literal | Existing source-citation guidance in journal.ts, unchanged by this admission repair.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing recall guidance in journal.ts, unchanged by this admission repair.
Verification: Targeted retry, stage latency, reply-check, cost, spend-cap, reply budget, group carry and unavailable-review release tests. Architecture, typecheck, publication checks and pinned-text checks are recorded in the repair report. Saved Studio full-gate results returned HTTP 404; no fabricated full-suite report replaces them.

## Closing block

simplestRobustRoute: This is the simplest robust route: retain the existing worker checkpoint and client, bound only the previously unbounded disclosure wait, and pass the remaining budget onward. The single local timer prevents the demonstrated late dispatch; a raced admission cannot dispatch after losing. Start guards remain disclosure, ownership, stop and durable reservation; limits remain two attempts and the existing total reply budget; end guards remain interpretation and full-context fallback. Real recorded content traverses the shipped worker/client offline, including loopback HTTP; live acceptance belongs to the Studio gate.
80/20: One worker wrapper and targeted neighbor tests address the sole must-fix. No new service, journal schema, capability restriction or reviewer policy.
VERDICT: author submission; independent convergence is not claimed

# Change review — independent deadline enforcement and exact halt custody

Subject base: b6bd18bf7b406e9ebc4cce4bab32ca03cbe85eec
Review state: open
Reviewed content: none
Outcome: Repair the three demonstrated seams: a stalled journal owner or failed journal save no longer cancels exact-worker deadline actuation; non-limit reservation refusals remain uncertain; every worker retirement harvests the recorded watchdog cause before dropping identity.
Affected rules: 1, 4, 26, 32, 36, 42, 46, 49, 55, 60, 63, 65, 68, 70, 74, 95, 97, 101, 102, 103, 105, 111, 113, 115, 116.
Affected floors: secrets — no credential handling changed; spend cap — dispatch still requires reservation, typed cause distinguishes exhaustion from unavailable custody; stop — exact identity enforcement survives host-lock failure and never invents operator stop; no duplicate sends — existing reply identity/send path unchanged; durable intake — open turns and unsettled work retained without replay.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repair of lifetime enforcement and durable halt propagation at physical resource and admission boundaries.
Side effects: The watchdog tries the existing journal lock without waiting; on contention it writes a separate fsynced exact-worker halt in the existing session directory. Session IO folds that evidence into reads and writes, so a stale host snapshot cannot erase it. If all new writes fail, the already-durable open turn remains the causal admission and emergency actuation still runs, reporting recording failure. Fresh deadline, completion receipt and worker identity are checked before actuation. Unknown admission refusals no longer permanently exhaust a conversation. Retirement adds a lifecycle observation; an observed exact halt inhibits revival under the same allowance. This supersedes the original unit review statements that an unwritable halt prevents actuation and that all deadline enforcement waits for the journal lock.
Undo and recovery: Revert the repair commits together with regenerated pins/register if required; preserve session journals, independent halt markers and conversation input custody. Do not delete evidence to resume a halted allowance. Unconfirmed closure retains worker identity for reconciliation.
Multi-machine posture: The physical deadline marker is deliberately machine-local to the existing worker/session IO owner, keyed by exact process identity. Durable conversation halt and queued intake stay with the existing conversation ownership fence; no remote authority, replicated-store demand or send path changes.
Layer below: Read both constitutional documents in full. Inspected physical lock acquisition, atomic journal save, lifecycle receipts, tmux identity, deadline actuator, driver observation, admission reservation producer and both consumers, replacement/maintenance/preparation retirement, durable conversation custody and resource closure. Real subprocess tests hold sessions.lock with a live owner and check both expired and renewed turns.
Bug class: integration
Bug evidence: reproducer=tests/assembly/session-deadline-halt.test.ts
Hook bypass: none; checked core.hooksPath (unset) and common hooks directory (sample files only).
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt or semantic parser changes. The existing recorded summary, Jev, reply-review and reply shapes run through the conversation tests with an explicitly injected ceiling; no historical ceiling incident is claimed. Real HTTP failed durable reservation is asserted at its producer and conversation consumer, alongside actual exhaustion and successful last-call neighbors.

Subject (10 paths): scripts/production-session-io.mjs, scripts/session-deadline-watchdog.mjs, src/assembly/harness.declarations.json, src/assembly/production-conversation-session.ts, src/assembly/production-session-work.ts, tests/assembly/production-conversation-session.test.ts, tests/assembly/production-session-work.test.ts, tests/assembly/session-deadline-halt.test.ts, tests/preview/admission-gate.mjs, tests/preview/admission-gate.test.ts

Verification: 133/133 targeted tests in four changed files passed; tsc --noEmit passed. Native renewal ran the existing 10-case contract on this Darwin host with the declared Node runtime: before 9/10 (only stale certificate), after 10/10. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/runaway-stop-1016-repair-native/after.json. Architecture now passes. Full combined suite and live deployment remain the desk gate.

Publication: The delegated rehash/repin tools found no owner-reference or grounding-inventory changes. Regenerated generated/ by build-register.mjs --replay --commit cf4578fe3eda00446787f47fd0b6b66f66e10581.

Decision: repair-lock-fallback | Use the existing exact-worker admission plus a separately fsynced halt when the journal lock or save is unavailable; this prevents bookkeeping stalls from canceling emergency enforcement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/runaway-stop-1016-repair-PROGRESS.md
Decision: repair-exact-reservation | Carry calls versus reservation-unavailable at the existing checkpoint; only exact exhaustion halts the allowance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/runaway-stop-1016-repair-PROGRESS.md
Decision: repair-retirement-cause | Harvest physical safety causes inside shared retirement so replacement, preparation and idle maintenance cannot discard them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/runaway-stop-1016-repair-PROGRESS.md
Decision: repair-native-renewal | Use the established Darwin contract renewal with before/after evidence; no stale-certificate exception or blind repin is needed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/runaway-stop-1016-repair-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route through existing session IO, admission and retirement owners. The only added physical record retains an exact-worker halt without the stalled shared journal lock; merely extending its timeout cannot enforce a runaway ceiling. Existing durable turn admission authorizes emergency closure even if new writes fail. Fresh identity/deadline/receipt checks guard entry, uncertain retained intake and exact resource closure guard exit, existing call and time bounds remain limits. No new service, model gate, timer or reduced capability. Targeted physical/captured-shape evidence establishes the repair, not full live deployment or autonomous completion.
80/20: Three source seams repaired with positive/negative neighbors, physical contention and write-failure evidence, recorded-shape replay, TypeScript and cheap gates. Native certification uses only the established evidence-backed renewal tool. The desk owns combined full-suite and live proof.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

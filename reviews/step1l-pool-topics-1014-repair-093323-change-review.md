# Change review — topic admission wait and completed-move recovery

Subject base: 25431e47a510fa40bcc5c703fa1925a00b2ef53e
Review state: open
Reviewed content: none
Outcome: Preserve undispatched intake and the idle source worker during destination preflight failure; reconcile durable completed moves before current capacity selection.
Affected rules: Rules 1, 26, 33, 46, 49, 55, 60, 68, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — unchanged encrypted custody and transcript-only copying; spend cap — unchanged shared reservation and prepared-attempt accounting; stop — original host stop and lifetime remain authoritative; no duplicate sends — queued work alone retries, dispatched work is unchanged; durable intake — preflight unavailability returns the existing queued wait result.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Local recovery fixes in existing account handoff; no new queue, service or authority.
Side effects: Idle maintenance now waits on failed destination admission instead of throwing. Retirement, copy and custody exceptions still propagate through their existing error paths. A completed pool record repairs the topic snapshot before selection checks fresh capacity; it cannot authorize another dispatch by itself. The pending-destination quota check already landed in 21b6c36f and is retained.
Undo and recovery: Revert this repair to restore prior behavior, retaining all durable snapshots and intake records. No schema or migration changes. Reverting reintroduces abandoned undispatched input and delayed completion reconciliation.
Multi-machine posture: Machine-local under the existing topic owner and encrypted custody. No credential transfer or second writer.
Layer below: Inspected conversation-session work/drain/maintain and original deadlines, topic coordinator, pool readySession/select and persistent quota holds, recordHandoff idempotency, and encrypted fixture custody. Admission is awaited before exact retirement and transcript copying; only its failure becomes a wait.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains samples only.
Convergence: none
Prompt review: No model prompt or parser changes. Existing recorded summary-writer, uncertain, Jev undecided/unsure, reply-review, delivered-reply and empty-reply fixtures replay through pool replacements and the journal consumer tests.
Decision: step1l-repair-093323-wait | Catch only destination preflight failure at the handoff boundary and return the host's existing wait result; never replay dispatched work or swallow custody/retirement failures. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1l-pool-topics-1014-repair-093323-PROGRESS.md
Decision: step1l-repair-093323-completion | Reconcile an existing pool completion before fresh selection, preserving the original attempt and completion counts even when the destination is now full. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1l-pool-topics-1014-repair-093323-PROGRESS.md

Generated register: Published from source commit da6a34d3ed00cd763e10a2fc003479a3c8030a11 using build-register --replay; shape-only evidence, not native certification. Desk rehash and repin tools changed no owner or inventory pins.

simplestRobustRoute: This is the simplest robust route: reuse the boolean wait result, durable queue, maintenance pass, original lifetime and stop, existing quota selector and completion record. No new state, coordinator or retry mechanism. Prepared intent cannot replace fresh capacity and completed evidence cannot be forgotten because capacity changed. No unattended production acceptance claim.
80/20: Targeted topic pool and direct journal consumer tests, typecheck, architecture/register and change-review checks; Studio owns full-suite and native acceptance.
VERDICT: author submission for desk review; no independent convergence claimed

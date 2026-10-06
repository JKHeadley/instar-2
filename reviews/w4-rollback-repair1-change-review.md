# Change review — w4-rollback repair 1: an explicit compact and a restored snapshot keep the rollback window's guarantees

Subject base: 68513c59cfaf2312dd73aa2c31253638f9996571
Review state: open
Reviewed content: none
Outcome: Repairs the two must-fixes from the w4-rollback unit review (Astra, round 1, VERDICT NO). (1) `compact()` in tests/preview/journal.ts checked read-only/closed/missing-view but never `compactable()`; only its two automatic callers did, and `compact` is returned to every holder of the journal. An explicit call on a root carrying an admitted generation-ahead frame rewrote it, and the reopened view reported `forwardFrames: []`: the frame survived only in `snapshot.retained`, which restore never re-projects. `compact()` now refuses at its own entry, before any rewrite and before the try block that closes the descriptor, so the journal stays open and appendable; the automatic callers keep their continue-appending predicate. (2) `restoreSnapshot` set `forwardFrames` to empty and never applied the unknown-kind decision to the retained rows, so an authenticated, digest-correct snapshot carrying an undeclared or two-generations-ahead frame opened as if whole (pre-existing: the requested base opened it too). Restore now runs `admitForwardFrame` on every retained row whose kind is not in `KNOWN_FRAME_KINDS`, before `verifyPendingEvidence` and before any mutation of the file. Known kinds are already in the saved projection and are not replayed; only the per-reader `forwardFrames` observation is rebuilt, which also keeps a restored root from being compacted again.
Affected rules: 2 (a skipped frame stays named after restore, and no path can compact it out of the projection), 7 (archiving never means deleting: the explicit compaction no longer drops a forward frame's meaning), 42 (a refusal stays a refusal: the snapshot representation now refuses exactly what the raw representation refuses), 26 (the decision is made on the retained frame's own declaration, never on the snapshot's existence), 36 (both sides proven: each new assertion fails on the unrepaired journal.ts and passes on the repaired one, and the ordinary control snapshot and control compaction still succeed), 37 (fixed at the source, no quarantine), 116 (one guard line in `compact` and one loop in `restoreSnapshot` reusing the existing admission function; no new state, no migration service, and no ability narrowed)
Affected floors: secrets — unchanged: frames still authenticate under AES-256-GCM with offset-bound AAD before any admission runs; spend cap — unchanged: no reservation or count path changed, and a forward frame is still counted nowhere; stop — strengthened: a new stop-shaped kind carried in a newer build's snapshot can no longer be silently restored past, since undeclared kinds refuse; no duplicate sends — unchanged: send kinds are known and restored from the saved projection exactly as before; durable intake — unchanged: a refused open mutates nothing, proved byte-for-byte
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what the one durable store accepts on restore and when it may rewrite itself, which every turn of the operator's live conversation depends on.
Side effects: a snapshot whose retained evidence holds an unknown, undeclared or too-new kind now refuses to open where it previously opened; a snapshot from this build never retains such a row, because this build cannot compact a root carrying one. An explicit `compact()` on such a root now throws `preview journal: compaction refused while a forward frame is present` and leaves the journal open. `projectionDigest` and the snapshot shape are unchanged.
Undo and recovery: revert c77f11fd and this record. Nothing durable changes shape and no frame is written differently.
Multi-machine posture: machine-local, as in the unit: `forwardFrames` stays a per-reader observation excluded from the snapshot and the projection digest, so replicas replaying the same sealed bytes still agree.
Layer below: `admitForwardFrame` (reused unchanged, so raw and retained frames meet one test), `verifyPendingEvidence` (runs after admission, unchanged), and `compact`'s try/catch (the new guard sits before it, so a refusal does not close the descriptor).
Bug class: durability
Bug evidence: reproducer=tests/preview/journal-rollback-window.test.ts; restart=tests/preview/journal-rollback-window.test.ts
Hook bypass: none
Convergence: none
Decision: w4-rollback-compact-guard-inside | the guard lives in `compact()` itself rather than at more callers, because `compact` is returned publicly and any future caller would otherwise need to remember it; it throws before the try block so the refusal leaves the journal usable | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rollback-PROGRESS.md
Decision: w4-rollback-restore-reuses-admission | restore applies the existing `admitForwardFrame` to unknown retained kinds only, rebuilding the per-reader observation without replaying known effects already in the saved projection | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rollback-PROGRESS.md
Prompt review: no prompt, question, policy or framing text changed; this repair changes which stored frames a reader accepts on restore and when the store rewrites itself, never what a model is asked or how its output is parsed.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L45-change-review.md)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L45-change-review.md)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L45-change-review.md)

Subject (3 paths): reviews/w4-rollback-repair1-change-review.md, tests/preview/journal-rollback-window.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: required outcome: no path (explicit compaction or snapshot restore) bypasses the rollback window's preservation and refusal. Route: enforce the existing predicate at the function every compaction passes through, and run the existing admission test over the one representation that skipped it.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass

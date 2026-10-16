# Change review — Reconcile uncertain obligation evidence on the existing cadence

Subject base: 9b46a38232d88985e902a9fea9ecfee6d8b1ae66
Review state: open
Reviewed content: none
Outcome: A transient recovery read failure retains its original attempt identity and remains eligible for evidence reconciliation without repeating execution.
Affected rules: 8, 26, 36, 46, 49, 55, 63, 68, 70, 74, 75, 83, 101, 102, 113, 114, 116.
Affected floors: secrets — existing encrypted evidence and output handling; spend cap — reconciliation reserves no new call and settles the existing reservation; stop — existing gate precedes observation; no duplicate sends — uncertain execution remains held and recovered reports use the existing reply delivery path; durable intake — held work and attempt identity survive journal replay and compaction.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Durable work recovery controls whether an interrupted effect can be repeated.
Side effects: The existing host wake time now includes held reconciliation work. Repeated unknown evidence advances the existing revisit cadence and retains execution inhibition without extra providers, watchers or stores. A proved result clears the hold once; proven non-launch permits the next normally scheduled attempt.
Undo and recovery: Stop affected runners before rollback because the predecessor permanently holds uncertain results. Retain journals; no new record type or migration is needed. Restart repaired code to reconcile existing recoveryHeld rows through their retained lastSlot.
Multi-machine posture: Shared journal work retains its exact attempt id; the existing session evidence collector still enforces owner, scope, placement and child closure. No foreign owner gains execution authority.
Layer below: projectObligationWork ordering, idempotent settleTokens, obligationSchedule execution exclusion, session collector exact closure and no-child evidence, journal checkpoint captured digest, and loopHealth host wake projection.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-obligations.test.ts
Hook bypass: none
Convergence: none
Decision: silence-cover-reconcile | Reuse lastSlot and recoveryHeld as pending identity; reread on the existing cadence and clear the hold only on resolved evidence, preserving execution exclusion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/silence-cover-1015-repair-185211-PROGRESS.md
Decision: silence-cover-wake | Include held evidence in nextWorkAt and remove its unknown-only host inhibition so observation remains scheduled. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/silence-cover-1015-repair-185211-PROGRESS.md
Prompt review: No model instructions or field parser changed. Replay the committed real c1 checkpoint and recorded negative summary, review, Jev and empty-reply outputs using the existing decision parser; injected uncertainty is explicitly synthetic.
Prompt finding: 849db3a6296a | quoted-evidence | Existing memory diagnostic phrase untouched by recovery repair — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: e8708c7fea24 | quoted-evidence | Existing source instruction untouched by recovery repair — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

## Closing block

simplestRobustRoute: This is the simplest route: reuse the durable attempt slot, recovery-held flag, exact evidence collector and bounded work cadence. No additional store, watcher, model call or effect retry is introduced. Stop and owner checks remain admission guards; a single recovered report or proven non-launch resolves the hold; unknown evidence stays execution-held. Tests replay real recorded output, not an unattended live-delivery claim; isolated live proof remains desk-owned.
80/20: Repair the single demonstrated dead end, test both persistent unknown and later resolved evidence, and regenerate existing source pins.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

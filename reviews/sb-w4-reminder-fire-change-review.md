# Change review — sb-w4-reminder-fire integration

Subject base: 01279df4399297466caa0f72400cdfe1b1269a48
Review state: open
Reviewed content: none
Outcome: integrate w4-reminder-fire 680aecce0682ec44248fe1a2c5f3bc22decce028 onto the exact live sb-w4-agentready head; an idle poll settles exhausted background memory judgments so an already requested due reminder can fire without another inbound message.
Affected rules: 29, 34, 36, 52, 57, 69, 70, 74, 87, 90, 93, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets and durable intake unchanged; stop and expiry precede settlement; spend caps, cancellation holds, verified scheduler principal, aggregation and the no duplicate sends floor through durable send deduplication remain in the existing path. Always-sent envelope measures 21675 bytes under the unchanged 22959-byte guard.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: carries the unit's user-facing reminder admission change.
Side effects: the ordinary merge fast-forwarded with no conflicts. No unit byte was edited. Idle polling now records existing memory-undecided settlements for exhausted judgments. Retryable memory and later unanswered cancellation candidates still hold. The desk replay changes only generated provenance and the source wiring pin.
Undo and recovery: revert the unit's source/test commit and regenerate the register; existing memory-undecided records are readable by the earlier build. No new journal format, store, ownership or authority.
Multi-machine posture: unchanged single-owner preview journal and verified scheduler writer; this integration adds no machine-local state or cross-machine protocol.
Layer below: the carried reviews/w4-reminder-fire-change-review.md, settleExhaustedEdit, unresolvedReminderMemory, scheduleRequests stop/expiry/spend guards, ordinary drain, verified system writer and durable send intent. The existing register generator consumes the actual merged bytes.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and the common hooks directory contains only sample hooks. Plain ordinary merge and commits.
Convergence: none
Decision: sb-w4-reminder-fire-merge | merge exactly 680aecce onto live base 01279df4, preserving unit bytes and history; no conflicts; unit evidence is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-reminder-fire-PROGRESS.md | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-reminder-fire-PROGRESS.md
Decision: sb-w4-reminder-fire-desk | use the cint-L37 desk chain: inventory repin, TypeScript build, owner-manifest rehash, register replay at 680aecce; no new machinery or changed guard | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-reminder-fire-PROGRESS.md
Prompt review: no prompt, parser or model routing change. Captured reminder outputs and failures for updates 6233067 and 6233075 replay through the new scheduling path; recorded summary-cascade uncertain and undecided outcomes also replay. Supplemental held-reply shapes are synthetic, not claimed as real empty-bubble evidence. Complete live-prefix replay is the unit's recorded evidence; this machine does not claim a fresh live-room read or delivery.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed absent-memory reply in journal.ts, unchanged.
Prompt finding: bd01de21286a | protocol-literal | existing sourceLabel citation instruction, unchanged.
Prompt finding: fb5fa7e706c8 | protocol-literal | existing instruction for questions about the operator's words, unchanged.
Deferral: generated/register.json:1 | not-a-deferral=generated constitutional text, not a deferred task introduced here

simplestRobustRoute: ordinary merge of the reviewed unit plus the established desk regeneration chain. This is that route. The unit reuses an exact exhaustion predicate rather than adding another scheduler or weakening cancellation holds. Stop/expiry start guards and existing spend, intent and send limits remain. Captured reminder regressions verify one due turn and one send across repeated polling and restart; actual deployment and Telegram proof remain the pipeline's responsibility.
80/20: targeted regression and boundary tests, register consumer and unchanged context guard; no full suite or unrelated platform investigation. Author submission to the independent pipeline gate.
VERDICT: author submission; independent pipeline gate pending

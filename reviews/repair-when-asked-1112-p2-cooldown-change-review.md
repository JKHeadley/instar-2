# Change review — per-turn preparation cooldown repair

Subject base: 644ec8abf31078ff9f979faaf94a9108640d4173
Review state: open
Reviewed content: none
Outcome: Multiple preparation-held turns keep independent cooldowns while later turns and one durable accelerated retry remain reachable.
Affected rules: 4, 8, 46, 55, 57, 60, 61, 68, 74, 77, 95, 101, 102, 113, 116, 123
Affected floors: secrets — unchanged outbound boundary; spend cap — existing reservations; stop — existing gates; no duplicate sends — unknown reservations never replay; durable intake — existing journal retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Scheduling brake in the live journal worker; narrow repair of review regression.
Side effects: Cache now holds one entry per pending preparation-held turn. Completed, reserved, removed and unheld entries are pruned; successful preparation deletes its entry. Frontier, byte-limit and elapsed-time invalidation remain unchanged. Rules 77/95: cooldown skips only its held turn, preserving later-turn reachability; uncertainty grants no call.
Undo and recovery: Revert this repair commit to restore single-slot cache; that also restores the known repeated-preparation defect. No schema or durable record changes.
Multi-machine posture: Deliberately worker-local optimization; existing journal ownership and durable repair consumption remain authoritative on every machine.
Layer below: Checked heldFitKey, held turn traversal, durable selfRepairAttempt consumption, preparation failure and reservation/send gates.
Bug class: unit
Bug evidence: reproducer=tests/preview/self-repair-request.test.ts
Hook bypass: none
Convergence: none
Decision: repair-preparation-per-turn | Preserve independent pending-turn cooldowns, existing invalidation, and durable once-only acceleration | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/repair-when-asked-1112-p2-repair-213826-PROGRESS.md
Team posture: Existing verified operator and conversation ownership unchanged; cache adds no visibility or authority.
1.x comparison: Researched JKHeadley/instar main 6dbe9535b4c82eb71887df62f3b56db1baa8aa99: src/monitoring/StallTriageNurse.ts treatment/verification/silent respawn; src/messaging/DeliveryRetryManager.ts bounded retry and manual-cycle latch; src/scaffold/templates.ts Self-Unblock and Self-Diagnosis; docs/specs/self-unblock-before-escalating.md existing BlockerLedger design. History 8d81ecb24, e7d875b69, 5129779c3; ONEX-LESSONS sessions/recovery and wiring-integrity lessons. Carry the behavior, not tmux managers: the 2.0 journal already owns exact reservations, scope and effect uniqueness. Additional repair precedent: StallTriageNurse.ts lines 188/247/922 keys cooldowns by topic; reuse that isolation by turn here.
Prompt review: No prompt/parser changes. Replays existing authorized message-828 shapes through real writer/worker with substituted model responses; adds two held turns and counts preparation at the real port. No live-provider claim.
Prompt finding: 105c1569b6bb | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (2 paths): tests/preview/journal.ts, tests/preview/self-repair-request.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: key the existing cooldown by turn and discard obsolete entries; retain existing invalidation and durable acceleration. No second scheduler or capability restriction.
80/20: Eight generated projections refreshed mechanically against c19af8831eb43610c03d87d570520de320a5cca1 (generation sha256:932eab3277ee0d51fea0c235af28e8b46cfc1cc2e3efd5549ae16d99cc342bf5). One review must-fix, repaired at source in 13 changed runtime lines; regression fails before and passes after. No full-suite or live deployment claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

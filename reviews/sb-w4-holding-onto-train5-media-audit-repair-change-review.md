# Change review — active-memory media provenance repair

Subject base: 40a4293808495cf18106cc0dec79b3c275704440
Review state: open
Reviewed content: none
Outcome: The shipped active-memory auditor accepts authentic photo, voice, audio and document history before and after custody and compacted replay, while rejecting altered content and broken operator provenance.
Affected rules: 26, 28, 37, 45, 49, 70, 74, 101, 113, 116.
Affected floors: secrets — original custody and audit output remain intact; spend cap — no calls or reservations added; stop — original checks intact; no duplicate sends — no dispatch change; durable intake — retained envelopes and custody records remain the source.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This repairs the shipped provenance consumer and shares the existing intake formatter; exact content and authenticated identity checks are required even though the changed audit is read-only.
Side effects: operatorMessageText is a pure extraction of the existing intake expression, preserving every description, caption, text and unreadable-content byte. The auditor reconstructs only supported media from this function plus mediaCustodyText for the recorded result. Plain-text exact comparison remains. A custody-bearing turn without its media envelope is refused. Generated register files bind the committed source inventory.
Undo and recovery: Revert the source repair and regenerate the register through the desk tools; that restores the false media finding. There is no journal schema change, migration, new store or effect to undo.
Multi-machine posture: The audit is read-only over the same authenticated journal projection on any host, including compacted replay. No new shared or machine-local state, ownership or transport is introduced.
Layer below: Inspected admittedUpdate, the media-custody reducer, telegramInboundMedia, mediaCustodyText, journal compaction/reopen and the shipped journal-agent audit command. Tests invoke the actual worker and encrypted journal with substituted model/media ports, then run the shipped CLI after compaction. The intake text expression is moved unchanged; no prompt or model-output decisions change.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-audit.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only
Convergence: none
Decision: holding-train5-media-audit-shared-text | Extract the existing intake text expression and reuse it in the provenance consumer, with the existing custody formatter and exact equality; avoid a duplicate format or permissive substring test. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-holding-onto-train5-repair-PROGRESS.md
Decision: holding-train5-media-audit-evidence | Keep the saved gate report and process provenance intact. Record its worktree-bound evidence failures separately from targeted repair results; the pipeline owns the fresh full run. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-holding-onto-train5-repair-PROGRESS.md
Prompt review: The formatter is extracted without changing its expression or emitted text. No instructions, questions, output parser or accept/escalate/refuse model decision changes. Existing literal findings are unchanged protocol instructions. Media fixtures are explicitly synthetic, not live-platform captures; no new live-model claim or recorded-model replay claim is made.
Prompt finding: 849db3a6296a | protocol-literal | unchanged fixed memory-list reply
Prompt finding: bd01de21286a | protocol-literal | unchanged source citation instruction
Prompt finding: fb5fa7e706c8 | protocol-literal | unchanged source grounding instruction

Subject (outside reviews): tests/preview/journal-audit.mjs, tests/preview/journal-audit.test.ts, tests/preview/journal.ts, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json.

## Closing block

simplestRobustRoute: This is the simplest robust route: migrate the existing consumer to the producer's exact text derivation and recorded custody formatter. Sharing prevents future format drift; no new service, gate, approval or reduction in media ability. Start guards retain acceptance, update, sender and bound-chat checks; the end guard is exact full-content equality including custody. Existing bounded intake, custody and execution limits remain. The shipped audit CLI exits zero for each compacted media fixture; altered content and provenance produce the original finding. This is synthetic integration evidence, not an autonomous live-platform completion claim.
80/20: The four new media regressions first reproduced memory-operator-source-absent, then the whole touched audit file passed all 20 tests without skips, including plaintext/forum and tamper controls. Typecheck and build pass. Final cheap checks and exact saved-report limitations are recorded in the lane progress; no full suite or load test runs on this host.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

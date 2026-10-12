# Change review — merge live memory fixes with acknowledgement and recall repairs

Subject base: 0d9a45b7b0e748a863e591fa1057dc14f1e85f87
Review state: open
Reviewed content: none
Outcome: Include live build cbc92478 in holdack-1011 through an ordinary merge, preserving acknowledgement handling, current-question recall, compact memory guidance and historical failure-notice continuity.
Affected rules: Purpose coherence, least revelation and durable cause; Rules 7, 11, 26, 31, 36, 37, 49, 63, 70, 74, 96, 101, 110, 111, 112, 113, 116.
Affected floors: secrets — existing outbound guard retained; spend cap — existing bounded calls and reservations retained; stop — existing admission and dispatch checks retained; no duplicate sends — acknowledgement and final answer assertions retained; durable intake — encrypted journal, original memory and replication retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This merge includes previously shipped prompt and continuity changes, verified together with branch recall and acknowledgement repairs using recorded outputs and targeted regressions.
Side effects: Compact guidance leaves more packet space, so recent turns no longer need dropping in the cross-topic regression. Assert the exact optional candidate drop instead and retain both recalled packet content and durable grounding assertions. No runtime behavior is added beyond the two parents.
Undo and recovery: Revert the merge with its first parent as mainline and regenerate register publications. No new schema, migration or persistent store; historical journal bytes remain readable.
Multi-machine posture: Existing ownership, replication and owner-only sends remain. The retained peer-loss proof checks acknowledgement and final delivery separately after peer recovery, with no send during peer absence. Replay evidence is deliberately machine-local.
Layer below: Compared both parents of journal.ts, inspected recall priority and optional packet dropping, retained durable source and current-question assertions, and inspected captured-output replay and historical-notice reopen tests. Source merged cleanly; conflicts were generated publications and adjacent independent assertions. Runtime safeguards are unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, containing only sample hooks.
Convergence: none
Decision: ordinary-live-merge | Preserve both parent histories and behavior; resolve the obsolete recent-drop assertion to the exact candidate actually dropped by the compact prompt. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack-1011-repair-PROGRESS.md
Prompt review: Retain the live build's compact journal/topic/restart guidance verbatim, including exact memory source and quotation requirements. The branch's current-question recall priority remains. Replay real recorded writer, uncertain, Jev, review, delivered and empty-context outputs through the merged worker; no live model or deployment claim.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged exact memory-inventory response, not a semantic filter.
Prompt finding: bd01de21286a | protocol-literal | Unchanged source-label grounding instruction.
Prompt finding: fb5fa7e706c8 | protocol-literal | Unchanged semantic retrieval instruction.

Verification: journal-boundaries (23), journal-memory-save-live (17) and topic-awareness (11) passed before the assertion-only repair. journal-conversations (11), journal (70), journal-packet-pressure-value (1), journal-summary-crash (39) and two-machine-floors (4) then passed together: 125/125 tests. Compiler and build passed. The merged worker consumes the recorded 969390379 save and writer/uncertain/Jev/review/delivered/empty-context cases with their original update IDs; historical notice 715672853 stays pending and successful reply 715672779 stays addressed. The unchanged saved full report still carries the old peer-loss failure; contract checkers stop at that failed-report prerequisite, not at a new source finding. The pipeline owns the fresh full run.
Generated publication: Delegated manifest/assembly repin tools ran and reported zero pin changes. Regenerated all seven publications from merged source ec842fcec000f2ed17b51b4ff9cd8b2b032a09a2, generation sha256:d9278890c3a11b2ab47b9e68f00eb5bfb4a6decebb8b2e6bdf621d550b28aaf6. No pin was hand-edited.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge, keep both independent assertions and adjust only the packet-drop expectation invalidated by shorter live guidance; regenerate conflicting derived publication data. No additional machinery or capability restriction. Start, end and limit guards remain authenticated durable intake, truthful outcomes, bounded calls, stop, secrets and durable owned sends. Existing recorded cases exercise the merged worker unattended offline; no fresh autonomous live completion is claimed.
80/20: Targeted merge tests, recorded-shape replay, pinned-text tests, compiler and cheap gates provide candidate evidence. Preserve prior passing history and let the pipeline supply the full-suite run and independent landing judgment.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

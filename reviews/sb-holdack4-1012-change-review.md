# Change review — Integrate ten-second slow-reply acknowledgement

Subject base: ea75ce395d9fdd4f9f2f970e8c278b9fe37a5387
Review state: open
Reviewed content: none
Outcome: Integrate reviewed holdack4-1012 at 8e8edc1d onto the exact live head; suppress acknowledgements when the answer is ready before ten seconds, while preserving older durable acknowledgements.
Affected rules: Purpose least revelation and durable cause; Rules 1/4/14/26/32/36/44/46/49/52/63/69/70/74/75/77/87/90/101/102/111/112/113/116.
Affected floors: secrets — existing outbound checks unchanged; spend cap — no new model calls and reply allowance retained; stop — existing cancellation and dispatch checks unchanged; no duplicate sends — durable intent and UNKNOWN fence retained; durable intake — journal acceptance unchanged and older eight-second entries remain readable.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of a timing correction at an irreversible outbound boundary, including durable-history compatibility.
Side effects: Acknowledgement starts at ten rather than eight seconds. An already-ready answer suppresses it during review and delivery. Replay still accepts previously admitted eight-second fixed acknowledgements. Generated publication names the merged unit head. No new prompt, parser, review criterion or state store.
Undo and recovery: Revert the unit and regenerate publication; ten-second entries remain admissible under the previous eight-second minimum. Never retry accepted or UNKNOWN sends.
Multi-machine posture: Timers remain deliberately process-local and reconstructed from durable intake. Existing ownership, replication and signed admission govern sends; no additional shared state or authority.
Layer below: Read both constitutional documents in full and verified they match origin/main. The unit is a descendant of the exact live ea75ce39; ordinary merge fast-forwarded without conflicts. Inspected existing answerReady cancellation, turn.answer guard and new/replay journal boundary. Repin and owner rehash found zero changed pins. Unit report exists locally at .instar/state/holdack4-1012.md; its Studio destination below was not yet readable (404). Integration uses committed captures and reruns changed tests, default context and publication checks.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath checked unset and common hooks directory contains only samples.
Convergence: none
Decision: sb-holdack4-merge | Ordinary merge of reviewed 8e8edc1dbda836c59f3d960c0c8553a54ce7dc3b into exact live ea75ce395d9fdd4f9f2f970e8c278b9fe37a5387 fast-forwarded without conflicts; keep the unit unchanged. Unit report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack4-1012-PROGRESS.md (local original .instar/state/holdack4-1012.md). | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-holdack4-1012-PROGRESS.md
Decision: sb-holdack4-publication | Use the existing desk repin, build, owner rehash and register replay from merged 8e8edc1d; zero inventory or owner pins require changes, and only generated publication identity is refreshed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-holdack4-1012-PROGRESS.md
Prompt review: No model-facing text changes in this integration. Committed real shapes replay from live updates 969390382 and 969390407–410, summary-writer summary:715672480, summary-uncertain 715672483, Jev-undecided 715672482, Jev-unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty reply 715672550. Injected timing proves the new ten-second path; no fresh production measurement is claimed.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged answer protocol, already dispositioned by the unit.
Prompt finding: bd01de21286a | protocol-literal | Existing unchanged source-label grounding instruction, already dispositioned by the unit.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing unchanged operator-history grounding instruction, already dispositioned by the unit.
Deferral: generated/register.json:1 | not-a-deferral=Existing governed register text emitted by the generator, not deferred work.

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the reviewed unit unchanged and refresh publication with existing desk tools. Existing answer guards, timer cancellation, ownership, allowance and UNKNOWN fences supply the start, completion and limit guards. The replay distinction prevents unreadable deployed journals without a new timer or readiness flag. No new machinery, live deployment or unattended production completion is claimed.
80/20: Run changed tests, committed real shapes, context-floor and required machine checks; list WSL limitations for the Studio gate. No full suite, load generation or second base worktree.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

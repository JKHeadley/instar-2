# Change review — Restore composed prompt floor and recorded replay paths

Subject base: b1c387eb164a63c946f9c372a055ee03fccd7069
Review state: open
Reviewed content: none
Outcome: Restore the complete answer/tool/summary prompt within the existing byte floor and replay captured model outputs with the approved Rule 87 source.
Affected rules: 3, 7, 36, 37, 47, 49, 58, 70, 74, 87, 93, 96, 101, 110, 111, 113, 116; purpose ability preservation.
Affected floors: secrets — existing custody and outbound checkpoint unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged durable claims; durable intake — unchanged journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Model-facing prompt prose changes need captured-shape replays and exact byte-boundary evidence.
Side effects: Prompt text is shorter but all verbatim constitutional rows, protocol fields, capabilities and checkpoint requirements remain. Current source-order assertions now include Rule 87 instead of throwing inside replay model ports. Register outputs are regenerated for this source tree.
Undo and recovery: Revert the source repair and regenerate the register; historical journal outputs and gate evidence are read-only and need no recovery.
Multi-machine posture: Stateless prompt composition is identical on each machine. Temporary offline replay journals and diagnostic logs are machine-local; no replication, ownership or transport changes.
Layer below: Checked sourcePacket excerpt hashing, ANSWER_INSTRUCTIONS delivery, packetFor recall instructions, packet fitting and review reserve, replay callbacks and real recorded outputs. Both constitutional documents read in full.
Bug class: integration
Bug evidence: reproducer=tests/preview/guidance.test.ts; Before: 13 failures in four named files. After: those four files pass 39 tests, with only the existing manual capture test skipped. Exact floor and one-byte-over boundary both pass, including the tool route. Recorded default-root directive and blocker paths fire.
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: Only explanatory prose is shortened; exact rule meanings and Rule 87 remain unchanged. Protocol requires verbatim quote/date, fulfilled evidence of completed work, application-owned compaction disclosure, evidence-grounded recall and honest missing-source handling. Summary uncertain/over-cap outputs, Jev undecided/unsure, reviewer verdicts and delivered/empty candidates are replayed from immutable live/proof-room captures. This proves path execution, not a new live model quality judgment.
Prompt finding: 4b98dc2a1b9f | quoted-evidence | Existing self-description or memory-list protocol wording is quoted by regression tests; this repair introduces no fixed semantic answer — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 849db3a6296a | quoted-evidence | Existing self-description or memory-list protocol wording is quoted by regression tests; this repair introduces no fixed semantic answer — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 95e349aaf4ac | quoted-evidence | Existing self-description or memory-list protocol wording is quoted by regression tests; this repair introduces no fixed semantic answer — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Deferral: tests/preview/briefing.ts:217 | not-a-deferral=The instruction precedence verb is defer, not a postponement of builder work.

Subject (15 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/briefing.ts, tests/preview/guidance.test.ts, tests/preview/hallucinated-memory-rate.test.ts, tests/preview/journal-boundaries.test.ts, tests/preview/journal-channel-memory.test.ts, tests/preview/journal.ts, tests/preview/summary-cascade-stall.test.ts, tests/preview/topic-awareness.test.ts

Register replay: regenerated seven generated/ publications at source commit 89fca85326d2fc73677e28d755b451366edfa0be; reviewed the generation/source-only diff and retained all declaration counts.

Recall consumers: updated the negative-control phrase locator and source-label assertion for the shortened guidance; five tests across hallucinated-memory-rate.test.ts and journal-channel-memory.test.ts pass.

Prompt finding: e8708c7fea24 | quoted-evidence | The regression test locates and removes the current recall instruction to exercise its negative control; the runtime prose is not derived from a semantic fixture answer.

Pinned instruction consumers: journal-boundaries now checks the compact compaction/provenance wording; topic-awareness restores only the reviewed recall prose for its historical packet comparison, preserving the original digest. Both files pass all 34 tests.

## Closing block

simplestRobustRoute: This is the simplest robust route: remove redundant explanatory words and update three stale source-list assertions. No cap expansion, capability restriction, new machinery or quarantine. Existing intake, prompt-fit, effect and resource checkpoints stay in force; no new autonomous capability is claimed.
80/20: All named regressions pass on recorded shapes and byte boundaries; the desk reruns the full suite. No independent convergence verdict is claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

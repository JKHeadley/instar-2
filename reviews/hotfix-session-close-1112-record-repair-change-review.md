# Change review — withdraw the unsafe exit diagnostic

Subject base: 8ff2f5f97afe005e91183cb1e5764b9a1a8957f9
Review state: open
Reviewed content: none
Outcome: Retain only the close tolerance in src/assembly/production-conversation-session.ts and its regression test. Restore tests/preview/journal-agent.mjs byte-identically to e3cb0f08 and remove the diagnostic test.
Affected rules: 1, 12, 24, 25, 27, 34, 37, 42, 49, 70, 74, 101, 102, 105, 111, 113, 115, 116, 123
Affected floors: secrets — the added diagnostic is removed; spend cap — reservation and accounting remain enforced; stop — retirement still runs; no duplicate sends — no dispatch or replay changes; durable intake — existing inputs and local close remain persisted.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The retained change affects durable conversation closure; the diagnostic addition is withdrawn.
Side effects: The unchanged close catch accepts an Error containing the specified refusal substring, including unknown edges as well as previously closed edges. It persists the local close without an accepted second journal close; other append errors propagate. This does not reconcile the stores or establish why the edge is absent.
Undo and recovery: Reverting the close tolerance restores the throwing path and risks the reported crash loop. Any product rollback belongs to the desk live deployment process; this unit does not restart or mutate the running agent. Existing durable intake and journal history remain retained.
Multi-machine posture: Cleanup concerns the existing machine-owned worker and its conversation store; ownership, transport and replicated journal semantics are unchanged. This test runs solely against isolated fixture state.
Layer below: Inspected close(), retire(), maintain(), the fixture clone-on-save/load store, and tests/preview/journal.ts recordSessionWork admission: unknown and already-closed edges share one rejection before accounting mutation. A local persisted close is not evidence that a second journal row was admitted.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none
Convergence: none
Decision: D01 | Withdraw the diagnostic and its test; keep close tolerance and its regression unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-session-close-1112-r4-build-report.md
Decision: D02 | Use existing evidence-gated native conformance renewal and mechanical register replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-session-close-1112-r4-build-report.md
Prompt review: Neither outage commit nor this regression test changes model instructions, model output parsing, or model acceptance decisions. The two findings concern unchanged existing prompt text, not phrases added to force a test outcome.
Prompt finding: 0725f0150c56 | quoted-evidence | The existing test quotes the unchanged role/refusal instruction, "use them to answer and act within that role; a tool refusal remains a refusal." This change does not touch that phrase or make it a model decision trigger.
Prompt finding: 27d7720e7977 | quoted-evidence | The existing test quotes the unchanged context introduction, "this memory and work record". This change does not touch that phrase or make it a model decision trigger.

1.x comparison: Searched actual JKHeadley/instar origin/main 72dfe3a52b8cfe7a2ebed131b7acfc332f4c02f0 src/, docs/specs/ and git history for session close, cleanup and already-closed handling. Read src/core/SqliteRegistry.ts (history ab26b7ca3), docs/specs/MULTI-MACHINE-LEASE-ROBUSTNESS-SPEC.md and REMOTE-SESSION-CLOSE-SPEC.md, and ONEX-LESSONS.md sections 2 and 6. The reused design principle is idempotent cleanup: SQLite's closed set prevents repeated teardown and remote-close treats an already-gone session calmly. Their broad best-effort shutdown and UI behavior do not fit 2.0 journal-edge accounting, so no unrelated 1.x code is copied. Keep the existing 2.0 mitigation and test its narrower error propagation.

Team posture: No owner/member/guest authorization, sharing or audience changes. Fixture identities never enter production. The diagnostic is absent, and the baseline error handling remains byte-identical.

Evidence and limits: The desk's supplied outage report says nine exits occurred 2026-11-12 13:44–14:29, DIAG-EXIT named the journal refusal through close()/maintain(), and the exact hotfix was stable from 14:34. This author has not independently replayed that outage. The original close mitigation had no dedicated test; this record adds "persists close when the journal refuses an already-closed edge but propagates other append errors". It exercises the real port with an injected append error and checks persisted close after reconstruction, not real disk durability or production concurrency. Root cause remains unknown. The full repair is owned by the desk's unit session-close-tolerant-1112; this record does not claim that work is complete. Current validation is recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-session-close-1112-r4-build-report.md.

The diagnostic line is withdrawn because three reviews demonstrated message-content disclosure through stack text, including PEM fragments and message lines shaped like code locations. Exit-cause recording is owned by session-close-tolerant-1112, which will address provenance through structured stack frames.

R4 comparison: Re-searched actual JKHeadley/instar local origin/main 700b2a9135623f5eae27ebcf5352d9a6d9135c1b src/, docs/specs/ and history ab26b7ca3; the inherited SqliteRegistry and remote-close comparison still applies, with ONEX-LESSONS sections 2/6 read.

## Closing block

simplestRobustRoute: This is the simplest robust route: retain the existing close tolerance and its positive/negative regression, remove the repeatedly unsafe diagnostic, and use existing native certification and register generation. Entry requires an admitted conversation; completion requires persisted close; unrelated append failures propagate. Stop, reservation, accounting and dispatch limits remain unchanged.
80/20: One regression covers the catch boundary and persistence. The product delta is ten lines; remaining files provide tests, review and mechanical governance evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

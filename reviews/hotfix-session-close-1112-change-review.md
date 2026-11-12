# Change review — record and test the live session-close mitigation

Subject base: e3cb0f08d3a74d70c9e059edbd64fc457492bfff
Review state: open
Reviewed content: none
Outcome: Cover outage commits b6b511c81840375e85b8b345660a58ee7748590a (DIAG-EXIT stderr diagnostic) and 231b3370e6ec9d44ad82929290a0d7e12343891d (tolerate the named journal close refusal), and add one regression test without changing either product edit.
Affected rules: 1, 12, 24, 27, 34, 37, 42, 49, 70, 74, 101, 111, 113, 116, 123
Affected floors: secrets — existing redaction applies to the diagnostic message, stack handling discussed below; spend cap — reservation and accounting remain enforced; stop — retirement still runs; no duplicate sends — no dispatch or replay changes; durable intake — existing inputs and local close remain persisted.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The inherited changes affect the live runner's exit path and durable conversation closure; the authoring addition is only review and one test.
Side effects: The close catch accepts an Error containing the specified refusal substring, including unknown edges as well as previously closed edges. It persists the local close without an accepted second journal close. This prevents the observed runner exit but can conceal the reason the edge is absent; it does not reconcile the two stores. Other append errors still propagate. DIAG-EXIT adds a local stderr line: the first message line is redacted and limited to 300 characters, while up to eight stack frames are emitted with partial path normalization, not the message redactor. Absolute paths or unusual custom stack contents can remain; stderr must retain its existing restricted operator audience. No new user-facing output is added.
Undo and recovery: Revert the added review/test commit to remove this evidence only. Reverting 231b3370 restores the throwing path and risks the reported crash loop; reverting b6b511c8 removes the diagnostic. Any product rollback belongs to the desk's live deployment process; this unit does not restart or mutate the running agent. Existing durable intake and journal history are retained.
Multi-machine posture: Cleanup concerns the existing machine-owned worker and its conversation store; ownership, transport and replicated journal semantics are unchanged. This test runs solely against isolated fixture state.
Layer below: Inspected close(), retire(), maintain(), the fixture store's clone-on-save/load behavior, and tests/preview/journal.ts recordSessionWork admission logic around lines 2725–2745: unknown and already-closed edges share one rejection before accounting mutation. Inspected journal-agent.mjs final catch and its diagnostic redaction boundary. A local persisted close is not evidence that a second journal row was admitted.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none
Convergence: none
Decision: D01 | Inject failure only for the final host-close append, avoiding retire() cleanup interception; test persisted close across port reconstruction and identity-preserving propagation of another error. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-session-close-1112-record-PROGRESS.md
Prompt review: Neither outage commit nor this regression test changes model instructions, model output parsing, or model acceptance decisions. The two findings concern unchanged existing prompt text, not phrases added to force a test outcome.
Prompt finding: 0725f0150c56 | quoted-evidence | The existing test quotes the unchanged role/refusal instruction, "use them to answer and act within that role; a tool refusal remains a refusal." This change does not touch that phrase or make it a model decision trigger.
Prompt finding: 27d7720e7977 | quoted-evidence | The existing test quotes the unchanged context introduction, "this memory and work record". This change does not touch that phrase or make it a model decision trigger.

1.x comparison: Searched actual JKHeadley/instar origin/main 72dfe3a52b8cfe7a2ebed131b7acfc332f4c02f0 src/, docs/specs/ and git history for session close, cleanup and already-closed handling. Read src/core/SqliteRegistry.ts (history ab26b7ca3), docs/specs/MULTI-MACHINE-LEASE-ROBUSTNESS-SPEC.md and REMOTE-SESSION-CLOSE-SPEC.md, and ONEX-LESSONS.md sections 2 and 6. The reused design principle is idempotent cleanup: SQLite's closed set prevents repeated teardown and remote-close treats an already-gone session calmly. Their broad best-effort shutdown and UI behavior do not fit 2.0 journal-edge accounting, so no unrelated 1.x code is copied. Keep the existing 2.0 mitigation and test its narrower error propagation.

Team posture: No owner/member/guest authorization, sharing or audience changes. Fixture identities never enter production; diagnostics remain on the existing local operator stderr surface. The test overrides the fixture's readonly append port through Object.assign with its declared parameter type, matching existing fixture override practice.

Evidence and limits: The desk's supplied outage report says nine exits occurred 2026-11-12 13:44–14:29, DIAG-EXIT named the journal refusal through close()/maintain(), and the exact hotfix was stable from 14:34. This author has not independently replayed that outage. The two original commits had no dedicated test; this record adds "persists close when the journal refuses an already-closed edge but propagates other append errors". It exercises the real port with an injected append error and checks persisted close after reconstruction, not real disk durability or production concurrency. Root cause remains unknown. The full repair is owned by the desk's unit session-close-tolerant-1112; this record does not claim that work is complete. Validation results are recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-session-close-1112-record-PROGRESS.md.

## Closing block

simplestRobustRoute: This is the simplest route for the assigned evidence gap: retain both live edits, use the existing review record mechanism and fixture, and test the exact tolerated error alongside a throwing neighbor. Entry requires an admitted conversation; completion requires a persisted close; stop, reservation, accounting and dispatch limits remain unchanged. No autonomous root-cause-repair claim or new machinery is introduced.
80/20: The one test covers the catch boundary and persistence; the record exposes the unknown-edge ambiguity and diagnostic limits for independent review without expanding into the separately owned full repair.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

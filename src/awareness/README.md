# Session awareness

Context continuity for 2.0's agent sessions: a session that starts, resumes, is
cleared, is compacted or is respawned comes back knowing who it is, what was just
said, what it promised and what else it is running — injected by a hook, not by a
prompt reminder. Port of 1.x `session-start.sh`, `compaction-recovery.sh`,
`CompactionSentinel`, `ContextWedgeSentinel` and parallel-work awareness.

| File | Role |
|---|---|
| `grounding.ts` | Pure grounding block: identity, recent conversation, unanswered user messages, open commitments, other running work, recall packet. Credential floor, one-line untrusted text, 64 KiB bound with priority trimming. |
| `work.ts` | Own-work index (one row per topic) and conservative duplicate-work overlap. |
| `sentinel.ts` | Pure context sentinel: fresh files, receipt-verified re-grounding after compaction/respawn, bounded re-ground delivery, context-wall handoff to the session driver. Signal-only otherwise. |
| `service.ts` | `createAwareness` over small ports; `createLabelledFakeRecall` until port-memory lands; `groundingHookSettings` for the session driver. |

Physical side (outside the pure core): `scripts/session-hooks/grounding.mjs` (the
SessionStart hook; writes a `grounded` receipt) and `scripts/awareness-io.mjs`
(atomic per-claim grounding files, receipts, sentinel state, signal log).

Wiring with the session driver (port-sessions): spawn each session with
`INSTAR_SESSION_GROUNDING_FILE = io.groundingFileFor(claim)` and merge
`groundingHookSettings(hook)` into its `--settings` hooks; share its inbox; its
observer supplies `ObservedSession` rows (pane idle/busy, `classifyStuckSignature`);
`AwarenessActions.deliver` / `recoverContext` map to its `deliver` (deduped on the
operation id) and `recoverContext`. Run `tick()` on the host's cadence.

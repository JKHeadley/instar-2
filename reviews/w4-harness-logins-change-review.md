# Change review — Runner-scoped harness logins and reviewed capacity switching

Subject base: 9d8089a6db175d9ed72ae30a7f8347b158301ffe
Review state: open
Reviewed content: none
Outcome: Each runner names its own profile-keyed custody. An explicitly ordered pool admits the next call on the next reviewed, individually activated account after a typed provider limit or a fresh matching quota threshold; the failed call stays failed, and the switch is durable with one journal-deduplicated notice.
Affected rules: 1, 4, 26, 32, 41, 42, 44, 45, 49, 52, 53, 57, 58, 60, 61, 74, 75, 95, 100, 101, 102, 111, 113, 116
Affected floors: secrets — profile-keyed owner-only custody and held-secret filtering cover every listed account; spend cap — existing call, step, turn and charge reservations remain shared; stop — existing stop plus per-profile live grant withdrawal; no duplicate sends — no retry of a dispatched call and existing journal notice/delivery deduplication; durable intake — unchanged journal intake and writer lease, selection persisted before dispatch
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the credential selected at the subscription doorway and the session-work admission boundary; desk activation and independent doorway review are required before installing.
Side effects: Old singleton login.json is no longer read by default. Each runner needs explicit reviewed profile/custody migration. A pool creates harness-login-pool.json under its existing root and adds its configuration identity to the existing run log. Notice text is appended to the next eligible operator reply. No live runner or Shared file was changed by this builder.
Undo and recovery: Stop the owned runner by exact PID; preserve journal, run log and selection history. Restore missing selection state from its matching backup; never delete state to clear a hold. A reviewed new pool identity needs an archived old state and new initialization while stopped. Unknown provider reset times require desk review of a new configuration. A code rollback also requires an explicitly reviewed custody/launcher rollback; do not accidentally restore the shared account topology.
Multi-machine posture: Deliberately machine-local host custody and quota observation. Each runner has disjoint reviewed accounts, directories and grants provisioned by the desk. No discovery, global account assignment, credential replication, or live switching of an in-flight session is introduced.
Layer below: Reused existing typed provider limit classification, registered session driver's rate-limited observation, activation resolver and preflights, atomic preview writer, root writer lease and deduplicated doorway notices. Ported 1.x SubscriptionPool's account/config-home quota matching and ordered eligible-account selection without copying its credential mutation machinery.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: HL-1 | Profile reference names custody and isolated harness directories; no singleton fallback, because fallback would silently reunite serving and proof traffic. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-harness-logins-PROGRESS.md
Decision: HL-2 | Select only at the next call or delegated-step admission; never replay the limited call. Keep one shared resource/call ceiling and each member's own activation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-harness-logins-PROGRESS.md
Decision: HL-3 | Persist selection before dispatch and detect missing state using the existing run log; reuse journal-deduplicated doorway notices instead of a second message sender. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-harness-logins-PROGRESS.md
Prompt review: No prompts, reply/verdict parsers or acceptance rules changed. Routing replay uses the real captured Claude weekly-limit frame through the actual adapter and launcher. Existing recorded summary, uncertain summary, Jev undecided/unsure, reply-review, delivered-reply and empty recorded-context fixtures exercise selection preservation; their provenance and update ids are listed in PROGRESS. No genuine empty delivered bubble is claimed. Physical harness/Telegram/CLI IO is substituted in the launcher test; real sealed authority resolution and encrypted journal remain active. Live integration remains deliberately disabled by the no-Shared/no-live instruction.

## Closing block

simplestRobustRoute: One profile-keyed custody helper and one small runner-local selection module around existing doorway admission. The durable sidecar prevents restart forgetting; run-log identity detects its loss. The existing provider classifier and journal notice machinery do the rest.
80/20: Targeted tests prove limit-to-next-login delivery with one notice, revoked secondary authority refusal, all-exhausted/unreviewed refusal, isolated proof custody, threshold boundaries/freshness/reset and corrupt/lost selection-state refusal. Architecture checks pass. Independent review and live activation belong to the desk chain.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

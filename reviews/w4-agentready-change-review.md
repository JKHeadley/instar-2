# Change review — renew the reviewed activation end and remove the preview framing

Subject base: ceae2dd950a8944c69cb259960459fc4c6e9219f
Review state: open
Reviewed content: none
Outcome: Move the reviewed activation end to 2026-11-12T21:40:00Z with 2026-10-12T20:40:00Z as its predecessor; new operator replies and notices carry no preview label, and status counts say so far.
Affected rules: 1, 26, 34, 36, 42, 44, 45, 49, 56, 74, 76, 77, 79, 80, 82, 90, 91, 98, 101, 102, 105, 110, 113, 116
Affected floors: secrets — existing content checks and credential-shaped notice retained; spend cap — limits and charges unchanged, renewal still requires approval; stop — stop admission and durable state unchanged; no duplicate sends — existing intent/receipt and split-part state retained, old text replayed verbatim; durable intake — accepted messages and encrypted journal retained.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Two operator-directed presentation/activation-default changes; no new authority, provider, storage format or send route. Existing exact authorization and replay checks remain in place.
Side effects: Reply byte lengths decrease and split positions omit PREVIEW. Old journals retain their exact text; notice classification, continuity, conflict questions and completed-question reads accept both text generations. Existing host-notice authority and signed raise requests remain readable. Historical captures remain unchanged. The source closure changes and requires its normal conformance/pin refresh.
Undo and recovery: Revert this branch before activation. After a November renewal, do not roll back to an October-only activation record: the existing record/journal matching rule deliberately refuses it. Any rollback must retain the reviewed November end and the journal's recorded renewal. Never reset receipts or replay an uncertain send.
Multi-machine posture: No new state. Each machine reads the same reviewed constants and journaled activation end; the existing ownership, replication, stop and send fences still govern. Mixed-version history is readable, but a predecessor activation stops matching after the renewal lands as before.
Layer below: Read the purpose and all 116 rules from the branch (identical to origin/main); inspected the 10-05 to 10-12 renewal in df2312c7/a735faee, activation-end admission, signed answer projection, journal intent/receipt replay, approval request rendering/digests, split-part settlement and continuation disclosure readers.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: agentready-reviewed-pair | Advance only the fixed reviewed current/predecessor pair, following the existing renewal implementation; keep the phone approval and refusal boundaries unchanged | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-agentready-PROGRESS.md
Decision: agentready-journal-compatibility | Strip the old marker only in comparison/projection readers and new reply construction; never rewrite old durable intents or receipts. Retain exact legacy host notice authority and signed approval rendering support, including old phone-renewal request wording | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-agentready-PROGRESS.md
Decision: agentready-surface-scope | Remove label emissions including continuation parts, approval/dashboard text and outage notices, preserve notice substance, and update status wording. Keep internal preview identifiers and model protocols intact | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-agentready-PROGRESS.md
Decision: agentready-targeted-wsl | Run changed tests and direct importing tests only with one worker; skip the repository-listed macOS tests and report WSL launcher failures for the desk. Do not run a full suite or touch a live root | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-agentready-PROGRESS.md
Decision: agentready-conformance-pin | Refresh the declared composition digest for the reviewed-expiry constant change; the native macOS contract remains a desk-host check, not claimed as run on WSL | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-agentready-PROGRESS.md
Prompt review: No parsing schema, prompt protocol, model route or decision threshold changes. Review candidates and self-state text lose the label. Existing recorded-shape replay tests cover summary writer uncertain outputs, undecided Jev scores, unavailable reply review and lost/empty delivered answers; captured fixture bytes are preserved. Targeted run results are recorded in the local handoff report.
Prompt finding: 450c79237a95 | protocol-literal | Existing conversation protocol text in production-provider.ts is unchanged.
Prompt finding: 849db3a6296a | protocol-literal | Existing memory-list shape recognition is unchanged; only the emitted preview prefix is removed.
Prompt finding: bd01de21286a | protocol-literal | Existing source-label grounding instruction is unchanged.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing operator-history grounding instruction is unchanged.

## Closing block

simplestRobustRoute: Update the existing reviewed expiry pair and existing text producers/readers. Add no service, store or gate. Compatibility alternatives prevent old durable notices and signed approvals from becoming unreadable after a presentation-only update. Existing start, expiry, stop, spend, ownership and durable-send guards stay in place; no autonomous-completion claim is made.
80/20: Author submission covering the implementation, both design-version entries, and the follow-up replay/crash assertion corrections. Targeted checks and remaining platform evidence are listed in the report for independent landing review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

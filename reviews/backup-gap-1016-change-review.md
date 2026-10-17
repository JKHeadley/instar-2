# Change review — expose the missing backup without inhibiting local operation

Subject base: a82cdeac28e30f18a6f3dfee9335ae71ca31b890
Review state: open
Reviewed content: none
Outcome: Running chat status and the operator dashboard show the conversation's backup gap. A supported single-machine installation remains functional. Multi-machine status distinguishes missing observation, no freshly acknowledged complete copy, and a recent authenticated copy without promising automatic takeover.
Affected rules: 26, 31, 34, 36, 49, 63, 74, 76, 80, 87, 101, 102, 111, 113, 116; purpose single-machine deployment and durable cause
Affected floors: secrets — fixed content with no peer URLs or credentials; spend cap — no new model call; stop — no admission changes; no duplicate sends — existing delivery gate unchanged and reopen tested; durable intake — existing journal and replicated demand unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: small user-facing observation on the existing status path; no new authority, store, service or watcher
Side effects: generated register artifacts are refreshed to source commit 2f972fbac658f8b798c449dea905074269a8ad35, retaining shape-only authority and unchanged declarations. One additional status line enters the existing reply budget and dashboard snapshot. The line can shorten with other long lines but its leading backup conclusion remains visible in real recorded long-status tests. Peer freshness uses the shipper's existing 20-second window; an acknowledgement is not a service or quorum guarantee.
Undo and recovery: revert the runtime/documentation edits and their tests, then regenerate register pins from the reverted source; no new persistent data or migration is introduced
Multi-machine posture: derived per serving conversation from the existing shipper's authenticated distinct-machine acknowledgement and freshness. A stale, incomplete, same-machine or unauthenticated peer does not confirm a target. The single-machine observation never lowers an enrolled installation's replication demand. The one-voter authority remains a takeover dependency.
Layer below: journal-replication authenticates nonces and peer identity, rejects this same machine, tracks the complete durable copy and contact freshness; awaitReplicated never selects local durability on peer loss. Existing ownerLines reaches both the worker's statusExtra and the operator dashboard's statusAnswer. The status line has no effect or admission consumer.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No model instruction, output parser or accept/escalate/refuse decision changes. Fixed pull text reports transport facts, never infers intent. Recorded summary-cascade journal rows (updates 715672479–715672500) and recorded status replies 6232038, 6232050, 6232056 exercise projection and reply sizing. Tests do not claim new live model or proof-room evidence.
Decision: backup-gap-1016-pull | Reuse the existing authenticated peer status and owner pull lines; report a recent complete copy as backup evidence with its authority dependency, never as a guarantee or permission. No new sentinel, network probe, persisted state or admission gate | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/backup-gap-1016-PROGRESS.md

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/README.md, tests/preview/journal-agent.mjs, tests/preview/journal-replication.ts, tests/preview/journal-replication.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: one formatter over existing peer evidence, wired into existing pull surfaces. Start guard is the serving runner's existing ownership; end state is an honestly qualified backup line; resource and reply limits remain unchanged. No autonomous completion or successful unattended failover is claimed. A second monitor would duplicate the existing authenticated contact/freshness checks without preventing a new failure.
80/20: Tests cover local reply and reopen deduplication, fresh peer, expiry, loss, recovery, same-machine and bad authentication, missing observation, an online incomplete copy, real recorded journal rows and long status text. Independent landing review and live proof-room acceptance belong to the desk; no convergence verdict is asserted.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

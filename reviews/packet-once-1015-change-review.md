# Change review — render conversation grounding once

Subject base: c458547406d4ad8f3c7988f8247befb73775f618
Review state: open
Reviewed content: none
Outcome: Single and batched native conversation turns retain each complete prepared envelope without rendering its exact grounding packet again.
Affected rules: Rules 1, 26, 34, 36, 47, 49, 70, 74, 77, 96, 101, 102, 105, 113, 115, 116.
Affected floors: secrets — unchanged custody and outbound checks; spend cap — unchanged reservations; stop — unchanged admission guards; no duplicate sends — unchanged delivery identity and recovery; durable intake — unchanged journal and queue.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes model-facing prompt assembly, without changing authority, storage or dispatch.
Side effects: More queued inputs can fit under the existing exact prompt-byte bound. Every envelope and its instructions remain byte-identical. Separate context is omitted only for identical canonical packet bytes in a context-role envelope message. Ordinary, malformed or different-context inputs retain their original context. Clock and unresolved references remain once per turn. Batched results retain arrival order.
Undo and recovery: Revert the renderer and its tests, and re-certify the restored composition before publishing its register; no state migration or replay is required. Existing accepted and uncertain deliveries retain their stored prompt, digest and outcomes.
Multi-machine posture: Pure rendering on the existing conversation owner; no new state, owner or transport. Existing machine-local worker and replicated journal posture is unchanged.
Layer below: Executed the actual native harness contract on Darwin node-24.14.1 before renewing its 255-file composition digest to sha256:9ad7321d1a6d1c5dfc07eb71f2374c06c5bfed264cca8436293d38c176cfa902. Captured provider frames exercise real confined tool launches, install, stop, refusal and timeout; no real account or live channel is used. Inspected prepareJournalEnvelope, canonical packet encoding, the session durable dispatch checkpoint, adapter receipt and ordered batch result correlation. Exercised actual prepared envelopes through the session and journal consumers.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; live=tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json
Hook bypass: none; rechecked on the Studio: core.hooksPath is unset and the common hooks directory has sample files only.
Convergence: none
Prompt review: Replayed all 35 actual requests indexed by packet-duplication.json from step1-rewalk4-1014-records/walk/smoke-host.json through single prompts and all 21 recorded delivery groups (seven batches). Recorded prompts total 3,726,994 bytes before and 1,867,316 after, removing 1,859,678 bytes (median 48,494 per native turn). A 203 KB captured subset keeps one single and the first actual batch in CI. No semantic decision or instruction changes. Exact prepared envelope bytes stay intact; captured summary, uncertain summary, Jev undecided/unsure, reply-review, delivered reply and empty reply shapes are preserved through single and batch paths. No live latency claim.
Deferral: tests/assembly/production-conversation-session.test.ts:482 | not-a-deferral=The literal is a test question for context retention, not a promise to postpone work.
Decision: packet-once-exact | Omit only a canonically byte-exact embedded context-role packet; preserve all separate context when recognition fails, and keep host facts outside packet deduplication. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/packet-once-1015-PROGRESS.md
Decision: packet-once-batch | Retain complete envelopes and arrival order; omit duplicate per-member and outer lead context while sizing the actual remaining prompt. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/packet-once-1015-PROGRESS.md

Decision: packet-once-publication | Regenerate the register from the committed source head and renew the Darwin certificate only after executing the actual native contract on the certified Studio runtime, as requested by the desk rejection follow-up. Register source: a365ec49ddaa7e68649c1c325dd82df052446356. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/packet-once-1015-PROGRESS.md

Subject (13 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/README.md, src/assembly/harness.declarations.json, src/assembly/production-conversation-session.ts, tests/assembly/production-conversation-session.test.ts, tests/preview/journal-topic-sessions.test.ts, tests/preview/fixtures/packet-once-walk-2026-10-14.json

simplestRobustRoute: This is the simplest robust route: remove exact duplicate renderings in the existing builder, retaining unknown shapes in full. The small exact envelope check prevents loss for ordinary callers; no new store, scheduler or protocol. Canonical results use the existing take/consumeResult boundary. Existing authority, stop, cap, durable dispatch and correlated completion guards remain. Recorded offline replay proves rendering, not live compaction or latency improvement; the desk owns that walk.
80/20: Targeted source-consumer tests and recorded-shape replay, typecheck and architecture/register/change-review checks; no full suite or live room run.
VERDICT: author submission; no independent convergence or live acceptance claim

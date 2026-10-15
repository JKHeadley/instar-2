# Change review — train-41 reviewed release composition

Subject base: c458547406d4ad8f3c7988f8247befb73775f618
Review state: open
Reviewed content: none
Outcome: Combine reviewed exact packet deduplication, short-history summary scheduling and bounded reaction receipts on the existing live base.
Affected rules: 1, 4, 7, 13, 26, 34, 36, 42, 49, 55, 60, 63, 69, 74, 75, 90, 96, 101, 102, 105, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain the members' existing guards and exact refusal behavior.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combine model-facing native prompts, summary scheduling and channel acknowledgement behavior; preserve reviewed source bytes and verify their consumers.
Side effects: Exact duplicate packets disappear from prompts; short histories avoid premature summary calls; reaction receipt waits may occupy their caller for ten seconds. Unknown reactions still forbid fallback and replay. Original histories and long-history compression remain available. No new semantic acceptance, authority or store.
Undo and recovery: Select the previous exact live base through the normal desk release procedure; no schema migration. Never replay uncertain effects during rollback.
Multi-machine posture: Existing conversation owner alone dispatches; pure rendering and bounded wait stay machine-local. Durable journal and cross-machine ownership remain unchanged.
Layer below: Read the three member reports, exact merge diffs, prepared-envelope packet comparison, summary catch-up condition, acknowledgement ambiguity handling and standard register generator. Replay committed real captured shapes through the combined consumers.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Prompt review: Carries the members' reviewed model-facing changes unchanged. Replay committed packet-once-walk and summary-ack-walk fixtures plus historical uncertain summaries, Jev undecided/unsure, reply reviews and delivered/empty-context replies. Offline replay is not live latency or deployment acceptance.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-citation instruction remains unchanged; tests exercise the delivered protocol.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory response remains unchanged; tests check that literal response.
Deferral: tests/assembly/production-conversation-session.test.ts:482 | not-a-deferral=The literal is a test question for context retention, not a promise to postpone work.
Decision: train-41-step1 | Retain step1-rewalk4-1014 at the exact base c458547406d4ad8f3c7988f8247befb73775f618; ordinary merge is already up to date. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1-rewalk4-1014-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-PROGRESS.md
Decision: train-41-packet | Fast-forward the reviewed packet-once-1015 head 60635e6e40126d32671f0a3b80b776b2ba2dc806. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/packet-once-1015-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-PROGRESS.md
Decision: train-41-summary | Merge the reviewed summary-ack-1015 head de3eaa6ea605beb774fd067050f6471fef4ed131. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-ack-1015-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-PROGRESS.md
Decision: train-41-A | Preserve both members without source edits; seven generated conflicts temporarily retain the first parent until the standard replay regenerates them from the merged source. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-PROGRESS.md
Decision: train-41-B | Preserve the exact live base ancestry and do not merge newer unreviewed tips or the other trains. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-PROGRESS.md
Decision: train-41-C | No product conflict exists and no head is omitted; generated outputs are regenerated rather than hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-PROGRESS.md
Decision: train-41-D | Run portable direct-consumer and recorded-shape tests here; report unmodified host-dependent checks for Studio acceptance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-PROGRESS.md
Decision: train-41-desk | Run the downloaded desk repin, build, rehash and exact full-commit replay chain. Repin and rehash change zero pins; regenerate seven outputs at 28ece89b9f7adb9426e0cf6822fc94be458024a3. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-PROGRESS.md

Subject (23 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/packet-once-1015-change-review.md, reviews/summary-ack-1015-change-review.md, reviews/summary-ack-1015-register-review.md, src/assembly/README.md, src/assembly/harness.declarations.json, src/assembly/production-conversation-session.ts, tests/assembly/production-conversation-session.test.ts, tests/preview/fixtures/packet-once-walk-2026-10-14.json, tests/preview/fixtures/summary-ack-walk-2026-10-15.json, tests/preview/journal-poll-endpoint.mjs, tests/preview/journal-topic-sessions.test.ts, tests/preview/journal.ts, tests/preview/summary-ack-walk.test.ts, tests/preview/telegram-acknowledgement-bridge.test.ts, tests/preview/telegram-acknowledgement.mjs, tests/preview/telegram-acknowledgement.test.ts

simplestRobustRoute: This is the simplest robust route: ordinary exact-head merges followed by the existing desk generation chain and targeted consumer checks. No new product machinery or acceptance rule is introduced. Existing exact source matching, spend bounds, stop, owner admission, durable cause and ambiguous-effect non-replay remain the guards. Recorded offline behavior is verified; the desk owns unattended live acceptance.
80/20: Check the reviewed union and direct consumers without a full suite; report host-dependent checks honestly for the desk gate.
VERDICT: author submission; no independent convergence or live acceptance claim

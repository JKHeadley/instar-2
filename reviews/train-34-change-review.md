# Change review — train-34 reviewed waiting batch integration

Subject base: 9d8c16f03f6917b9850269f3773809bd39fa9335
Review state: open
Reviewed content: none
Outcome: Integrate exact reviewed waiting-batch head 75633196fe99391ea1f20cf9516c9ea5d75ec6f3 onto the exact live train-30 base, preserving its behavior and renewed Darwin certificate.
Affected rules: Purpose 2/3; Rules 1, 4, 26, 29, 34, 36, 37, 42, 46, 49, 52, 55, 60, 63, 68, 70, 74, 75, 87, 89, 90, 95, 96, 101, 102, 105, 111, 112, 113, 115, 116.
Affected floors: secrets — existing outbound checks; spend cap — shared host and per-intake reservations; stop — existing dispatch and send guards; no duplicate sends — durable intents and unknown-result preservation; durable intake — existing topic queue and atomic batch result custody.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates model-facing batching, durable recovery and bounded progress; carries the member critical tier.
Side effects: Waiting messages share an ordered model turn, with exact per-operation result identities and ordinary per-intake send validation. Correlated closed batches recover without redispatch; unknown effects remain uncertain. The 45-second progress slot uses existing durable sends. Single-message envelopes and live-base account/ack behavior remain. Generated publication follows the exact reviewed source.
Undo and recovery: Revert the candidate before deployment. Preserve all journals; rollback readers must understand batch and waitingProgress fields. Never replay UNKNOWN effects or delete custody. A different native composition needs its own contract evidence.
Multi-machine posture: Existing conversation ownership and journal durability demands remain unchanged. Process handles and topic snapshots remain deliberately machine-local; no new worker adoption or peer requirement.
Layer below: Inspected durable host queue, result identity/order parser, correlated adapter recovery, journal reservations, progress intents, actual shipped modelBatch closure and native declaration evidence. Ordinary fast-forward preserves member bytes and live-base ancestry.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-topic-sessions.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No new model text beyond the reviewed member. Batch instructions define operation-indexed results. Replay the member captured summary/uncertain, Jev unsure/undecided, reply-review and delivered/empty-context shapes through the batch path; enclosing batch responses remain synthetic offline evidence, not a live-user acceptance claim.
Prompt finding: 849db3a6296a | quoted-evidence | Carried unchanged memory-list wording, not a new semantic phrase matcher.
Prompt finding: e8708c7fea24 | quoted-evidence | Carried unchanged recall instructions; no fixed-phrase decision added.
Deferral: generated/register.json:1 | not-a-deferral=Generated publication preserves registered terms and historical descriptions; no work is postponed.

Subject (16 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/README.md, src/assembly/conversation-topics.ts, src/assembly/harness.declarations.json, src/assembly/production-conversation-session.ts, tests/assembly/conversation-topics.test.ts, tests/preview/batch-waiting-progress.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-topic-sessions.test.ts, tests/preview/journal.ts

## Closing block


Decision: train-34-merge | Ordinary merge of exact 75633196fe99391ea1f20cf9516c9ea5d75ec6f3 fast-forwarded without conflict; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-PROGRESS.md and reviews/step1m-darwin-1014-change-review.md document behavior and native certification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-34-PROGRESS.md
Decision: train-34-desk-A | Preserve all member behavior byte-for-byte; no overlapping conflict or manual source resolution. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-34-PROGRESS.md
Decision: train-34-desk-B | Create the separate branch directly at exact 9d8c16f03f6917b9850269f3773809bd39fa9335 and preserve its ancestry; no main merge or later branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-34-PROGRESS.md
Decision: train-34-desk-D | Run portable targeted and pinned checks on WSL; report untouched physical-host checks for the Studio gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-34-PROGRESS.md
Decision: train-34-register | Run downloaded desk repin, build, owner rehash and register replay against exact reviewed head; retain renewed native conformance declaration unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-34-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: ordinary exact-head merge, existing desk regeneration and targeted consumer verification. No new machinery. Verified intake and authority guard start; correlated results and durable unique sends guard completion; shared allowance, stop and byte bounds guard execution. No unattended live deployment claim.
80/20: Run changed tests, direct consumers and named journal/pin checks in bounded foreground batches; Studio owns physical-host checks and the combined full gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

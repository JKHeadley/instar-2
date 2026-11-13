# Change review — train-260

Subject base: 384bad285f51c5c132d9474fb3d5fc2cc9835e75
Review state: open
Reviewed content: none
Outcome: Integrate exact reviewed packet-search hotfix 90b965aafab2025dec5cbcf1f69e087b45e21624 onto the live train-253 build, bounding speculative preparation while preserving ordinary packet bytes and full/compact sibling grounding.
Affected rules: 1, 15, 34, 36, 37, 39, 46, 49, 55, 60, 70, 74, 77, 90, 95, 96, 101, 102, 110, 111, 113, 116, 117, 123.
Affected floors: Secrets — existing redaction and audience checks; spend cap — no extra model calls; stop — unchanged admission; no duplicate sends — unchanged durable intent/receipt path; durable intake — source history and omitted report debt remain in the journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Inherits model-facing packet-selection behavior under resource pressure; no new authority, store or migration.
Side effects: A bound hit can omit optional evidence and select a weaker packet; existing packetDropped records that fact and omitted reports remain owed. The clock is sampled between synchronous candidates, so one candidate can overrun five seconds. Completed history rungs get fresh count allowance; elapsed deadline and triggered brake remain shared. Ordinary packets retain ordering and bytes.
Undo and recovery: Revert this integration with review and regenerate publication through the desk chain. No journal migration; preserve history and recorded outcomes. Desk owns deployment and native certification.
Multi-machine posture: Search allowance is machine-local CPU policy. Durable omissions, ownership, replication and effect fencing remain unchanged.
Team posture: Owner/member/guest standing, private defaults and audience gates retain their existing behavior. Fallback only narrows optional evidence; no new sharing surface or access grant.
Layer below: Inspected preparedFor, preparedWithFloor, dated/report/search variants, packetFor, sessionWriterOf, preference lineage and prepareJournalEnvelope. Envelope still measures actual bytes and validates grounding. Direct production importer journal-agent.mjs supplies the worker and envelope to the subscription/conversation session paths. Selected tests cover fitting, sibling/group grounding, lifecycle, summary and provider wiring without sweeping unrelated shared-index consumers.
Bug class: integration
Bug evidence: reproducer=tests/preview/packet-search-bound.test.ts
Hook bypass: none; core.hooksPath unset, common hooks directory contains only sample files. Plain merge and commits.
Convergence: none
Prompt review: No new instruction/parser edits beyond the reviewed packet selection. Replay recorded summary writer and uncertain summary, Jev undecided/unsure, reply-review, delivered reply and empty reply in packet-search-bound; replay recorded sibling envelopes with exact base hashes. Ordinary packet/envelope hashes and all fixed prompt guards remain unchanged. No live deployment or independent acceptance claim.
Prompt finding: 105c1569b6bb | quoted-evidence | Existing prompt phrase and its pre-existing fixture are unchanged by this bounded-search patch.
Prompt finding: 4106b49fff07 | quoted-evidence | Existing prompt phrase and its pre-existing fixture are unchanged by this bounded-search patch.
Prompt finding: 7ef11b68103f | quoted-evidence | Existing prompt phrase and its pre-existing fixture are unchanged by this bounded-search patch.
Prompt finding: 849db3a6296a | quoted-evidence | Existing prompt phrase and its pre-existing fixture are unchanged by this bounded-search patch.
Prompt finding: 85544c20941f | quoted-evidence | Existing prompt phrase and its pre-existing fixture are unchanged by this bounded-search patch.
Prompt finding: 9f0106c66027 | quoted-evidence | Existing prompt phrase and its pre-existing fixture are unchanged by this bounded-search patch.
Prompt finding: bac6ce7485d9 | quoted-evidence | Existing prompt phrase and its pre-existing fixture are unchanged by this bounded-search patch.
Prompt finding: e8708c7fea24 | quoted-evidence | Existing prompt phrase and its pre-existing fixture are unchanged by this bounded-search patch.
Decision: train-260-M1 | Ordinary no-ff merge of exact reviewed 90b965aafab2025dec5cbcf1f69e087b45e21624; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-packet-search-bound-1112-PROGRESS.md, authenticated snapshot SHA256 481c4f120d433df1d6c3f0762e7a67357988c635fa2465cafcbc0c75faee4667 verified. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-260-build-report.md
Decision: train-260-A | Preserve every member and live-base behavior. Only generated publication conflicted: retain base output temporarily and regenerate from the merged source. No product conflict or changelog version changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-260-build-report.md
Decision: train-260-B | Pre-provisioned separate train-260 worktree is clean at exact requested base, with branch-creation reflog confirming origin/train-253. Use it without moving the branch; origin/main already contained, no main merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-260-build-report.md
Decision: train-260-D | Run checks using installed certified Node 24.14.1 and classify unchanged Studio/host-dependent evidence separately. Preserve all guards and timeouts; no native declaration changes on M5. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-260-build-report.md
Decision: train-260-chain | Follow authenticated cint-L37 desk chain: repin 0, build, rehash 0, register replay from source merge 77c83bd9cdd771009f85775b65d63e3f6aa261d7. Generated files are never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-260-build-report.md
Deferral: generated/register.json:1 | not-a-deferral=generated output quotes existing governing material; no deferred work introduced.

1.x comparison: Freshly fetched actual JKHeadley/instar origin/main 793df597860c71a9514708d553e4cd9796593016; searched src/, docs/specs/ and git history. Read src/memory/WorkingMemoryAssembler.ts and docs/specs/ASSEMBLER-CONTEXT-ENDPOINT-SPEC.md with history 5129779c3, 511aca183, 61816bbaf and df4446717. Reuse bounded full-to-compact-to-name-only rendering through the reviewed 2.0 ladder. Its token-section assembler does not directly fit canonical-envelope Cartesian search. No unrelated 1.x code copied. Read available authenticated ONEX-LESSONS sections 5/6: preserve source memory and provenance, prove production wiring and bound resource/test concurrency.

Scope: Exact base and member remain ancestors. No member left out; C unused because no product conflict. Product delta is 55 additions and 16 deletions in the existing fitter, within about 100 lines. Tests and generated publication are separate. Always-sent prompt delta is zero; PREVIEW_FIXED_PROMPT_BYTES remains 23,459. The normal combined full gate retains independent review, native, integration, E2E and live release obligations.

simplestRobustRoute: One exact ordinary merge and the existing desk chain are the simplest robust route. The member adds count/time brakes to the existing fitter rather than a worker, store or scheduler. Start guards are exact base/head identity and admitted turn; end guards are fitting canonical bytes and matching grounding, targeted checks and pushed custody. All five safety floors remain enforced. Offline evidence proves bounded preparation, not live deployment acceptance.
80/20: No additional product changes. Preserve reviewed behavior, exercise changed boundaries and direct consumers, and use the existing combined release gate for the full repository suite.
VERDICT: author submission; independent convergence and release approval belong to the desk

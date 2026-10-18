# Change review — Integrate correction without losing the current answer

Subject base: ea75ce395d9fdd4f9f2f970e8c278b9fe37a5387
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed correction unit 7eb7b5bacc2db1fbc360bf0c8e5826d0aa567001 onto the live head; retain the current answer separately from the optional correction and regenerate publication.
Affected rules: Purpose coherence and least revelation; Rules 1/4/8/10/34/36/41/42/44/49/52/55/57/58/60/63/69/70/74/75/77/84/86/90/95/101/102/106/111/112/113/116.
Affected floors: secrets — existing outbound checks inspect the addition before its review; spend cap — existing reservation, single revision-review slot and shared deadline; stop — existing admission and send checks; no duplicate sends — one signed intent with UNKNOWN effects never repeated; durable intake — acceptance precedes processing and deferred sources return to the existing journal queue.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of reviewed model-facing reply assembly and recovery behavior.
Side effects: Inherited optional correction can consume the existing revision-review slot when the original answer passes directly. Corrections can remain pending under tight budgets. No additional runtime edits are made by this integration; publication identity changes after replay.
Undo and recovery: Revert behavior only while retaining a journal reader supporting the additive correction fields and correctionCandidate reservation shape. Never restore an old reader against a journal containing new reservations or repeat UNKNOWN effects.
Multi-machine posture: Existing ownership-gated signed intent and authenticated journal govern all machines. No new store or authority. Readers on every machine must support the additive reservation shape before sharing a journal that uses it.
Layer below: Read both constitutional documents from origin/main in full. Exact live ea75ce39 is the unit's ancestor; ordinary merge to 7eb7b5ba fast-forwarded without conflicts. Inspected the correction bound, rewrite coherence question, review reservation, intent requeue and replay tests. The unit report is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/correction-keeps-answer-1012-PROGRESS.md. Captures omit original draft/revision rows; reconstructed answer fields are explicitly labeled, not claimed as captured bytes.
Bug class: integration
Bug evidence: reproducer=tests/preview/correction-keeps-answer.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains only samples.
Convergence: none
Decision: sb-correction-keeps-answer-merge | Ordinary merge of exact reviewed 7eb7b5ba onto live ea75ce39 fast-forwarded with no conflicts; preserve source, fixture and unit review unchanged. Unit report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/correction-keeps-answer-1012-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-correction-keeps-answer-1012-PROGRESS.md
Decision: sb-correction-keeps-answer-publication | Use the existing desk repin/build/owner-rehash/register replay chain at merged 7eb7b5ba; no source or owner pins needed changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-correction-keeps-answer-1012-PROGRESS.md
Prompt review: Integration adds no model-facing text beyond the reviewed unit. Its captured correction-only delivery and reviewer findings from updates 840342530 and 840342531 reach the bound and coherence-review paths; the test's separated answer is reconstructed from captured reasoning. Controlled reviewer outcomes prove routing, not live judgment quality. Existing recorded summary, Jev, reply-review and empty-delivery shapes are replayed independently. No live deployment is claimed.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged memory-list output literal, carried from the unit review.
Prompt finding: bd01de21286a | protocol-literal | Unchanged source-label guidance, carried from the unit review.
Prompt finding: fb5fa7e706c8 | protocol-literal | Unchanged journal grounding guidance, carried from the unit review.
Deferral: generated/register.json:1 | not-a-deferral=Existing governed register text emitted by the generator, not postponed work.

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the reviewed unit unchanged, regenerate publication using existing desk tools and verify its consumer tests. No new mechanism is introduced by integration. The inherited start guard is grounded correction provenance; completion is one admitted answer with a reviewed addition or durable pending sources; limits are the existing cap, deadline, one review slot and bounded addition. No unattended production completion is claimed.
80/20: Run targeted correction/review tests, recorded-shape replays, the unchanged context floor and required machine gates. Report host-dependent checks explicitly for the Studio gate; no full suite or load generation.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

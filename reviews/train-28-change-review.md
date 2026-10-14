# Change review — train-28 continuing conversation repair

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Combine the exact live train-19 base with reviewed main documentation and the reviewed continuing-conversation format-repair head, preserving its prerequisite host, topics and first-run behavior.
Affected rules: Purpose 2/3/6; Rules 1, 4, 26, 29, 34, 36, 37, 42, 46, 49, 55, 57, 60, 68, 70, 74, 75, 77, 84, 88, 90, 91, 95, 101, 102, 111, 112, 113, 116.
Affected floors: Existing secrets, spend cap, stop, durable intake and no duplicate sends remain structural. The repair shares the original conversation allowance and existing one-repair reservation; original request digest checks and durable send receipts remain unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of the reviewed continuing-session host and its repair on the live base, without new authority or relaxed guards.
Side effects: The reviewed head includes its host, topic, first-run and session-mouth prerequisites. A reserved format repair uses a distinct intake-linked operation identity, retaining original operation replay and the parent send identity. Main design text is retained exactly; distinct incoming changelog entries append above the intact live suffix. Generated publications and source pins are rebuilt through the existing desk chain.
Undo and recovery: Revert the combined candidate before deployment if rejected. Preserve original and child operation records and journal send receipts; never replay unknown dispatched work or delete durable history to recover. No live root is modified by this build.
Multi-machine posture: Existing conversation ownership fences and host/journal durable records remain authoritative. No second machine receives dispatch permission, no new peer dependency is introduced, and local tests do not establish live cross-machine acceptance.
Layer below: Inspected host request digest and queue identity, durable format-retry reservation and exact packet comparison, outcome persistence, and journal unique-send settlement. Inspected history validation and register replay rather than hand-editing generated output.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts; live=tests/preview/fixtures/repair-identity-copy-walk-2026-10-14.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Prompt review: No new prompt wording is authored in this combination. Replay the reviewed packets for updates 840342703, 840342709 and 840342711 and the recorded summary, Jev, review and empty-reply neighbors through the existing tests; live delivery remains the desk's gate.
Decision: train-28-main | Merge exactly ea8808d878b9a1d673e9fba1755a72261074fd1c; reports reviews/amend-single-machine-1013.md and reviews/install-platform-neutral-1013.md. Retain main design text and union histories with newly numbered incoming entries, preserving live revisions verbatim. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-PROGRESS.md
Decision: train-28-repair | Merge exactly 763634f7810272ded82ecec22ff9eab979f531c3, with its reviewed prerequisites; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1g-repair-identity-1014-PROGRESS.md and reviews/step1g-repair-identity-1014-change-review.md. Preserve original/child digest identities and honest uncertain outcomes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-PROGRESS.md
Decision: train-28-desk-A | Keep all intended behaviors; only changelog conflicts required resolution, with both sides retained. No runtime conflict required a substitute design. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-PROGRESS.md
Decision: train-28-desk-B | Create a fresh worktree and branch directly at ac3bd4d8874495f8b66b571837a1380995113d7a; preserve the base and member prerequisite ancestry. Do not alter other testing trains. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-PROGRESS.md
Decision: train-28-desk-C | No product conflict and no head left out. Generated publications are replayed rather than hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-PROGRESS.md
Decision: train-28-desk-D | Run targeted direct consumers and required journal/register tests in bounded foreground chunks; classify untouched host-dependent assertions separately for the Studio gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-PROGRESS.md
Decision: train-28-chain | Apply the downloaded desk repin/build/rehash/replay chain, using Linux sed syntax only in the local tool copy. Preserve the default context guard and source roster. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-PROGRESS.md

Generated register: replay from 40c1831eaa7878d8564f7b95738b851c4c59d913; shape-only source publication, no runtime conformance certificate modified.

simplestRobustRoute: This is the simplest robust route: ordinary merges of exact reviewed heads, preservation of both histories, and the existing desk regeneration and consumer checks. No new runtime machinery or gate is added. Existing verified intake and ownership guard start; cap, stop, secrets and durable outcome/send receipts bound completion. Recorded replay proves the integrated path; unattended live acceptance belongs to the desk.
80/20: Changed tests, direct consumers, required journal and pinned text checks in foreground chunks, plus typecheck and architecture/register/review checks. No full suite, live walk or load test.
VERDICT: author submission; no independent convergence or live deployment claimed

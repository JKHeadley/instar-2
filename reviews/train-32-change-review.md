# Change review — train-32 per-topic pool integration

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Combine the exact reviewed main, durable topic host, continuing session accounts and acknowledgement deadline heads while retaining the live base. Include the reviewed replacement pool built on train-30.
Affected rules: Purpose 2/3; Rules 1, 4, 18, 26, 29, 34, 36, 37, 41, 42, 49, 55, 60, 63, 70, 74, 75, 77, 84, 87, 90, 91, 95, 96, 101, 102, 111, 112, 113, 114, 116.
Affected floors: secrets — existing encrypted custody, connector handoff and outbound checks; spend cap — retained shared parent allowance and reserveCall checkpoint; stop — exact claim/incarnation retirement and account-change admission closure; no duplicate sends — retained journal receipts and no UNKNOWN replay; durable intake — retained topic queues and exact reserved-packet collection.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of durable topic hosting and account-bearing session launch with after-send review.
Side effects: Account preparation now coexists with lifecycle hooks and topic-scoped cumulative call accounting. Accounts changing stop admission; grant withdrawal preserves host custody. Both host and account test families remain. The earlier acknowledgement timer and final-dispatch suppression are retained. Main design text is adopted, and both changelog histories survive. The reviewed per-topic pool adds encrypted selected/pending custody, native resume and validation-wait recovery through the existing serialized host.
Undo and recovery: Revert the combined candidate before deployment. Preserve original roots and journal generations; after-send review journals require generation 5 readers. Do not delete custody, replay UNKNOWN effects or reuse a newer copy with an older reader.
Multi-machine posture: Existing conversation owner and durable effect fences are unchanged. Host process handles and encrypted snapshots remain machine-local deliberately; no new peer requirement or cross-machine worker adoption.
Layer below: Inspected the host durable queue, shared reservation, exact driver control, lifecycle receipt, connector nonce custody, prepared admission and after-send review projection. The replacement pool uses exact topic retirement, durable pending movement and destination validation; source ownership and shared charges are retained.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No new model instructions or classifiers. Retain and replay the members' captured answer, summary uncertain, Jev uncertain/undecided, reply-review and delivered/empty context shapes. No fresh live walk or deployment is claimed.
Decision: train-32-main | Merge reviewed main 40de162c384b66613aa2700511e46a59cc762726; provenance reviews/fix-guide-163-1013-change-review.md and reviews/amend-single-machine-1013.md. Main document text is exact; preserve both changelog histories and regenerate their markdown. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-32-PROGRESS.md
Decision: train-32-pool | Merge reviewed step1l-pool-topics-1014 18d97316e50b9134cb66d42234ae7da7a8f20e35; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1l-pool-topics-1014-PROGRESS.md and its three committed change-review records. Preserve its train-30 dependencies and validation-wait repairs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-32-PROGRESS.md
Decision: train-32-desk-A | Keep both reviewed behaviors. The only conflicts were three main changelog pairs; preserve every live-base entry as a suffix and append distinct incoming entries with new revision numbers. No source conflict or behavioral replacement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-32-PROGRESS.md
Decision: train-32-desk-B | Create separate train-32 directly at exact live ac3bd4d8874495f8b66b571837a1380995113d7a. Preserve ancestry and recorded train-30 member base; do not move the branch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-32-PROGRESS.md
Decision: train-32-desk-D | Run changed tests and direct consumers plus journal/floor/pinned checks on WSL. Defer unchanged macOS/live/e2e/integration checks to Studio per the remote-host directive; no live-root or serving-login use. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-32-PROGRESS.md
Decision: train-32-register | Use the downloaded desk repin/build/rehash/build-register replay chain. No owner pins changed; generated publication binds the merged source commit, with no hand-merged output. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-32-PROGRESS.md

Deferral: tests/preview/journal-conversation-session.test.ts:393 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:426 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:428 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:430 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:432 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:433 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:434 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:435 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:436 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:437 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:438 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:439 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:440 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:441 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:446 | not-a-deferral=Executable delayed-completion regression using a deferred fixture; no work promise is postponed.

simplestRobustRoute: This is the simplest robust route: two ordinary exact-head merges, append-only changelog reconciliation and existing desk regeneration. No new product machinery. Existing verified intake and grants guard start, receipts guard completion, and shared spend, lifetime and stop bound execution. Recorded replay is not unattended live acceptance.
80/20: Changed tests, direct consumers and named floor/journal checks in bounded foreground batches; Studio owns the full gate.
VERDICT: author submission; independent review belongs to the desk

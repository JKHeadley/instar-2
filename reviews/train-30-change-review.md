# Change review — train-30 continuing conversation integration

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Combine the exact reviewed main, durable topic host, continuing session accounts and acknowledgement deadline heads while retaining the live base. Return the incompatible single-worker pool head to the desk.
Affected rules: Purpose 2/3; Rules 1, 4, 18, 26, 29, 34, 36, 37, 41, 42, 49, 55, 60, 63, 70, 74, 75, 77, 84, 87, 90, 91, 95, 96, 101, 102, 111, 112, 113, 114, 116.
Affected floors: secrets — existing encrypted custody, connector handoff and outbound checks; spend cap — retained shared parent allowance and reserveCall checkpoint; stop — exact claim/incarnation retirement and account-change admission closure; no duplicate sends — retained journal receipts and no UNKNOWN replay; durable intake — retained topic queues and exact reserved-packet collection.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of durable topic hosting and account-bearing session launch with after-send review.
Side effects: Account preparation now coexists with lifecycle hooks and topic-scoped cumulative call accounting. Accounts changing stop admission; grant withdrawal preserves host custody. Both host and account test families remain. The earlier acknowledgement timer and final-dispatch suppression are retained. Main design text is adopted, and both changelog histories survive. The pool head is excluded rather than transplanting its obsolete single-worker state machine into the durable topic host.
Undo and recovery: Revert the combined candidate before deployment. Preserve original roots and journal generations; after-send review journals require generation 5 readers. Do not delete custody, replay UNKNOWN effects or reuse a newer copy with an older reader.
Multi-machine posture: Existing conversation owner and durable effect fences are unchanged. Host process handles and encrypted snapshots remain machine-local deliberately; no new peer requirement or cross-machine worker adoption.
Layer below: Inspected the host durable queue, shared reservation, exact driver control, lifecycle receipt, connector nonce custody, prepared admission and after-send review projection. The pool's unscoped driver.stop and one global handoff conflict with the topic host's independent exact-target workers.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No new model instructions or classifiers. Retain and replay the members' captured answer, summary uncertain, Jev uncertain/undecided, reply-review and delivered/empty context shapes. No fresh live walk or deployment is claimed.
Decision: train-30-main | Merge exact main 40de162c384b66613aa2700511e46a59cc762726. Preserve live changelog suffixes and append distinct main revisions; regenerate markdown. Main's reviewed platform-neutral design text is retained; review provenance: reviews/fix-guide-163-1013-change-review.md and review-guides/install-platform-neutral-1013.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-host | Merge e3e3f88f630daa192a0a52159562d51160c8d9d0; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1k-host-repairs-1014-PROGRESS.md and reviews/step1k-host-repairs-1014.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-mouth | Ordinary merge of 4a5a9628dd33ef4a6409ad1f4eccee6bcbc47e33 reports already up to date: the host head contains it. Report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-mouth-copy-1013-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-accounts | Merge 53dbc1efefd2605d16932e4cb72cf7e7b3cc3eac; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1d-accounts-1013-PROGRESS.md. Retain lifecycle installation, edge budget and reserveCall together with MCP reads, preparation and cleanup. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-pool | Attempt then abort merge of 7649e345d13db0c5e80fa109aad853b224ea1836 under C. Report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1e-pool-1013-PROGRESS.md. Its prepareTurn/global driver.stop state machine cannot preserve two topic workers and exact control without a substantive topic-aware redesign. This head is not covered. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-ack | Merge f4b799e305593c6e15acd759a01a5d1d5afb9de5; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1i-ack-deadline-1014-PROGRESS.md and reviews/step1i-ack-deadline-1014-change-review.md. Retain seven-second deadline and final-dispatch suppression. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-desk-A | Combine account and host behavior at each overlapping hunk, retain both test families and the newer durable host. No allowance reset or unscoped worker stop. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-desk-B | Create a separate worktree directly at exact ac3bd4d8 and preserve its ancestry; merge only the reviewed heads in order. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-desk-C | Abort only the pool merge for the named ownership/state-machine conflict; continue the acknowledgement merge and disclose exclusion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-desk-D | Run targeted direct consumers, journal and pinned checks on WSL; report untouched physical macOS/e2e/integration checks separately for Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-ack-replay | Align the recorded eight-second send-stage replay with the seven-second acknowledgement deadline; retain final audience, stop, unknown-send and restart assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md
Decision: train-30-register | Regenerate owner pins and register using the downloaded desk chain; generated conflicts temporarily retain the previous publication until replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-PROGRESS.md


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

Validation: Core consumer tests 163/163; architecture, build and typecheck pass; pinned-text checks 89/89; lint has no issues and register check is true. Register publication is regenerated from 0881f380. Broader physical-host results are reported separately.

simplestRobustRoute: This is the simplest robust route: ordinary exact-head merges, local resolution preserving both behaviors, existing desk regeneration and consumer tests. No new host, pool, store or classifier. Durable intake and authority guard start; exact receipts guard completion; shared call allowance, lifetime and stop guard execution. The incompatible pool returns to its owning unit rather than growing an unreviewed replacement here. Offline recorded replay is not unattended live acceptance.
80/20: Target changed tests, direct source consumers and named journal/pin checks only, in bounded foreground batches. Studio owns the full gate and copy walk.
VERDICT: author submission; independent review belongs to the desk

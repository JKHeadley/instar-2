# Change review — one notice per runner login transition

Subject base: f2798733d43ee4460aac33c40e2f9364a0e52d04
Review state: open
Reviewed content: none
Outcome: Retain every topic handoff while emitting one notice for each real runner active-login transition, including later returns to the same destination.
Affected rules: Purpose 2/3; Rules 1, 4, 26, 32, 37, 49, 52, 70, 74, 87, 101, 102, 111, 113, 116.
Affected floors: secrets — no credential changes; spend cap — no admission or quota-limit changes; stop — unchanged host retirement and stop checks; no duplicate sends — retain existing notice keys and consumer deduplication, prevent duplicate switch producers; durable intake — unchanged topic intent, completion and queued input.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Small repair to durable runner transition accounting and its existing user notice consumer.
Side effects: Completion of another topic's move to the already-active login no longer appends a runner switch. Each topic handoff and completed attempt remains durable. An explicit selection from a stale source to the already-active destination likewise adds no switch. Historical switch records and already-issued notice keys are preserved. Destination choice, fallback, holds, measured status and request caps are unchanged.
Undo and recovery: Revert the module change without rewriting pool or topic state. No schema change or migration. Existing state.active is the durable boundary, existing move.id handles completion replay, and existing topic reconciliation handles the crash between pool completion and topic save.
Multi-machine posture: Deliberately machine-local under the existing root writer lease; the runner's active login is local, and per-topic custody remains under the existing owning-host fence. No new store or cross-host write.
Layer below: Traced scripts/topic-login-pool.mjs prepareTurn to selectSession and recordHandoff, including topic-specific IDs and restart reconciliation. Traced both switch append sites and notices() in tests/preview/harness-login-pool.mjs and openReplyNotices in credential-reminders.ts. Multiple topics migrating A to B generate different completion IDs; the old append sites count each as a new runner transition. The real topic host test reproduces this without replacing the handoff implementation.
Bug class: integration
Bug evidence: reproducer=tests/preview/topic-login-pool.test.ts and tests/preview/harness-login-pool.test.ts; three new assertions/cases failed before repair with 2, 3 and 4 switch records instead of one, then all 243 targeted tests passed
Hook bypass: none; core.hooksPath unset, shared hooks directory inspected and contains sample hooks only.
Convergence: none
Prompt review: No model prompt, parser, accept/escalate/refuse decision, model choice or wording changed. Existing recorded-shape replays in the direct-import tests remain green; no new live provider invocation.
Decision: login-notice-dedup-1030-active | Reuse durable active-login equality at both switch producers; retain distinct topic completions, never deduplicate by account pair forever or by a time window. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/login-notice-dedup-1030-PROGRESS.md
Decision: login-notice-dedup-1030-history | Preserve historical switches and notice keys; prevent new duplicate records without retroactively guessing which old notices were delivered. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/login-notice-dedup-1030-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: the existing durable active index identifies whether a runner transition actually occurs. No new event ledger, clock window or notice filter. Exact active equality prevents repeated topic completion/selection from inventing a switch, while a later active change preserves a genuinely new transition. Existing prepared-selection, authority, stop, quota and handoff completion guards remain. No autonomous live-completion or deployment claim.
80/20: Two order-sensitive regression cases, the actual multi-topic host test, direct-import tests and required static/pinned checks. Full Studio suite and serving deployment remain desk-owned. Live sequences 15–17 were described by the brief, not independently read on this host; source reproduction proves this path, not exclusive attribution of those historical rows.
VERDICT: author candidate submission; no independent convergence or live deployment claimed

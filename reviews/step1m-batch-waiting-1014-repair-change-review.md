# Change review — repair batch recovery and aggregate delivery sizing

Subject base: 5c3662fa81e63008b007fd831844b7205497969a
Review state: open
Reviewed content: none
Outcome: A fresh admission gate no longer wedges batch recovery; individually valid waiting messages drain in fitting ordered prefixes instead of failing together on aggregate overflow.
Affected rules: Rules 1, 4, 15, 26, 29, 34, 36, 42, 46, 49, 60, 63, 68, 70, 74, 75, 77, 95, 96, 101, 102, 111, 113, 114, 116.
Affected floors: secrets — existing outbound checks; spend cap — unchanged durable call reservation and delivery ceiling; stop — existing host guards and worker retirement; no duplicate sends — no tool replay and existing unique-send doorway; durable intake — fitting prefix leaves the suffix in the existing durable host queue.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs recovery of tool-bearing batch work and selection of model-facing message envelopes.
Side effects: A large waiting batch can require multiple turns under the same cumulative allowance. The exact serialized prompt, including escaping, host history, clock and result path, decides the prefix. A lone message retains its existing prompt. Recovery can read existing durable journal edges rather than relying on the previous process's lost Map. A matched process edge, closed child edges and correlated adapter completion recover the result; missing, unreadable, pending-child or malformed evidence preserves uncertainty and retires the old worker. No allowance or admission is reopened. Journal evidence reads include retained pre-compaction records.
Undo and recovery: Revert the repair commit without deleting custody or journal evidence; the old defects would return. No new schema is introduced. Preserve uncertain work rather than replaying its effects. Worker retirement still requires confirmation.
Multi-machine posture: Deliberately machine-local process handles and custody remain under the existing ownership fence. Journal replication and durability demands do not change. No cross-machine worker adoption or new store.
Layer below: Inspected the real admission gate's volatile claims and durable child-edge append, journal frame offsets and compaction retention, adapter correlated reply/turn-end contract, topic retirement coordinator, shared allowance, shipped modelBatch closure, per-intake reservations, collection and unique send path.
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-topic-sessions.test.ts; live=tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Prompt review: Batch instructions and semantic output parsing are unchanged. Only the number of admitted envelopes per delivery changes, measured in final UTF-8 bytes. Recorded summary writer, uncertain summary, undecided/unsure Jev, reviewer, delivered reply and empty-candidate bytes replay through the shipped batch path; enclosing results remain synthetic. No live-model or live-user acceptance is claimed.
Prompt finding: 849db3a6296a | quoted-evidence | Existing memory-list wording is unchanged; this repair adds no phrase-based semantic decision.
Prompt finding: e8708c7fea24 | quoted-evidence | Existing recall instructions remain unchanged quoted context; no fixed-phrase gate is added.

Decision: step1m-repair-prefix | Size the exact envelope at the host dispatch boundary, drain the largest fitting ordered prefix, and retain the suffix in the existing queue. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-repair-132417-PROGRESS.md
Decision: step1m-repair-recovery | Reuse durable journal process and child edges plus correlated adapter receipts; missing evidence settles uncertainty after retirement, never reopens allowance or replays tools. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-repair-132417-PROGRESS.md
Decision: step1m-repair-certificate | Leave the byte-bound native macOS conformance certificate unchanged for the Studio owner under the current standing charter's explicit exception. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-repair-132417-PROGRESS.md

simplestRobustRoute: Reuse the existing host queue and journal evidence. The exact prefix selection prevents aggregate prompt overflow; the durable edge reader prevents restart dependence on volatile admission state. No new queue, store, scheduler, authority, resource cap or model call is added. Start guards remain admission, authority, cumulative spend and stop; completion still needs correlated identity, child closure and atomic result custody. Targeted offline regressions establish these paths, not unattended live-user acceptance.
80/20: Targeted source-consumer tests and recorded-shape replay, typecheck, architecture, register, review and pinned gate checks; no full suite or load test. Studio owns the native conformance contract.
VERDICT: author submission; no independent convergence claim

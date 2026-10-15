# Change review — train-42 runner exit visibility

Subject base: fc140791d9892a8def43a1ed3e66fe78ed735c29
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed runner exit-reason head into the live base, preserving lifecycle, recovery and accepted live behavior while making existing exit causes visible to the launcher.
Affected rules: Purpose 2/3; Rules 34, 35, 37, 39, 46, 49, 55, 59, 60, 68, 69, 70, 74, 90, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — fixed errors suppress details; spend cap and stop — unchanged; no duplicate sends — retained intent/result fencing and restart tests; durable intake — accepted work survives exit and relaunch.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Integration of reviewed observability-only stderr logging and process recovery tests; no new lifecycle or model-facing behavior.
Side effects: One stderr exit reason per runner process, with the member's one-shot guard. Generated publications reflect the merged source. No provider, prompt, cap or recovery policy changes.
Undo and recovery: Reject this candidate or restore the preceding live build through the desk deployment process. Preserve journals and receipts; never resend UNKNOWN intents. No new migration or authority.
Multi-machine posture: Exit output is deliberately machine-local to each runner's launcher. Existing conversation ownership, replicated journal and recovery remain unchanged. WSL builds; Studio owns native proof and deployment.
Layer below: Inspected merged runner shutdown and signal handlers, lane.settle ordering, durable exit records and intake/send restart tests. Checked exact base/member ancestry and the already-contained shared graduation repair.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model instructions, parser or accept/escalate/refuse changes. Member fixture outputs only support process-boundary tests; real model-shape replay is not applicable to stderr observability.
Decision: train-42-merge | Ordinary merge of exact reviewed f96617a49004f8f671856dd9746e70257ea1eaa1; no conflicts. Member scope and evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/runner-exit-reason-1014-PROGRESS.md and reviews/runner-exit-reason-1014-change-review.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-42-PROGRESS.md
Decision: train-42-desk-A | Preserve both the live runner changes and member exit logging through the clean ordinary merge; no product conflict or omitted head. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-42-PROGRESS.md
Decision: train-42-desk-B | Create train-42 directly at exact live fc140791d9892a8def43a1ed3e66fe78ed735c29. No main merge or unreviewed branch tip. Shared repair d746452bbe60ac6f23d04daf0627f44dcf60a8d8 is already an ancestor, so no second repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-42-PROGRESS.md
Decision: train-42-desk-D | Run changed tests, direct consumers and prescribed journal checks on WSL. Report unchanged host-dependent failures and absent Studio report paths without changing declarations to conceal them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-42-PROGRESS.md
Decision: train-42-publication | Use downloaded desk repin/build/rehash tools and replay register at merged source 10f4d5cd0b23773234047b232e0be5918455cf4f. No manual generated edits or certificate changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-42-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: one exact-head merge, existing publication tools and targeted consumer checks. No new runtime machinery. Existing ownership, secret, spend and stop guards constrain entry; durable intake, send outcomes and bounded settling constrain exit. No unattended live acceptance or independent convergence is claimed.
80/20: Changed tests, direct consumers, prescribed journal tests and pinned checks only. No full suite, transitive closure, comparison worktree, live login or load generation.
VERDICT: author submission for desk gate; no independent convergence or deployment claim

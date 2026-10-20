# Change review — deadset-close-1019

Subject base: 5b8a3230bdf7826f8628fade0f3a2c9d5a01135d
Review state: open
Reviewed content: none
Outcome: Recover verified-gone launch debits through the existing Six close path and admit into the rotated generation with that generation's predecessor references. Unknown owner identity never earns early credit.
Affected rules: 1, 26, 32, 33, 49, 60, 70, 74, 101, 102, 113, 116
Affected floors: secrets — unchanged; spend cap — retain debit until verified gone; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Small repair to existing host accounting and its recovery evidence boundary, with real file-store regression coverage; no new authority or effect.
Side effects: First admission after rotation or a pending return now sees the current domain head. Rows missing owner identity remain unresolved instead of being credited. Existing complete census and member incarnation checks, partial-return settlement and host lease remain.
Undo and recovery: Revert this change through review; existing durable closed sets remain valid, old generations remain on disk, and unresolved rows are retained for a later verified recovery. No fact migration or deletion is introduced.
Multi-machine posture: Deliberately machine-local physical process and host-resource accounting. Existing Six host lease governs returns; this change grants no cross-machine disposal authority.
Layer below: Read the constitution, startup-slow-1019 diagnostic, resource-owner recovery, Six adapter, resource-set close authority and process inventory. The assigned base already returns verified-gone debits; its observation-only comment is stale. The actual reproduced defect is stale predecessor heads on rotation. No live host-111 closure is claimed.
Bug class: integration
Bug evidence: reproducer=tests/preview/deadset-recovery.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, containing only samples.
Convergence: none
Prompt review: No model-facing change.
Decision: deadset-existing-close | Reuse recovery-observed-gone:<launch id> and resume under the original durable settlement; do not duplicate an already shipped close path or alter src/facts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deadset-close-1019-PROGRESS.md
Decision: deadset-current-head | Compute demands after pending returns and rotation so the reservation names the selected generation's domain heads. Original regression fails with domain predecessor changed after recovery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deadset-close-1019-PROGRESS.md
Decision: deadset-owner-evidence | Missing or malformed owner identity is unknown, not gone; keep its row and debit under Rule 60. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deadset-close-1019-PROGRESS.md
Decision: deadset-recorded-shape | Recreate the diagnostic's held committed set beyond 128 facts with real Six/file storage and injected host observations. This is incident-shape regression evidence, not live journal-byte replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deadset-close-1019-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: preserve the existing verified-gone close/resume path and rotation, compute predecessor heads after the existing generation choice, and refuse early credit without owner evidence. No new loop, persistence format or core derivation. Start guard is verified owner/member absence and complete census; end guard is durable close before ledger removal; limit guard is Six capacity under the host lease. Tests drive the real shipped recovery adapter unattended on isolated file stores; live Studio acceptance remains with the desk.
80/20: Targeted regression and direct importers, typecheck, architecture/register/change-review checks and the specified READY subset. No full suite or second base worktree.
VERDICT: author submission for desk gate; no independent convergence or live acceptance claim

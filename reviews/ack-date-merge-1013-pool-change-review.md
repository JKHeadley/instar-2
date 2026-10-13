# Change review — Merge acknowledgement fixture clock repair into pool candidate

Subject base: 943097c36787cdc4fd60f52924ea631abc325eb5
Review state: open
Reviewed content: none
Outcome: Merge the single owning clock repair into the pool candidate without changing product behavior.
Affected rules: 1, 26, 35, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — no serving credentials or outbound model calls; spend cap — admission unchanged; stop — expiry enforcement unchanged; no duplicate sends — restart assertions retained; durable intake — journal reopen assertions retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Ordinary merge of the existing test-only repair and review; no product or model-facing change.
Side effects: The test retains its date matrix and resets fixture time after clearAllTimers. Existing branch changes and both review histories are preserved.
Undo and recovery: Revert the merge with its first parent as mainline; no production state changes.
Multi-machine posture: Machine-local test clock deliberately; production replication and ownership unchanged.
Layer below: Read the full main constitution and inspected the owning commit and merged diff. The restart fixture restores its injected clock after Vitest resets it. All 19 acknowledgement cases pass on this host on 2026-10-13.
Bug class: unit
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only samples.
Convergence: none
Prompt review: No prompt, parser, model decision or product change; recorded replay fixtures remain unchanged.
Decision: ack-date-merge-pool | Preserve the ordinary conflict-free merge and add this record to cover the merge commit under Rule 74; use the existing clock repair without reimplementing it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-login-pool-default-1012-repair-031403-PROGRESS.md
Decision: pool-report-handoff-031403 | Correct the missing report reference to the desk's designated repair handoff and carry both decision ids in that report; the passing test implementation and enforcement stay unchanged. This record retains its original subject base to cover the merge and this report-reference repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-login-pool-default-1012-repair-031403-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the one owning test repair, preserve both histories, and verify the candidate. Start guard is a clean branch at its origin head; end guards are passing targeted checks and a pushed clean head. Existing safety floors are untouched; no autonomous product capability is claimed.
80/20: The 19-case acknowledgement test passes including fixture day, today and 2099. Required final-head checks and any host limitations are recorded in the report; independent landing judgment remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

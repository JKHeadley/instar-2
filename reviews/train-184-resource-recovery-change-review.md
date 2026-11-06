# Change review — train-184 partial allocation recovery observations

Subject base: 0087b389a1de73546b78ec515b077180df09d15b
Review state: open
Reviewed content: none
Outcome: The partial allocation-return regression exercises durable recovery independently of ambient process-query availability and proves that unavailable observations retain its debit.
Affected rules: Rules 34, 37, 42, 60, 70, 74, 95, 101, 102, 113, 116.
Affected floors: secrets — no credential path change; spend cap — no calls or allowance changes; stop — unchanged; no duplicate sends — unchanged effect identities and dispatch; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test fixture uses the existing query port; no product behavior, timeout, resource ceiling, or persistent format changes.
Side effects: The fixture no longer relies on real ps succeeding for invented absent PIDs or a complete ambient host census. Real-host recovery tests remain intact. No new runtime mechanism or capability restriction.
Undo and recovery: Revert this test and review commit to restore ambient observations; no runtime migration or journal repair.
Multi-machine posture: Deliberately machine-local test observations; the real Six journal is reopened with distinct incarnations. No change to replication, ownership, or deployment behavior.
Layer below: scripts/resource-owner.mjs startEvidence/recover/settle, scripts/process-inventory.mjs census, tests/preview/six-host-resources.ts and the existing real-host orphan recovery test. Production retains a row whenever absence is unproven and resumes partial returns using their original settlement.
Bug class: unit
Bug evidence: reproducer=tests/integration/resource-owner.test.ts
Hook bypass: none
Convergence: none
Decision: train184-repair-recovery | Inject unavailable and absent observations through the existing query port, retaining the real owner and Six persistence; prove each failure retains the debit before successful recovery resumes the original settlement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-PROGRESS.md

1.x FIRST: Actual JKHeadley/instar origin/main 71abd5b7ebdba39d3409d4812e1a7ebadc115aab. Searched src/core/SessionLivenessOracle.ts, docs/specs/unified-session-lifecycle-robustness.md and docs/specs/test-runner-concurrency-bound.md, and their history (ab26b7ca36c1375d855f08c9a6a66e84e2b656e2, 5129779c3, 618560b3e). Read ONEX-LESSONS.md sections 2 and 6. Reuse its tri-state principle already implemented by the 2.0 resource owner: unavailable evidence is indeterminate, never proof of death. The tmux oracle is not a Six allocation-set implementation, so copying it adds no needed behavior. Existing 2.0 query injection fits this test.

Step back: The bounded gate evidence shows one failed assertion and adjacent fork resource exhaustion. It does not identify the failing observation; attribution to a specific query remains unproven. The original test passes alone, which is not exoneration under Rule 37. Its requirement is durable partial-return recovery, and its ambient observations made the expected outcome conditional on unrelated host availability. Shrink the repair to that fixture: three unavailable-observation controls retain the exact open set and ledger; complete absence resumes the original settlement; an already closed set permits removal of a surviving row. Retain the accepted browser/probe/cache and earlier repair work without extending it.

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing observation port to fix the test's missing precondition, while exercising the real owner and durable Six journal. Start with a deliberately interrupted return; end with one completed original settlement and no ledger row, or a retained debit when evidence is unavailable. No retry, quarantine, timeout increase, runtime change, or autonomous product-completion claim.
80/20: One named test plus its review; verify recovery and refusal controls, typecheck and cheap gates. The desk owns the full-suite rerun; this submission does not claim a new full gate or live acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

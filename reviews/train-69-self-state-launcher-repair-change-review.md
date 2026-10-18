# Change review — launcher self-state access inventory assertions

Subject base: 26936db37c9121a1dea88e16f06d35de0746a227
Review state: open
Reviewed content: none
Outcome: Align the real-launcher regression test with the accepted compact self-state and access inventory, preserving activation-label, accounting, restart and secret-value assertions.
Affected rules: 26, 34, 37, 49, 70, 74, 84, 96, 101, 102, 107, 111, 112, 113, 116.
Affected floors: secrets — assert fixture values absent while safe metadata is present; spend cap — retain before/after cap accounting; stop — implementation unchanged; no duplicate sends — retain exact reply totals; durable intake — retain intake counts and restart evidence.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only a regression test and its review record change; no model instructions, parser, policy, authority or executable behavior changes.
Side effects: The old whole-prompt exclusion incorrectly rejected permitted inventory metadata. Exclusion now applies to the activation display line, while inventory has positive structured assertions and fixture secret values have negative assertions. Compact prompt counts are asserted separately from unchanged verbose status counts. Failure diagnostics include the fixture's recorded launch refusal.
Undo and recovery: Revert this test-only commit; doing so restores the stale assertions and cannot change runtime behavior or durable state.
Multi-machine posture: Machine-local offline fixture; no shared state or ownership change. The real launcher still requires its supported host shell; WSL dash refuses the existing ulimit -u shim before bot identity verification.
Layer below: Read selfStateBrief compact and verbose branches, selfStateSource, readSelfAccess, credentials registration and the physical Telegram transport/limit shim. Metadata is deliberately present, secret values are withheld, and both count formats share stateFacts.
Bug class: none
Bug evidence: Test-contract drift shown by the supplied Studio gate at 26936db3: self-state-launcher.test.ts:96 rejects preview-activation inside Credentials metadata. Local launcher attempt refuses before reaching those assertions on WSL; no passing launcher result is asserted.
Hook bypass: none
Convergence: none
Decision: train-69-self-state-contract | Repair the stale test consumer rather than remove accepted access metadata or expand the prompt budget; keep human-readable activation labels and secret-value checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-69-repair-060248-PROGRESS.md
Prompt review: No model-facing change. The existing self-unblock tests replay captured provider shapes; this repair changes only assertions about the unchanged prompt.

Subject (1 paths): tests/preview/self-state-launcher.test.ts

## Closing block

simplestRobustRoute: Update the existing launcher test to distinguish the activation display line from safe access metadata and assert compact accounting with the same totals; retain status and restart checks. No runtime machinery, capability restriction, new service or guard bypass is needed.
80/20: Targeted portable tests and cheap gates support this test-only correction; the supported-host real launcher and full-suite acceptance remain the Studio pipeline's checks. No live or unattended capability-completion claim.
VERDICT: author submission; no independent verdict asserted.

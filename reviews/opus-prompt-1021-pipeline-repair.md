# Change review — Preserve historical rationale wording in literal-copy replay

Subject base: 91e5b8a9b192c5022916ecdb7197f3eab7836d53
Review state: open
Reviewed content: none
Outcome: Repair the historical prompt comparison while preserving the recorded provider capture and current brief-rationale instruction.
Affected rules: 26, 36, 37, 49, 70, 74, 101, 102, 108, 111, 112, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; only a test comparison changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test-only compatibility translation; no shipped prompt, parser, decision boundary or fixture changes.
Side effects: The exact historical equality accounts for the rationale sentence change. Explicit positive and negative assertions prevent silently accepting reversed or absent instructions.
Undo and recovery: Revert this test and review commit; captured bytes and production behavior remain intact.
Multi-machine posture: Shared test source is identical on all hosts; introduces no state or machine coordination.
Layer below: Immutable literal-copy-715675751.json capture, current SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, and existing five-route prompt-rationale tests.
Bug class: none
Bug evidence: Test expectation regression reproduced with 1 failed and 2 passed before repair, then 8 passed across literal-copy and prompt-rationale tests.
Hook bypass: none
Convergence: none
Decision: opus-prompt-repair-historical-rationale | Translate only the known rationale sentence in the existing historical comparison, keeping real capture bytes immutable and current production instructions intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/opus-prompt-1021-repair-101518-PROGRESS.md
Prompt finding: 57849d16f797 | protocol-literal | Exact current protocol text is asserted in a test, not used to classify model meaning or sent as new instructions.
Prompt finding: db5c8eb34441 | protocol-literal | Exact current protocol text is asserted in a test, not used to classify model meaning or sent as new instructions.

Subject (1 paths): tests/preview/literal-copy.test.ts

## Closing block

simplestRobustRoute: Extend the existing historical prompt translation by one known sentence and assert both old and new forms explicitly; no new production machinery or changed safety floors.
80/20: Reproduced the exact failure, kept full prompt equality and real recorded replay, and verified the current five-route instruction contract with targeted tests. Independent landing review remains the desk's responsibility.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

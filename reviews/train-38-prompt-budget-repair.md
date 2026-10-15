# Change review — train-38 tool prompt budget repair

Subject base: 28c704d9bf0691a0ee687d768821660f37fc017c
Review state: open
Reviewed content: none
Outcome: Repair the stale tool-prompt size assertion while preserving the accepted completion guidance and the existing growth margin.
Affected rules: 13, 26, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — no runtime change; spend cap — offline tests only; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test bound and its explanation; no production prompt, parser, gate, policy or fixture changes.
Side effects: The growth bound increases by a fixed 409 characters, exactly the accepted TOOL_TASK_COMPLETION addition. It retains the prior 33-character margin and remains independent of runtime string length. The separate default-context-floor test still pins exact growth at 3176; tool-readback tests still require exactly one completion clause per tool route.
Undo and recovery: Revert this test and review commit; no state migration or deployment recovery.
Multi-machine posture: Static repository assertion shared across hosts; no new state or cross-machine behavior. Physical launch checks require the supported Studio host.
Layer below: Inspected tool-answer-guidance.ts and production-provider tool framing against the existing default-context-floor pin and captured tool-readback fixture. Previous growth 2767 plus accepted completion text 409 equals current 3176; old bound 2800 and new bound 3209 both leave 33 characters. No production change is warranted.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-provider-tools.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: train38-repair023733-budget | Add only the accepted fixed 409-character completion allowance to the old test budget; retain all runtime behavior, exact growth pin and existing safety assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-38-repair-023733-PROGRESS.md

Subject (1 paths): tests/assembly/production-provider-tools.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: correct one stale test budget, adding the measured accepted guidance length without changing production or adding machinery. Existing exact-growth and once-only guidance assertions remain the limits; the changed assertion still rejects growth at 3209. This test-only repair makes no autonomous or fresh live completion claim.
80/20: Reproduced the exact Studio failure locally; rerun the changed assertion, exact context-floor and captured read-back tests plus the required cheap checks. Keep host-dependent physical launch failures visible for the Studio gate; no full suite on WSL.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

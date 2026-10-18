# Change review — train-30 acknowledgement test repair

Subject base: fdf5df2d2ffa00af1f4bc760ce72b29c9e0dbc59
Review state: open
Reviewed content: none
Outcome: Align the resource-launcher and phase-timing regression tests with the accepted seven-second acknowledgement contract, including both sides of its boundary.
Affected rules: Rules 13, 26, 37, 49, 70, 74, 87, 101, 102, 111, 112, 113 and 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake keep their existing implementation and assertions; only test timing expectations change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair of stale ten-second expectations; no model prompt, parser, admission or runtime behavior changes.
Side effects: The desk rehash tool refreshes the existing resource-test owner pin without changing its authority. The resource fixture waits for acknowledgements at 8200 ms as well as 10200 ms; exact 6999/7000 ms cases distinguish premature sends from the required acknowledgement. Phase evidence still separates callback lateness from audience admission latency.
Undo and recovery: Revert the two test edits and this record; no state migration or deployed recovery is needed. Reverting restores the known stale expectations.
Multi-machine posture: Test fixtures are machine-local and temporary; shared runtime ownership, durable state and effect admission are unchanged.
Layer below: Read journal.ts acknowledgement constant, held-notice timing measurements and timer registration; the existing timer uses 7000 ms. Resource fixture advances an injected clock and exercises the real launcher and HTTP sends; phase fixture retains encrypted journal compaction/replay and unknown/not-sent assertions.
Bug class: none
Bug evidence: Studio full-run excerpt reports three failures in the two named files, each retaining ten-second expectations after the accepted seven-second change. This repairs the verification contract, not a product defect.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none

Decision: train-30-repair-100322-timing | Keep the accepted seven-second runtime and correct the two stale test consumers; add exact boundary cases without changing product behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-repair-100322-PROGRESS.md

Subject (3 paths): register-source/owner-references/preview.json, tests/preview/journal-agent-resources.test.ts, tests/preview/phase-timing.test.ts

## Closing block

simplestRobustRoute: Correct the stale expectations in the existing tests and exercise 6999/7000 ms through their existing injected clock; this is the simplest robust route and adds no machinery. Existing secret custody, bounded launch, audience admission and send uniqueness checks remain. No new autonomous or live-user completion is claimed.
80/20: Run the two affected test files, typecheck and required cheap gates; the Studio pipeline owns the full suite and host-dependent proof.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

# Change review — PR 199 ownership, notices and change boundary repair

Subject base: b4bdc719c3f3d868a2c8c164190e7f756d275c9b
Review state: open
Outcome: Reuse a66fe61615157b2072d226c74096a6e425b12417 so overdue features own their declaring module and the Studio reader receives deadline notices on success and refusal. Derive changed paths from the actual target merge-base instead of subtracting unrelated remote tips.
Affected rules: 26, 34, 42, 49, 70, 72, 73, 74, 90, 91, 95, 101, 102, 105, 111, 112, 113, 115, 116, 119.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged.
Operator questions: none about the repair; existing expired preview-feature deadlines need disposition before this whole PR can pass its corrected gate.
Suggested tier: critical
Declared tier: critical
Tier rationale: Deterministic release-integrity refusal and its operator visibility.
Side effects: A sibling implementation change now refuses when its module is overdue. Docs own only exact paths. Missing or ambiguous target ancestry fails closed. Other remote branches cannot hide this change. Explicit caller bases remain trusted inputs; the default target is origin/main for this main-targeting repository. No deadline is renewed and no feature promoted. Notices use the existing deduplicating desk reader, with no new sender or state.
Undo and recovery: Revert the repair and regenerate publication from that source if rejected; restore a native certificate only through the real contract for its matching composition. Reversion restores the known review findings and is not a correctness fix.
Multi-machine posture: Identical Git target and source bytes yield identical scope on every host. Unknown history refuses. Native conformance is deliberately bound to the Darwin runtime; no shared state is introduced.
Layer below: Real rungraph-core declaredBy, sibling implementation imports, actual Git histories, register export and CLI catch boundary, and Studio driver.py lines 204-223 read-only. No synthetic-source self-match substitutes for provenance.
Bug class: unit
Bug evidence: reproducer=tests/register/change-scope.test.ts
Hook bypass: none; use plain commits.
Convergence: none
Decision: R72-REPAIR-PORT | Port the owning live repair, including real-provenance tests and the existing notice adapter, without transplanting its different composition certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-fix-1109-PROGRESS.md
Decision: R72-TARGET-BASE | Require one merge-base against the caller target or origin/main; missing or ambiguous boundary returns null, never an empty change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-fix-1109-PROGRESS.md

## Provenance and omitted live changes

Actual JKHeadley/instar origin/main 55e3010b0245a2a1b94e2ced738a7f19ab051bd5, searched src/ and docs/specs/ plus history 7df9eeea63 / 17c81eaae6: src/core/FeatureMaturationPlanGate.mjs supplies structural WARN behavior; src/monitoring/DarkFlagMaturationRegistry.ts supplies owner/deadline/proof-of-life visibility; docs/specs/feature-maturation-discipline.md and feature-maturation-ladder.md preserve reviewed promotion. The shared behavior is per-feature attention without blocking unrelated work. Those paths do not implement this Git build boundary. Reuse the complete relevant 2.0 repair a66fe6161. ONEX-LESSONS sections 3 and 6 require actual delivery-path evidence and bounded concurrency.

The history c7603b400..2f7a76ad for src/rulegraph/graph.ts, src/register/workflow.ts and scripts/build-register.mjs contains a66fe6161, 338eb8674, 4e99924ea and merge 44978fe32. Port a66fe6161's ownership, notice formatter/export, CLI emission/extraction and tests. Workflow already matches live. Leave its native digest out because this composition must be measured here. 338eb8674's anchor refresh and Rule39 conversion from 4e99924ea/44978fe32 are already adapted to main; copying their foreign pins would be wrong. No other later Rule72 behavior is omitted.

The Git bug remains on live 2f7a76ad in scripts/build-register.mjs:172-178: contains catches errors as false, and excluded subtracts every non-containing remote tip. This repair is only on the assigned PR; the desk owns routing the live repair.

## Verification and limitations

Evidence and exact command outputs live at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-fix-1109-PROGRESS.md and the adjacent rule72-to-main-fix-1109-evidence directory. The inherited source/tests and earlier failed findings remain in history. The corrected default PR boundary exposes an actual overdue preview-conversation change inherited from PR199: tests/preview is its declaring module. That refusal must remain visible; using a later base to pass this PR would conceal part of its change. Separate isolated CLI probes demonstrate unrelated success and own-feature refusal without asserting that the entire PR is green.

No prompt, model-output parser or model accept/escalate decision changes. docs/01-the-rules.md stays byte-identical to 2f7a76ad; no published entry is renumbered. Product code is under 100 changed lines; extra lines are the inherited real-provenance repair, regression tests, corrected review records and required mechanical publication/certification.

simplestRobustRoute: Port the already-working live module and notice mechanism, and replace unrelated-ref subtraction with Git's target merge-base. Missing history fails closed under Rule95. Reuse the native contract and existing mechanical tools; no new registry, notifier or permission mechanism.
80/20: Targeted real-provenance, Git and CLI tests plus required gates; the pipeline owns the full suite.
VERDICT: author submission; no independent approval or green whole-PR claim

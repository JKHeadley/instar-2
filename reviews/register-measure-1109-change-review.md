# Change review — exact train-227 register measurement

Subject base: 0bde1fda553a2609382d221684b152aa71cdb634
Review state: open
Reviewed content: none
Outcome: Publish a dated register measurement at the exact live source, replacing stale 8/118 citations with 8/122 linked rules, zero held-reviewed, and explicit historical versus current-head carryover proof limits.
Affected rules: 13, 26, 49, 69, 74, 101, 102, 111, 113, 116; purpose constraints 3, 4, 6
Affected floors: secrets, spend cap, stop, no duplicate sends, durable intake — existing paths unchanged; documentation only
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Measurement and review prose only; no runtime, declaration, test or constitutional wording changes.
Side effects: Readers gain a current denominator and scoped test references; no authority or live-proof status is promoted.
Undo and recovery: Revert this documentation commit; retained desk replay evidence remains available.
Multi-machine posture: Shared versioned documentation; deliberately host-local read-only measurement, with exact source and Studio evidence paths. No shared state protocol changes.
Layer below: Read constitution, scripts/build-register.mjs and register-source.mjs, src/rulegraph/graph.ts evidence classification, exact replay output, owner-reference catalogs, named can-fail assertions, and the existing carryover inventory. Replay and --check both exit 0 at the full source SHA; shape-only authority and empty extract remain visible.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples
Convergence: none
Decision: D1 | The requested repository spec is absent at the measured SHA; use the existing desk spec definitions and publish the current measurement at docs/specs/register-link-1103-spec.md, preserving desk originals | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/register-measure-1109-PROGRESS.md
Decision: D2 | Report row 63 as historical fc000d65 evidence and zero current-head rows established by the inspected evidence; the parallel proof effort has no completed result at measurement time | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/register-measure-1109-PROGRESS.md
Prompt review: none; no model-facing behavior changes

1.x FIRST: searched actual JKHeadley/instar origin/main src/, docs/specs/ and history at 6cbe44c819cd97aec1d9c7f470b04148fbca708d. Read src/core/StandardsRegistryParser.ts, scripts/standards-coverage.mjs and docs/specs/CARTOGRAPHER-CONFORMANCE-AUDIT.md; inspected history 84b2220f3a, a10176d728, ac000547bf. Reused named-guard/resolvable-reference measurement discipline through 2.0's existing replay builder. The 1.x existence grading does not establish 2.0 semantic Hold review or Part Two authority, so no scanner is ported. ONEX-LESSONS areas 1 and 5 warn against unknown production SHA and missing evaluation presented as success.

Subject (1 path): docs/specs/register-link-1103-spec.md

simplestRobustRoute: Reuse the existing register replay and owner catalogs, report precise counts with their source and evidence limits, and add no machinery.
80/20: Exact-source replay and verification establish the requested measurement; current-head carryover parity remains explicitly unmeasured, owned by the separate proof task rather than inferred from older results.
VERDICT: author submission; no independent review verdict claimed

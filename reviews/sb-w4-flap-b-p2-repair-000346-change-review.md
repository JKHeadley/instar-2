# Change review — flap-b pipeline decision-report repair

Subject base: 6c9cff8f90489b08921618b7f77b998ad207a827
Review state: open
Reviewed content: none
Outcome: Point the four integration decisions at the repair report the desk will copy from Mama, and explicitly report every decision there.
Affected rules: 49, 74, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no disclosure change; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Review metadata and reporting only; no source, test, model-facing input or acceptance change.
Side effects: The Studio checker now resolves the four decisions through the current repair report. That report must be copied by the desk before the Studio check can pass.
Undo and recovery: Revert this repair commit to restore the original report references; runtime behavior is identical.
Multi-machine posture: Review records travel through git. The report is written under Mama state and copied to the specified Studio lane by the desk; no Studio writes from Mama.
Layer below: scripts/check-change-review.mjs reads absolute report paths and requires each decision id in their content; the integration record contains four decisions whose original report is missing according to the supplied gate failure.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sbflapbp2-repair-report | Repair the reporting references and enumerate all four original decisions in the handoff, preserving the existing runtime implementation and verification machinery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-flap-b-p2-repair-000346-PROGRESS.md

Subject (1 paths): reviews/sb-w4-flap-b-change-review.md

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the existing decision-to-report references and deliver the report through the specified desk handoff; adding runtime code or weakening the report checker would not repair missing evidence. The check starts from committed records and ends with every decision present in its actual desk report. No autonomous runtime completion is claimed.
80/20: Typecheck, architecture/register checks, decision checks, and available saved gate contract checks; no full suite or runtime changes.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

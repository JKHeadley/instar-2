# Change review — Repair train-12 decision report references

Subject base: 80dcddb8eee3514725ca9640c0d2b110d018ae6e
Review state: open
Reviewed content: none
Outcome: Make the six train-12 decisions resolve to the desk-copied repair report that names each decision.
Affected rules: 49, 74, 101, 102, 111, 112, 113, 116; purpose Rule 3 evidence.
Affected floors: secrets — ; spend cap — ; stop — ; no duplicate sends — ; durable intake — 
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Review evidence locator repair only; no executable code or model-facing content changes.
Side effects: The desk must copy the Mama report to the exact Studio lane destination before the unchanged Rule 102 consumer can resolve it. No checker exception is added.
Undo and recovery: Revert the locator repair commit; original decisions and review history remain in git. No runtime data changes.
Multi-machine posture: Repository-shared locators name the required Studio evidence destination. The Mama report is local under .instar/state and is transferred by the desk; this builder never writes to Studio.
Layer below: Read both constitutional documents from origin/main; inspected all six original Decision rows and the validateRecord report existence/id checks in scripts/change-review.mjs.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->

Subject: reviews/train-12-change-review.md

Decision: train-12-repair-053214-report | Point the six existing decisions to the prescribed desk-copied repair report and preserve their content and ids. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-12-repair-053214-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: repair six evidence locators and supply their decision summaries in the existing report mechanism. No new machinery. Start guard: exact original six references; end guard: existing Rule 102 validator and desk report copy; limits: no Studio write and no weakened safety floor. No autonomous runtime capability claim.
80/20: Run portable required checks and pinned-text tests; retain the expected Studio-local missing-report diagnostic rather than fabricate evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

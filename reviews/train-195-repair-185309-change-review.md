# Change review — repair stopped-attempt outcome assertions

Subject base: e8d374e690a865c7bc06f138ab3fecb3532a00af
Review state: open
Reviewed content: none
Outcome: The repair lifecycle test recognizes the accepted plain stopped-task notice and verifies retained uncertainty, infrastructure provenance, and exactly one delivery across restart and replay.
Affected rules: Rules 37/49/70/74/89/101/102/116.
Affected floors: secrets — no runtime change; spend cap — no runtime change; stop — no runtime change; no duplicate sends — strengthened restart assertions; durable intake — retained uncertainty checked after reopening.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only correction of a stale wording assertion; no production behavior or authority changes.
Side effects: Only regression assertions change. A completed malformed repair keeps its separate assertion. Uncertain and thrown repairs must preserve their unknown outcome without an answer or automatic retry.
Undo and recovery: Reverting restores the obsolete test failure; no data or runtime migration exists.
Multi-machine posture: Portable worker and encrypted-journal fixture; no host-specific runtime changes. Studio owns the full suite.
Layer below: Inspected unknownAnswerNotice, persisted modelState/noticeClass, infrastructure send provenance and the existing restart/replay fixture. The accepted runtime formatter already supplies the correct notice.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset, common hooks directory contains samples only.
Convergence: none
Decision: train195-stop-test-contract | Replace the obsolete shared wording regex with explicit unknown-cause, retained-request and no-retry assertions for uncertain/thrown repairs; retain the malformed neighbor and verify no answer, infrastructure speaker and durable uncertainty across restart. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-repair-185309-PROGRESS.md
Decision: train195-test-pin-publication | Refresh the changed test owner-reference pin with the supplied desk tools and regenerate the register from the committed pin source; no declarations or authority change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-repair-185309-PROGRESS.md
1.x comparison: Inherit the accepted plain-task-stop comparison; refreshed against actual JKHeadley/instar origin/main 1723950ceca23f0ae516e4cb9d3e675ae1c1eea3 after searching src/, docs/specs/ and git history and reading ONEX-LESSONS section 3. src/messaging/plainNoticeCheck.ts is a test-time signal, not runtime authority; src/monitoring/watchdog-notifications.ts reports interventions; docs/specs/wedge-recovery-message-loss.md separates delivered notices from answered work. Preserve those principles using the existing 2.0 notice and journal owner. Watchdog restart promises do not fit an uncertain attempt that will not retry. No new mechanism is needed.
Prompt review: No model prompt, output parser, acceptance, escalation or refusal threshold changes. This tests the existing shipped bridge and journal. Recorded-shape checks in the same test file remain intact; fixture sends are not live delivery evidence.
Prompt finding: 85544c20941f | protocol-literal | Unchanged login-outage fixture wording, unrelated to the repaired assertion; no prompt instruction changed.
Generated publication: Replay from committed source 915fc2564903930efeee63d68b4146445ecd1738; generation sha256:b5cba1741cf313fcb7abd814aac2cb53fd04ef3971278a3dcbda37bf7d8d585f. Existing declarations and shape-only authority unchanged.
Deferral: generated/register.json:1 | not-a-deferral=Existing prerequisite descriptions republished without adding or postponing work.
Verification: Baseline reproduced exactly two uncertain/throw failures with the original assertion; scoped test file, typecheck and final cheap checks are recorded in the report. Full Studio suite remains desk-owned.

## Closing block

simplestRobustRoute: Correct the stale test at its source and strengthen outcome/restart evidence through the existing fixture. No runtime workaround, quarantine, new gate, authority or ability restriction.
80/20: Repair the two demonstrated assertion failures, retain the completed-malformed and successful repair neighbors, and leave full-suite qualification to Studio.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

# Change review — publish train-183 startup repair evidence

Subject base: cacc72a7eaf2d0b876adbbe850271d467ff36a51
Review state: open
Reviewed content: none
Outcome: Publish the register generated from the committed startup repair and verified native composition.
Affected rules: 9, 26, 69, 74, 90, 95, 101, 105, 111, 113, 115, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake keep their existing enforcement; shape-only register replay creates no authority.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Generated register publication binds the changed source and native certificate; it does not alter governing wording or runtime policy.
Side effects: All seven generated outputs name source cacc72a7eaf2d0b876adbbe850271d467ff36a51 and generation sha256:67436f9116259b86360e2b0a921995293b4b321ba49bfcb1b3d3eb6fe20f57dc. The native conformance digest reflects the passing ten-case contract. Existing unavailable proof dispositions remain unavailable.
Undo and recovery: Revert the source repair and regenerate from that committed source; do not edit generated evidence by hand or retry an uncertain effect.
Multi-machine posture: Git carries source and generated evidence; native conformance is bound to the declared macOS runtime and composition, not a claim about other hosts.
Layer below: Existing build-register committed-source replay, desk owner rehash/repin, native contract before/after evidence and the source repair review.
Bug class: none
Bug evidence: none
Hook bypass: none; hooks configuration and samples-only directory checked.
Convergence: none
Prompt review: Generated text retains the approved governing wording. Only source/generation and tested native composition evidence change; no authored model instructions or parsing change.
Deferral: generated/register.json:1 | not-a-deferral=Generated existing governing text and evidence; no new deferred work.
Decision: train-183-cache-publication | Generate the seven outputs from the committed repair using the existing replay tool, then require the final cheap checks before publication. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-PROGRESS.md

1.x comparison: Inherits reviews/train-183-cache-integration-review.md, including owner cc11e45f92e2590dd1bbd3c3facb5b849532f0fc source/spec/history research and independent actual main36290662ca8ace97def8a08874d087f8050860b8 src/ and docs/specs/ cache search and history -G. SessionManager.ts handleReadyAndInject and cli-login-expired-opens-repair.eli16.md preserve actual startup evidence; history4e38b9fda/c579b0841/e460a9be3 and ONEX section4 were inspected. No matching 1.x cache or 2.0 canonical-register implementation; reuse owning0c1d832a repair and existing publisher. No legacy files copied.

Validation: Typecheck/build passed; affected tests passed 122/122; native contract passed 10/10 after verified renewal. Real installed profile matches both recorded digests with hooks enabled. Desk rehash/repin exited 0 with zero pin changes; committed-source register replay exited 0 with 299 entries, 121 rules, 34 terms. Final cheap checks are recorded in canonical PROGRESS.
simplestRobustRoute: This is the simplest robust route: regenerate through the existing committed-source publisher. No new machinery or authority; the final source/register checks refuse stale evidence, and Studio owns live answer acceptance.
80/20: Publish exact evidence once and check the final head; the automatic Studio gate owns the full suite and live-answer check.
VERDICT: author submission; no independent convergence claimed

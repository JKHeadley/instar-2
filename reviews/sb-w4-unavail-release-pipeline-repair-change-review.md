# Change review — unavailable-release test repair coverage

Subject base: bd1307461003ed55c59e8e77e4c9141bafc92e61
Review state: open
Reviewed content: none
Outcome: Cover commit 3bf291d2's two corrected test expectations with the missing Rule 74 review. An unavailable contextual review releases the reply while the refused declaration remains refused. The gate had zero failing tests and stopped because that commit lacked a review record.
Affected rules: 4, 37, 42, 49, 70, 74, 77, 86, 95, 101, 111, 112, 113, 116
Affected floors: secrets — credential and shared-audience protections remain in the existing reply path; spend cap — no model calls or limits changed; stop — existing send checkpoint unchanged; no duplicate sends — tests require one send through the existing intent path; durable intake — journal and refused declarations remain preserved
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test expectations and review evidence only; the previously integrated runtime behavior, prompts, parsers, declarations and permissions are unchanged.
Side effects: The tests now reject the old silent-hold behavior when review is unavailable. They still require contextual review rather than the echo shortcut, retain unavailable provenance, and keep refused obligation counts. No production behavior changes in this repair.
Undo and recovery: Revert this review record to reproduce the uncovered-commit gate failure. Reverting the two test expectations restores assertions inconsistent with the integrated unavailable-review behavior; no journal migration or state recovery is needed.
Multi-machine posture: Repository review and tests travel with the branch. Tests use isolated local journals deliberately. No ownership, replication, networking or framework ability changes.
Layer below: Read both constitutional documents in full. Inspected the 3bf291d2 diff, the journal's unavailable-review release and credential/audience notice branches, and check-change-review's commit-range coverage. Checked the preserved gate log: its sole final failure is Rule 74 coverage for 3bf291d2. All eleven contract checkers pass in the original gate workspace against its saved report and original process/assertion artifacts.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-fulfills-support.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, parser or model decision code changed. The corrected fulfillment test replays recorded proof-room update 715673050. Existing unavailable-release and held-cascade fixtures provide captured uncertain/unavailable verdict neighbors; these are offline replays, not fresh live-provider or deployment evidence.

Subject (2 paths): tests/preview/journal-fulfills-support.test.ts, tests/preview/operator-echo.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: add the missing review for the already passing test repair. No runtime machinery, ability restriction or checker change is needed. Start with the exact rejected commit, retain declaration refusal and send safety floors, and finish with targeted tests plus the existing cheap gates. No autonomous live completion is claimed.
80/20: The recorded failure names one missing review. Keep the passing implementation intact, verify the two corrected tests and captured release/hold neighbors, and use the saved full-run artifacts for contract checks without rerunning the full suite.
VERDICT: author submission; no independent pass is asserted

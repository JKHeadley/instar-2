# Change review — Repair train-204 full-run failures at source

Subject base: e5e7e98ca770992928cd7f15a8594a05bcd076ad
Review state: open
Reviewed content: none
Outcome: the train-204 m5pro full run failed 15 tests in three files; each is repaired where its cause is, with no assertion changed and nothing quarantined. tests/preview/journal-capacity.test.ts executes a slice of the shipped launcher conversion, and reply-review-cause (d3d4a4ec) declared providerFailure one line above the slice's old anchor, so every limit() call threw ReferenceError and the capacity path never fired; the slice now starts at that declaration. tests/preview/journal-reply-grounding.test.ts compared the inspect reply to an exact shape that predates the unavailableChecks field d3d4a4ec added; the expectation now names it (an empty list on this fixture). tests/register/intake-owner.test.ts bundled five whole-tree TypeScript scans into each R1 case, so the case's 60 s budget shrank as src grew 13 percent on this train; each (scope, form) pair is now its own case, and the 50 MB copy-and-commit case carries an explicit 180 s I/O budget. The afterEach hook timeout was collateral of the timed-out case still running.
Affected rules: 37, 116, 36, 102
Affected floors: secrets — no secret read, written or logged; spend cap — no call, reservation or retry added, and the spend-cap capacity case still passes; stop — unchanged, the stop/outbound-refusal capacity case still passes; no duplicate sends — the one-notice-per-topic and lost-receipt cases now run and pass; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test-only edits; no source, prompt, parser or decision changes.
Side effects: intake-owner reports 36 cases instead of 24 (same assertions, split per replacement form). The capacity slice now includes the providerFailure field in the converted result, exactly as the launcher returns it.
Undo and recovery: revert the repair commit; the three files return to their previous form.
Multi-machine posture: machine-local test fixtures only; no state or store.
Layer below: tests/preview/journal-agent.mjs invokeSubscription result conversion (lines 2033-2039 at this head) and the inspect reply projection that calls unavailableChecks from tests/preview/journal.ts; scripts/check-register-wiring.mjs sourceProgram/scanSources, whose cost profiled as spread across TypeScript type-checking of the whole closed graph (directoryExists about 10 percent), so the work is inherent to the scan and scales with src.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-capacity.test.ts
Hook bypass: none
Convergence: none
Decision: t204r-capacity-slice-anchor | start the shipped-conversion slice at the providerFailure declaration rather than inlining a substitute, so the test keeps executing the launcher's own bytes (the test's stated purpose) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-204-repair-110127-PROGRESS.md
Decision: t204r-grounding-shape | update the exact-shape expectation to include unavailableChecks: [] because the field is d3d4a4ec's intended inspect output, not a regression | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-204-repair-110127-PROGRESS.md
Decision: t204r-intake-owner-split | split the R1 cases to one whole-tree scan each and give only the copy-and-commit case a named 180 s I/O budget, instead of raising the shared 60 s budget or optimizing the pinned wiring script | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-204-repair-110127-PROGRESS.md
Prompt review: no prompt, parser or accept, escalate or refuse decision changes. The capacity file replays the captured provider limit envelope tests/fixtures/provider-failure/claude-limit-result.json with the operator's recorded 2026-10-10 session wording through the shipped launcher conversion; before the fix the capacity path never fired on it, after the fix it fires (one topic notice, one desk alert, dedupe across restart and compaction).

1.x comparison: JKHeadley/instar main bfe143d6d6f7 handles usage limits in src/core/UsageWallRescue.ts, src/core/LlmCircuitBreaker.ts and src/core/CodexDeviceLimitJudge.ts, but its src, docs, tests and scripts contain none of unavailableChecks, replyCheckCauses, journal-agent or scanSources (git grep, with a positive control on UsageWallRescue); these are 2.0-only test fixtures, so no 1.x code applies.

Verification: npm run typecheck exit 0; tests/preview/journal-capacity.test.ts and tests/preview/journal-reply-grounding.test.ts 23/23 passed (before the fix 13 failed the same way as the gate); tests/register/intake-owner.test.ts 36/36 passed single-worker at load average 8 to 9 on a 10-core WSL host, longest case 34 s (before the fix the R1 dedup case timed out at 78 s on the same host); npm run lint and npm run register:check exit 0.
Residue: full-run-under-load | low | the four-worker m5pro budget is confirmed only by the Studio pipeline rerun after push.

## Closing block

simplestRobustRoute: two one-line test corrections follow the launcher change they lagged, and the slow fixture pays one scan per case under the existing budget; no new gate, script or quarantine.
80/20: all 15 reported failures are addressed at their cause; the scan's inherent cost is left as is.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
